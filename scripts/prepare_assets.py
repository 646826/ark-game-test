#!/usr/bin/env python3
"""Rebuild packaged greenhouse backdrops from the committed concept images.

The script deliberately removes all central UI/game-board regions. Shipped gameplay
text and mechanisms are always live DOM/Canvas content, never baked into art.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
OUTPUT = ROOT / "public" / "assets"
OUTPUT.mkdir(parents=True, exist_ok=True)


def environment(source: Path, *, brightness: float, saturation: float, blur: float) -> Image.Image:
    image = Image.open(source).convert("RGB")
    # Remove the concept's HUD and toolbar before selecting environment-only edges.
    image = image.crop((0, int(image.height * 0.105), image.width, int(image.height * 0.88)))
    width, height = 1600, 900
    left = image.crop((0, 0, int(image.width * 0.24), image.height)).resize((992, height), Image.Resampling.LANCZOS)
    right = image.crop((int(image.width * 0.78), 0, image.width, image.height)).resize((992, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), (4, 28, 28))
    canvas.paste(left, (0, 0))

    mask = Image.new("L", right.size, 255)
    draw = ImageDraw.Draw(mask)
    overlap = 384
    for x in range(overlap):
        draw.line((x, 0, x, height), fill=round(255 * x / max(1, overlap - 1)))
    canvas.paste(right, (width - right.width, 0), mask)

    center_box = (400, 0, 1200, height)
    center = canvas.crop(center_box).filter(ImageFilter.GaussianBlur(18))
    center_mask = Image.new("L", center.size, 0)
    center_draw = ImageDraw.Draw(center_mask)
    for x in range(center.width):
        position = x / max(1, center.width - 1)
        alpha = round(235 * (1 - abs(position - 0.5) * 2) ** 0.55)
        center_draw.line((x, 0, x, height), fill=alpha)
    canvas.paste(center, center_box[:2], center_mask)

    canvas = ImageEnhance.Brightness(canvas).enhance(brightness)
    canvas = ImageEnhance.Color(canvas).enhance(saturation)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur)).convert("RGBA")

    teal = Image.new("RGBA", canvas.size, (4, 35, 33, 54))
    canvas = Image.alpha_composite(canvas, teal)

    radial = Image.radial_gradient("L").resize(canvas.size, Image.Resampling.BICUBIC)
    vignette_alpha = ImageOps.invert(radial).point(lambda value: round(value * 0.38))
    vignette = Image.new("RGBA", canvas.size, (0, 7, 8, 0))
    vignette.putalpha(vignette_alpha)
    canvas = Image.alpha_composite(canvas, vignette)
    return canvas.convert("RGB")


def save(name: str, image: Image.Image, quality: int = 87) -> None:
    destination = OUTPUT / name
    image.save(destination, "WEBP", quality=quality, method=6)
    print(f"{name}: {destination.stat().st_size / 1024:.1f} KiB")


garden = environment(ARTIFACTS / "gameplay-concept.webp", brightness=0.86, saturation=0.93, blur=4)
menu = ImageEnhance.Color(ImageEnhance.Brightness(garden).enhance(1.22)).enhance(1.12)
map_background = environment(ARTIFACTS / "map-concept.webp", brightness=0.82, saturation=0.88, blur=5)
victory = environment(ARTIFACTS / "victory-concept.webp", brightness=0.9, saturation=1.05, blur=5)
portrait = garden.crop((430, 0, 1170, 900)).resize((720, 1280), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(3))

save("garden-desktop.webp", garden, 86)
save("atrium-desktop.webp", menu, 87)
save("map-desktop.webp", map_background, 86)
save("victory-desktop.webp", victory, 86)
save("garden-portrait.webp", portrait, 86)
