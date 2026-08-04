#!/usr/bin/env python3
"""Verify the v1.3 cinematic runtime art contract and cached render path."""
from __future__ import annotations

import json
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:4173"
SAVE_KEY = "clockwork-conservatory-progress-v3"
ASSET_DIR = ROOT / "public" / "assets" / "cinematic"
REQUIRED = [
    "platform-0.webp", "platform-1.webp", "platform-2.webp", "platform-3.webp",
    "mechanism-terminal.webp", "mechanism-straight.webp", "mechanism-elbow.webp", "mechanism-junction.webp",
    "pipe.webp", "coupler.webp", "source.webp", "leak.webp", "lock.webp",
    "plant-lumen-orchid-on.webp", "plant-lumen-orchid-off.webp",
    "plant-moonbell-on.webp", "plant-moonbell-off.webp",
    "plant-sun-dahlia-on.webp", "plant-sun-dahlia-off.webp",
    "plant-mist-lily-on.webp", "plant-mist-lily-off.webp",
    "plant-ember-bloom-on.webp", "plant-ember-bloom-off.webp",
]


def wait_server(timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(BASE_URL, timeout=.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(.1)
    raise RuntimeError("preview server did not start")


def validate_assets() -> None:
    missing = [name for name in REQUIRED if not (ASSET_DIR / name).exists()]
    if missing:
        raise AssertionError(f"missing cinematic assets: {missing}")
    total = 0
    for name in REQUIRED:
        path = ASSET_DIR / name
        total += path.stat().st_size
        with Image.open(path) as image:
            image.load()
            if image.mode != "RGBA" or image.getchannel("A").getbbox() is None:
                raise AssertionError(f"{name}: expected non-empty transparent RGBA art")
    if total > 4_200_000:
        raise AssertionError(f"cinematic runtime pack exceeds 4.2 MB: {total}")


def main() -> None:
    validate_assets()
    server = subprocess.Popen(
        ["node", "scripts/serve.mjs", "dist"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_server()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path="/usr/bin/chromium",
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            progress = {
                "schema": 4,
                "campaignLevel": 12,
                "totalScore": 18450,
                "totalStars": 33,
                "bestScore": 4920,
                "streak": 7,
                "dailyBest": {},
                "specimens": ["lumen-orchid", "moonbell", "sun-dahlia", "mist-lily", "ember-bloom"],
                "settings": {
                    "language": "en", "sound": False, "music": False, "haptics": True,
                    "reducedMotion": False, "highContrast": False, "quality": "high",
                },
            }
            context.add_init_script(
                f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(json.dumps(progress, separators=(',', ':')))});"
            )
            page = context.new_page()
            page.goto(f"{BASE_URL}/?standalone=1&debug=1&autostart=campaign", wait_until="domcontentloaded")
            page.wait_for_selector('#app[data-loaded="true"]', timeout=12_000)
            page.wait_for_function(
                "window.__clockworkDiagnostics?.().renderer?.artMode === 'cinematic'",
                timeout=15_000,
            )
            page.wait_for_timeout(1_600)
            diagnostics = page.evaluate("window.__clockworkDiagnostics?.().renderer")
            if diagnostics.get("cinematicMissing"):
                raise AssertionError(diagnostics)
            if diagnostics.get("cinematicReady", 0) < diagnostics.get("cinematicRequired", 0):
                raise AssertionError(diagnostics)
            if diagnostics.get("lastDrawCostMs", 999) > 12:
                raise AssertionError(f"cached cinematic frame is too expensive: {diagnostics}")
            if diagnostics.get("staticCacheDirty"):
                raise AssertionError(f"cinematic cache did not settle: {diagnostics}")
            resources = page.evaluate("performance.getEntriesByType('resource').map((entry) => entry.name)")
            missing_runtime = [
                name for name in REQUIRED
                if name in {"platform-0.webp", "pipe.webp", "source.webp"}
                and not any("/assets/cinematic/" in url and url.endswith(name) for url in resources)
            ]
            if missing_runtime:
                raise AssertionError(f"cinematic runtime assets were not requested: {missing_runtime}")
            browser.close()
        print("Cinematic renderer smoke test passed.")
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
