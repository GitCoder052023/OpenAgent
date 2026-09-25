"""Push-to-talk runner with opt-in calibrated reply playback."""
import argparse
import signal
import subprocess
import tempfile
import os
import time
import threading
from pathlib import Path
from pynput import keyboard
from .audio import start_recording, speak, encode_attachment
from .ax import snapshot, dump
from .config import Config
from .desktop import Desktop
from .replies import watch


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["inspect", "run", "speak"])
    p.add_argument("--text", default="")
    args = p.parse_args()
    cfg = Config.from_env()
    desk = Desktop(cfg)
    if args.command == "inspect":
        print(dump(snapshot()))
        return
    if args.command == "speak":
        speak(args.text)
        return
    desk.assert_locked()
    print(f"Locked to visible WhatsApp header {cfg.number}. Hold F8 to talk; press Esc to quit.")
    print("Voice watcher is opt-in, requires calibrated incoming voice AX markers; read docs/limitations.md.")
    recording = None
    path = None
    last_send = 0.0
    stop = threading.Event()
    watcher = None
    def press(key):
        nonlocal recording, path
        if key == keyboard.Key.esc:
            stop.set()
            if recording: recording.terminate()
            return False
        if key == keyboard.Key.f8 and recording is None and not busy.locked():
            try:
                desk.assert_locked()
                fd, name = tempfile.mkstemp(suffix=".wav", prefix="jarvis-bridge-")
                os.close(fd)
                path = Path(name)
                path.unlink()  # SoX creates its own WAV
                recording = start_recording(path, cfg)
                print("Recording... release F8 to attach audio")
            except Exception as exc: print(f"Recording refused: {exc}")
    busy = threading.Lock()
    def release(key):
        nonlocal recording, path
        if key != keyboard.Key.f8 or recording is None: return
        proc, recording = recording, None
        recorded_path = path
        if not busy.acquire(blocking=False):
            proc.terminate()
            print("Previous request still running; dropped this recording.")
            return
        threading.Thread(target=process_recording, args=(proc, recorded_path), daemon=True).start()
    def process_recording(proc, recorded_path):
        nonlocal last_send, watcher
        attachment = None
        try:
            proc.send_signal(signal.SIGINT)
            try: proc.wait(timeout=3)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait()
            if stop.is_set(): return
            if not recorded_path.exists() or recorded_path.stat().st_size < 4000: raise RuntimeError("No audio captured")
            if time.monotonic() - last_send < cfg.min_send_interval: raise RuntimeError("Rate limit: wait before sending again")
            attachment = encode_attachment(recorded_path)
            desk.send_audio(attachment)
            last_send = time.monotonic()
            print("Audio attachment submitted. Watching for incoming voice notes if calibrated; text is silent.")
            if cfg.message_list_path and cfg.incoming_marker and cfg.voice_play_marker and cfg.voice_pause_marker:
                def hear():
                    try: watch(cfg, stop=stop)
                    except Exception as exc: print("Reply watch stopped:", exc)
                if watcher and watcher.is_alive():
                    print("Previous reply watch still active; no second watcher started.")
                else:
                    watcher = threading.Thread(target=hear, daemon=True)
                    watcher.start()
            else: print("Reply watch not configured; check WhatsApp manually.")
        except Exception as exc: print("Not sent:", exc)
        finally:
            recorded_path.unlink(missing_ok=True)
            if attachment: attachment.unlink(missing_ok=True)
            busy.release()
    with keyboard.Listener(on_press=press, on_release=release) as listener:
        listener.join()
    stop.set()

if __name__ == "__main__": main()
