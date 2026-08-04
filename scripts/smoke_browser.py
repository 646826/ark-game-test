#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)

subprocess.run(["node", str(ROOT / "scripts" / "build.mjs")], check=True)

try:
    from playwright.sync_api import Page, Playwright, sync_playwright
except ImportError:
    print("Playwright is not installed; build smoke check passed and browser screenshots were skipped.")
    raise SystemExit(0)


def compiled_import_map() -> dict[str, str]:
    module_paths = sorted((DIST / "src").rglob("*.js"))
    aliases = {path.resolve(): f"@cw/{path.relative_to(DIST).as_posix()}" for path in module_paths}
    pattern = re.compile(r"(?P<prefix>\bfrom\s+|\bimport\s+)(?P<quote>['\"])(?P<spec>\.\.?/[^'\"]+)(?P=quote)")
    imports: dict[str, str] = {}

    for path in module_paths:
        source = path.read_text(encoding="utf-8")

        def replace(match: re.Match[str]) -> str:
            target = (path.parent / match.group("spec")).resolve()
            alias = aliases.get(target)
            if not alias:
                raise RuntimeError(f"Unmapped module import {match.group('spec')} in {path}")
            return f"{match.group('prefix')}{match.group('quote')}{alias}{match.group('quote')}"

        rewritten = pattern.sub(replace, source)
        encoded = base64.b64encode(rewritten.encode("utf-8")).decode("ascii")
        imports[aliases[path.resolve()]] = f"data:text/javascript;base64,{encoded}"
    return imports


IMPORT_MAP = json.dumps({"imports": compiled_import_map()}, separators=(",", ":"))


def visual_page() -> str:
    asset_files = {
        "atrium": DIST / "assets" / "atrium-desktop.webp",
        "garden": DIST / "assets" / "garden-desktop.webp",
        "portrait": DIST / "assets" / "garden-portrait.webp",
        "map": DIST / "assets" / "map-desktop.webp",
        "victory": DIST / "assets" / "victory-desktop.webp",
    }
    assets = {
        key: f"data:image/webp;base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"
        for key, path in asset_files.items()
    }
    css = (DIST / "src" / "styles.css").read_text(encoding="utf-8")
    asset_map = json.dumps(assets, separators=(",", ":"))
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="arkadium-app-insights-id" content=""><style>{css}</style><script>window.__clockworkAssetUrls={asset_map};</script><script type="importmap">{IMPORT_MAP}</script></head><body><main id="app" aria-busy="true"></main><script type="module">import "@cw/src/main.js";</script></body></html>"""


def sdk_bridge_page() -> str:
    sdk_mock = r"""
      window.__sdkEvents=[]; window.__sdkCallbacks={};
      const rec=(method,...args)=>window.__sdkEvents.push({method,args});
      const lifecycle={
        LifecycleEvent:{GAME_PAUSE:'GAME_PAUSE',GAME_RESUME:'GAME_RESUME'},
        registerEventCallback(event,callback){window.__sdkCallbacks[event]=callback;},
        async onTestReady(){rec('onTestReady');}, async onGameStart(){rec('onGameStart');},
        async onChangeScore(score){rec('onChangeScore',score);}, async onLevelStart(level){rec('onLevelStart',level);},
        async onLevelEnd(level){rec('onLevelEnd',level);}, async onGameEnd(){rec('onGameEnd');}
      };
      const analytics=async (...args)=>rec('analytics',...args);
      window.ArkadiumGameSDK={getInstance:async()=>({
        lifecycle,
        persistence:{async getLocalStorageItem(){return null},async setLocalStorageItem(){rec('localSave')},async getRemoteStorageItem(){return null},async setRemoteStorageItem(){rec('remoteSave')}},
        auth:{async isUserAuthorized(){return false}},
        ads:{async showInterstitialAd(){rec('interstitial')},async showRewardAd(){return {value:1}}},
        leaderboard:{async isSupported(){return true},async postScore(score){rec('postScore',score)}},
        analytics:{setDimensions:analytics,sendStartButtonClickedEvent:analytics,sendGameScreenPageView:analytics,sendGameplayReadyEvent:analytics,sendRoundEvent:analytics,sendRoundEndEvent:analytics,sendGameEndEvent:analytics,sendGameOverPageView:analytics,sendFirstMoveEvent:analytics,sendAppStartedEvent:analytics,sendIntroScreenPageView:analytics,sendMainScreenReadyEvent:analytics,sendMenuActionsEvent:analytics,sendHelpEvent:analytics,sendEvent:analytics,sendErrorEvent:analytics,trackException:analytics}
      })};
    """
    test_module = r"""
      import { ArkadiumBridge } from '@cw/src/platform/arkadium.js';
      const bridge = new ArkadiumBridge('0.3.0');
      bridge.bindPauseHandlers(()=>{window.__paused=true},()=>{window.__resumed=true});
      await bridge.initialize();
      await bridge.markReady();
      await bridge.gameStart();
      await bridge.levelStart(1);
      await bridge.levelEnd(1, 1234);
      await bridge.gameWon(1234, 42);
      await bridge.saveProgress('smoke', {version:3,campaignLevel:1,totalScore:0,totalStars:0,completedLevels:0,streak:0,bestDaily:{},unlockedSpecimens:['lumen'],settings:{language:'en',sound:true,reducedMotion:false,highContrast:false,quality:'auto',tutorialHints:true}});
      window.__rewarded = await bridge.showRewarded();
      await bridge.gameEnd();
      window.__bridgeStatus = bridge.status;
      window.__sdkDone = true;
    """
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="arkadium-app-insights-id" content=""><script>{sdk_mock}</script><script type="importmap">{IMPORT_MAP}</script></head><body><script type="module">{test_module}</script></body></html>"""


