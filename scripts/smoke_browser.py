#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

subprocess.run(["node", str(ROOT / "scripts" / "build.mjs")], cwd=ROOT, check=True)
server = subprocess.Popen(["node", str(ROOT / "scripts" / "serve.mjs"), "dist"], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    time.sleep(0.8)
    executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "/usr/bin/chromium")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=executable, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:4173/?standalone=1", wait_until="networkidle")
        page.wait_for_selector("#menu-screen:not([hidden])")
        page.screenshot(path=str(OUT / "menu-desktop.png"), full_page=True)
        page.click('[data-action="campaign"]')
        page.wait_for_selector("#map-screen:not([hidden])")
        page.screenshot(path=str(OUT / "map-desktop.png"), full_page=True)
        page.click('[data-action="continue-restoration"]')
        page.wait_for_selector("#game-hud:not([hidden])")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "gameplay-desktop.png"), full_page=True)
        page.mouse.click(720, 430)
        page.wait_for_selector("#complete-screen:not([hidden])", timeout=7_000)
        page.wait_for_timeout(180)
        page.screenshot(path=str(OUT / "victory-desktop.png"), full_page=True)

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile_errors: list[str] = []
        mobile.on("pageerror", lambda error: mobile_errors.append(str(error)))
        mobile.goto("http://127.0.0.1:4173/?standalone=1&autostart=campaign", wait_until="networkidle")
        mobile.wait_for_selector("#game-hud:not([hidden])")
        mobile.wait_for_timeout(500)
        mobile.screenshot(path=str(OUT / "gameplay-mobile.png"), full_page=True)
        mobile.close()

        advanced = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        advanced_errors: list[str] = []
        advanced.on("pageerror", lambda error: advanced_errors.append(str(error)))
        saved = {
            "schema": 3, "campaignLevel": 4, "totalScore": 8200, "totalStars": 9,
            "bestScore": 3000, "streak": 4, "dailyBest": {},
            "specimens": ["lumen-orchid", "moonbell"],
            "settings": {"language": "en", "sound": False, "music": False, "reducedMotion": False, "highContrast": False, "quality": "high"},
        }
        advanced.add_init_script(f"localStorage.setItem('clockwork-conservatory-progress-v3', {json.dumps(json.dumps(saved))});")
        advanced.goto("http://127.0.0.1:4173/?standalone=1&autostart=campaign", wait_until="networkidle")
        advanced.wait_for_selector("#game-hud:not([hidden])")
        advanced.wait_for_timeout(500)
        advanced.screenshot(path=str(OUT / "gameplay-level4.png"), full_page=True)
        advanced.close()
        browser.close()
        if errors or mobile_errors or advanced_errors:
            raise RuntimeError("Browser errors: " + " | ".join(errors + mobile_errors + advanced_errors))
    print(f"Visual smoke test passed. Screenshots: {OUT}")
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
