#!/usr/bin/env python3
"""Generate the v1.3 cinematic runtime art pack.

The renderer still owns gameplay, hit testing, rotation, power propagation and
animation.  This script only creates independent transparent 2.5D materials for
platforms, regulators, pipes, ports, source and specimens.  No full-screen mockup
is used at runtime.
"""
from __future__ import annotations

import importlib.util
import math
import random
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "cinematic"
ULTRA_SOURCE = ROOT / "artifacts" / "source-art" / "clockwork-ultra-reference.png"
LEGACY_GENERATOR = ROOT / "scripts" / "generate_cinematic_assets.py"
V2_GENERATOR = ROOT / "scripts" / "generate_cinematic_v2_assets.py"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


legacy = load_module(LEGACY_GENERATOR, "clockwork_cinematic_legacy")
v2 = load_module(V2_GENERATOR, "clockwork_cinematic_v2")


def save(image: Image.Image, name: str, quality: int = 94) -> None:
    image.save(OUT / name, "WEBP", quality=quality, method=4, exact=True)


def alpha_composite_at(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    base.alpha_composite(layer, xy)


def vertical_cylinder(width: int, height: int, *, seed: int) -> Image.Image:
    """A dark, physically shaded bronze cylinder with a recessed glass conduit."""
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    center = height * 0.50
    radius = height * 0.31
    d = np.clip((yy - center) / radius, -1, 1)
    # Cylindrical Lambert response plus a narrow top-left specular streak.
    normal = np.sqrt(np.maximum(0.0, 1.0 - d * d))
    key = 0.30 + 0.64 * normal
    highlight = np.exp(-((d + 0.42) / 0.14) ** 2) * 0.42
    under = np.exp(-((d - 0.72) / 0.26) ** 2) * 0.40
    light = np.clip(key + highlight - under, 0.18, 1.28)
    base = np.array([147.0, 88.0, 30.0], dtype=np.float32)
    rgb = base[None, None, :] * light[..., None]
    # Warm reflected light from the left and green patina in lower recesses.
    rgb[..., 0] += (1 - xx / max(1, width - 1)) * 12
    rgb[..., 1] += np.maximum(0, d) * 3
    rng = np.random.default_rng(seed)
    rgb += rng.normal(0, 2.2, size=(height, width, 1))
    alpha = np.zeros((height, width), dtype=np.uint8)
    alpha[np.abs(d) <= 1] = 255
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
    image = Image.fromarray(rgba, "RGBA")

    draw = ImageDraw.Draw(image, "RGBA")
    y0 = round(center - radius)
    y1 = round(center + radius)
    # Recessed aether-glass channel; remains dark until runtime power is painted.
    groove_h = max(16, round(height * 0.105))
    gy0 = round(center - groove_h / 2)
    gy1 = round(center + groove_h / 2)
    draw.rounded_rectangle((20, gy0, width - 20, gy1), radius=groove_h // 2, fill=(2, 27, 31, 252), outline=(88, 61, 29, 235), width=3)
    draw.line((30, gy0 + 3, width - 30, gy0 + 3), fill=(178, 235, 211, 50), width=2)
    draw.line((30, gy1 - 3, width - 30, gy1 - 3), fill=(0, 7, 10, 235), width=3)
    # Restrained edge highlights. Avoid a flat white cartoon outline.
    draw.line((22, y0 + 4, width - 22, y0 + 4), fill=(245, 205, 116, 150), width=3)
    draw.line((24, y1 - 5, width - 24, y1 - 5), fill=(36, 17, 8, 230), width=5)
    return image


def make_pipe_v3() -> Image.Image:
    width, height = 768, 220
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((18, 91, 750, 178), radius=40, fill=(0, 0, 0, 170))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    cylinder = vertical_cylinder(width - 44, 150, seed=7317)
    image.alpha_composite(cylinder, (22, 34))
    draw = ImageDraw.Draw(image, "RGBA")

    # Substantial machined collars. Three are enough to read at 12–18 px runtime height.
    for x in (38, width // 2, width - 38):
        draw.rounded_rectangle((x - 26, 31, x + 26, 188), radius=13, fill=(42, 21, 9, 255), outline=(190, 135, 58, 245), width=7)
        draw.rounded_rectangle((x - 17, 38, x + 17, 181), radius=9, fill=(151, 87, 27, 255), outline=(239, 194, 100, 180), width=3)
        draw.line((x - 10, 45, x - 10, 173), fill=(255, 225, 148, 135), width=4)
        draw.line((x + 10, 45, x + 10, 173), fill=(54, 27, 11, 235), width=5)
        for y in (56, 164):
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(24, 12, 6, 255), outline=(223, 169, 77, 220), width=2)

    # Engraved seams and subtle verdigris spots.
    rng = random.Random(94421)
    for _ in range(150):
        x = rng.randrange(52, width - 52)
        y = rng.randrange(63, 157)
        if rng.random() < 0.55:
            color = (61, 126, 103, rng.randrange(12, 40))
        else:
            color = (255, 221, 139, rng.randrange(8, 28))
        r = rng.choice((1, 1, 1, 2))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    return ImageEnhance.Sharpness(image).enhance(1.35)


def make_coupler_v3() -> Image.Image:
    w = h = 360
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((46, 206, 314, 308), fill=(0, 0, 0, 170))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(17)))
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = 180, 168
    # Dark port body matching the reference: powered light is added live by Canvas.
    for box, fill, outline, width in [
        ((46, 70, 314, 274), (40, 21, 9, 255), (101, 61, 25, 255), 8),
        ((60, 80, 300, 262), (152, 92, 31, 255), (238, 192, 100, 230), 5),
        ((82, 97, 278, 245), (26, 17, 12, 255), (70, 39, 18, 255), 8),
        ((105, 114, 255, 228), (2, 20, 23, 255), (183, 132, 56, 220), 5),
    ]:
        draw.ellipse(box, fill=fill, outline=outline, width=width)
    # Glass recess and small specular arc.
    draw.ellipse((125, 127, 235, 214), fill=(2, 31, 35, 255), outline=(75, 111, 91, 150), width=3)
    draw.arc((136, 138, 224, 207), 200, 310, fill=(220, 241, 213, 90), width=4)
    for index in range(12):
        angle = index * math.tau / 12
        x = cx + math.cos(angle) * 105
        y = cy + math.sin(angle) * 76
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(27, 13, 6, 255), outline=(222, 167, 73, 220), width=2)
    rng = random.Random(11791)
    for _ in range(220):
        angle = rng.random() * math.tau
        radius = math.sqrt(rng.random()) * 118
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius * .72
        color = (49, 112, 91, rng.randrange(9, 36)) if rng.random() < .58 else (249, 205, 112, rng.randrange(7, 30))
        rr = rng.choice((1, 1, 1, 2))
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)
    # A small radial light falloff gives the dark port enough tonal entropy after
    # downscaling without making it appear powered.
    glaze = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glaze, "RGBA")
    gd.ellipse((82, 95, 278, 246), fill=(255, 219, 135, 18))
    gd.ellipse((118, 123, 242, 220), fill=(69, 135, 115, 20))
    glaze = glaze.filter(ImageFilter.GaussianBlur(9))
    image = Image.alpha_composite(image, glaze)
    return ImageEnhance.Sharpness(image).enhance(1.38)


