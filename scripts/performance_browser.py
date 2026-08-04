#!/usr/bin/env python3
"""Browser performance guardrails for representative device classes.

This is not a synthetic benchmark. It verifies that adaptive quality selects a
safe renderer profile, canvas allocation stays inside budget, the static menu
actually sleeps, and the game remains responsive under modest CPU throttling.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
REPORT_PATH = ARTIFACTS / "performance-report.json"
BASE_URL = "http://127.0.0.1:4173"
SAVE_KEY = "clockwork-conservatory-progress-v3"


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


def progress(level: int = 12) -> dict[str, Any]:
    return {
        "schema": 4,
        "campaignLevel": level,
        "totalScore": 18_450,
        "totalStars": 33,
        "bestScore": 4_920,
        "streak": 7,
        "dailyBest": {},
        "specimens": ["lumen-orchid", "moonbell", "sun-dahlia"],
        "settings": {
            "language": "en",
            "sound": False,
            "music": False,
            "haptics": True,
            "reducedMotion": False,
            "highContrast": False,
            "quality": "auto",
        },
    }


def apply_device_signals(
    context: BrowserContext,
    *,
    memory: int,
    cores: int,
    save_data: bool = False,
    effective_type: str = "4g",
    level: int = 12,
) -> None:
    payload = json.dumps({"memory": memory, "cores": cores, "saveData": save_data, "effectiveType": effective_type})
    context.add_init_script(
        f"""
        (() => {{
          const signals = {payload};
          try {{ Object.defineProperty(navigator, 'deviceMemory', {{ configurable: true, get: () => signals.memory }}); }} catch {{}}
          try {{ Object.defineProperty(navigator, 'hardwareConcurrency', {{ configurable: true, get: () => signals.cores }}); }} catch {{}}
          try {{ Object.defineProperty(navigator, 'connection', {{
            configurable: true,
            get: () => ({{ saveData: signals.saveData, effectiveType: signals.effectiveType }})
          }}); }} catch {{}}
        }})();
        """
    )
    serialized = json.dumps(progress(level), separators=(",", ":"))
    context.add_init_script(f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(serialized)});")


def capture_errors(page: Page, label: str) -> list[str]:
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(f"{label}: pageerror: {error}"))
    page.on("console", lambda message: errors.append(f"{label}: console.error: {message.text}") if message.type == "error" else None)
    return errors


def goto(page: Page, path: str) -> None:
    page.goto(f"{BASE_URL}/{path}", wait_until="domcontentloaded", timeout=15_000)
    page.wait_for_selector('#app[data-loaded="true"]', timeout=12_000)


def diagnostics(page: Page) -> dict[str, Any]:
    value = page.evaluate("window.__clockworkDiagnostics?.()")
    if not isinstance(value, dict) or not isinstance(value.get("renderer"), dict):
        raise AssertionError(f"Renderer diagnostics unavailable: {value}")
    return value


def measure_interaction_latency(page: Page) -> float:
    """Measure keyboard input to the first renderer frame carrying the update."""
    value = page.evaluate(
        """() => new Promise((resolve) => {
          const canvas = document.querySelector('#game-canvas');
          const read = () => window.__clockworkDiagnostics?.().renderer?.renderedFrames ?? 0;
          const before = read();
          const started = performance.now();
          canvas?.focus();
          canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          const poll = () => {
            if (read() > before) return resolve(performance.now() - started);
            if (performance.now() - started > 500) return resolve(999);
            requestAnimationFrame(poll);
          };
          requestAnimationFrame(poll);
        })"""
    )
    return round(float(value), 2)


def sample_game(page: Page, *, warmup_ms: int = 1_200, sample_ms: int = 1_500) -> dict[str, Any]:
    page.wait_for_selector("#game-hud:not([hidden])", timeout=12_000)
    page.wait_for_timeout(warmup_ms)

    # Exercise selection, rotation and view motion without depending on projected coordinates.
    canvas = page.locator("#game-canvas")
    canvas.focus()
    for key in ("Enter", "ArrowRight", "Enter", "q", "e"):
        page.keyboard.press(key)
        page.wait_for_timeout(75)

    before = diagnostics(page)
    start = time.monotonic()
    page.wait_for_timeout(sample_ms)
    elapsed = max(0.001, time.monotonic() - start)
    after = diagnostics(page)
    renderer_before = before["renderer"]
    renderer_after = after["renderer"]
    frame_delta = max(0, renderer_after["renderedFrames"] - renderer_before["renderedFrames"])
    browser_metrics = page.evaluate(
        """() => {
          const resources = performance.getEntriesByType('resource');
          return {
            domNodes: document.getElementsByTagName('*').length,
            heapUsed: performance.memory?.usedJSHeapSize ?? null,
            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
            canvas: { width: document.querySelector('canvas')?.width ?? 0, height: document.querySelector('canvas')?.height ?? 0 },
            qualityMode: document.querySelector('#app')?.getAttribute('data-quality-mode'),
            overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
            resourceCount: resources.length,
            resourceTransferBytes: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
            resourceEncodedBytes: resources.reduce((total, resource) => total + (resource.encodedBodySize || 0), 0),
          };
        }"""
    )
    return {
        "diagnostics": after,
        "renderedFramesDuringSample": frame_delta,
        "effectiveRenderedFps": round(frame_delta / elapsed, 2),
        "sampleSeconds": round(elapsed, 3),
        **browser_metrics,
    }


def run_device(
    browser: Browser,
    *,
    label: str,
    viewport: dict[str, int],
    dpr: float,
    mobile: bool,
    memory: int,
    cores: int,
    cpu_rate: float,
    expected_quality: str,
) -> dict[str, Any]:
    context = browser.new_context(
        viewport=viewport,
        device_scale_factor=dpr,
        is_mobile=mobile,
        has_touch=mobile,
        locale="en-US",
        color_scheme="dark",
    )
    apply_device_signals(context, memory=memory, cores=cores)
    page = context.new_page()
    page.set_default_timeout(10_000)
    errors = capture_errors(page, label)
    session = context.new_cdp_session(page)
    session.send("Emulation.setCPUThrottlingRate", {"rate": cpu_rate})
    try:
        goto(page, "?standalone=1&debug=1&autostart=campaign")
        page.wait_for_selector("#game-hud:not([hidden])", timeout=12_000)
        page.wait_for_timeout(450)
        interaction_latency = measure_interaction_latency(page)
        result = sample_game(page)
        result["interactionToRenderMs"] = interaction_latency
        renderer = result["diagnostics"]["renderer"]
        if renderer["quality"] != expected_quality:
            raise AssertionError(f"{label}: expected {expected_quality}, got {renderer['quality']}")
        budget = 1_350_000 if expected_quality == "balanced" else 2_800_000
        if renderer["canvasPixels"] > budget + 4_000:
            raise AssertionError(f"{label}: canvas pixel budget exceeded: {renderer['canvasPixels']} > {budget}")
        if renderer["averageDrawCostMs"] > 18:
            raise AssertionError(f"{label}: average draw cost is too high: {renderer['averageDrawCostMs']} ms")
        if interaction_latency > 220:
            raise AssertionError(f"{label}: input-to-render latency is too high: {interaction_latency} ms")
        if result["overflowX"] > 2:
            raise AssertionError(f"{label}: horizontal overflow {result['overflowX']} px")
        payload_budget = 1_800_000 if expected_quality == "balanced" else 3_600_000
        if result["resourceEncodedBytes"] > payload_budget:
            raise AssertionError(
                f"{label}: cumulative first-game payload is too large: "
                f"{result['resourceEncodedBytes']} > {payload_budget} bytes"
            )
        if errors:
            raise AssertionError("\n".join(errors))
        return {
            "label": label,
            "requestedSignals": {
                "viewport": viewport,
                "devicePixelRatio": dpr,
                "deviceMemory": memory,
                "hardwareConcurrency": cores,
                "cpuThrottle": cpu_rate,
            },
            **result,
        }
    finally:
        context.close()


def run_menu_sleep(browser: Browser) -> dict[str, Any]:
    context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    apply_device_signals(context, memory=8, cores=8)
    page = context.new_page()
    errors = capture_errors(page, "menu-sleep")
    try:
        goto(page, "?standalone=1&debug=1")
        page.wait_for_selector("#menu-screen:not([hidden])")
        # Let the CSS entrance transition and initial renderer invalidation finish.
        page.wait_for_timeout(1_100)
        before = diagnostics(page)["renderer"]
        page.wait_for_timeout(1_000)
        after = diagnostics(page)["renderer"]
        rendered = max(0, after["renderedFrames"] - before["renderedFrames"])
        if rendered > 1:
            raise AssertionError(f"menu-sleep: static menu rendered {rendered} canvas frames")
        network = page.evaluate(
            """() => {
              const resources = performance.getEntriesByType('resource');
              return {
                resourceCount: resources.length,
                resourceTransferBytes: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
                resourceEncodedBytes: resources.reduce((total, resource) => total + (resource.encodedBodySize || 0), 0),
              };
            }"""
        )
        if network["resourceEncodedBytes"] > 900_000:
            raise AssertionError(f"menu-sleep: first-screen payload is too large: {network['resourceEncodedBytes']} bytes")
        if errors:
            raise AssertionError("\n".join(errors))
        return {
            "label": "menu-sleep",
            "measurementMs": 1_000,
            "renderedFrames": rendered,
            "skippedFrameDelta": max(0, after["skippedFrames"] - before["skippedFrames"]),
            "diagnostics": after,
            **network,
        }
    finally:
        context.close()


def run_stability_stress(browser: Browser) -> dict[str, Any]:
    """Exercise repeated input, pause/resume and orientation changes on a low-end profile."""
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale="en-US",
        color_scheme="dark",
    )
    apply_device_signals(context, memory=4, cores=4, level=36)
    page = context.new_page()
    page.set_default_timeout(10_000)
    errors = capture_errors(page, "stability-stress")
    try:
        goto(page, "?standalone=1&debug=1&autostart=campaign")
        page.wait_for_selector("#game-hud:not([hidden])", timeout=12_000)
        page.wait_for_timeout(600)
        before = page.evaluate(
            """() => ({
              heap: performance.memory?.usedJSHeapSize ?? null,
              nodes: document.getElementsByTagName('*').length,
              puzzle: window.__clockworkDiagnostics?.().puzzle,
            })"""
        )
        canvas = page.locator("#game-canvas")
        canvas.focus()
        for cycle in range(72):
            if page.locator("#complete-screen:not([hidden])").count():
                page.click('[data-action="replay"]')
                page.wait_for_selector("#game-hud:not([hidden])", timeout=8_000)
                canvas.focus()
            page.keyboard.press(("ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp")[cycle % 4])
            page.keyboard.press("Enter")
            if cycle % 5 == 0:
                page.keyboard.press("z")
            if cycle % 8 == 0:
                page.keyboard.press("q")
                page.keyboard.press("e")
            if cycle % 18 == 0:
                page.click('[data-action="pause"]')
                page.wait_for_selector("#pause-overlay:not([hidden])")
                page.click('[data-action="resume"]')
                canvas.focus()
            page.wait_for_timeout(12)

        page.set_viewport_size({"width": 844, "height": 390})
        page.wait_for_timeout(260)
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(1_300)
        after = page.evaluate(
            """() => ({
              heap: performance.memory?.usedJSHeapSize ?? null,
              nodes: document.getElementsByTagName('*').length,
              overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
              screen: document.querySelector('#app')?.getAttribute('data-screen'),
              diagnostics: window.__clockworkDiagnostics?.(),
            })"""
        )
        renderer = after["diagnostics"]["renderer"]
        bounds = {
            "particleCount": 84,
            "pendingBurstCount": 20,
            "powerTransitionCount": 64,
            "impactCount": 64,
        }
        exceeded = {key: renderer.get(key) for key, limit in bounds.items() if renderer.get(key, 0) > limit}
        if exceeded:
            raise AssertionError(f"stability-stress: renderer queues exceeded bounds: {exceeded}")
        if after["nodes"] > before["nodes"] + 30:
            raise AssertionError(f"stability-stress: DOM grew unexpectedly: {before['nodes']} -> {after['nodes']}")
        if after["heap"] is not None and before["heap"] is not None and after["heap"] - before["heap"] > 16_000_000:
            raise AssertionError(f"stability-stress: heap grew by {after['heap'] - before['heap']} bytes")
        if after["overflowX"] > 2:
            raise AssertionError(f"stability-stress: horizontal overflow {after['overflowX']} px")
        if errors:
            raise AssertionError("\n".join(errors))
        return {
            "label": "stability-stress",
            "cycles": 72,
            "before": before,
            "after": after,
        }
    finally:
        context.close()


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
            launch_options: dict[str, Any] = {
                "headless": True,
                "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"],
            }
            explicit = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
            system_chromium = Path("/usr/bin/chromium")
            if explicit:
                launch_options["executable_path"] = explicit
            elif system_chromium.exists():
                launch_options["executable_path"] = str(system_chromium)
            browser = playwright.chromium.launch(**launch_options)
            try:
                scenarios = [
                    run_menu_sleep(browser),
                    run_device(
                        browser,
                        label="constrained-mobile",
                        viewport={"width": 390, "height": 844},
                        dpr=2,
                        mobile=True,
                        memory=4,
                        cores=4,
                        cpu_rate=2,
                        expected_quality="balanced",
                    ),
                    run_device(
                        browser,
                        label="strong-mobile",
                        viewport={"width": 390, "height": 844},
                        dpr=2,
                        mobile=True,
                        memory=8,
                        cores=8,
                        cpu_rate=1,
                        expected_quality="high",
                    ),
                    run_device(
                        browser,
                        label="desktop",
                        viewport={"width": 1440, "height": 900},
                        dpr=1,
                        mobile=False,
                        memory=8,
                        cores=8,
                        cpu_rate=1,
                        expected_quality="high",
                    ),
                    run_stability_stress(browser),
                ]
            finally:
                browser.close()

        report = {
            "name": "Clockwork Conservatory browser performance guardrails",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "pass": True,
            "scenarios": scenarios,
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Performance guardrails passed. Report: {REPORT_PATH}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
