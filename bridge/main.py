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


def is_hotkey(key, name):
    name = (name or "f8").strip().lower()
    if name in ("f8", "8"):
        if key in (keyboard.Key.f8, keyboard.Key.media_play_pause):
            return True
        if getattr(key, "vk", None) in (100, 28, 91):  # 100=F8, 28=Mac ANSI 8, 91=Numpad 8
            return True
        if getattr(key, "char", None) == "8":
            return True
        return False
    elif name in ("f6", "6"):
        if key == keyboard.Key.f6 or getattr(key, "vk", None) in (97, 22, 88):
            return True
        if getattr(key, "char", None) == "6":
            return True
        return False
    elif name in ("shift_r", "right_shift"):
        return key == keyboard.Key.shift_r
    elif name in ("ctrl_r", "right_ctrl"):
        return key == keyboard.Key.ctrl_r
    elif name in ("cmd_r", "right_cmd"):
        return key == keyboard.Key.cmd_r
    else:
        char = getattr(key, "char", None)
        if char and str(char).lower() == name:
            return True
        target = getattr(keyboard.Key, name, None)
        return key == target


def is_release_hotkey(key, name):
    # Only the configured hotkey ends a recording. A bare Fn release (vk 63)
    # must NOT stop it: on keyboards where F8 needs Fn, lifting Fn a beat
    # early would truncate the recording to a fraction of a second.
    return is_hotkey(key, name)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["inspect", "run", "speak"])
    p.add_argument("--text", default="")
    p.add_argument("--unlocked", action="store_true", help="Unlock system from strict safe mode")
    p.add_argument("--send-mode", choices=["text", "audio"], default=None, help="Send mode: text (Whisper STT) or audio (M4A file)")
    p.add_argument("--hotkey", default=None, help="Trigger key (e.g. f8, f6, right_shift)")
    args = p.parse_args()
    cfg = Config.from_env()
    if args.unlocked:
        cfg = dataclasses.replace(cfg, safe_mode=False)
    if args.send_mode:
        cfg = dataclasses.replace(cfg, send_mode=args.send_mode)
    if args.hotkey:
        cfg = dataclasses.replace(cfg, hotkey=args.hotkey)

    desk = Desktop(cfg)
    if args.command == "inspect":
        print(dump(snapshot(safe_mode=cfg.safe_mode)))
        return
    if args.command == "speak":
        speak(args.text)
        return
    desk.assert_locked()
    from .ax import hide_whatsapp
    hide_whatsapp()

    status_str = "UNLOCKED (safe mode disabled)" if not cfg.safe_mode else "LOCKED (safe mode active)"
    hotkey_name = cfg.hotkey.upper()
    if cfg.hotkey.lower() in ("f8", "8"):
        trigger_hint = "F8 (or 8)"
    elif cfg.hotkey.lower() in ("f6", "6"):
        trigger_hint = "F6 (or 6)"
    else:
        trigger_hint = hotkey_name
    print(f"[{status_str}] Destination: {cfg.number} | Mode: {cfg.send_mode} | Hotkey: {hotkey_name}")
    print(f"WhatsApp: BACKGROUND / HIDDEN (screen remains clean and private).")
    print(f"Hold {trigger_hint} to talk; release to send; press Esc to quit.")

    stop = threading.Event()
    watcher = None
    if cfg.message_list_path and cfg.incoming_marker and cfg.voice_play_marker and cfg.voice_pause_marker:
        print("Voice reply watcher: ENABLED (incoming notes will play automatically).")
        watcher_state = {}  # played signatures + queue persist across watch windows
        def hear():
            while not stop.is_set():
                try:
                    watch(cfg, stop=stop, state=watcher_state)
                except Exception as exc:
                    if stop.is_set(): break
                    print(f"\n[Watcher error] {exc} (restarting)")
                    time.sleep(2)
        watcher = threading.Thread(target=hear, daemon=True)
        watcher.start()
    else:
        print("Voice reply watcher: DISABLED (calibration needed for inbound voice playback).")

    recording = None
    path = None
    last_send = 0.0
    def press(key):
        nonlocal recording, path
        if key == keyboard.Key.esc:
            stop.set()
            if recording: recording.terminate()
            return False
        if is_hotkey(key, cfg.hotkey) and recording is None and not busy.locked():
            try:
                fd, name = tempfile.mkstemp(suffix=".wav", prefix="jarvis-bridge-")
                os.close(fd)
                path = Path(name)
                path.unlink()  # SoX creates its own WAV
                recording = start_recording(path, cfg)
                print(f"\n[Recording started] Speak now... (release {trigger_hint} to send)")
            except Exception as exc: print(f"\nRecording refused: {exc}")
    busy = threading.Lock()
    def release(key):
        nonlocal recording, path
        if not is_release_hotkey(key, cfg.hotkey) or recording is None: return
        proc, recording = recording, None
        recorded_path = path
        print(f"\n[Recording stopped] Processing audio ({cfg.send_mode})...")
        if not busy.acquire(blocking=False):
            proc.terminate()
            print("Previous request still running; dropped this recording.")
            return
        threading.Thread(target=process_recording, args=(proc, recorded_path), daemon=True).start()
    def process_recording(proc, recorded_path):
        nonlocal last_send
        attachment = None
        try:
            proc.send_signal(signal.SIGINT)
            try: proc.wait(timeout=3)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait()
            if stop.is_set(): return
            if not recorded_path.exists() or recorded_path.stat().st_size < 1000: raise RuntimeError("No audio captured")
            if recorded_path.stat().st_size < 32000: raise RuntimeError("Recording too short (<1s); not sending")
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
                print(f"Sending audio file to {cfg.number}...")
                desk.send_audio(attachment)
                print("Audio attachment sent. WhatsApp backgrounded.")

            last_send = time.monotonic()
        except Exception as exc: print("Not sent:", exc)
        finally:
            recorded_path.unlink(missing_ok=True)
            if attachment: attachment.unlink(missing_ok=True)
            busy.release()

    with keyboard.Listener(on_press=press, on_release=release) as listener:
        listener.join()
    stop.set()

if __name__ == "__main__": main()