def extract_reference_ring(source: np.ndarray, spec: tuple[tuple[int, int, int, int], tuple[int, int], tuple[int, int], tuple[int, int]]) -> Image.Image:
    box, center, outer, inner = spec
    x1, y1, x2, y2 = box
    crop = source[y1:y2, x1:x2].copy()
    h, w = crop.shape[:2]
    b, g, r = cv2.split(crop)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    yy, xx = np.mgrid[0:h, 0:w]
    outer_mask = ((xx - center[0]) / outer[0]) ** 2 + ((yy - center[1]) / outer[1]) ** 2 <= 1
    inner_mask = ((xx - center[0]) / inner[0]) ** 2 + ((yy - center[1]) / inner[1]) ** 2 <= 1
    brass = ((r > 58) & (r > g * 1.01) & (g > b * 1.08)) | ((hsv[..., 0] < 38) & (hsv[..., 1] > 36) & (hsv[..., 2] > 34))
    cyan = (hsv[..., 0] >= 72) & (hsv[..., 0] <= 108) & (hsv[..., 1] > 52) & (hsv[..., 2] > 92)
    alpha = ((brass | cyan | inner_mask) & outer_mask).astype(np.uint8) * 255
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    alpha = cv2.dilate(alpha, np.ones((3, 3), np.uint8), iterations=1)
    teal = (hsv[..., 0] >= 62) & (hsv[..., 0] <= 118) & (hsv[..., 1] > 25)
    alpha[teal & ~inner_mask] = 0
    alpha = (alpha * outer_mask.astype(np.uint8)).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.62)
    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    image = Image.fromarray(rgba, "RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    # Preserve source detail; only mild grading and one controlled upscale.
    image = image.resize((image.width * 4, image.height * 4), Image.Resampling.LANCZOS)
    a = image.getchannel("A")
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = (rgb - lum) * 1.04 + lum
    rgb *= np.array([0.96, 0.94, 0.90], dtype=np.float32)
    rgb = np.clip((rgb - 8) * 1.05 + 8, 0, 255).astype(np.uint8)
    color = Image.fromarray(rgb, "RGB").filter(ImageFilter.UnsharpMask(radius=1.05, percent=120, threshold=3))
    image = color.convert("RGBA")
    image.putalpha(a)
    return image


def make_mechanism_v3(reference: Image.Image, variant: int) -> Image.Image:
    size = 640
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((90, 412, 550, 566), fill=(0, 0, 0, 190))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))
    draw = ImageDraw.Draw(image, "RGBA")

    # Cast-metal plinth. It is intentionally an ellipse rather than a flat cog icon.
    draw.ellipse((118, 254, 522, 506), fill=(43, 22, 10, 255), outline=(103, 60, 23, 255), width=13)
    draw.ellipse((130, 238, 510, 474), fill=(151, 91, 30, 255), outline=(226, 177, 82, 240), width=8)
    draw.ellipse((151, 253, 489, 455), fill=(51, 28, 15, 255), outline=(252, 214, 129, 185), width=4)
    # Four heavy sockets make all topology variants compatible with live rotation.
    socket_centers = [(171, 305), (469, 305), (171, 420), (469, 420)]
    for sx, sy in socket_centers:
        draw.rounded_rectangle((sx - 43, sy - 24, sx + 43, sy + 24), radius=12, fill=(47, 23, 9, 255), outline=(184, 124, 48, 240), width=6)
        draw.ellipse((sx - 18, sy - 13, sx + 18, sy + 13), fill=(3, 27, 29, 255), outline=(229, 180, 84, 210), width=4)
    # Small secondary gears and screws create readable mechanical density.
    for gx, gy, teeth in [(224, 256, 9), (416, 256, 10), (320, 474, 8)]:
        radius = 31 if gy < 400 else 25
        pts = []
        for index in range(teeth * 2):
            angle = index * math.pi / teeth
            rr = radius if index % 2 == 0 else radius * 0.79
            pts.append((gx + math.cos(angle) * rr, gy + math.sin(angle) * rr * 0.74))
        draw.polygon(pts, fill=(116, 68, 25, 255), outline=(229, 175, 74, 210))
        draw.ellipse((gx - 11, gy - 8, gx + 11, gy + 8), fill=(8, 26, 26, 255), outline=(245, 203, 105, 210), width=3)
    for index in range(12):
        angle = index * math.tau / 12
        sx = 320 + math.cos(angle) * 178
        sy = 360 + math.sin(angle) * 102
        draw.ellipse((sx - 5, sy - 5, sx + 5, sy + 5), fill=(24, 12, 6, 255), outline=(230, 175, 78, 220), width=2)

    # Reference-derived brass regulator ring carries the painterly detail of the target art.
    ref = reference.copy()
    max_w, max_h = 360, 270
    scale = min(max_w / ref.width, max_h / ref.height)
    ref = ref.resize((max(1, round(ref.width * scale)), max(1, round(ref.height * scale))), Image.Resampling.LANCZOS)
    image.alpha_composite(ref, ((size - ref.width) // 2, 226 + (270 - ref.height) // 2))

    # Variant-specific dial marks stay subtle; the physical ports are drawn live by channels.
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = 320, 355
    symbol_color = (219, 185, 111, 135)
    if variant == 0:
        draw.arc((282, 327, 358, 383), 25, 330, fill=symbol_color, width=4)
        draw.ellipse((315, 350, 325, 360), fill=(160, 239, 216, 105))
    elif variant == 1:
        draw.line((291, cy, 349, cy), fill=symbol_color, width=5)
    elif variant == 2:
        draw.arc((292, 329, 352, 385), 185, 280, fill=symbol_color, width=5)
    else:
        draw.line((291, cy, 349, cy), fill=symbol_color, width=4)
        draw.line((cx, 330, cx, 380), fill=symbol_color, width=4)

    # Fine patina and a restrained top-left key light.
    rng = random.Random(20431 + variant * 997)
    for _ in range(170):
        angle = rng.random() * math.tau
        rad = math.sqrt(rng.random()) * 178
        x = cx + math.cos(angle) * rad
        y = 360 + math.sin(angle) * rad * 0.59
        color = (58, 126, 102, rng.randrange(8, 33)) if rng.random() < 0.62 else (255, 218, 132, rng.randrange(5, 24))
        rr = rng.choice((1, 1, 1, 2))
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)
    return ImageEnhance.Sharpness(image).enhance(1.25)


def clean_existing_plants() -> None:
    """Remove screenshot matte and tile fragments from project-owned specimens."""
    silhouettes = {
        "lumen-orchid": [(240, 170, 154, 154), (240, 338, 150, 190)],
        "moonbell": [(240, 174, 172, 166), (240, 348, 152, 190)],
        "sun-dahlia": [(240, 175, 158, 170), (240, 350, 148, 188)],
        "mist-lily": [(240, 205, 154, 196), (240, 382, 148, 166)],
        "ember-bloom": [(240, 205, 154, 198), (240, 382, 148, 166)],
    }
    for path in sorted(OUT.glob("plant-*-on.webp")):
        kind = path.name.removeprefix("plant-").removesuffix("-on.webp")
        with Image.open(path) as source:
            image = source.convert("RGBA")
        rgba = np.asarray(image, dtype=np.uint8).copy()
        rgb = rgba[..., :3]
        alpha = rgba[..., 3]
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        h, w = alpha.shape

        silhouette = Image.new("L", (w, h), 0)
        sd = ImageDraw.Draw(silhouette)
        for cx, cy, rx, ry in silhouettes[kind]:
            sd.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=255)
        # Pot pedestal and lower mechanical feet.
        sd.rounded_rectangle((108, 305, 372, 548), radius=78, fill=255)
        sd.ellipse((83, 458, 397, 588), fill=255)
        silhouette = silhouette.filter(ImageFilter.GaussianBlur(1.15))
        alpha = np.minimum(alpha, np.asarray(silhouette))

        # Remove the electric-blue matte behind pink/purple specimens while keeping
        # actual blue petals on the Lumen Orchid.
        if kind != "lumen-orchid":
            r = rgb[..., 0].astype(np.float32)
            g = rgb[..., 1].astype(np.float32)
            b = rgb[..., 2].astype(np.float32)
            cyan_matte = (g > r * 1.10) & (b > r * 1.10) & (g > 105) & (b > 115)
            if kind == "mist-lily":
                # Preserve the white flower core; only strip cyan at the silhouette.
                core = ((np.indices((h, w))[1] - w*.5)/(w*.22))**2 + ((np.indices((h, w))[0] - h*.22)/(h*.18))**2 <= 1
                cyan_matte &= ~core
            alpha[cyan_matte] = (alpha[cyan_matte].astype(np.float32) * .12).astype(np.uint8)

        # One-pixel matte contraction followed by a sub-pixel feather produces a clean
        # edge on both dark desktop scenes and bright mobile glasshouse themes.
        alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8), iterations=1)
        alpha = cv2.GaussianBlur(alpha, (0, 0), .42)
        rgba[..., 3] = alpha
        result = Image.fromarray(rgba, "RGBA")
        result = ImageEnhance.Contrast(result).enhance(1.025)
        save(result, path.name, 94)
        off_path = Path(str(path).replace("-on.webp", "-off.webp"))
        dormant = legacy.grade_dormant(result)
        save(dormant, off_path.name, 92)


