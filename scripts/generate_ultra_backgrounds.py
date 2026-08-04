#!/usr/bin/env python3
"""Build clean, detailed conservatory scene plates without baked gameplay UI.

The source plates are original project artwork. This pass restores local contrast,
adds crisp greenhouse structure at the perimeter, and keeps the central play area
quiet so the live Canvas board remains the only puzzle visible.
"""
from __future__ import annotations

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"

SCENES = {
    "menu": {"warm": (230, 179, 86), "aqua": (65, 214, 190), "center": 0.19, "particles": 210},
    "map": {"warm": (238, 187, 92), "aqua": (66, 205, 184), "center": 0.25, "particles": 250},
    "game": {"warm": (240, 184, 86), "aqua": (61, 220, 204), "center": 0.34, "particles": 170},
    "victory": {"warm": (255, 204, 102), "aqua": (92, 246, 217), "center": 0.15, "particles": 420},
}


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    w, h = image.size
    tw, th = size
    scale = max(tw / w, th / h)
    resized = image.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def radial_mask(size: tuple[int, int], center: tuple[float, float], radius: float, strength: int) -> Image.Image:
    w, h = size
    mask = Image.new("L", size)
    px = mask.load()
    cx, cy = center[0] * w, center[1] * h
    max_r = radius * max(w, h)
    for y in range(h):
        dy = y - cy
        for x in range(w):
            d = math.sqrt((x - cx) ** 2 + dy ** 2) / max_r
            t = max(0.0, 1.0 - d)
            px[x, y] = int(strength * t * t)
    return mask