def launch_browser(playwright: Playwright):
    browser_path = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    options: dict[str, object] = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-gpu-sandbox",
            "--disable-background-networking",
        ],
    }
    if browser_path:
        options["executable_path"] = browser_path
    return playwright.chromium.launch(**options)


def dispatch_enter(page: Page) -> None:
    page.evaluate("""() => {
      const canvas = document.querySelector('#game-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game canvas is unavailable');
      window.dispatchEvent(new Event('focus'));
      canvas.focus({preventScroll:true});
      canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    }""")


def run_visual(playwright: Playwright, html: str, name: str, viewport: dict[str, int]) -> None:
    print(f"Visual smoke: {name}", flush=True)
    browser = launch_browser(playwright)
    try:
        context = browser.new_context(viewport=viewport, reduced_motion="reduce", device_scale_factor=1)
        page = context.new_page()
        errors: list[str] = []
        console_errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.set_content(html, wait_until="load")
        page.wait_for_selector('#app[data-loaded="true"]', timeout=15_000)
        page.wait_for_timeout(300)
        page.screenshot(path=str(ARTIFACTS / f"smoke-{name}.png"))

        page.locator('[data-action="campaign"]').click()
        page.wait_for_selector('#game-hud:not([hidden])', timeout=8_000)
        page.wait_for_timeout(350)
        page.screenshot(path=str(ARTIFACTS / f"smoke-game-{name}.png"))

        dispatch_enter(page)
        page.wait_for_selector('#completion-overlay:not([hidden])', timeout=5_000)
        page.wait_for_timeout(120)
        page.screenshot(path=str(ARTIFACTS / f"smoke-victory-{name}.png"))

        page.locator('#completion-overlay [data-action="menu"]').click()
        page.wait_for_selector('#menu-overlay:not([hidden])', timeout=5_000)
        page.locator('[data-action="daily"]').click()
        page.wait_for_selector('#game-hud:not([hidden])', timeout=8_000)
        page.wait_for_timeout(350)
        page.screenshot(path=str(ARTIFACTS / f"smoke-daily-{name}.png"))

        if errors or console_errors:
            raise RuntimeError("; ".join(errors + console_errors))
        context.close()
    finally:
        browser.close()


def run_sdk_bridge(playwright: Playwright) -> None:
    print("SDK bridge smoke", flush=True)
    browser = launch_browser(playwright)
    try:
        context = browser.new_context(viewport={"width": 800, "height": 600}, device_scale_factor=1)
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.set_content(sdk_bridge_page(), wait_until="load")
        page.wait_for_function("window.__sdkDone === true", timeout=10_000)
        state = page.evaluate("({methods:window.__sdkEvents.map(event=>event.method),callbacks:Object.keys(window.__sdkCallbacks),status:window.__bridgeStatus,rewarded:window.__rewarded})")
        required = ['onTestReady', 'onGameStart', 'onLevelStart', 'onLevelEnd', 'onChangeScore', 'onGameEnd']
        missing = [method for method in required if method not in state['methods']]
        if missing or errors:
            raise RuntimeError(f"SDK smoke failure: missing={missing}; errors={errors}")
        if state['status'] != 'connected' or state['rewarded'] is not True:
            raise RuntimeError(f"SDK capability smoke failure: {state}")
        if state['methods'].index('onGameStart') > state['methods'].index('onLevelStart') or state['methods'].index('onLevelStart') > state['methods'].index('onLevelEnd'):
            raise RuntimeError(f"SDK lifecycle ordering failure: {state['methods']}")
        if 'GAME_PAUSE' not in state['callbacks'] or 'GAME_RESUME' not in state['callbacks']:
            raise RuntimeError(f"SDK pause/resume callbacks were not registered: {state['callbacks']}")
        context.close()
    finally:
        browser.close()


VISUAL_HTML = visual_page()
with sync_playwright() as playwright:
    run_visual(playwright, VISUAL_HTML, "desktop", {"width": 1440, "height": 900})
    run_visual(playwright, VISUAL_HTML, "mobile", {"width": 390, "height": 844})
    run_sdk_bridge(playwright)

print("Desktop/mobile menu, gameplay, victory, dense portrait, and Arkadium bridge smoke tests passed.")
sys.stdout.flush()
os._exit(0)
