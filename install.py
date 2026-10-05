#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENAGENT - ONE-COMMAND AUTONOMOUS INSTALLER
==============================================================================
A complete, autonomous zero-touch setup and installation engine:
1. Installs/verifies macOS system dependencies (Homebrew, uv, Bun, SoX, FFmpeg, Ripgrep, Whisper).
2. Synchronizes Python virtual environment with all extras via uv.
3. Installs Bun CLI harness TypeScript modules (src/tools/cli-harness).
4. Auto-provisions speech recognition models (Whisper ggml-base & Vosk offline wake model).
5. Initializes and verifies environment configuration (.env).
6. Audits and prompts macOS Accessibility & Input permissions.
7. Verifies WhatsApp Desktop integration.
8. Runs post-install verification smoke tests.
==============================================================================
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent


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
    print(f"""{Style.BOLD}{Style.CYAN}
==============================================================================
          ⚡ OPENAGENT - SYSTEM INSTALLER & SETUP                    
=============================================================================={Style.RESET}""")


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
    """Ensure standard system and user binary paths are active."""
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
    current = os.environ.get("PATH", "").split(":")
    to_add = [p for p in standard_paths if p not in current and os.path.isdir(p)]
    if to_add:
        os.environ["PATH"] = ":".join(to_add + current)


def install_system_dependencies(skip_brew: bool = False) -> bool:
    """Installs required system CLI utilities via Homebrew and standalone scripts."""
    setup_path()
    brew_bin = shutil.which("brew")
    
    # 1. Install / verify uv
    uv_bin = shutil.which("uv")
    if not uv_bin:
        log_info("Installing 'uv' Astral package manager...")
        try:
            subprocess.run("curl -LsSf https://astral.sh/uv/install.sh | sh", shell=True, check=True)
            setup_path()
            uv_bin = shutil.which("uv")
        except Exception:
            if brew_bin and not skip_brew:
                subprocess.run([brew_bin, "install", "uv"], check=False)
                setup_path()
                uv_bin = shutil.which("uv")
    if uv_bin:
        log_ok(f"uv installed: {uv_bin}")
    else:
        log_err("Could not install 'uv'. Please install manually: brew install uv")
        return False

    # 2. Install / verify Bun
    bun_bin = shutil.which("bun")
    if not bun_bin:
        log_info("Installing Bun JavaScript/TypeScript runtime...")
        try:
            subprocess.run("curl -fsSL https://bun.sh/install | bash", shell=True, check=True)
            setup_path()
            bun_bin = shutil.which("bun")
        except Exception:
            if brew_bin and not skip_brew:
                subprocess.run([brew_bin, "install", "bun"], check=False)
                setup_path()
                bun_bin = shutil.which("bun")
    if bun_bin:
        log_ok(f"Bun installed: {bun_bin}")
    else:
        log_err("Could not install 'bun'. Please install manually: brew install bun")
        return False

    # 3. Brew tools: sox, ffmpeg, ripgrep, whisper-cpp
    brew_packages = [
        ("sox", "rec", "Audio recording engine"),
        ("ffmpeg", "ffmpeg", "Audio/video media encoder"),
        ("ripgrep", "rg", "Fast file/code search engine"),
        ("whisper-cpp", "whisper-cli", "On-device speech-to-text engine"),
    ]

    for pkg, cmd_name, desc in brew_packages:
        bin_path = shutil.which(cmd_name)
        if not bin_path:
            if brew_bin and not skip_brew:
                log_info(f"Installing {pkg} ({desc}) via Homebrew...")
                res = subprocess.run([brew_bin, "install", pkg], check=False)
                setup_path()
                bin_path = shutil.which(cmd_name)
            else:
                log_warn(f"Missing {pkg} ({desc}). Run: brew install {pkg}")
        
        if bin_path:
            log_ok(f"{pkg} ready: {bin_path}")
        else:
            if pkg in ("sox", "ffmpeg"):
                log_err(f"{pkg} is required for audio operation.")
                return False
            else:
                log_warn(f"{pkg} missing; optional capabilities may be limited.")

    return True


def sync_python_environment(verbose: bool = False) -> bool:
    """Synchronizes python environment and workspace packages using uv."""
    setup_path()
    uv_bin = shutil.which("uv")
    if not uv_bin:
        log_err("uv not found in PATH.")
        return False

    log_info("Synchronizing Python dependencies via 'uv sync --all-extras'...")
    cmd = [uv_bin, "sync", "--all-extras"]
    res = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=not verbose, text=True)
    if res.returncode != 0:
        log_err("Failed to synchronize Python dependencies.")
        if not verbose and hasattr(res, "stderr"):
            print(res.stderr)
        return False

    log_ok("Python virtual environment synchronized (.venv)")
    return True


