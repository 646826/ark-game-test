#!/usr/bin/env python3
"""Stable browser smoke matrix for Clockwork Conservatory.

The runner deliberately creates a fresh browser context for every viewport. This
keeps high-DPI canvas memory bounded and avoids state leaking between scenarios.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ENGINE = os.environ.get("PLAYWRIGHT_BROWSER", "chromium").strip().lower()
OUT = ROOT / "artifacts" / ("screenshots" if ENGINE == "chromium" else f"screenshots-{ENGINE}")
OUT.mkdir(parents=True, exist_ok=True)
BASE_URL = "http://127.0.0.1:4173"
SAVE_KEY = "clockwork-conservatory-progress-v3"


def saved_progress(
    level: int,
    *,
    quality: str = "auto",
    reduced_motion: bool = False,
    high_contrast: bool = False,
) -> dict[str, Any]:
    return {
        "schema": 4,
        "campaignLevel": level,
        "totalScore": max(0, level - 1) * 2_050,
        "totalStars": max(0, level - 1) * 2,
        "bestScore": max(0, level - 1) * 750,
        "streak": min(12, max(0, level - 1)),
        "dailyBest": {},
        "specimens": ["lumen-orchid", "moonbell"],
        "settings": {
            "language": "en",
            "sound": False,
            "music": False,
            "haptics": True,
            "reducedMotion": reduced_motion,
            "highContrast": high_contrast,
            "quality": quality,
        },
    }


def wait_for_server(url: str, timeout: float = 12.0) -> None:
    deadline = time.monotonic() + timeout
    last_error: BaseException | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.75) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            last_error = error
        time.sleep(0.1)
    raise RuntimeError(f"Preview server did not become ready: {last_error}")


def seed_storage(context: BrowserContext, progress: dict[str, Any] | None) -> None:
    if progress is None:
        return
    serialized = json.dumps(progress, separators=(",", ":"))
    context.add_init_script(
        f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(serialized)});"
    )


def attach_error_capture(page: Page, label: str) -> list[str]:
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(f"{label}: pageerror: {error}"))

    def on_console(message: Any) -> None:
        if message.type == "error":
            text = message.text
            # Chromium may emit benign favicon/network diagnostics. Runtime errors are not ignored.
            if "favicon" not in text.lower():
                errors.append(f"{label}: console.error: {text}")

    page.on("console", on_console)
    return errors


def goto_ready(page: Page, path: str) -> None:
    page.goto(f"{BASE_URL}/{path}", wait_until="domcontentloaded", timeout=15_000)
    page.wait_for_selector('#app[data-loaded="true"]', timeout=12_000)


def assert_no_horizontal_overflow(page: Page, label: str, tolerance: int = 2) -> None:
    metrics = page.evaluate(
        """() => ({
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          viewportWidth: document.documentElement.clientWidth,
          documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          viewportHeight: document.documentElement.clientHeight,
        })"""
    )
    if metrics["documentWidth"] > metrics["viewportWidth"] + tolerance:
        raise AssertionError(f"{label}: horizontal overflow: {metrics}")


def assert_toolbar_visible(page: Page, label: str) -> None:
    box = page.locator("#game-toolbar").bounding_box()
    viewport = page.viewport_size
    if not box or not viewport:
        raise AssertionError(f"{label}: toolbar is not measurable")
    if box["x"] < -2 or box["y"] < -2 or box["x"] + box["width"] > viewport["width"] + 2 or box["y"] + box["height"] > viewport["height"] + 2:
        raise AssertionError(f"{label}: toolbar falls outside viewport: {box} in {viewport}")


def wait_game(page: Page) -> None:
    page.wait_for_selector("#game-hud:not([hidden])", timeout=15_000)
    page.wait_for_function("document.querySelector('#app')?.dataset.screen === 'playing'", timeout=12_000)
    quality = page.locator("#app").get_attribute("data-quality")
    if quality == "high":
        page.wait_for_function(
            "window.__clockworkDiagnostics?.().renderer?.artMode === 'cinematic'",
            timeout=15_000,
        )
    page.wait_for_timeout(550)


@contextmanager
def scenario(
    browser: Browser,
    label: str,
    *,
    viewport: dict[str, int],
    progress: dict[str, Any] | None = None,
    mobile: bool = False,
    device_scale_factor: float = 1,
) -> Iterator[tuple[Page, list[str]]]:
    context = browser.new_context(
        viewport=viewport,
        device_scale_factor=device_scale_factor,
        is_mobile=mobile,
        has_touch=mobile,
        locale="en-US",
        color_scheme="dark",
        reduced_motion="no-preference",
    )
    seed_storage(context, progress)
    page = context.new_page()
    page.set_default_timeout(10_000)
    errors = attach_error_capture(page, label)
    try:
        yield page, errors
    finally:
        context.close()


def run(browser: Browser) -> None:
    failures: list[str] = []

    with scenario(browser, "desktop", viewport={"width": 1440, "height": 900}) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1")
        page.wait_for_selector("#menu-screen:not([hidden])")
        page.wait_for_timeout(650)
        assert_no_horizontal_overflow(page, "desktop menu")
        page.screenshot(path=str(OUT / "menu-desktop.png"), full_page=True)

        page.click('[data-action="settings"]')
        page.wait_for_selector("#game-modal[open]")
        if page.locator("#setting-haptics").count() != 1:
            raise AssertionError("desktop settings: haptics control missing")
        options = page.locator("#setting-quality option").all_text_contents()
        if options != ["Auto", "High", "Balanced"]:
            raise AssertionError(f"desktop settings: unexpected quality options {options}")
        page.click('[data-action="close-modal"]')

        page.click('[data-action="campaign"]')
        page.wait_for_selector("#map-screen:not([hidden])")
        page.wait_for_timeout(450)
        assert_no_horizontal_overflow(page, "desktop map")
        page.screenshot(path=str(OUT / "map-desktop.png"), full_page=True)

        page.click('[data-action="continue-restoration"]')
        wait_game(page)
        assert_toolbar_visible(page, "desktop gameplay")
        page.screenshot(path=str(OUT / "gameplay-desktop.png"), full_page=True)

        # Resizing and rotating an Arkadium embed must not reload or mutate the active run.
        state_before_resize = page.evaluate(
            """() => ({
              puzzle: window.__clockworkDiagnostics?.().puzzle,
              moves: document.querySelector('[data-hud-moves]')?.textContent,
            })"""
        )
        page.set_viewport_size({"width": 900, "height": 1100})
        page.wait_for_timeout(260)
        assert_no_horizontal_overflow(page, "desktop portrait resize")
        assert_toolbar_visible(page, "desktop portrait resize")
        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(260)
        state_after_resize = page.evaluate(
            """() => ({
              puzzle: window.__clockworkDiagnostics?.().puzzle,
              moves: document.querySelector('[data-hud-moves]')?.textContent,
            })"""
        )
        if state_after_resize != state_before_resize:
            raise AssertionError(f"desktop resize changed the run: {state_before_resize} -> {state_after_resize}")

        # The authored first tutorial always solves in one clockwise turn and the target
        # is selected by default. Keyboard input makes this independent of projection.
        if page.locator('[data-action="dismiss-coach"]:visible').count():
            page.click('[data-action="dismiss-coach"]')
        page.locator("#game-canvas").focus()
        page.keyboard.press("Enter")
        page.wait_for_selector("#complete-screen:not([hidden])", timeout=9_000)
        page.wait_for_timeout(1_050)
        page.screenshot(path=str(OUT / "victory-desktop.png"), full_page=True)
        failures.extend(errors)

    with scenario(
        browser,
        "mobile",
        viewport={"width": 390, "height": 844},
        progress=saved_progress(4),
        mobile=True,
        device_scale_factor=2,
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1&autostart=campaign")
        wait_game(page)
        assert_no_horizontal_overflow(page, "mobile gameplay")
        assert_toolbar_visible(page, "mobile gameplay")
        page.screenshot(path=str(OUT / "gameplay-mobile.png"), full_page=True)
        page.click('[data-action="pause"]')
        page.wait_for_selector("#pause-overlay:not([hidden])")
        page.click('[data-action="resume"]')
        page.wait_for_function("document.querySelector('#pause-overlay')?.hidden === true")
        failures.extend(errors)

    with scenario(
        browser,
        "compact",
        viewport={"width": 320, "height": 568},
        progress=saved_progress(4, quality="balanced"),
        mobile=True,
        device_scale_factor=1,
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1")
        page.wait_for_selector("#menu-screen:not([hidden])")
        page.wait_for_timeout(650)
        assert_no_horizontal_overflow(page, "compact menu")
        page.screenshot(path=str(OUT / "compact-menu.png"), full_page=True)
        page.click('[data-action="campaign"]')
        page.wait_for_selector("#map-screen:not([hidden])")
        page.wait_for_timeout(450)
        assert_no_horizontal_overflow(page, "compact map")
        page.screenshot(path=str(OUT / "compact-map.png"), full_page=True)
        page.click('[data-action="continue-restoration"]')
        wait_game(page)
        assert_no_horizontal_overflow(page, "compact gameplay")
        assert_toolbar_visible(page, "compact gameplay")
        page.screenshot(path=str(OUT / "compact-game.png"), full_page=True)
        failures.extend(errors)

    with scenario(
        browser,
        "emergency",
        viewport={"width": 280, "height": 320},
        progress=saved_progress(4, quality="balanced"),
        mobile=True,
        device_scale_factor=1,
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1&autostart=campaign")
        wait_game(page)
        assert_no_horizontal_overflow(page, "emergency gameplay")
        assert_toolbar_visible(page, "emergency gameplay")
        page.screenshot(path=str(OUT / "emergency-280x320.png"), full_page=True)
        failures.extend(errors)

    with scenario(
        browser,
        "landscape",
        viewport={"width": 844, "height": 390},
        progress=saved_progress(4),
        mobile=True,
        device_scale_factor=1,
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1&autostart=campaign")
        wait_game(page)
        assert_no_horizontal_overflow(page, "landscape gameplay")
        assert_toolbar_visible(page, "landscape gameplay")
        page.screenshot(path=str(OUT / "landscape-game.png"), full_page=True)
        failures.extend(errors)

    with scenario(
        browser,
        "accessible",
        viewport={"width": 1024, "height": 768},
        progress=saved_progress(12, quality="balanced", reduced_motion=True, high_contrast=True),
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1&autostart=campaign")
        wait_game(page)
        state = page.evaluate(
            """() => ({
              quality: document.querySelector('#app')?.getAttribute('data-quality'),
              reduced: document.querySelector('#app')?.getAttribute('data-motion'),
              contrast: document.querySelector('#app')?.getAttribute('data-contrast'),
            })"""
        )
        if state != {"quality": "balanced", "reduced": "reduced", "contrast": "high"}:
            raise AssertionError(f"accessible scenario settings not applied: {state}")
        page.locator("#game-canvas").focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(260)
        before_sleep = page.evaluate("window.__clockworkDiagnostics?.().renderer")
        page.wait_for_timeout(360)
        after_sleep = page.evaluate("window.__clockworkDiagnostics?.().renderer")
        transient_keys = ("particleCount", "pendingBurstCount", "powerTransitionCount", "impactCount")
        active_queues = {key: after_sleep.get(key) for key in transient_keys if after_sleep.get(key) != 0}
        if active_queues:
            raise AssertionError(f"reduced motion retained animation queues: {active_queues}")
        if after_sleep["renderedFrames"] - before_sleep["renderedFrames"] > 1:
            raise AssertionError(f"reduced motion did not sleep: {before_sleep} -> {after_sleep}")
        page.screenshot(path=str(OUT / "accessible-balanced.png"), full_page=True)
        failures.extend(errors)

    with scenario(
        browser,
        "advanced",
        viewport={"width": 1440, "height": 900},
        progress=saved_progress(36, quality="high"),
    ) as (page, errors):
        goto_ready(page, "?standalone=1&debug=1&autostart=campaign")
        wait_game(page)
        page.screenshot(path=str(OUT / "gameplay-level36.png"), full_page=True)
        diagnostics = page.evaluate("window.__clockworkDiagnostics?.()")
        if not diagnostics or diagnostics.get("puzzle", {}).get("level") != 36:
            raise AssertionError(f"advanced scenario loaded the wrong puzzle: {diagnostics}")
        failures.extend(errors)

    if failures:
        raise RuntimeError("Browser errors:\n" + "\n".join(failures))


def main() -> None:
    subprocess.run(["node", str(ROOT / "scripts" / "build.mjs")], cwd=ROOT, check=True)
    server = subprocess.Popen(
        ["node", str(ROOT / "scripts" / "serve.mjs"), "dist"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        wait_for_server(f"{BASE_URL}/")
        with sync_playwright() as playwright:
            browser_type = getattr(playwright, ENGINE, None)
            if browser_type is None:
                raise ValueError(f"Unsupported Playwright browser engine: {ENGINE}")
            launch_options: dict[str, Any] = {"headless": True}
            if ENGINE == "chromium":
                explicit = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
                system_chromium = Path("/usr/bin/chromium")
                if explicit:
                    launch_options["executable_path"] = explicit
                elif system_chromium.exists():
                    launch_options["executable_path"] = str(system_chromium)
                launch_options["args"] = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"]
            browser = browser_type.launch(**launch_options)
            try:
                run(browser)
            finally:
                browser.close()
        print(f"Visual smoke matrix passed in {ENGINE}. Screenshots: {OUT}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
