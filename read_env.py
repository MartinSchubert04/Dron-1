"""
Lee .env en la raíz del proyecto e inyecta WIFI_SSID / WIFI_PASS
como build flags de PlatformIO para que no queden hardcodeadas en config.h.

Uso: extra_scripts = pre:read_env.py  (en platformio.ini)
"""

import os
from pathlib import Path

Import("env")  # noqa: F821  — SConstruct global de PlatformIO


def load_dotenv(filename: str) -> None:
    p = Path(filename)
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


load_dotenv(".env")
load_dotenv(".env.example")  # fallback de placeholders

ssid = os.environ.get("WIFI_SSID", "")
pwd  = os.environ.get("WIFI_PASS",  "")

if ssid:
    env.Append(BUILD_FLAGS=[          # noqa: F821
        f'-DWIFI_SSID=\\"{ssid}\\"',
        f'-DWIFI_PASS=\\"{pwd}\\"',
    ])
    print(f"[WiFi] SSID={ssid}")
else:
    print("[WiFi] WARNING: WIFI_SSID no encontrado en .env")