def make_platform_v3(source: np.ndarray, variant: int) -> Image.Image:
    # Start from the project texture sampler, then rebuild the extrusion and bevel with
    # slimmer, darker geometry closer to the target board.
    width, height = 1024, 680
    top = [(512, 54), (984, 276), (512, 498), (40, 276)]
    extrusion = 102
    left = [top[3], top[2], (top[2][0], top[2][1] + extrusion), (top[3][0], top[3][1] + extrusion)]
    right = [top[1], top[2], (top[2][0], top[2][1] + extrusion), (top[1][0], top[1][1] + extrusion)]
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow = Image.new("RGBA", result.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((90, 390, 934, 646), fill=(0, 0, 0, 168))
    result.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))

    side_mask = ImageChops.lighter(legacy.polygon_mask(result.size, left), legacy.polygon_mask(result.size, right))
    side = legacy.gradient_image(result.size, [(0, (18, 54, 51, 255)), (.50, (5, 29, 30, 255)), (1, (1, 12, 16, 255))])
    result.alpha_composite(Image.composite(side, Image.new("RGBA", result.size), side_mask))
    draw = ImageDraw.Draw(result, "RGBA")
    draw.line([left[0], left[1], left[2], left[3], left[0]], fill=(27, 14, 7, 255), width=11, joint="curve")
    draw.line([right[0], right[1], right[2], right[3], right[0]], fill=(27, 14, 7, 255), width=11, joint="curve")
    draw.line([(58, 311), (512, 532), (966, 311)], fill=(132, 82, 32, 230), width=6, joint="curve")
    draw.line([(62, 319), (512, 542), (962, 319)], fill=(238, 188, 95, 70), width=2, joint="curve")
    draw.line([(70, 375), (512, 590), (954, 375)], fill=(83, 49, 23, 230), width=4, joint="curve")
    for x, y in [(126, 347), (260, 414), (420, 492), (604, 492), (764, 414), (898, 347)]:
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(34, 17, 8, 255), outline=(198, 144, 63, 210), width=2)

    texture = np.asarray(legacy.make_glass_texture(source, variant).convert("RGB"))
    src_pts = np.float32([[0, 0], [767, 0], [767, 767], [0, 767]])
    dst_pts = np.float32(top)
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(cv2.cvtColor(texture, cv2.COLOR_RGB2RGBA), matrix, (width, height), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_TRANSPARENT)
    top_img = Image.fromarray(warped, "RGBA")
    top_img.putalpha(legacy.polygon_mask(result.size, top, .35))
    result = Image.alpha_composite(result, top_img)

    draw = ImageDraw.Draw(result, "RGBA")
    # Dark outer body, warm mid bevel, hairline highlight: not a neon gold outline.
    draw.line(top + [top[0]], fill=(24, 12, 6, 255), width=22, joint="curve")
    draw.line(top + [top[0]], fill=(104, 61, 23, 255), width=13, joint="curve")
    draw.line(top + [top[0]], fill=(196, 140, 55, 245), width=7, joint="curve")
    draw.line(top + [top[0]], fill=(245, 207, 125, 145), width=2, joint="curve")
    inner = [(512, 79), (944, 282), (512, 474), (80, 282)]
    draw.line(inner + [inner[0]], fill=(1, 18, 21, 235), width=11, joint="curve")
    draw.line(inner + [inner[0]], fill=(206, 161, 83, 82), width=2, joint="curve")

    # Four corner bosses plus tiny engraved tracks.
    for x, y in [(512, 82), (936, 282), (512, 470), (88, 282)]:
        draw.regular_polygon((x, y, 15), 4, rotation=45, fill=(101, 59, 23, 255), outline=(219, 166, 73, 220))
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(25, 12, 6, 255), outline=(226, 176, 82, 220), width=2)
    # Etched geometry and a narrow reflection.
    draw.line([(220, 281), (512, 145), (806, 282), (512, 420), (220, 281)], fill=(181, 226, 208, 22), width=2)
    draw.ellipse((405, 226, 619, 338), outline=(204, 237, 219, 18), width=2)
    return legacy.cinematic_grade(legacy.enhance(result, sharp=1.12, color=1.02, contrast=1.08), exposure=.91, bronze_depth=.18, cyan_lift=.04)


