"""Backward compatibility shim redirecting 'bridge' to 'OpenAgent'."""
import sys
import importlib

# Ensure OpenAgent package is imported
import OpenAgent

# Forward all attributes
__all__ = getattr(OpenAgent, "__all__", [])

_SUBMODULES = [
    "audio",
    "ax",
    "config",
    "desktop",
    "diagnostics",
    "dispatcher",
    "harness",
    "mac_adapter",
    "main",
    "replies",
    "voice",
]

for _mod in _SUBMODULES:
    try:
        _imported = importlib.import_module(f"OpenAgent.{_mod}")
        sys.modules[f"bridge.{_mod}"] = _imported
        globals()[_mod] = _imported
    except Exception:
        pass


def __getattr__(name):
    try:
        mod = importlib.import_module(f"OpenAgent.{name}")
        globals()[name] = mod
        return mod
    except ModuleNotFoundError:
        pass
    if hasattr(OpenAgent, name):
        return getattr(OpenAgent, name)
    raise AttributeError(f"module 'bridge' has no attribute '{name}'")
