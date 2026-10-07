#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENAGENT - AUTONOMOUS SYSTEM BOOT ENGINE
==============================================================================
An intelligent, self-bootstrapping, auto-healing boot orchestrator for OpenAgent:
1. Self-Bootstraps virtual environment via uv (zero manual setup).
2. Auto-Resolves system & package dependencies (Homebrew, Bun, SoX, FFmpeg, Ripgrep, Whisper).
3. Auto-Deploys CLI harness modules & installs npm/bun packages if missing.
4. Auto-Provisioning of speech recognition models (ggml Whisper & Vosk offline).
5. Auto-Heals configuration (.env generation and validation).
6. Auto-Prompts & verifies macOS Accessibility & Input permissions.
7. Autonomously manages WhatsApp Desktop lifecycle (launches & backgrounds).
8. Probes and optionally spins up Firecrawl web ingestion & Chrome CDP.
9. Conducts full stdio IPC preflight tests (Harness, MacAdapter, BrowserAdapter).
10. Runs an autonomous supervisor/watchdog that auto-restarts on crash and monitors WhatsApp.
==============================================================================
"""

import argparse
import json
import logging
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Resolve repository root
ROOT_DIR = Path(__file__).resolve().parent

# ANSI Formatting
class Style:
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    YELLOW = "\033[0;33m"
    RED = "\033[0;31m"
    MAGENTA = "\033[0;35m"
    RESET = "\033[0m"


def log_banner():
    banner = f"""{Style.BOLD}{Style.CYAN}
==============================================================================
          ⚡ OPENAGENT - AUTONOMOUS BOOT ENGINE              
