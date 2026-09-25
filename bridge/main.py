"""Push-to-talk runner with opt-in calibrated reply playback."""
import argparse
import dataclasses
import signal
import subprocess
import tempfile
import os
import time
import threading
from pathlib import Path
from pynput import keyboard
from .audio import start_recording, speak, encode_attachment, transcribe
from .ax import snapshot, dump
from .config import Config
from .desktop import Desktop
from .replies import watch


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["inspect", "run", "speak"])
    p.add_argument("--text", default="")
    p.add_argument("--unlocked", action="store_true", help="Unlock system from strict safe mode")
    p.add_argument("--send-mode", choices=["text", "audio"], default=None, help="Send mode: text (Whisper STT) or audio (M4A file)")
    args = p.parse_args()
    cfg = Config.from_env()
    if args.unlocked:
        cfg = dataclasses.replace(cfg, safe_mode=False)
    if args.send_mode:
        cfg = dataclasses.replace(cfg, send_mode=args.send_mode)

    desk = Desktop(cfg)
    if args.command == "inspect":
        print(dump(snapshot(safe_mode=cfg.safe_mode)))
        return
    if args.command == "speak":
        speak(args.text)
        return
    desk.assert_locked()
    status_str = "UNLOCKED (safe mode disabled)" if not cfg.safe_mode else "LOCKED (safe mode active)"
    print(f"[{status_str}] Destination: {cfg.number} | Mode: {cfg.send_mode}")
    print("Hold F8 to talk; release to send; press Esc to quit.")
    if cfg.message_list_path and cfg.incoming_marker and cfg.voice_play_marker and cfg.voice_pause_marker:
        print("Voice reply watcher: ENABLED (incoming notes will play automatically).")
    else:
        print("Voice reply watcher: DISABLED (calibration needed for inbound voice playback).")

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
                print(f"Recording... release F8 to send ({cfg.send_mode})")
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

            if cfg.send_mode == "text":
                print("Transcribing audio locally with Whisper...")
                text = transcribe(recorded_path, cfg)
                print(f"Transcript: \"{text}\"")
                if not text:
                    raise RuntimeError("Empty transcription; not sending.")
                desk.send(text)
                print("Text message sent to WhatsApp.")
            else:
                attachment = encode_attachment(recorded_path)
                desk.send_audio(attachment)
                print("Audio attachment submitted.")

            last_send = time.monotonic()
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