def install_bun_harness() -> bool:
    """Installs dependencies in src/tools/cli-harness using Bun."""
    setup_path()
    bun_bin = shutil.which("bun")
    if not bun_bin:
        log_err("Bun is not available in PATH.")
        return False

    harness_dir = ROOT_DIR / "src" / "tools" / "cli-harness"
    if not (harness_dir / "package.json").exists():
        log_warn(f"Harness directory not found at {harness_dir}")
        return False

    log_info("Installing Bun CLI harness packages (src/tools/cli-harness)...")
    res = subprocess.run([bun_bin, "install"], cwd=str(harness_dir), capture_output=True, text=True)
    if res.returncode != 0:
        log_err(f"Bun install failed: {res.stderr}")
        return False

    log_ok("Bun CLI harness dependencies installed successfully")
    return True


def download_models(all_models: bool = True) -> bool:
    """Downloads speech recognition models: Whisper ggml-base and Vosk offline wake model."""
    models_dir = ROOT_DIR / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # 1. Whisper ggml model
    whisper_model = models_dir / "ggml-base.bin"
    if not whisper_model.exists():
        log_info("Downloading Whisper ggml-base model (~148 MB)...")
        script_path = ROOT_DIR / "scripts" / "download-model.sh"
        if script_path.exists():
            subprocess.run(["bash", str(script_path), "base"], check=False)
        else:
            url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
            try:
                urllib.request.urlretrieve(url, whisper_model)
            except Exception as e:
                log_warn(f"Direct download failed: {e}")
        if whisper_model.exists():
            log_ok("Whisper model installed: models/ggml-base.bin")
        else:
            log_warn("Whisper model could not be downloaded automatically.")
    else:
        log_ok("Whisper model already present: models/ggml-base.bin")

    # 2. Vosk offline model
    if all_models:
        vosk_dir = models_dir / "vosk-model-small-en-us-0.15"
        if not vosk_dir.is_dir():
            log_info("Downloading Vosk offline voice wake-word model (~40 MB)...")
            zip_dest = models_dir / "vosk-model.zip"
            url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
            try:
                urllib.request.urlretrieve(url, zip_dest)
                with zipfile.ZipFile(zip_dest, "r") as zip_ref:
                    zip_ref.extractall(models_dir)
                zip_dest.unlink(missing_ok=True)
                log_ok("Vosk voice wake model installed: models/vosk-model-small-en-us-0.15")
            except Exception as e:
                log_warn(f"Failed to download Vosk model: {e}")
        else:
            log_ok("Vosk model already present: models/vosk-model-small-en-us-0.15")

    return True


def setup_config_file() -> Path:
    """Initializes .env from .env.example if missing."""
    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"

    if not env_path.exists():
        if example_path.exists():
            log_info("Creating .env from .env.example...")
            shutil.copy(example_path, env_path)
            log_ok(".env created with default settings")
        else:
            log_warn("Neither .env nor .env.example found.")
    else:
        log_ok(".env configuration file is present")

    return env_path


def check_permissions_and_whatsapp() -> bool:
    """Audits macOS permissions and WhatsApp Desktop availability."""
    # Check WhatsApp installation
    wa_app = Path("/Applications/WhatsApp.app")
    user_wa_app = Path.home() / "Applications/WhatsApp.app"
    if wa_app.exists() or user_wa_app.exists() or shutil.which("whatsapp"):
        log_ok("WhatsApp Desktop application found")
    else:
        # Check Spotlight
        mdfind = shutil.which("mdfind")
        found = False
        if mdfind:
            res = subprocess.run([mdfind, "kMDItemCFBundleIdentifier == 'net.whatsapp.WhatsApp'"], capture_output=True, text=True)
            if res.stdout.strip():
                log_ok(f"WhatsApp Desktop located at: {res.stdout.strip().splitlines()[0]}")
                found = True
        if not found:
            log_warn("WhatsApp Desktop not found in /Applications. Please install WhatsApp Desktop.")

    # Probe Accessibility
    try:
        from ApplicationServices import AXIsProcessTrusted, AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt
        if AXIsProcessTrusted():
            log_ok("macOS Accessibility permission granted")
        else:
            log_warn("macOS Accessibility permission required for terminal.")
            print(f"  {Style.BOLD}👉 Enable access in:{Style.RESET} System Settings → Privacy & Security → Accessibility")
            AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: True})
    except ImportError:
        # Check via python inside .venv
        venv_py = ROOT_DIR / ".venv/bin/python"
        if venv_py.exists():
            res = subprocess.run([str(venv_py), "-c", "from ApplicationServices import AXIsProcessTrusted; print(AXIsProcessTrusted())"], capture_output=True, text=True)
            if "True" in res.stdout:
                log_ok("macOS Accessibility permission granted")
            else:
                log_warn("macOS Accessibility permission required for terminal.")

    return True


