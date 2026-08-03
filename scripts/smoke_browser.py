#!/usr/bin/env python3
"""Visual smoke test using a self-contained in-memory ESM loader.

The execution environment may block browser navigation. This loader injects the
production build into an about:blank page without changing application code.
Requires Python Playwright and a Chromium binary.
"""
from __future__ import annotations

import json
import os
import posixpath
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTIFACTS = ROOT / "artifacts"
CHROMIUM = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
IMPORT_RE = re.compile(r"(?P<prefix>\b(?:from\s*|import\s*)[(']?\s*[\"'])(?P<path>\.{1,2}/[^\"']+)(?P<suffix>[\"'])")


def collect_modules() -> dict[str, str]:
    modules: dict[str, str] = {}
    for path in sorted((DIST / "src").rglob("*.js")):
        logical = path.relative_to(DIST).as_posix()
        source = path.read_text(encoding="utf-8")

        def replace(match: re.Match[str]) -> str:
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(logical), match.group("path")))
            return f'{match.group("prefix")}clockwork/{resolved}{match.group("suffix")}'

        modules[f"clockwork/{logical}"] = IMPORT_RE.sub(replace, source)
    return modules


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Python Playwright is not installed; install it to run visual smoke tests.", file=sys.stderr)
        return 2

    subprocess.run(["node", "scripts/build.mjs"], cwd=ROOT, check=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    modules = collect_modules()
    css = (DIST / "src" / "styles.css").read_text(encoding="utf-8")
    html = f"""<!doctype html><html lang='en'><head>
      <meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
      <style>{css}</style></head><body><main id='app' aria-busy='true'></main></body></html>"""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROMIUM,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        try:
            scenarios = [
                ("menu-desktop.png", None, 1440, 900),
                ("game-desktop.png", "campaign", 1440, 900),
                ("tutorial-mobile.png", "campaign", 390, 844),
                ("game-mobile.png", "daily", 390, 844),
                ("game-landscape.png", "daily", 844, 390),
            ]
            for filename, action, width, height in scenarios:
                page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
                errors: list[str] = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.set_content(html, wait_until="domcontentloaded")
                page.evaluate(
                    """async ({ modules }) => {
                      window.__savedProgress = null;
                      window.ArkadiumGameSDK = {
                        getInstance: async () => ({
                          lifecycle: {
                            LifecycleEvent: { GAME_PAUSE: 'pause', GAME_RESUME: 'resume' },
                            registerEventCallback: () => undefined,
                            onTestReady: () => undefined,
                            onGameStart: () => undefined,
                            onGameEnd: () => undefined,
                            onLevelStart: () => undefined,
                            onLevelEnd: () => undefined,
                            onChangeScore: () => undefined,
                          },
                          auth: { isUserAuthorized: () => false },
                          persistence: {
                            getLocalStorageItem: () => null,
                            setLocalStorageItem: (_key, value) => {
                              window.__savedProgress = structuredClone(value);
                            },
                          },
                          analytics: {},
                        }),
                      };
                      const imports = {};
                      for (const [name, source] of Object.entries(modules)) {
                        imports[name] = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
                      }
                      const map = document.createElement('script');
                      map.type = 'importmap';
                      map.textContent = JSON.stringify({ imports });
                      document.head.append(map);
                      await import('clockwork/src/main.js');
                    }""",
                    {"modules": modules},
                )
                page.locator("#app[data-loaded='true']").wait_for(timeout=8_000)
                if action:
                    page.locator(f"[data-action='{action}']").click()
                    page.locator("#app[data-screen='playing']").wait_for(timeout=8_000)
                page.wait_for_timeout(900)
                page.screenshot(path=str(ARTIFACTS / filename), full_page=True)
                if filename == "game-desktop.png":
                    page.locator("#game-canvas").click(position={"x": width / 2, "y": height / 2})
                    page.locator("#app[data-state='celebrating']").wait_for(timeout=4_000)
                    page.wait_for_timeout(420)
                    page.screenshot(path=str(ARTIFACTS / "victory-desktop.png"), full_page=True)
                    page.locator("#app[data-screen='complete']").wait_for(timeout=5_000)
                    page.wait_for_timeout(650)
                    page.screenshot(path=str(ARTIFACTS / "completion-desktop.png"), full_page=True)
                    unlock = page.locator("[data-unlock-message]").inner_text()
                    if "Aster" not in unlock:
                        raise RuntimeError(f"Expected first specimen unlock, received: {unlock!r}")
                    active_run_persisted = page.evaluate("Boolean(window.__savedProgress?.activeRun)")
                    if active_run_persisted:
                        raise RuntimeError("Clean level completion must clear the persisted active run")
                if errors:
                    raise RuntimeError(f"Browser errors in {filename}: {' | '.join(errors)}")
                has_overflow = page.locator("body").evaluate("node => node.scrollWidth > node.clientWidth + 1")
                if has_overflow:
                    raise RuntimeError(f"Horizontal overflow detected in {filename}")
                if action and page.locator("canvas#game-canvas").count() != 1:
                    raise RuntimeError(f"Canvas missing in {filename}")
                page.close()

            # Simulate an SDK that becomes available only after the standalone timeout and
            # after the player has already started a level. The lifecycle outbox must replay
            # every mandatory event in the original order.
            page = browser.new_page(viewport={"width": 900, "height": 700}, device_scale_factor=1)
            page.route("**/sdk/v2/sdk.js", lambda route: route.abort())
            page.set_content(html, wait_until="domcontentloaded")
            page.evaluate(
                """async ({ modules }) => {
                  const imports = {};
                  for (const [name, source] of Object.entries(modules)) {
                    imports[name] = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
                  }
                  const map = document.createElement('script');
                  map.type = 'importmap';
                  map.textContent = JSON.stringify({ imports });
                  document.head.append(map);
                  await import('clockwork/src/main.js');
                }""",
                {"modules": modules},
            )
            page.locator("#app[data-loaded='true']").wait_for(timeout=8_000)
            page.locator("[data-action='campaign']").click()
            page.locator("#app[data-screen='playing']").wait_for(timeout=4_000)
            page.evaluate(
                """() => {
                  window.__lifecycleReplay = [];
                  const record = (name) => (...args) => window.__lifecycleReplay.push([name, ...args]);
                  window.ArkadiumGameSDK = {
                    getInstance: async () => ({
                      lifecycle: {
                        LifecycleEvent: { GAME_PAUSE: 'pause', GAME_RESUME: 'resume' },
                        registerEventCallback: () => undefined,
                        onTestReady: record('onTestReady'),
                        onGameStart: record('onGameStart'),
                        onGameEnd: record('onGameEnd'),
                        onLevelStart: record('onLevelStart'),
                        onLevelEnd: record('onLevelEnd'),
                        onChangeScore: record('onChangeScore'),
                      },
                      analytics: {},
                    }),
                  };
                  const script = document.querySelector('script[data-arkadium-game-sdk]');
                  if (!script) throw new Error('Arkadium SDK script marker missing');
                  script.dispatchEvent(new Event('load'));
                }"""
            )
            page.wait_for_function("window.__lifecycleReplay?.length >= 3", timeout=4_000)
            replay = page.evaluate("window.__lifecycleReplay.map(entry => entry[0])")
            if replay[:3] != ["onTestReady", "onGameStart", "onLevelStart"]:
                raise RuntimeError(f"Late SDK lifecycle replay is out of order: {replay}")
            page.close()
        finally:
            browser.close()
    print("Browser smoke test passed. Screenshots written to artifacts/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