def add_greenhouse_structure(base: Image.Image, scene: str, seed: int) -> Image.Image:
    random.seed(seed)
    w, h = base.size
    cfg = SCENES[scene]
    warm = cfg["warm"]
    aqua = cfg["aqua"]
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    # Tall brass ribs and glasshouse arches at the edges. Multiple strokes create
    # believable bevels while staying cheap in the browser because this is baked.
    rib_color = (*warm, 84)
    rib_shadow = (30, 19, 9, 128)
    rib_highlight = (255, 229, 156, 72)
    margin = int(w * 0.035)
    for side in (-1, 1):
        x = margin if side < 0 else w - margin
        for offset in (0, int(w * 0.025), int(w * 0.05)):
            xx = x + side * offset
            draw.line((xx + side * 7, -30, xx + side * 2, h + 50), fill=rib_shadow, width=max(8, w // 180))
            draw.line((xx, -30, xx, h + 50), fill=rib_color, width=max(5, w // 260))
            draw.line((xx - side * 2, -30, xx - side * 2, h + 50), fill=rib_highlight, width=max(1, w // 900))

    # Roof arcs and mullions.
    for inset in (0.0, 0.11, 0.22):
        box = (
            int(w * (0.03 + inset)),
            int(-h * (0.64 - inset * 0.7)),
            int(w * (0.97 - inset)),
            int(h * (0.62 + inset * 0.55)),
        )
        draw.arc(box, 2, 178, fill=rib_shadow, width=max(9, w // 170))
        draw.arc(box, 2, 178, fill=rib_color, width=max(4, w // 300))
        draw.arc(box, 2, 178, fill=rib_highlight, width=max(1, w // 1000))

    # Fine glass seams are intentionally subtle and mostly visible in the upper half.
    for i in range(1, 11):
        x = int(w * i / 11)
        draw.line((x, 0, int(w / 2 + (x - w / 2) * 0.63), int(h * 0.58)), fill=(151, 225, 215, 19), width=1)
    for j in range(1, 5):
        y = int(h * (0.08 + j * 0.10))
        draw.arc((int(w * 0.08), int(-h * 0.45 + j * h * 0.07), int(w * 0.92), int(h * 0.54 + j * h * 0.05)), 6, 174, fill=(175, 232, 220, 14), width=1)

    # Warm hanging lanterns around the perimeter.
    lanterns = [(0.08, 0.24), (0.92, 0.20), (0.12, 0.64), (0.88, 0.62)]
    for lx, ly in lanterns:
        cx, cy = int(w * lx), int(h * ly)
        r = max(8, w // 100)
        draw.line((cx, 0, cx, cy - r), fill=(*warm, 75), width=max(1, w // 900))
        draw.rounded_rectangle((cx - r, cy - r, cx + r, cy + r * 2), radius=r // 3, fill=(39, 25, 12, 190), outline=(*warm, 160), width=max(1, w // 700))
        draw.ellipse((cx - r * 0.42, cy - r * 0.30, cx + r * 0.42, cy + r * 1.05), fill=(255, 214, 122, 150))

    # Vines/leaves around corners, with smaller leaves higher up for depth.
    leaf_palette = [(17, 78, 48, 145), (30, 108, 61, 132), (55, 133, 69, 112), (75, 151, 77, 82)]
    for side in (-1, 1):
        for i in range(90):
            y = random.randint(int(h * 0.05), h + 20)
            edge_factor = (y / h) ** 1.3
            x = random.randint(-25, int(w * (0.115 + edge_factor * 0.045)))
            if side > 0:
                x = w - x
            size = random.randint(max(3, w // 380), max(7, w // 130))
            color = random.choice(leaf_palette)
            angle = random.uniform(-0.9, 0.9)
            dx = int(math.cos(angle) * size)
            dy = int(math.sin(angle) * size * 0.5)
            draw.ellipse((x - size, y - size // 2, x + size, y + size // 2), fill=color)
            draw.line((x - dx, y - dy, x + dx, y + dy), fill=(139, 177, 101, 50), width=1)

    # A small number of flowers makes the scene feel cultivated without competing
    # with interactive plant tiles.
    flower_colors = [(230, 128, 190, 130), (125, 154, 255, 125), (246, 190, 88, 120)]
    for _ in range(42):
        side = random.choice((-1, 1))
        x = random.randint(20, int(w * 0.13))
        if side > 0:
            x = w - x
        y = random.randint(int(h * 0.30), h - 10)
        r = random.randint(2, max(3, w // 450))
        color = random.choice(flower_colors)
        for p in range(5):
            a = p * math.tau / 5
            px = x + math.cos(a) * r * 1.3
            py = y + math.sin(a) * r * 0.85
            draw.ellipse((px-r, py-r, px+r, py+r), fill=color)
        draw.ellipse((x-r//2, y-r//2, x+r//2+1, y+r//2+1), fill=(255, 219, 126, 185))

    # Fireflies / brass dust. Keep the center sparser during gameplay.
    particle_count = int(cfg["particles"])
    for _ in range(particle_count):
        x = random.randrange(w)
        y = random.randrange(h)
        nx = abs(x / w - 0.5) * 2
        ny = abs(y / h - 0.5) * 2
        if scene == "game" and random.random() > min(1.0, 0.25 + nx * 0.9 + ny * 0.25):
            continue
        radius = random.choice((1, 1, 1, 2, 2, 3))
        color = warm if random.random() < 0.68 else aqua
        alpha = random.randint(45, 150)
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(*color, alpha))

    # A quiet central vignette preserves board readability and guarantees there is
    # never a second baked puzzle behind the live board.
    center_mask = radial_mask(base.size, (0.5, 0.52), 0.64, int(255 * cfg["center"]))
    center_dark = Image.new("RGBA", base.size, (0, 13, 15, 255))
    overlay = Image.alpha_composite(overlay, Image.composite(center_dark, Image.new("RGBA", base.size), center_mask))

    # Warm and aqua pools at the edges.
    for center, color, strength, radius in [((0.12, 0.36), warm, 110, 0.28), ((0.87, 0.28), aqua, 72, 0.30), ((0.50, 0.04), warm, 45, 0.42)]:
        mask = radial_mask(base.size, center, radius, strength)
        tint = Image.new("RGBA", base.size, (*color, 255))
        overlay = Image.alpha_composite(overlay, Image.composite(tint, Image.new("RGBA", base.size), mask))

    overlay = overlay.filter(ImageFilter.GaussianBlur(max(0.35, w / 4200)))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def finish(source: Path, output: Path, scene: str, size: tuple[int, int], seed: int) -> None:
    base = cover(Image.open(source).convert("RGB"), size)
    base = ImageEnhance.Color(base).enhance(1.18)
    base = ImageEnhance.Contrast(base).enhance(1.18)
    base = ImageEnhance.Brightness(base).enhance(0.94 if scene == "game" else 1.0)
    # Controlled unsharp pass restores metal/glass edges but avoids ringing in foliage.
    base = base.filter(ImageFilter.UnsharpMask(radius=2.1, percent=155, threshold=4))
    result = add_greenhouse_structure(base, scene, seed).convert("RGB")
    result.save(output, "WEBP", quality=88, method=6)


def main() -> None:
    for index, scene in enumerate(("menu", "map", "game", "victory")):
        finish(ASSETS / f"ambient-{scene}.webp", ASSETS / f"ambient-{scene}-ultra.webp", scene, (1600, 900), 12811 + index * 97)
    # Mobile uses the clean portrait source and the gameplay palette. A narrower
    # central vignette leaves room for the vertical live board.
    finish(ASSETS / "ambient-mobile.webp", ASSETS / "ambient-mobile-ultra.webp", "game", (720, 1280), 13777)


if __name__ == "__main__":
    main()