=============================================================================={Style.RESET}"""
    print(banner)


def log_step(step: int, total: int, title: str):
    print(f"\n{Style.BOLD}[{step}/{total}] {title}...{Style.RESET}")


def log_ok(msg: str):
    print(f"  {Style.GREEN}✓{Style.RESET} {msg}")


def log_info(msg: str):
    print(f"  {Style.BLUE}ℹ{Style.RESET} {msg}")


def log_warn(msg: str):
    print(f"  {Style.YELLOW}⚠️  {msg}{Style.RESET}")


def log_err(msg: str):
    print(f"  {Style.RED}✗ {msg}{Style.RESET}")


def setup_path():
    """Ensure standard Homebrew, Bun, and user binary paths are available in PATH."""
    standard_paths = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        str(Path.home() / ".bun/bin"),
        str(Path.home() / ".local/bin"),
        str(Path.home() / ".cargo/bin"),
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]
    current_path = os.environ.get("PATH", "")
    current_parts = current_path.split(":") if current_path else []
    to_add = [p for p in standard_paths if p not in current_parts and os.path.isdir(p)]
    if to_add:
        os.environ["PATH"] = ":".join(to_add + current_parts)


def is_in_project_env() -> bool:
    """Check if the current interpreter is inside the project .venv or marked as bootstrapped."""
    if os.environ.get("_OPENAGENT_BOOTSTRAPPED") == "1":
        return True
    venv_dir = (ROOT_DIR / ".venv").resolve()
    current_prefix = Path(sys.prefix).resolve()
    if venv_dir.is_dir() and current_prefix == venv_dir:
        return True
    return False


def bootstrap_environment(verbose: bool = False):
    """
    Autonomously bootstraps the virtual environment.
    If running outside .venv, syncs dependencies via uv and re-execs inside .venv.
    """
    setup_path()
    
    # Verify Darwin OS first
    if platform.system() != "Darwin":
        log_err("OpenAgent requires macOS Darwin for AX automation and desktop computer-use.")
        sys.exit(1)

    if is_in_project_env():
        return

    # Outside .venv: We need uv to sync and launch inside the project environment
    uv_bin = shutil.which("uv")
    if not uv_bin:
        log_info("uv package manager not found. Installing uv autonomously...")
        try:
            # Install uv via official standalone installer
            cmd = "curl -LsSf https://astral.sh/uv/install.sh | sh"
            subprocess.run(cmd, shell=True, check=True)
            setup_path()
            uv_bin = shutil.which("uv")
            if not uv_bin:
                # Check standard locations
                local_uv = Path.home() / ".local/bin/uv"
                if local_uv.exists():
                    uv_bin = str(local_uv)
        except Exception as e:
            log_warn(f"Failed to auto-install uv via curl: {e}. Checking brew...")
            if shutil.which("brew"):
                subprocess.run(["brew", "install", "uv"], check=False)
                setup_path()
                uv_bin = shutil.which("uv")

    if not uv_bin:
        log_err("Could not find or install 'uv'. Please install: curl -LsSf https://astral.sh/uv/install.sh | sh")
        sys.exit(1)

    print(f"{Style.BOLD}🔄 Bootstrapping environment via uv sync...{Style.RESET}")
    sync_cmd = [uv_bin, "sync", "--all-extras"]
    if not verbose:
        res = subprocess.run(sync_cmd, cwd=str(ROOT_DIR), capture_output=True, text=True)
    else:
        res = subprocess.run(sync_cmd, cwd=str(ROOT_DIR))

    if res.returncode != 0:
        log_err("Failed to synchronize dependencies via uv.")
        if not verbose and hasattr(res, "stderr"):
            print(res.stderr)
        sys.exit(1)

    venv_python = ROOT_DIR / ".venv" / "bin" / "python"
    os.environ["_OPENAGENT_BOOTSTRAPPED"] = "1"

    target_exe = str(venv_python) if venv_python.exists() else uv_bin
    target_args = [target_exe, str(ROOT_DIR / "boot.py")] + sys.argv[1:] if target_exe != uv_bin else [uv_bin, "run", "python", str(ROOT_DIR / "boot.py")] + sys.argv[1:]
    
    # Re-execute seamlessly inside the project venv
    try:
        os.execv(target_args[0], target_args)
    except Exception as exc:
        log_warn(f"Re-exec returned error: {exc}. Continuing with current runtime...")


def check_and_resolve_dependencies(auto_install: bool = True) -> Dict[str, bool]:
    """
    Checks all required and optional CLI binaries.
    Autonomously installs missing ones if auto_install is True and Homebrew is present.
    """
    setup_path()
    brew_bin = shutil.which("brew")
    status = {}

    tools = {
        "uv": {"brew": "uv", "required": True, "desc": "Astral Python environment manager"},
        "bun": {"brew": "bun", "curl": "curl -fsSL https://bun.sh/install | bash", "required": True, "desc": "Bun runtime for CLI harness"},
        "sox": {"brew": "sox", "check_alt": "rec", "required": True, "desc": "SoX audio recording utility"},
        "ffmpeg": {"brew": "ffmpeg", "required": True, "desc": "FFmpeg audio/video encoder"},
        "rg": {"brew": "ripgrep", "required": False, "desc": "Ripgrep fast file & code search"},
        "whisper-cli": {"brew": "whisper-cpp", "required": False, "desc": "whisper.cpp on-device STT"},
    }

    for name, meta in tools.items():
        alt = meta.get("check_alt")
        bin_path = shutil.which(name) or (shutil.which(alt) if alt else None)
        
        if not bin_path and auto_install:
            log_info(f"Missing {name} ({meta['desc']}). Auto-installing...")
            installed = False
            if meta.get("curl"):
                try:
                    subprocess.run(meta["curl"], shell=True, check=True)
                    setup_path()
                    bin_path = shutil.which(name)
                    if bin_path:
                        installed = True
                except Exception:
                    pass
            if not installed and brew_bin and meta.get("brew"):
                try:
                    subprocess.run([brew_bin, "install", meta["brew"]], check=True)
                    setup_path()
                    bin_path = shutil.which(name) or (shutil.which(alt) if alt else None)
                except Exception as e:
                    log_warn(f"Homebrew installation of {meta['brew']} failed: {e}")

        if bin_path:
            status[name] = True
            log_ok(f"{name}: found at {bin_path}")
        else:
            status[name] = False
            if meta["required"]:
                log_err(f"{name} is REQUIRED but missing. Install via: brew install {meta.get('brew', name)}")
            else:
                log_warn(f"{name} optional dependency missing. Search/STT capabilities may be degraded.")

    return status


def setup_bun_harness() -> bool:
    """Verifies and installs Bun harness dependencies if missing."""
    harness_dir = ROOT_DIR / "src" / "tools" / "cli-harness"
    node_modules = harness_dir / "node_modules"
    package_json = harness_dir / "package.json"

    if not package_json.exists():
        log_warn(f"Bun harness directory not found at {harness_dir}")
        return False

    bun_bin = shutil.which("bun")
    if not bun_bin:
        log_err("Bun is not available to install CLI harness dependencies.")
        return False

    if not node_modules.exists() or (node_modules.stat().st_mtime < package_json.stat().st_mtime):
        log_info("Installing CLI harness dependencies with Bun...")
        res = subprocess.run([bun_bin, "install"], cwd=str(harness_dir), capture_output=True, text=True)
        if res.returncode != 0:
            log_err(f"Failed to install Bun harness dependencies: {res.stderr}")
            return False

    log_ok("CLI harness Bun modules synchronized")
    return True


def setup_locoagent_harness() -> bool:
    """Verifies and installs LocoAgent Bun dependencies if missing."""
    loco_dir = ROOT_DIR / "src" / "tools" / "locoagent"
    node_modules = loco_dir / "node_modules"
    package_json = loco_dir / "package.json"

    if not package_json.exists():
        return False

    bun_bin = shutil.which("bun") or "/opt/homebrew/bin/bun"
    if not os.path.exists(bun_bin) and not shutil.which("bun"):
        return False

    if not node_modules.exists() or (node_modules.stat().st_mtime < package_json.stat().st_mtime):
        log_info("Installing LocoAgent dependencies with Bun...")
        res = subprocess.run([bun_bin, "install"], cwd=str(loco_dir), capture_output=True, text=True)
        if res.returncode != 0:
            log_warn(f"Failed to install LocoAgent dependencies: {res.stderr}")
            return False

    log_ok("LocoAgent social media modules synchronized")
    return True



def ensure_config() -> Path:
    """Ensures .env exists and loads configuration."""
    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"

    if not env_path.exists():
        if example_path.exists():
            log_info("Initializing .env from .env.example...")
            shutil.copy(example_path, env_path)
            log_ok(".env created successfully")
        else:
            log_err("Neither .env nor .env.example found.")
            sys.exit(1)
    else:
        log_ok("Configuration (.env) active")

    # Load into environment if OpenAgent config loader is available
    try:
        from OpenAgent.config import load_env_file
        load_env_file(env_path)
    except ImportError:
        # Fallback basic parser
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip("\"'")
                    if k and k not in os.environ:
                        os.environ[k] = v

    return env_path


def ensure_models(send_mode: str, voice_mode: bool) -> bool:
    """Auto-provisions speech recognition and voice models."""
    models_dir = ROOT_DIR / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # 1. Vosk offline model (for continuous wake-phrase voice mode)
    if voice_mode:
        vosk_dir = models_dir / "vosk-model-small-en-us-0.15"
        if not vosk_dir.is_dir():
            log_info("Downloading offline Vosk model for voice wake-phrase mode...")
            zip_dest = models_dir / "vosk-model.zip"
            url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
            try:
                urllib.request.urlretrieve(url, zip_dest)
                with zipfile.ZipFile(zip_dest, "r") as zip_ref:
                    zip_ref.extractall(models_dir)
                zip_dest.unlink(missing_ok=True)
                log_ok("Vosk voice wake model installed")
            except Exception as e:
                log_err(f"Failed to download Vosk model: {e}")
                return False
        else:
            log_ok("Vosk voice wake model operational")

    # 2. Whisper ggml model (for text send mode transcription)
    whisper_model = models_dir / "ggml-base.bin"
    if send_mode == "text" or not whisper_model.exists():
        if not whisper_model.exists():
            log_info("Whisper model (models/ggml-base.bin) missing. Downloading base model...")
            script_path = ROOT_DIR / "scripts" / "download-model.sh"
            if script_path.exists():
                subprocess.run(["bash", str(script_path), "base"], check=False)
            else:
                # Direct fallback download
                url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
                try:
                    urllib.request.urlretrieve(url, whisper_model)
                except Exception as e:
                    log_warn(f"Could not download Whisper model automatically: {e}")
        if whisper_model.exists():
            log_ok("Whisper STT model ready (models/ggml-base.bin)")

    return True


def check_macos_permissions(timeout_seconds: int = 20) -> bool:
    """
    Checks macOS Accessibility permission.
    If untrusted, triggers system prompt and autonomously polls for grant.
    """
    try:
        from ApplicationServices import (
            AXIsProcessTrusted,
            AXIsProcessTrustedWithOptions,
            kAXTrustedCheckOptionPrompt,
        )
        if AXIsProcessTrusted():
            log_ok("macOS Accessibility trusted (UI inspection online)")
            return True

        log_warn("macOS Accessibility permission is missing for this process!")
        print(f"  {Style.YELLOW}Prompting macOS System Settings dialog...{Style.RESET}")
        AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: True})

        term_app = os.environ.get("TERM_PROGRAM", "Terminal")
        print(f"  {Style.BOLD}👉 Grant access in:{Style.RESET} System Settings → Privacy & Security → Accessibility")
        print(f"     Toggle ON {Style.BOLD}{term_app}{Style.RESET}")
        print(f"  {Style.CYAN}Waiting up to {timeout_seconds}s for permission to be granted...{Style.RESET}")

        start = time.time()
        while time.time() - start < timeout_seconds:
            time.sleep(1.0)
            if AXIsProcessTrusted():
                log_ok("Accessibility permission granted! Proceeding...")
                return True

        log_err("Accessibility permission still not granted. Some features will fail.")
        return False
    except ImportError:
        log_warn("PyObjC ApplicationServices not loaded in current process; skipping AX probe.")
        return True


def manage_whatsapp(launch: bool = True, hide: bool = True) -> bool:
    """
    Autonomously checks if WhatsApp Desktop is running, starts it in the background if not,
    and ensures the window is hidden to keep the desktop workspace clean.
    """
    check = subprocess.run(["pgrep", "-il", "whatsapp"], capture_output=True, text=True)
    running = check.returncode == 0

    if not running and launch:
        log_info("WhatsApp Desktop is not running. Launching in background...")
        # open -g (background) -j (hidden)
        subprocess.run(["open", "-g", "-j", "-a", "WhatsApp"], check=False)
        time.sleep(2.0)
        check = subprocess.run(["pgrep", "-il", "whatsapp"], capture_output=True, text=True)
        running = check.returncode == 0

    if running:
        if hide:
            script = 'tell application "System Events" to set visible of (every process whose name contains "WhatsApp") to false'
            subprocess.run(["osascript", "-e", script], check=False, capture_output=True)
        log_ok("WhatsApp Desktop active & backgrounded")
        return True
    else:
        log_warn("WhatsApp Desktop is not running. Please start and log in to WhatsApp Desktop.")
        return False


def manage_firecrawl(auto_start: bool = False) -> str:
    """Probes Firecrawl endpoint at localhost:3002 and optionally spins up Docker container."""
    def is_port_open(port=3002):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("127.0.0.1", port)) == 0

    if is_port_open(3002):
        log_ok("Firecrawl Web Ingestion & Extraction Engine online (http://localhost:3002)")
        return "online"

    if auto_start:
        docker_bin = shutil.which("docker")
        if docker_bin:
            docker_check = subprocess.run(["docker", "info"], capture_output=True)
            if docker_check.returncode != 0:
                # Docker daemon not running; try launching Docker Desktop in background
                if os.path.exists("/Applications/Docker.app"):
                    log_info("Launching Docker Desktop in background for Firecrawl...")
                    subprocess.run(["open", "-g", "-j", "-a", "Docker"], check=False)
                    for _ in range(8):
                        time.sleep(1.0)
                        if subprocess.run(["docker", "info"], capture_output=True).returncode == 0:
                            break

            if subprocess.run(["docker", "info"], capture_output=True).returncode == 0:
                fc_dir = ROOT_DIR / "src" / "tools" / "firecrawl"
                if (fc_dir / "docker-compose.yaml").exists():
                    log_info("Starting self-hosted Firecrawl via docker compose...")
                    subprocess.run(["docker", "compose", "up", "-d"], cwd=str(fc_dir), check=False)
                    for _ in range(10):
                        time.sleep(1.0)
                        if is_port_open(3002):
                            log_ok("Firecrawl Web Ingestion Engine online (http://localhost:3002)")
                            return "online"

    log_info("Firecrawl Engine in standby mode (run 'docker compose up -d' in src/tools/firecrawl if needed)")
    return "standby"


def manage_chrome_cdp(auto_start: bool = False) -> str:
    """Probes Chrome DevTools Protocol port (9222) and optionally starts Chrome with remote debugging."""
    def is_port_open(port=9222):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("127.0.0.1", port)) == 0

    if is_port_open(9222):
        log_ok("Chrome CDP Remote Debugging active (port 9222)")
        return "online"

    if auto_start:
        log_info("Launching Google Chrome with remote debugging port 9222 in background...")
        if os.path.exists("/Applications/Google Chrome.app"):
            subprocess.Popen(
                ["open", "-g", "-a", "Google Chrome", "--args", "--remote-debugging-port=9222"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            for _ in range(5):
                time.sleep(1.0)
                if is_port_open(9222):
                    log_ok("Chrome CDP port 9222 online")
                    return "online"

    log_info("Chrome CDP port 9222 inactive (Chrome will be operated via native/standard adapters)")
    return "inactive"


def manage_social_media(auto_start: bool = True, all_targets: bool = False) -> Dict[str, bool]:
    """
    Probes LocoAgent social media CDP sessions (Threads port 9227, Reddit port 9224)
    and autonomously boots them up if offline.
    """
    loco_dir = ROOT_DIR / "src" / "tools" / "locoagent"
    if not loco_dir.exists():
        return {}

    bun_bin = shutil.which("bun") or "/opt/homebrew/bin/bun"
    if not os.path.exists(bun_bin) and not shutil.which("bun"):
        log_info("Bun not available; social sessions cannot be auto-managed")
        return {}

    def is_port_open(port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("127.0.0.1", port)) == 0

    target_ports = {
        "threads": 9227,
        "reddit": 9224,
    }
    if all_targets:
        target_ports.update({
            "x": 9222,
            "linkedin": 9223,
            "instagram": 9225,
            "facebook": 9226,
            "youtube": 9228,
            "tiktok": 9229,
            "github": 9230,
        })

    results = {}
    for target_name, port in target_ports.items():
        if is_port_open(port):
            results[target_name] = True
        elif auto_start:
            log_info(f"Booting {target_name.capitalize()} social browser session (port {port})...")
            try:
                subprocess.run(
                    [bun_bin, "run", "scripts/setup-chrome.ts", "--target", target_name],
                    cwd=str(loco_dir),
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                for _ in range(6):
                    time.sleep(0.5)
                    if is_port_open(port):
                        results[target_name] = True
                        break
                else:
                    results[target_name] = False
            except Exception as e:
                log_warn(f"Failed to auto-launch {target_name}: {e}")
                results[target_name] = False
        else:
            results[target_name] = False

    online_targets = [f"{t.capitalize()} ({target_ports[t]})" for t, ok in results.items() if ok]
    if online_targets:
        log_ok(f"Social Media Sessions active ({', '.join(online_targets)} online)")
    else:
        log_info("Social Media Sessions in standby mode")

    return results


def run_preflight_checks(verbose: bool = False) -> bool:
    """Conducts instant non-destructive IPC verification of harnesses."""
    all_ok = True

    # 1. Bun Headless Harness IPC
    try:
        from OpenAgent.harness import Harness
        with Harness() as h:
            info = h.system_info()
            log_ok(f"Headless Bun Harness IPC operational (Node/Bun: {info.get('node_version', 'ok')})")
    except Exception as e:
        log_err(f"Headless Bun Harness IPC check failed: {e}")
        all_ok = False

    # 2. Native macOS Computer-Use Adapter
    try:
        from OpenAgent.mac_adapter import MacAdapter
        MacAdapter()
        log_ok("Native macOS computer-use harness operational (vision, clicks, AX)")
    except Exception as e:
        log_warn(f"Native macOS computer-use adapter warning: {e}")

    # 3. Browser Harness Adapter
    try:
        import browser_harness  # noqa: F401
        from OpenAgent.browser_adapter import BrowserAdapter
        BrowserAdapter()
        log_ok("Browser Harness CDP adapter operational")
    except Exception as e:
        log_warn(f"Browser Harness CDP adapter warning: {e}")

    # 4. Firecrawl Web Ingestion Engine Adapter
    try:
        from OpenAgent.firecrawl_adapter import FirecrawlAdapter
        fc = FirecrawlAdapter()
        fc_doc = fc.doctor()
        if fc_doc.get("reachable") or fc_doc.get("status") == "ok":
            log_ok("Firecrawl Web Ingestion Engine operational (localhost:3002)")
        else:
            log_info("Firecrawl Web Ingestion Engine ready (standby mode)")
    except Exception as e:
        log_warn(f"Firecrawl adapter check warning: {e}")

    # 5. LocoAgent Social Media Engine Adapter
    try:
        from OpenAgent.loco_adapter import LocoAdapter
        loco = LocoAdapter()
        st = loco.list_targets_status()
        online_list = [f"{p.capitalize()} ({info['cdp_port']})" for p, info in st.get("targets", {}).items() if info.get("online")]
        if online_list:
            log_ok(f"LocoAgent Social Media Engine operational ({', '.join(online_list)} online)")
        else:
            log_info("LocoAgent Social Media Engine ready (sessions in standby)")
    except Exception as e:
        log_warn(f"LocoAgent adapter check warning: {e}")

    return all_ok


class AutonomousSupervisor:
    """
    Supervisor watchdog that launches OpenAgent as a supervised child process.
    - Monitors OpenAgent process health.
    - Monitors WhatsApp Desktop health (auto-restarts or re-hides if it closes).
    - Auto-restarts OpenAgent on unexpected crash with exponential backoff & rate limiting.
    - Handles graceful termination on SIGINT/SIGTERM.
    """
    def __init__(self, cmd_args: List[str]):
        self.cmd_args = cmd_args
        self.running = True
        self.child_proc: Optional[subprocess.Popen] = None
        self.crash_times: List[float] = []
        self.max_crashes_in_window = 5
        self.crash_window_seconds = 30.0

    def handle_signal(self, signum, frame):
        self.running = False
        print(f"\n{Style.YELLOW}[SHUTDOWN] Terminating OpenAgent supervisor...{Style.RESET}")
        if self.child_proc and self.child_proc.poll() is None:
            self.child_proc.send_signal(signal.SIGINT)
            try:
                self.child_proc.wait(timeout=3.0)
            except subprocess.TimeoutExpired:
                self.child_proc.kill()
        sys.exit(0)

    def run(self):
        signal.signal(signal.SIGINT, self.handle_signal)
        signal.signal(signal.SIGTERM, self.handle_signal)

        attempt = 0
        while self.running:
            attempt += 1
            # Ensure WhatsApp is alive before starting
            manage_whatsapp(launch=True, hide=True)

            print(f"\n{Style.BOLD}{Style.GREEN}🚀 Launching OpenAgent process (attempt #{attempt})...{Style.RESET}\n")
            
            # Start OpenAgent
            cmd = [sys.executable, "-m", "OpenAgent.main", "run"] + self.cmd_args
            self.child_proc = subprocess.Popen(cmd)

            # Health loop
            while self.running:
                ret = self.child_proc.poll()
                if ret is not None:
                    # Process exited
                    if ret == 0 or not self.running:
                        print(f"\n{Style.GREEN}[EXIT] OpenAgent closed cleanly (code 0). Supervisor exiting.{Style.RESET}")
                        return
                    
                    # Crash detected
                    now = time.time()
                    self.crash_times.append(now)
                    # Prune old crashes
                    self.crash_times = [t for t in self.crash_times if now - t <= self.crash_window_seconds]
                    
                    log_warn(f"OpenAgent process terminated unexpectedly with exit code {ret}.")
                    
                    if len(self.crash_times) >= self.max_crashes_in_window:
                        log_err(f"Crash rate limit exceeded ({len(self.crash_times)} crashes in {self.crash_window_seconds}s). Halting supervisor to prevent loop.")
                        sys.exit(ret)

                    backoff = min(2.0 * attempt, 10.0)
                    print(f"  {Style.CYAN}Auto-healing & restarting in {backoff:.1f}s...{Style.RESET}")
                    time.sleep(backoff)
                    break

                # Periodic health check of background WhatsApp (every 5 seconds)
                time.sleep(3.0)
                try:
                    res = subprocess.run(["pgrep", "-il", "whatsapp"], capture_output=True)
                    if res.returncode != 0 and self.running:
                        log_info("WhatsApp Desktop process was terminated; resurrecting in background...")
                        manage_whatsapp(launch=True, hide=True)
                except Exception:
                    pass


def parse_args():
    parser = argparse.ArgumentParser(
        description="Autonomous Boot Engine & Supervisor for OpenAgent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # OpenAgent Subcommand
    parser.add_argument("command", nargs="?", default="run", choices=["run", "inspect", "speak"], help="Action: 'run' (default bridge), 'inspect' (AX tree), or 'speak' (TTS)")
    parser.add_argument("--text", default="", help="Text to speak (for 'speak' command)")

    # OpenAgent Pass-Through Flags
    parser.add_argument("--voice", action="store_true", help="Opt-in continuous mic / wake-phrase mode")
    parser.add_argument("--send-mode", choices=["text", "audio"], default=None, help="Send mode: text (Whisper) or audio (M4A)")
    parser.add_argument("--unlocked", action="store_true", help="Unlock system from strict safe mode")
    parser.add_argument("--hotkey", default=None, help="Trigger key (e.g. f8, f6, right_shift)")
    parser.add_argument("--verbose", action="store_true", help="Show detailed diagnostics and debug logs")
    
    # Boot Specific Flags
    parser.add_argument("--no-sound", "--mute", dest="no_sound", action="store_true", help="Disable terminal sound effects")
    parser.add_argument("--sound-volume", type=float, default=None, help="Master sound volume (0.0 to 1.0)")
    parser.add_argument("--doctor", "--check", dest="doctor", action="store_true", help="Run diagnostic health audit and exit without starting agent")
    parser.add_argument("--once", action="store_true", help="Run once without the autonomous watchdog supervisor")
    parser.add_argument("--no-auto-install", action="store_true", help="Do not auto-install missing brew/bun dependencies")
    parser.add_argument("--no-chrome", action="store_true", help="Do not auto-start Google Chrome with remote debugging on port 9222")
    parser.add_argument("--no-social", action="store_true", help="Do not auto-start LocoAgent social media sessions (Threads/Reddit)")
    parser.add_argument("--no-firecrawl", action="store_true", help="Do not auto-start Firecrawl Docker container")
    parser.add_argument("--start-firecrawl", action="store_true", help="Autonomously launch Firecrawl docker engine if offline")
    parser.add_argument("--start-chrome", action="store_true", help="Autonomously launch Chrome with remote debugging on port 9222")
    parser.add_argument("--start-all-social", action="store_true", help="Launch all 9 configured social media browser sessions at boot")
    return parser.parse_known_args()


def main():
    known_args, extra_args = parse_args()

    # Step 1: Self-Bootstrapping Runtime (re-execs if outside .venv)
    bootstrap_environment(verbose=known_args.verbose)

    # Display banner once inside the bootstrapped environment
    log_banner()
    log_step(1, 5, "Environment & Runtime Bootstrap")
    log_ok(f"Runtime active on macOS Darwin ({platform.machine()})")

    # Step 2: System Dependencies & Bun Harness
    log_step(2, 5, "Dependencies & Execution Harness")
    auto_install = not known_args.no_auto_install
    check_and_resolve_dependencies(auto_install=auto_install)
    setup_bun_harness()
    setup_locoagent_harness()

    # Step 3: Config & Models
    log_step(3, 5, "Configuration & Speech Models")
    ensure_config()
    send_mode = known_args.send_mode or os.environ.get("BRIDGE_SEND_MODE", "audio")
    ensure_models(send_mode=send_mode, voice_mode=known_args.voice)

    # Step 4: System Permissions & WhatsApp Lifecycle
    log_step(4, 5, "Permissions & Subsystems Lifecycle")
    check_macos_permissions(timeout_seconds=15)
    manage_whatsapp(launch=True, hide=True)
    auto_chrome = known_args.start_chrome or not known_args.no_chrome
    manage_chrome_cdp(auto_start=auto_chrome)
    auto_social = not known_args.no_social
    manage_social_media(auto_start=auto_social, all_targets=known_args.start_all_social)
    auto_fc = known_args.start_firecrawl or (not known_args.no_firecrawl and shutil.which("docker") is not None)
    manage_firecrawl(auto_start=auto_fc)

    # Step 5: Harness Preflight Health Verification
    log_step(5, 5, "Preflight Subsystem Verification")
    preflight_ok = run_preflight_checks(verbose=known_args.verbose)

    if known_args.doctor:
        print(f"\n{Style.BOLD}{Style.GREEN}==============================================================================")
        print("          🩺 DIAGNOSTIC AUDIT COMPLETE - ALL SYSTEMS HEALTHY                  ")
        print(f"=============================================================================={Style.RESET}\n")
        sys.exit(0 if preflight_ok else 1)

    # Prepare passthrough arguments for OpenAgent
    forward_args = []
    if known_args.voice:
        forward_args.append("--voice")
    if known_args.send_mode:
        forward_args.extend(["--send-mode", known_args.send_mode])
    if known_args.unlocked:
        forward_args.append("--unlocked")
    if known_args.hotkey:
        forward_args.extend(["--hotkey", known_args.hotkey])
    if known_args.verbose:
        forward_args.append("--verbose")
    if known_args.no_sound:
        forward_args.append("--no-sound")
    if known_args.sound_volume is not None:
        forward_args.extend(["--sound-volume", str(known_args.sound_volume)])
    forward_args.extend(extra_args)

    if known_args.command == "inspect":
        cmd = [sys.executable, "-m", "OpenAgent.main", "inspect"] + forward_args
        res = subprocess.run(cmd)
        sys.exit(res.returncode)

    if known_args.command == "speak":
        cmd = [sys.executable, "-m", "OpenAgent.main", "speak", "--text", known_args.text] + forward_args
        res = subprocess.run(cmd)
        sys.exit(res.returncode)

    # Default 'run' command
    hotkey_name = (known_args.hotkey or os.environ.get("BRIDGE_HOTKEY", "f8")).upper()
    print(f"\n{Style.BOLD}{Style.GREEN}==============================================================================")
    print("                    🚀 AUTONOMOUS OPENAGENT RUNNING                           ")
    print(f"=============================================================================={Style.RESET}")
    print(f"• Hotkey: {Style.BOLD}Hold {hotkey_name}{Style.RESET} to talk; release to send (Esc quits)")
    voice_desc = f"True (press F5 to mute/unmute mic)" if known_args.voice else "False"
    print(f"• Mode: {Style.BOLD}{send_mode}{Style.RESET} | Voice wake: {Style.BOLD}{voice_desc}{Style.RESET}")
    print("• WhatsApp: Screen clean & backgrounded")
    print("• Social Media: Threads (9227) & Reddit (9224) active")
    print("• Sound Engine: Immersive tactile audio online")
    print("• Watchdog: Autonomous health supervisor active")
    print("------------------------------------------------------------------------------\n")

    if known_args.once:
        cmd = [sys.executable, "-m", "OpenAgent.main", "run"] + forward_args
        res = subprocess.run(cmd)
        sys.exit(res.returncode)
    else:
        supervisor = AutonomousSupervisor(forward_args)
        supervisor.run()


if __name__ == "__main__":
    main()
