"""Push-to-talk runner with opt-in calibrated reply playback."""
import math
import argparse
import dataclasses
import signal
import subprocess
import tempfile
import os
import time
import threading
import wave
import logging
from .diagnostics import setup_logging, event
from .voice import gate_pcm
from pathlib import Path
from pynput import keyboard
from .audio import start_recording, speak, encode_attachment, transcribe
from .ax import snapshot, dump
from .config import Config
from .desktop import Desktop
from .replies import watch
from .sound import SoundEvent, play as play_sound, set_enabled as set_sound_enabled, set_volume as set_sound_volume


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


def is_f5(key):
    """Detect F5 keypress across macOS virtual key codes and pynput representations."""
    if key == keyboard.Key.f5:
        return True
    if getattr(key, "vk", None) in (96,):  # 96=Mac F5
        return True
    if getattr(key, "name", None) == "f5":
        return True
    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["inspect", "run", "speak"])
    p.add_argument("--text", default="")
    p.add_argument("--unlocked", action="store_true", help="Unlock system from strict safe mode")
    p.add_argument("--send-mode", choices=["text", "audio"], default=None, help="Send mode: text (Whisper STT) or audio (M4A file)")
    p.add_argument("--voice", action="store_true", help="Opt-in continuous mic / wake-phrase mode")
    p.add_argument("--hotkey", default=None, help="Trigger key (e.g. f8, f6, right_shift)")
    p.add_argument("--verbose", action="store_true", help="Show detailed diagnostics in terminal")
    p.add_argument("--no-sound", "--mute", action="store_true", help="Disable terminal sound effects")
    p.add_argument("--sound-volume", type=float, default=None, help="Master sound volume (0.0 to 1.0)")
    args = p.parse_args()
    setup_logging(args.verbose)
    cfg = Config.from_env()
    if args.unlocked:
        cfg = dataclasses.replace(cfg, safe_mode=False)
    if args.send_mode:
        cfg = dataclasses.replace(cfg, send_mode=args.send_mode)
    if args.hotkey:
        cfg = dataclasses.replace(cfg, hotkey=args.hotkey)
    if args.no_sound:
        cfg = dataclasses.replace(cfg, sound_enabled=False)
    if args.sound_volume is not None:
        cfg = dataclasses.replace(cfg, sound_volume=max(0.0, min(1.0, float(args.sound_volume))))
    set_sound_enabled(cfg.sound_enabled)
    set_sound_volume(cfg.sound_volume)

    try:
        from ApplicationServices import AXIsProcessTrusted, AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt
        if not AXIsProcessTrusted():
            print("\n" + "=" * 60)
            print("⚠️  [ACCESSIBILITY PERMISSION REQUIRED] ⚠️")
            print("This terminal process is NOT trusted by macOS Accessibility.")
            print("macOS blocks reading WhatsApp messages and keyboard hotkeys.")
            print("Please enable your terminal app in:")
            print("  System Settings → Privacy & Security → Accessibility")
            print("=" * 60 + "\n")
            AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: True})
    except Exception:
        pass

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
    sound_status = f"ENABLED (vol {cfg.sound_volume:.1f})" if cfg.sound_enabled else "MUTED"
    print(f"Sound feedback: {sound_status} (tactile terminal audio online).")
    play_sound(SoundEvent.BOOT)
    print("Say Wakeup Jarvis to enter voice mode; press F5 to mute/unmute mic; Esc quits." if args.voice else f"Hold {trigger_hint} to talk; release to send; press Esc to quit.")

    stop = threading.Event()
    watcher = None
    sending = threading.Event()
    user_recording = threading.Event()
    playing = threading.Event()  # Shared by reply playback and the microphone.

    harness = None
    try:
        from .harness import Harness
        harness = Harness()
        print("Harness bridge: ENABLED (headless Mac execution harness online).")
    except Exception as exc:
        print(f"Harness bridge: DISABLED ({exc}).")

    mac_adapter = None
    try:
        from .mac_adapter import MacAdapter
        mac_adapter = MacAdapter()
        print("macOS Harness: ENABLED (native computer-use vision, clicks, keys, and AX inspection online).")
    except Exception as exc:
        print(f"macOS Harness: DISABLED ({exc}).")

    try:
        from .browser_adapter import BrowserAdapter
        BrowserAdapter()
        print("Browser Harness: ENABLED (Chrome background control, AX tree, and domain skills online).")
    except Exception as exc:
        print(f"Browser Harness: DISABLED ({exc}).")

    firecrawl_adapter = None
    try:
        from .firecrawl_adapter import FirecrawlAdapter
        firecrawl_adapter = FirecrawlAdapter(
            api_url=cfg.firecrawl_api_url,
            api_key=cfg.firecrawl_api_key,
            timeout=cfg.firecrawl_timeout,
        )
        print("Firecrawl Engine: ENABLED (self-hosted web scraping, search, crawling, and extraction online).")
    except Exception as exc:
        print(f"Firecrawl Engine: DISABLED ({exc}).")

    loco_adapter = None
    if cfg.locoagent_enabled:
        try:
            from .loco_adapter import LocoAdapter
            loco_adapter = LocoAdapter(
                root=cfg.locoagent_root or None,
                timeout=cfg.locoagent_timeout,
            )
            print("Social Media Engine (LocoAgent): ENABLED (X, LinkedIn, Reddit, Instagram, Facebook, Threads, YouTube, TikTok online).")
        except Exception as exc:
            print(f"Social Media Engine (LocoAgent): DISABLED ({exc}).")

    event("watcher_config", list_calibrated=bool(cfg.message_list_path), direction_calibrated=bool(cfg.incoming_marker), harness=bool(harness), mac_adapter=bool(mac_adapter), firecrawl=bool(firecrawl_adapter), loco=bool(loco_adapter), safe_mode=cfg.safe_mode)
    has_voice = bool(cfg.message_list_path and cfg.incoming_marker and cfg.voice_play_marker and cfg.voice_pause_marker)
    has_tools = bool(cfg.message_list_path and (cfg.incoming_marker or not cfg.safe_mode) and (harness is not None or mac_adapter is not None or firecrawl_adapter is not None or loco_adapter is not None))

    if has_voice or has_tools:
        if has_voice:
            print("Voice reply watcher: ENABLED (incoming notes will play automatically).")
        if has_tools:
            print("Tool call watcher: ENABLED (incoming Jarvis tool calls will execute locally).")
        watcher_state = {}  # played signatures + queue persist across watch windows
        def hear():
            while not stop.is_set():
                try:
                    watch(cfg, stop=stop, state=watcher_state, pause=sending, desk=desk, harness=harness, playing=playing, user_recording=user_recording, mac_adapter=mac_adapter, firecrawl_adapter=firecrawl_adapter, loco_adapter=loco_adapter)
                except Exception as exc:
                    if stop.is_set(): break
                    print(f"\n[Watcher error] {exc} (restarting)")
                    logging.getLogger("openagent.watcher").exception("Watcher restarting")
                    time.sleep(2)
        watcher = threading.Thread(target=hear, daemon=True)
        watcher.start()
    else:
        print("Reply watcher: DISABLED (calibration needed for inbound replies).")
        event("watcher_disabled", level="warning", list_calibrated=bool(cfg.message_list_path), direction_calibrated=bool(cfg.incoming_marker), harness=bool(harness))

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
                # If a voice note is currently playing over speakers, interrupt it immediately!
                if playing.is_set():
                    playing.clear()
                    try:
                        from .replies import pause_active_playback
                        pause_active_playback(snapshot(safe_mode=cfg.safe_mode), cfg, state=watcher_state)
                    except Exception:
                        pass
                    print("\n[Playback interrupted: user speaking...]")

                user_recording.set()
                play_sound(SoundEvent.RECORDING_START)
                fd, name = tempfile.mkstemp(suffix=".wav", prefix="OpenAgent-")
                os.close(fd)
                path = Path(name)
                path.unlink()  # SoX creates its own WAV
                recording = start_recording(path, cfg)
                print(f"\n[Recording started] Speak now... (release {trigger_hint} to send)")
            except Exception as exc:
                user_recording.clear()
                print(f"\nRecording refused: {exc}")
    busy = threading.Lock()
    def release(key):
        nonlocal recording, path
        if not is_release_hotkey(key, cfg.hotkey) or recording is None: return
        proc, recording = recording, None
        recorded_path = path
        play_sound(SoundEvent.RECORDING_STOP)
        print(f"\n[Recording stopped] Processing audio ({cfg.send_mode})...")
        if not busy.acquire(blocking=False):
            proc.terminate()
            user_recording.clear()
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
            if time.monotonic() - last_send < cfg.min_send_interval:
                rem = cfg.min_send_interval - (time.monotonic() - last_send)
                if rem > 0:
                    time.sleep(rem)
            with wave.open(str(recorded_path), "rb") as wav:
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000:
                    raise RuntimeError("Unexpected recording format; not sending")
                pcm = wav.readframes(wav.getnframes())
            if not recorded_path.name.startswith("openagent-voice-"):
                if not gate_pcm(pcm, source="hotkey"):
                    raise RuntimeError("Audio gate rejected silent or mostly quiet clip; not sending")

            # Clear playing so send proceeds cleanly
            if playing.is_set():
                playing.clear()
            sending.set()
            event("send_begin", mode=cfg.send_mode, source="voice" if recorded_path.name.startswith("openagent-voice-") else "hotkey", duration_s=round(len(pcm)/32000, 2))
            if cfg.send_mode == "text":
                print("Transcribing audio locally with Whisper...")
                text = transcribe(recorded_path, cfg)
                print(f"Transcript: \"{text}\"")
                if not text:
                    raise RuntimeError("Empty transcription; not sending.")
                if len(text) > 1000:
                    text = text[:990] + "..."
                if "\n" in text:
                    text = " ".join(text.splitlines())
                desk.send(text)
                play_sound(SoundEvent.MESSAGE_SENT)
                print("Text message sent to WhatsApp.")
            else:
                attachment = encode_attachment(recorded_path)
                print(f"Sending audio file to {cfg.number}...")
                desk.send_audio(attachment)
                play_sound(SoundEvent.MESSAGE_SENT)
                print("Audio attachment sent. WhatsApp backgrounded.")

            last_send = time.monotonic()
            event("send_complete", mode=cfg.send_mode)
        except Exception as exc:
            print("Not sent:", exc)
            event("send_failed", level="warning", reason=str(exc)[:180])
        finally:
            recorded_path.unlink(missing_ok=True)
            if attachment:
                def _cleanup(att):
                    time.sleep(2.0)
                    att.unlink(missing_ok=True)
                threading.Thread(target=_cleanup, args=(attachment,), daemon=True).start()
            sending.clear()
            user_recording.clear()
            busy.release()

    if args.voice:
        if cfg.send_mode != "audio":
            raise RuntimeError("Voice mode sends audio files; select --send-mode audio")
        muted = threading.Event()
        def on_voice_audio(pcm):
            if muted.is_set():
                return
            if playing.is_set():
                event("capture_drop", reason="playback_at_handoff")
                return
            if busy.locked():
                print("[Busy] Utterance dropped; retry after the previous send.")
                return
            user_recording.set()
            fd, name = tempfile.mkstemp(suffix=".wav", prefix="openagent-voice-")
            os.close(fd)
            recorded_path = Path(name)
            with wave.open(str(recorded_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(pcm)
            if not busy.acquire(blocking=False):
                user_recording.clear()
                recorded_path.unlink(missing_ok=True)
                return
            class FinishedRecording:
                def send_signal(self, sig): pass
                def wait(self, timeout=None): return 0
                def kill(self): pass
            threading.Thread(target=process_recording, args=(FinishedRecording(), recorded_path), daemon=True).start()
        from .voice import listen
        try:
            def on_voice_key(key):
                if key == keyboard.Key.esc:
                    stop.set()
                    return False
                if is_f5(key):
                    if muted.is_set():
                        muted.clear()
                        play_sound(SoundEvent.MIC_UNMUTE)
                        print("\n🟢 [MIC UNMUTED] Microphone live (listening). Press F5 to mute.")
                    else:
                        muted.set()
                        play_sound(SoundEvent.MIC_MUTE)
                        print("\n🔴 [MIC MUTED] Microphone completely muted (input blocked). Press F5 to unmute.")
                    return
                if is_hotkey(key, cfg.hotkey):
                    if playing.is_set():
                        playing.clear()
                        try:
                            from .replies import pause_active_playback
                            pause_active_playback(snapshot(safe_mode=cfg.safe_mode), cfg)
                        except Exception:
                            pass
                        print("\n[Playback interrupted: user hotkey...]")
            with keyboard.Listener(on_press=on_voice_key):
                listen(cfg, on_voice_audio, stop, playing=playing, user_recording=user_recording, muted=muted)
        finally:
            stop.set()
            if harness:
                try: harness.close()
                except Exception: pass
        return

    try:
        with keyboard.Listener(on_press=press, on_release=release) as listener:
            listener.join()
    finally:
        stop.set()
        if harness:
            try: harness.close()
            except Exception: pass

if __name__ == "__main__": main()