def main() -> None:
    if not ULTRA_SOURCE.exists():
        raise SystemExit(f"Missing source art: {ULTRA_SOURCE}")
    OUT.mkdir(parents=True, exist_ok=True)
    source = cv2.imread(str(ULTRA_SOURCE), cv2.IMREAD_COLOR)
    if source is None:
        raise SystemExit("Could not decode cinematic reference")

    for variant in range(4):
        save(make_platform_v3(source, variant), f"platform-{variant}.webp", 94)

    ring_specs = [
        ((930, 140, 1085, 280), (76, 70), (50, 36), (32, 23)),
        ((665, 450, 845, 625), (90, 90), (51, 38), (33, 24)),
        ((930, 140, 1085, 280), (76, 70), (50, 36), (32, 23)),
        ((665, 450, 845, 625), (90, 90), (51, 38), (33, 24)),
    ]
    rings = [extract_reference_ring(source, spec) for spec in ring_specs]
    for variant, name in enumerate(("terminal", "straight", "elbow", "junction")):
        save(make_mechanism_v3(rings[variant], variant), f"mechanism-{name}.webp", 95)

    save(make_pipe_v3(), "pipe.webp", 95)
    save(make_coupler_v3(), "coupler.webp", 95)
    # Keep the well-tested source/lock/leak silhouettes, but regenerate machinery at
    # consistent grading and remove old plant matte.
    save(v2.make_source(), "source.webp", 95)
    save(v2.make_lock(), "lock.webp", 94)
    clean_existing_plants()
    print("Generated cinematic v3 platforms, regulators, pipe, ports and cleaned specimens.")


if __name__ == "__main__":
    main()