def run_smoke_test() -> bool:
    """Performs quick verification of the installed harness and adapters."""
    venv_py = ROOT_DIR / ".venv/bin/python"
    target_py = str(venv_py) if venv_py.exists() else sys.executable

    test_script = """
import sys
from OpenAgent.harness import Harness
from OpenAgent.mac_adapter import MacAdapter
from OpenAgent.browser_adapter import BrowserAdapter

with Harness() as h:
    info = h.system_info()
    assert info.get('platform') == 'darwin'

MacAdapter()
BrowserAdapter()
print('SMOKE_TEST_PASSED')
"""
    res = subprocess.run([target_py, "-c", test_script], cwd=str(ROOT_DIR), capture_output=True, text=True)
    if "SMOKE_TEST_PASSED" in res.stdout:
        log_ok("Execution harnesses (Bun IPC, MacAdapter, BrowserAdapter) verified operational")
        return True
    else:
        log_warn(f"Smoke test reported warning: {res.stderr.strip()[:200]}")
        return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="One-Command Autonomous Installer for OpenAgent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--skip-brew", action="store_true", help="Skip Homebrew package installations")
    parser.add_argument("--no-vosk", action="store_true", help="Skip downloading Vosk speech recognition model")
    parser.add_argument("--verbose", action="store_true", help="Display full verbose output for install commands")
    return parser.parse_args()


def main():
    log_banner()
    args = parse_args()

    if platform.system() != "Darwin":
        log_err("OpenAgent requires macOS Darwin. Installation cannot continue on this OS.")
        sys.exit(1)

    total_steps = 7

    # Step 1: System Binaries
    log_step(1, total_steps, "Installing System Dependencies & Utilities")
    if not install_system_dependencies(skip_brew=args.skip_brew):
        log_err("System dependencies step encountered errors.")

    # Step 2: Python Virtual Environment
    log_step(2, total_steps, "Synchronizing Python Virtual Environment via uv")
    if not sync_python_environment(verbose=args.verbose):
        log_err("Python environment synchronization failed.")
        sys.exit(1)

    # Step 3: Bun CLI Harness
    log_step(3, total_steps, "Installing Bun CLI Harness TypeScript Modules")
    install_bun_harness()

    # Step 4: Speech Recognition Models
    log_step(4, total_steps, "Downloading Speech Models (Whisper & Vosk)")
    download_models(all_models=not args.no_vosk)

    # Step 5: Configuration
    log_step(5, total_steps, "Verifying Configuration (.env)")
    setup_config_file()

    # Step 6: Permissions & WhatsApp
    log_step(6, total_steps, "Checking macOS Permissions & WhatsApp Integration")
    check_permissions_and_whatsapp()

    # Step 7: Verification Smoke Test
    log_step(7, total_steps, "Running Subsystem Verification Smoke Test")
    smoke_ok = run_smoke_test()

    print(f"\n{Style.BOLD}{Style.GREEN}==============================================================================")
    print("            🎉 OPENAGENT INSTALLATION & SETUP COMPLETE!                       ")
    print(f"=============================================================================={Style.RESET}")
    print(f"• Start autonomous bridge:  {Style.BOLD}./boot.py{Style.RESET}  (or  {Style.BOLD}python3 boot.py{Style.RESET})")
    print(f"• Run system preflight:     {Style.BOLD}./boot.py --doctor{Style.RESET}")
    print(f"• Calibrate WhatsApp UI:    {Style.BOLD}./calibrate.py{Style.RESET}")
    print(f"• Run test suite:           {Style.BOLD}./test.py{Style.RESET}")
    print("------------------------------------------------------------------------------\n")
    sys.exit(0 if smoke_ok else 1)


if __name__ == "__main__":
    main()
