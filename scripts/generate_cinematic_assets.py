#!/usr/bin/env python3
"""Generate the high-detail interactive sprite pack from original project concept art.

The output is not a screenshot overlay. It produces independent transparent runtime
sprites for the live board so generated puzzles, rotations, leaks and powered states
remain fully interactive.
"""
from __future__ import annotations

import math
import random
import warnings
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "artifacts" / "source-art"
OUT = ROOT / "public" / "assets" / "cinematic"
BOARD_SOURCE = SOURCE_DIR / "clockwork-board-reference.png"
COCKPIT_SOURCE = SOURCE_DIR / "clockwork-cockpit-reference.png"


def rgba_from_bgra(image: np.ndarray, alpha: np.ndarray) -> Image.Image:
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    return Image.fromarray(rgba)


def enhance(image: Image.Image, *, sharp: float = 1.8, color: float = 1.08, contrast: float = 1.10) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(color)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.7, percent=int(105 * sharp), threshold=2))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def cinematic_grade(
    image: Image.Image,
    *,
    exposure: float = 0.94,
    bronze_depth: float = 0.22,
    cyan_lift: float = 0.08,
) -> Image.Image:
    """Give generated sprites the darker photographic material response of the target art.

    The procedural shapes are intentionally crisp, but raw gradients can read like
    bright vector icons.  This grade preserves the precise silhouette while adding a
    directional key light, deeper bronze shadows, cooler patina and protected cyan
    highlights.  It runs once at build time, never in the game loop.
    """
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32).copy()
    rgb = rgba[..., :3]
    alpha = rgba[..., 3:4] / 255.0
    height, width = rgb.shape[:2]
    yy, xx = np.mgrid[0:height, 0:width]
    nx = xx / max(1, width - 1)
    ny = yy / max(1, height - 1)

    # Warm top-left key and deep lower-right occlusion make circular parts read as
    # machined objects rather than flat UI glyphs.
    key = np.clip(1.10 - nx * 0.18 - ny * 0.24, 0.72, 1.12)[..., None]
    rgb *= exposure * key

    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    brass = (red > green * 1.03) & (green > blue * 1.25) & (red > 72)
    shadow_factor = 1.0 - bronze_depth * (0.45 + ny * 0.55)
    rgb[..., 0][brass] *= shadow_factor[brass]
    rgb[..., 1][brass] *= (shadow_factor * 0.88)[brass]
    rgb[..., 2][brass] *= (shadow_factor * 0.72)[brass]

    # Keep aether glass luminous after the global bronze grade.
    cyan = (blue > red * 0.88) & (green > red * 1.02) & (green > 75)
    rgb[..., 1][cyan] *= 1.0 + cyan_lift
    rgb[..., 2][cyan] *= 1.0 + cyan_lift * 1.18

    # Fine patina is subtle at source resolution but survives retina downscaling.
    rng = np.random.default_rng(41873 + width * 3 + height)
    noise = rng.normal(0.0, 2.2, size=(height, width, 1)).astype(np.float32)
    rgb += noise * alpha
    rgba[..., :3] = np.clip(rgb, 0, 255)
    graded = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    graded = ImageEnhance.Contrast(graded).enhance(1.08)
    return graded.filter(ImageFilter.UnsharpMask(radius=1.15, percent=138, threshold=2))


def crop_object(
    source: np.ndarray,
    box: tuple[int, int, int, int],
    *,
    foreground_ellipses: list[tuple[float, float, float, float]],
    definite_ellipses: list[tuple[float, float, float, float]] | None = None,
    shape_ellipses: list[tuple[float, float, float, float]],
    foreground_rects: list[tuple[float, float, float, float]] | None = None,
    erase_rects: list[tuple[float, float, float, float]] | None = None,
    output_size: tuple[int, int],
    object_scale: float = 0.86,
    anchor_y: float = 0.82,
    remove_teal_backplate: bool = True,
) -> Image.Image:
    x1, y1, x2, y2 = box
    crop = source[y1:y2, x1:x2].copy()
    h, w = crop.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    border = max(2, round(min(w, h) * 0.025))
    mask[:border, :] = cv2.GC_BGD
    mask[-border:, :] = cv2.GC_BGD
    mask[:, :border] = cv2.GC_BGD
    mask[:, -border:] = cv2.GC_BGD

    for cx, cy, rx, ry in foreground_ellipses:
        cv2.ellipse(mask, (round(cx * w), round(cy * h)), (round(rx * w), round(ry * h)), 0, 0, 360, cv2.GC_PR_FGD, -1)
    for cx, cy, rx, ry in definite_ellipses or []:
        cv2.ellipse(mask, (round(cx * w), round(cy * h)), (round(rx * w), round(ry * h)), 0, 0, 360, cv2.GC_FGD, -1)
    for rect in foreground_rects or []:
        rx, ry, rw, rh = rect
        cv2.rectangle(mask, (round(rx * w), round(ry * h)), (round((rx + rw) * w), round((ry + rh) * h)), cv2.GC_FGD, -1)

    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, None, bg_model, fg_model, 8, cv2.GC_INIT_WITH_MASK)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # A hand-authored soft silhouette removes any tile fragments that GrabCut keeps
    # because brass/foliage and the illustrated glass surface share local colours.
    shape = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(shape)
    for cx, cy, rx, ry in shape_ellipses:
        draw.ellipse((round((cx-rx)*w), round((cy-ry)*h), round((cx+rx)*w), round((cy+ry)*h)), fill=255)
    for rect in foreground_rects or []:
        rx, ry, rw, rh = rect
        draw.rounded_rectangle((round(rx*w), round(ry*h), round((rx+rw)*w), round((ry+rh)*h)), radius=max(2, round(min(w,h)*0.04)), fill=255)
    shape = shape.filter(ImageFilter.GaussianBlur(max(0.75, min(w, h) * 0.012)))
    alpha = np.minimum(alpha, np.asarray(shape))

    for rx, ry, rw, rh in erase_rects or []:
        alpha[round(ry*h):round((ry+rh)*h), round(rx*w):round((rx+rw)*w)] = 0

    if remove_teal_backplate:
        hsv_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        teal_backplate = (hsv_crop[..., 0] >= 68) & (hsv_crop[..., 0] <= 108) & (hsv_crop[..., 1] >= 25) & (hsv_crop[..., 2] <= 184)
        # Feather colour-keyed glass away while retaining bright cyan energy and blue flowers.
        keyed = cv2.GaussianBlur((teal_backplate.astype(np.uint8) * 255), (0, 0), 1.15)
        alpha = (alpha.astype(np.float32) * (1.0 - keyed.astype(np.float32) / 255.0)).astype(np.uint8)

    # Keep only meaningful connected components near the centre.
    binary = (alpha > 36).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, 8)
    keep = np.zeros_like(binary)
    for index in range(1, count):
        area = stats[index, cv2.CC_STAT_AREA]
        cx, cy = centroids[index]
        near = abs(cx - w/2) < w * 0.48 and abs(cy - h*0.54) < h * 0.58
        if area >= max(12, w*h*0.0016) and near:
            keep[labels == index] = 1
    alpha = (alpha * keep).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8), iterations=1)
    alpha = cv2.GaussianBlur(alpha, (0,0), max(0.7, min(w,h)*0.006))

    object_image = enhance(rgba_from_bgra(crop, alpha), sharp=1.45)
    # Trim transparent bounds before fitting to the standard runtime canvas.
    bbox = object_image.getbbox()
    if bbox:
        object_image = object_image.crop(bbox)
    target_w, target_h = output_size
    max_w = round(target_w * object_scale)
    max_h = round(target_h * object_scale)
    scale = min(max_w / max(1, object_image.width), max_h / max(1, object_image.height))
    object_image = object_image.resize((max(1, round(object_image.width * scale)), max(1, round(object_image.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", output_size, (0,0,0,0))
    x = (target_w - object_image.width) // 2
    anchor = round(target_h * anchor_y)
    y = anchor - object_image.height
    canvas.alpha_composite(object_image, (x, y))
    return canvas



def sharpen_specimen(image: Image.Image) -> Image.Image:
    """Apply a clean, print-like edge pass without inventing crunchy outlines."""
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(1.035)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.025)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.82, percent=72, threshold=6))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result

def grade_dormant(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    luminance = rgb.mean(axis=2, keepdims=True)
    rgb = luminance * 0.18 + rgb * 0.82
    rgb *= np.array([0.72, 0.82, 0.80], dtype=np.float32)
    rgb = np.clip((rgb - 18) * 0.88 + 18, 0, 255).astype(np.uint8)
    result = Image.fromarray(rgb, "RGB").convert("RGBA")
    result.putalpha(alpha.point(lambda value: round(value * 0.94)))
    return result


def save_webp(image: Image.Image, name: str, quality: int = 92) -> None:
    image.save(OUT / name, "WEBP", quality=quality, method=4, exact=True)


def warp_tile(source: np.ndarray, center: tuple[int, int], width: int = 205, height: int = 112, size: int = 768) -> np.ndarray:
    cx, cy = center
    src = np.float32([[cx, cy-height/2], [cx+width/2, cy], [cx, cy+height/2], [cx-width/2, cy]])
    dst = np.float32([[0,0], [size-1,0], [size-1,size-1], [0,size-1]])
    matrix = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(source, matrix, (size,size), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def make_glass_texture(source: np.ndarray, variant: int) -> Image.Image:
    centers = [(610,300),(815,302),(930,355),(850,468),(760,535),(550,505),(975,545),(845,655)]
    warped = [warp_tile(source, center) for center in centers]
    candidates = []
    masks = []
    for image in warped:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        # Dark teal / blue-green glass, excluding brass and bright aether.
        clean = (
            (hsv[...,0] >= 65) & (hsv[...,0] <= 112) &
            (hsv[...,1] >= 28) & (hsv[...,2] >= 24) & (hsv[...,2] <= 195)
        )
        candidates.append(image.astype(np.float32))
        masks.append(clean)
    stack = np.stack(candidates)
    mstack = np.stack(masks)
    texture = np.zeros_like(stack[0])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        for channel in range(3):
            values = np.where(mstack, stack[...,channel], np.nan)
            texture[...,channel] = np.nanmedian(values, axis=0)
    missing = np.isnan(texture[...,0])
    texture = np.nan_to_num(texture, nan=0).astype(np.uint8)
    # Fill missing centre regions from a reflected crop and then inpaint seams.
    fallback = warped[(variant + 2) % len(warped)]
    texture[missing] = fallback[missing]
    bad = missing.astype(np.uint8) * 255
    bad = cv2.dilate(bad, np.ones((11,11), np.uint8), iterations=1)
    texture = cv2.inpaint(texture, bad, 7, cv2.INPAINT_TELEA)
    texture = cv2.bilateralFilter(texture, 7, 34, 34)

    # Colour-grade toward the deep green glass of the target cockpit while retaining
    # the local hand-painted scratches and mottling from the source art.
    hsv = cv2.cvtColor(texture, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[...,0] = np.clip(hsv[...,0] * 0.94 + (86 + variant*2) * 0.06, 0, 179)
    hsv[...,1] = np.clip(hsv[...,1] * 1.09, 0, 255)
    hsv[...,2] = np.clip(hsv[...,2] * (0.82 + variant*0.025), 0, 255)
    texture = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # Fine engraved botanical/circuit pattern and controlled wear.
    pil = Image.fromarray(cv2.cvtColor(texture, cv2.COLOR_BGR2RGB)).convert("RGBA")
    overlay = Image.new("RGBA", pil.size, (0,0,0,0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    rng = random.Random(9281 + variant*307)
    for ring in range(5):
        inset = 110 + ring * 54
        draw.ellipse((inset, inset, 768-inset, 768-inset), outline=(143,224,198,18 + ring*2), width=2)
    for index in range(14):
        angle = index * math.tau / 14 + variant*0.13
        radius = 80 + (index%4)*48
        x = 384 + math.cos(angle)*radius
        y = 384 + math.sin(angle)*radius
        draw.arc((x-70,y-34,x+70,y+34), 12, 168, fill=(239,201,111,20), width=2)
    for _ in range(260):
        x=rng.randrange(55,713);y=rng.randrange(55,713);r=rng.choice((1,1,1,2))
        color=(244,208,125,rng.randrange(8,26)) if rng.random()<0.35 else (190,246,224,rng.randrange(6,19))
        draw.ellipse((x-r,y-r,x+r,y+r),fill=color)
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(pil, overlay)


def polygon_mask(size: tuple[int,int], points: list[tuple[float,float]], blur: float = 0) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(points, fill=255)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
    return mask


def gradient_image(size: tuple[int,int], stops: list[tuple[float,tuple[int,int,int,int]]], vertical: bool=True) -> Image.Image:
    w,h=size
    array=np.zeros((h,w,4),dtype=np.uint8)
    length=h if vertical else w
    for i in range(length):
        t=i/max(1,length-1)
        left=stops[0];right=stops[-1]
        for a,b in zip(stops,stops[1:]):
            if a[0]<=t<=b[0]:left,right=a,b;break
        u=(t-left[0])/max(1e-6,right[0]-left[0])
        color=[round(left[1][c]+(right[1][c]-left[1][c])*u) for c in range(4)]
        if vertical:array[i,:,:]=color
        else:array[:,i,:]=color
    return Image.fromarray(array,"RGBA")


def make_platform(source: np.ndarray, variant: int) -> Image.Image:
    width,height=1024,720
    top=[(512,54),(984,276),(512,498),(40,276)]
    extrusion=150
    left=[top[3],top[2],(top[2][0],top[2][1]+extrusion),(top[3][0],top[3][1]+extrusion)]
    right=[top[1],top[2],(top[2][0],top[2][1]+extrusion),(top[1][0],top[1][1]+extrusion)]
    result=Image.new("RGBA",(width,height),(0,0,0,0))

    # Soft contact shadow baked into the sprite so adjacent platforms feel weighty.
    shadow=Image.new("RGBA",result.size,(0,0,0,0));sd=ImageDraw.Draw(shadow)
    sd.ellipse((92,390,932,692),fill=(0,0,0,162))
    shadow=shadow.filter(ImageFilter.GaussianBlur(28))
    result=Image.alpha_composite(result,shadow)

    side_gradient=gradient_image(result.size,[(0,(24,74,66,255)),(.48,(8,43,42,255)),(1,(2,15,19,255))])
    side_mask=ImageChops.lighter(polygon_mask(result.size,left),polygon_mask(result.size,right))
    result.alpha_composite(Image.composite(side_gradient,Image.new("RGBA",result.size),(side_mask)))
    d=ImageDraw.Draw(result,"RGBA")
    # Recessed side panels, rails and catches.
    d.line([left[0],left[1],left[2],left[3],left[0]],fill=(34,17,8,240),width=13,joint="curve")
    d.line([right[0],right[1],right[2],right[3],right[0]],fill=(34,17,8,240),width=13,joint="curve")
    d.line([(54,304),(512,530),(970,304)],fill=(218,164,72,220),width=8,joint="curve")
    d.line([(56,319),(512,548),(968,319)],fill=(255,226,151,108),width=2,joint="curve")
    d.line([(62,392),(512,615),(962,392)],fill=(122,75,32,220),width=5,joint="curve")
    d.line([(68,407),(512,630),(956,407)],fill=(245,199,112,66),width=2,joint="curve")
    for x,y in [(116,350),(228,405),(392,486),(632,486),(796,405),(908,350),(512,604)]:
        r=10
        d.ellipse((x-r,y-r,x+r,y+r),fill=(66,35,14,255),outline=(245,198,106,210),width=3)
        d.line((x-4,y,x+4,y),fill=(255,231,173,130),width=1)

    # Warp the glass material onto the isometric top face.
    texture=np.asarray(make_glass_texture(source,variant).convert("RGB"))
    src_pts=np.float32([[0,0],[767,0],[767,767],[0,767]])
    dst_pts=np.float32(top)
    matrix=cv2.getPerspectiveTransform(src_pts,dst_pts)
    warped=cv2.warpPerspective(cv2.cvtColor(texture,cv2.COLOR_RGB2RGBA),matrix,(width,height),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_TRANSPARENT)
    top_img=Image.fromarray(warped,"RGBA")
    top_img.putalpha(polygon_mask(result.size,top,0.4))
    result=Image.alpha_composite(result,top_img)

    # Deep multi-stage brass bevel. Narrower than the old vector outline, with dark
    # occlusion on the inside and a precise warm highlight on the light-facing edge.
    d=ImageDraw.Draw(result,"RGBA")
    d.line(top+[top[0]],fill=(35,18,8,255),width=24,joint="curve")
    d.line(top+[top[0]],fill=(112,64,24,255),width=15,joint="curve")
    d.line(top+[top[0]],fill=(226,171,77,255),width=10,joint="curve")
    d.line(top+[top[0]],fill=(255,230,156,205),width=3,joint="curve")
    inner=[(512,78),(946,282),(512,475),(78,282)]
    d.line(inner+[inner[0]],fill=(2,23,25,220),width=13,joint="curve")
    d.line(inner+[inner[0]],fill=(238,198,112,120),width=3,joint="curve")

    # Corner plates and photographic brass bolts.
    for x,y in [(512,82),(936,282),(512,472),(88,282)]:
        r=18
        d.regular_polygon((x,y,r),4,rotation=45,fill=(135,82,29,255),outline=(255,219,137,220))
        d.ellipse((x-7,y-7,x+7,y+7),fill=(55,29,12,255),outline=(248,201,105,245),width=2)
        d.ellipse((x-3,y-4,x+1,y),fill=(255,243,194,220))

    # Directional glass reflection and tiny edge wear.
    sheen=Image.new("RGBA",result.size,(0,0,0,0));sd=ImageDraw.Draw(sheen,"RGBA")
    sd.polygon([(120,224),(350,116),(862,358),(634,466)],fill=(230,255,249,18+variant*2))
    sd.line([(128,235),(352,130),(850,365)],fill=(255,255,255,54),width=3)
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"),polygon_mask(result.size,top)))
    result=Image.alpha_composite(result,sheen)
    return cinematic_grade(enhance(result,sharp=1.25,color=1.04,contrast=1.10), exposure=.92, bronze_depth=.19, cyan_lift=.05)


def make_pipe() -> Image.Image:
    w,h=640,160
    scale=3
    image=Image.new("RGBA",(w,h),(0,0,0,0))
    draw=ImageDraw.Draw(image,"RGBA")
    cy=h//2
    # shadow
    draw.rounded_rectangle((22,cy-31,618,cy+43),radius=30,fill=(0,0,0,118))
    # brass cylinder with many tonal bands
    for offset,color in [(-27,(70,38,16,255)),(-23,(154,94,35,255)),(-17,(238,180,82,255)),(-10,(255,228,147,255)),(-3,(188,126,50,255)),(7,(101,59,24,255)),(17,(55,31,14,255)),(24,(157,94,35,255))]:
        draw.line((32,cy+offset,608,cy+offset),fill=color,width=8)
    draw.line((34,cy-13,606,cy-13),fill=(255,245,199,155),width=3)
    draw.line((34,cy+19,606,cy+19),fill=(25,13,7,210),width=4)
    # central glass groove
    draw.rounded_rectangle((34,cy-7,606,cy+8),radius=7,fill=(6,37,40,242),outline=(235,205,125,150),width=2)
    # collars and engraved ribs
    for x in (44,184,320,456,596):
        draw.rounded_rectangle((x-18,cy-42,x+18,cy+42),radius=8,fill=(70,38,15,255),outline=(255,216,126,220),width=3)
        draw.rectangle((x-11,cy-37,x+11,cy+37),fill=(185,119,43,255))
        draw.line((x-7,cy-34,x-7,cy+34),fill=(255,235,170,180),width=3)
        draw.line((x+8,cy-34,x+8,cy+34),fill=(63,32,13,220),width=3)
        for yy in (cy-27,cy+27):
            draw.ellipse((x-4,yy-4,x+4,yy+4),fill=(37,19,8,255),outline=(250,204,105,210),width=1)
    # subtle hand-painted patina/noise clipped to body
    rng=random.Random(7317)
    for _ in range(380):
        x=rng.randrange(30,610);y=rng.randrange(cy-28,cy+29)
        if rng.random()<0.55:color=(255,220,137,rng.randrange(10,54))
        else:color=(24,67,58,rng.randrange(10,45))
        r=rng.choice((1,1,1,2));draw.ellipse((x-r,y-r,x+r,y+r),fill=color)
    image=image.filter(ImageFilter.GaussianBlur(0.28))
    return cinematic_grade(enhance(image,sharp=1.2,color=1.06,contrast=1.11), exposure=.91, bronze_depth=.25, cyan_lift=.06)


def _mix_rgba(left: tuple[int, int, int, int], right: tuple[int, int, int, int], amount: float) -> tuple[int, int, int, int]:
    amount = max(0.0, min(1.0, amount))
    return tuple(round(left[index] + (right[index] - left[index]) * amount) for index in range(4))  # type: ignore[return-value]


def _sample_stops(stops: list[tuple[float, tuple[int, int, int, int]]], value: float) -> tuple[int, int, int, int]:
    value = max(0.0, min(1.0, value))
    for left, right in zip(stops, stops[1:]):
        if left[0] <= value <= right[0]:
            span = max(1e-6, right[0] - left[0])
            return _mix_rgba(left[1], right[1], (value - left[0]) / span)
    return stops[-1][1]


def _radial_disc(
    image: Image.Image,
    center: tuple[int, int],
    radius: int,
    stops: list[tuple[float, tuple[int, int, int, int]]],
    *,
    y_scale: float = 1.0,
    steps: int = 120,
) -> None:
    """Paint a smooth radial/elliptical gradient using supersampled rings."""
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = center
    for index in range(steps, 0, -1):
        t = index / steps
        color = _sample_stops(stops, 1 - t)
        rx = radius * t
        ry = radius * y_scale * t
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=color)


def _gear_polygon(cx: float, cy: float, root: float, outer: float, teeth: int, phase: float = 0.0) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for index in range(teeth * 4):
        angle = phase + index * math.pi * 2 / (teeth * 4)
        position = index % 4
        radius = outer if position in (1, 2) else root
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def make_mechanism(variant: int) -> Image.Image:
    """Create a clean, topology-specific cinematic regulator without screenshot fragments."""
    logical = 640
    supersample = 2
    size = logical * supersample
    scale = supersample
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")

    def p(value: float) -> int:
        return round(value * scale)

    def points(values: list[tuple[float, float]]) -> list[tuple[int, int]]:
        return [(p(x), p(y)) for x, y in values]

    cx, cy = p(320), p(337)
    # Weight and contact shadow.
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow, "RGBA")
    shadow_draw.ellipse((p(104), p(356), p(536), p(558)), fill=(0, 0, 0, 175))
    shadow = shadow.filter(ImageFilter.GaussianBlur(p(23)))
    image = Image.alpha_composite(image, shadow)
    draw = ImageDraw.Draw(image, "RGBA")

    # Isometric pedestal with separate dark and illuminated rails.
    base_points = [(320, 205), (535, 330), (320, 463), (105, 330)]
    lower_points = [(105, 330), (320, 463), (320, 520), (105, 387)]
    right_points = [(535, 330), (320, 463), (320, 520), (535, 387)]
    draw.polygon(points(lower_points), fill=(5, 27, 29, 248), outline=(111, 67, 27, 255))
    draw.polygon(points(right_points), fill=(3, 19, 23, 248), outline=(111, 67, 27, 255))
    draw.line(points(base_points + [base_points[0]]), fill=(33, 18, 9, 255), width=p(18), joint="curve")
    draw.line(points(base_points + [base_points[0]]), fill=(122, 71, 28, 255), width=p(12), joint="curve")
    draw.line(points(base_points + [base_points[0]]), fill=(229, 173, 77, 255), width=p(7), joint="curve")
    draw.line(points(base_points + [base_points[0]]), fill=(255, 233, 163, 205), width=p(2), joint="curve")

    # Four port saddles make the object read as industrial hardware instead of an icon.
    port_angles = [0, math.pi / 2, math.pi, math.pi * 1.5]
    enabled_ports = {
        0: {0},
        1: {0, 2},
        2: {0, 1},
        3: {0, 1, 2, 3},
    }[variant]
    for index, angle in enumerate(port_angles):
        length = 158 if index in enabled_ports else 126
        start = 126
        ux, uy = math.cos(angle), math.sin(angle)
        vx, vy = -uy, ux
        outer = (320 + ux * length, 337 + uy * length * 0.70)
        inner = (320 + ux * start, 337 + uy * start * 0.70)
        half = 18 if index in enabled_ports else 12
        polygon = [
            (inner[0] + vx * half, inner[1] + vy * half * 0.7),
            (outer[0] + vx * half, outer[1] + vy * half * 0.7),
            (outer[0] - vx * half, outer[1] - vy * half * 0.7),
            (inner[0] - vx * half, inner[1] - vy * half * 0.7),
        ]
        draw.polygon(points(polygon), fill=(38, 20, 10, 255), outline=(243, 198, 105, 235))
        inner_polygon = []
        for x, y in polygon:
            inner_polygon.append((320 + (x - 320) * 0.91, 337 + (y - 337) * 0.91))
        draw.polygon(points(inner_polygon), fill=(173, 109, 40, 255), outline=(255, 229, 155, 165))
        if index in enabled_ports:
            groove_end = (320 + ux * (length - 14), 337 + uy * (length - 14) * 0.70)
            groove_start = (320 + ux * (start + 5), 337 + uy * (start + 5) * 0.70)
            draw.line(points([groove_start, groove_end]), fill=(3, 38, 42, 255), width=p(9))
            draw.line(points([groove_start, groove_end]), fill=(115, 245, 224, 90), width=p(2))

    # Brass pedestal ellipse.
    pedestal = Image.new("RGBA", image.size, (0, 0, 0, 0))
    _radial_disc(
        pedestal,
        (cx, p(368)),
        p(184),
        [
            (0, (255, 244, 186, 255)),
            (.16, (238, 193, 101, 255)),
            (.42, (165, 99, 34, 255)),
            (.72, (65, 34, 14, 255)),
            (1, (20, 11, 7, 230)),
        ],
        y_scale=.58,
        steps=150,
    )
    image = Image.alpha_composite(image, pedestal)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((p(139), p(260), p(501), p(472)), outline=(255, 228, 151, 205), width=p(5))
    draw.ellipse((p(153), p(272), p(487), p(459)), outline=(44, 22, 9, 220), width=p(9))

    # Top gear body and teeth.
    gear = _gear_polygon(320, 329, 133, 181, [18, 12, 10, 8][variant], phase=variant * .07)
    draw.polygon(points(gear), fill=(40, 21, 10, 255), outline=(255, 223, 137, 225))
    inner_gear = _gear_polygon(320, 329, 118, 164, [18, 12, 10, 8][variant], phase=variant * .07)
    # Metallic gradient approximation using concentric rings clipped by the gear mask.
    gear_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gear_mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(gear_mask).polygon(points(inner_gear), fill=255)
    _radial_disc(
        gear_layer,
        (cx, p(329)),
        p(169),
        [
            (0, (255, 242, 178, 255)),
            (.22, (232, 179, 78, 255)),
            (.52, (151, 89, 31, 255)),
            (.74, (67, 35, 14, 255)),
            (1, (231, 174, 72, 255)),
        ],
        steps=170,
    )
    gear_layer.putalpha(ImageChops.multiply(gear_layer.getchannel("A"), gear_mask))
    image = Image.alpha_composite(image, gear_layer)
    draw = ImageDraw.Draw(image, "RGBA")

    # Variant-specific crown silhouette.
    if variant == 0:
        for index in range(8):
            angle = index * math.pi / 4
            x1, y1 = 320 + math.cos(angle) * 77, 329 + math.sin(angle) * 77
            x2, y2 = 320 + math.cos(angle) * 130, 329 + math.sin(angle) * 130
            draw.line(points([(x1, y1), (x2, y2)]), fill=(255, 222, 136, 235), width=p(10))
    elif variant == 1:
        for angle in (0, math.pi):
            ux, uy = math.cos(angle), math.sin(angle)
            vx, vy = -uy, ux
            poly = [
                (320 + ux * 52 + vx * 27, 329 + uy * 52 + vy * 27),
                (320 + ux * 133 + vx * 18, 329 + uy * 133 + vy * 18),
                (320 + ux * 133 - vx * 18, 329 + uy * 133 - vy * 18),
                (320 + ux * 52 - vx * 27, 329 + uy * 52 - vy * 27),
            ]
            draw.polygon(points(poly), fill=(224, 165, 68, 250), outline=(255, 237, 171, 220))
    elif variant == 2:
        for angle in (0, math.pi / 2):
            ux, uy = math.cos(angle), math.sin(angle)
            vx, vy = -uy, ux
            poly = [
                (320 + ux * 55 + vx * 26, 329 + uy * 55 + vy * 26),
                (320 + ux * 145 + vx * 13, 329 + uy * 145 + vy * 13),
                (320 + ux * 155, 329 + uy * 155),
                (320 + ux * 145 - vx * 13, 329 + uy * 145 - vy * 13),
                (320 + ux * 55 - vx * 26, 329 + uy * 55 - vy * 26),
            ]
            draw.polygon(points(poly), fill=(217, 153, 57, 250), outline=(255, 232, 161, 220))
    else:
        for angle in port_angles:
            x, y = 320 + math.cos(angle) * 124, 329 + math.sin(angle) * 124
            draw.rounded_rectangle((p(x - 29), p(y - 22), p(x + 29), p(y + 22)), radius=p(9), fill=(207, 142, 52, 250), outline=(255, 229, 151, 225), width=p(3))
            draw.ellipse((p(x - 7), p(y - 7), p(x + 7), p(y + 7)), fill=(45, 24, 10, 255), outline=(255, 223, 135, 220), width=p(2))

    # Recessed mechanical ring and engraved dial.
    for radius, color, width in [(112, (31, 16, 8, 255), 15), (99, (245, 197, 98, 255), 7), (87, (8, 37, 38, 255), 18), (72, (221, 164, 70, 255), 6)]:
        draw.ellipse((p(320-radius), p(329-radius), p(320+radius), p(329+radius)), outline=color, width=p(width))

    # Jeweled glass core.
    core = Image.new("RGBA", image.size, (0, 0, 0, 0))
    _radial_disc(
        core,
        (cx, p(329)),
        p(66),
        [
            (0, (255, 255, 238, 255)),
            (.15, (123, 255, 236, 255)),
            (.40, (19, 148, 144, 255)),
            (.72, (5, 52, 57, 255)),
            (1, (1, 13, 18, 255)),
        ],
        steps=100,
    )
    image = Image.alpha_composite(image, core)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((p(263), p(272), p(377), p(386)), outline=(255, 241, 185, 215), width=p(4))
    draw.arc((p(278), p(286), p(360), p(368)), 202, 315, fill=(255, 255, 255, 210), width=p(5))

    # Screws, etched ticks and patina.
    for index in range(12):
        angle = index * math.pi * 2 / 12 + .12
        x, y = 320 + math.cos(angle) * 150, 329 + math.sin(angle) * 150
        draw.ellipse((p(x-5), p(y-5), p(x+5), p(y+5)), fill=(31, 16, 7, 255), outline=(255, 218, 124, 230), width=p(2))
    rng = random.Random(8119 + variant * 313)
    for _ in range(420):
        angle = rng.random() * math.pi * 2
        radius = math.sqrt(rng.random()) * 176
        x = 320 + math.cos(angle) * radius
        y = 329 + math.sin(angle) * radius
        color = (73, 145, 119, rng.randrange(8, 36)) if rng.random() < .55 else (255, 225, 145, rng.randrange(5, 28))
        r = rng.choice((1, 1, 1, 2))
        draw.ellipse((p(x-r), p(y-r), p(x+r), p(y+r)), fill=color)

    image = image.resize((logical, logical), Image.Resampling.LANCZOS)
    return cinematic_grade(enhance(image, sharp=1.5, color=1.06, contrast=1.12), exposure=.90, bronze_depth=.29, cyan_lift=.09)


def make_source() -> Image.Image:
    logical = 640
    supersample = 2
    size = logical * supersample
    scale = supersample
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")

    def p(value: float) -> int:
        return round(value * scale)

    # Contact shadow and weighted isometric base.
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.ellipse((p(92), p(420), p(548), p(582)), fill=(0, 0, 0, 182))
    shadow = shadow.filter(ImageFilter.GaussianBlur(p(22)))
    image = Image.alpha_composite(image, shadow)
    draw = ImageDraw.Draw(image, "RGBA")
    base = [(320, 264), (540, 390), (320, 516), (100, 390)]
    draw.line([(p(x), p(y)) for x, y in base + [base[0]]], fill=(39, 19, 8, 255), width=p(18), joint="curve")
    draw.line([(p(x), p(y)) for x, y in base + [base[0]]], fill=(190, 123, 43, 255), width=p(10), joint="curve")
    draw.line([(p(x), p(y)) for x, y in base + [base[0]]], fill=(255, 225, 145, 210), width=p(3), joint="curve")

    # Four pipe ports.
    for angle in (0, math.pi / 2, math.pi, math.pi * 1.5):
        ux, uy = math.cos(angle), math.sin(angle)
        start, end = 124, 194
        x1, y1 = 320 + ux * start, 382 + uy * start * .55
        x2, y2 = 320 + ux * end, 382 + uy * end * .55
        draw.line((p(x1), p(y1), p(x2), p(y2)), fill=(48, 24, 10, 255), width=p(30))
        draw.line((p(x1), p(y1), p(x2), p(y2)), fill=(218, 157, 60, 255), width=p(20))
        draw.line((p(x1), p(y1-3), p(x2), p(y2-3)), fill=(255, 234, 165, 170), width=p(4))

    # Cylindrical brass reactor body.
    body = Image.new("RGBA", image.size, (0, 0, 0, 0))
    _radial_disc(
        body,
        (p(320), p(404)),
        p(172),
        [(0, (255, 239, 171, 255)), (.18, (230, 177, 78, 255)), (.46, (145, 82, 27, 255)), (.73, (54, 27, 11, 255)), (1, (20, 10, 7, 238))],
        y_scale=.58,
        steps=150,
    )
    image = Image.alpha_composite(image, body)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((p(148), p(307), p(492), p(500)), outline=(255, 230, 156, 220), width=p(6))
    draw.ellipse((p(166), p(322), p(474), p(485)), outline=(41, 21, 9, 235), width=p(12))

    # Ornate upper cage.
    for radius, color, width in [(142, (39, 20, 9, 255), 18), (131, (224, 165, 68, 255), 10), (117, (255, 230, 153, 190), 3), (101, (6, 41, 43, 255), 19)]:
        draw.ellipse((p(320-radius), p(300-radius*.56), p(320+radius), p(300+radius*.56)), outline=color, width=p(width))
    for index in range(8):
        angle = index * math.pi * 2 / 8
        x1, y1 = 320 + math.cos(angle) * 69, 300 + math.sin(angle) * 69 * .56
        x2, y2 = 320 + math.cos(angle) * 128, 300 + math.sin(angle) * 128 * .56
        draw.line((p(x1), p(y1), p(x2), p(y2)), fill=(235, 184, 85, 245), width=p(9))
        draw.line((p(x1), p(y1-2), p(x2), p(y2-2)), fill=(255, 241, 181, 160), width=p(2))

    # Luminous aether core.
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    for radius, alpha in [(150, 9), (120, 18), (94, 36), (72, 70)]:
        glow_draw.ellipse((p(320-radius), p(255-radius), p(320+radius), p(255+radius)), fill=(72, 255, 236, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(p(18)))
    image = Image.alpha_composite(image, glow)
    core = Image.new("RGBA", image.size, (0, 0, 0, 0))
    _radial_disc(core, (p(320), p(253)), p(73), [(0, (255,255,255,255)), (.16,(202,255,249,255)), (.36,(75,255,232,255)), (.65,(10,153,158,255)), (1,(1,30,42,245))], steps=120)
    image = Image.alpha_composite(image, core)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((p(248), p(181), p(392), p(325)), outline=(255, 250, 215, 225), width=p(5))
    draw.arc((p(264), p(198), p(378), p(312)), 205, 315, fill=(255, 255, 255, 215), width=p(6))

    # Double orbital rings and a star-shaped focus.
    orbital = Image.new("RGBA", image.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(orbital, "RGBA")
    od.arc((p(93), p(78), p(547), p(421)), 200, 340, fill=(148,255,242,230), width=p(8))
    od.arc((p(126), p(96), p(514), p(392)), 18, 160, fill=(255,236,158,190), width=p(5))
    od.arc((p(148), p(105), p(492), p(382)), 196, 340, fill=(255,255,255,110), width=p(2))
    orbital = orbital.filter(ImageFilter.GaussianBlur(p(.45)))
    image = Image.alpha_composite(image, orbital)
    draw = ImageDraw.Draw(image, "RGBA")
    star: list[tuple[int, int]] = []
    for index in range(16):
        angle = -math.pi/2 + index * math.pi / 8
        radius = 58 if index % 2 == 0 else 22
        star.append((p(320 + math.cos(angle)*radius), p(253 + math.sin(angle)*radius)))
    draw.polygon(star, fill=(225,255,247,245), outline=(255,255,255,255))

    # Brass screws and patina.
    for index in range(12):
        angle = index * math.pi * 2 / 12
        x, y = 320 + math.cos(angle) * 151, 405 + math.sin(angle) * 86
        draw.ellipse((p(x-5), p(y-5), p(x+5), p(y+5)), fill=(34,17,7,255), outline=(255,218,121,230), width=p(2))
    rng = random.Random(14813)
    for _ in range(320):
        angle = rng.random() * math.pi * 2
        radius = math.sqrt(rng.random()) * 170
        x = 320 + math.cos(angle) * radius
        y = 395 + math.sin(angle) * radius * .58
        color = (55, 131, 106, rng.randrange(8, 38)) if rng.random() < .62 else (255, 221, 136, rng.randrange(4, 25))
        r = rng.choice((1,1,1,2))
        draw.ellipse((p(x-r), p(y-r), p(x+r), p(y+r)), fill=color)

    image = image.resize((logical, logical), Image.Resampling.LANCZOS)
    return cinematic_grade(enhance(image, sharp=1.55, color=1.07, contrast=1.13), exposure=.91, bronze_depth=.24, cyan_lift=.12)


def make_coupler() -> Image.Image:
    logical = 320
    supersample = 3
    size = logical * supersample
    s = supersample
    image = Image.new("RGBA", (size, size), (0,0,0,0))
    shadow = Image.new("RGBA", image.size, (0,0,0,0))
    sd = ImageDraw.Draw(shadow,"RGBA")
    sd.ellipse((52*s,126*s,268*s,236*s),fill=(0,0,0,150))
    shadow=shadow.filter(ImageFilter.GaussianBlur(11*s))
    image=Image.alpha_composite(image,shadow)
    ring=Image.new("RGBA",image.size,(0,0,0,0))
    _radial_disc(ring,(160*s,156*s),112*s,[(0,(255,245,189,255)),(.18,(230,180,83,255)),(.43,(154,91,31,255)),(.72,(56,29,12,255)),(1,(225,164,65,255))],y_scale=.64,steps=120)
    image=Image.alpha_composite(image,ring)
    draw=ImageDraw.Draw(image,"RGBA")
    draw.ellipse((73*s,101*s,247*s,211*s),fill=(5,24,27,255),outline=(255,223,139,220),width=5*s)
    draw.ellipse((102*s,119*s,218*s,193*s),fill=(2,43,48,255),outline=(121,245,221,120),width=3*s)
    draw.arc((112*s,127*s,208*s,187*s),205,318,fill=(255,255,255,150),width=4*s)
    for x,y in ((65,156),(255,156),(160,91),(160,221)):
        draw.ellipse(((x-8)*s,(y-8)*s,(x+8)*s,(y+8)*s),fill=(42,21,9,255),outline=(255,217,119,230),width=2*s)
    image=image.resize((logical,logical),Image.Resampling.LANCZOS)
    return cinematic_grade(enhance(image,sharp=1.35,color=1.06,contrast=1.11), exposure=.90, bronze_depth=.27, cyan_lift=.08)


def make_lock() -> Image.Image:
    logical_w, logical_h = 360, 420
    supersample=3
    s=supersample
    image=Image.new("RGBA",(logical_w*s,logical_h*s),(0,0,0,0))
    shadow=Image.new("RGBA",image.size,(0,0,0,0));sd=ImageDraw.Draw(shadow,"RGBA")
    sd.ellipse((55*s,300*s,305*s,390*s),fill=(0,0,0,155));shadow=shadow.filter(ImageFilter.GaussianBlur(13*s));image=Image.alpha_composite(image,shadow)
    draw=ImageDraw.Draw(image,"RGBA")
    # Ornate shackle.
    draw.arc((82*s,35*s,278*s,255*s),185,355,fill=(39,20,9,255),width=42*s)
    draw.arc((82*s,35*s,278*s,255*s),185,355,fill=(207,143,53,255),width=28*s)
    draw.arc((92*s,45*s,268*s,245*s),185,355,fill=(255,232,158,190),width=5*s)
    # Body with bevel and jewel.
    body=Image.new("RGBA",image.size,(0,0,0,0))
    _radial_disc(body,(180*s,285*s),145*s,[(0,(255,243,184,255)),(.17,(229,178,78,255)),(.45,(150,88,30,255)),(.75,(58,30,13,255)),(1,(223,160,61,255))],y_scale=.72,steps=140)
    image=Image.alpha_composite(image,body);draw=ImageDraw.Draw(image,"RGBA")
    draw.rounded_rectangle((48*s,192*s,312*s,368*s),radius=44*s,outline=(255,229,150,220),width=6*s)
    draw.rounded_rectangle((69*s,211*s,291*s,348*s),radius=34*s,fill=(5,32,34,255),outline=(63,29,11,235),width=10*s)
    draw.regular_polygon((180*s,279*s,57*s),8,rotation=22.5,fill=(201,137,49,255),outline=(255,228,147,230))
    draw.ellipse((147*s,246*s,213*s,312*s),fill=(5,55,59,255),outline=(126,250,226,140),width=4*s)
    draw.polygon([(180*s,259*s),(196*s,289*s),(187*s,321*s),(173*s,321*s),(164*s,289*s)],fill=(9,18,18,255),outline=(255,221,126,210))
    for angle in range(0,360,45):
        rad=math.radians(angle);x=180+math.cos(rad)*105;y=281+math.sin(rad)*70
        draw.ellipse(((x-5)*s,(y-5)*s,(x+5)*s,(y+5)*s),fill=(37,18,7,255),outline=(255,215,113,230),width=2*s)
    image=image.resize((logical_w,logical_h),Image.Resampling.LANCZOS)
    return cinematic_grade(enhance(image,sharp=1.45,color=1.06,contrast=1.12), exposure=.89, bronze_depth=.30, cyan_lift=.05)


def main() -> None:
    if not BOARD_SOURCE.exists() or not COCKPIT_SOURCE.exists():
        raise SystemExit("Missing original source art under artifacts/source-art.")
    OUT.mkdir(parents=True,exist_ok=True)
    board=cv2.imread(str(BOARD_SOURCE),cv2.IMREAD_COLOR)
    cockpit=cv2.imread(str(COCKPIT_SOURCE),cv2.IMREAD_COLOR)
    if board is None or cockpit is None:
        raise SystemExit("Could not decode source art.")

    save_webp(make_platform(board,0),"platform-0.webp",92)
    save_webp(make_platform(board,1),"platform-1.webp",92)
    save_webp(make_platform(board,2),"platform-2.webp",92)
    save_webp(make_platform(board,3),"platform-3.webp",92)
    save_webp(make_pipe(),"pipe.webp",93)

    for variant, name in enumerate(("terminal", "straight", "elbow", "junction")):
        save_webp(make_mechanism(variant), f"mechanism-{name}.webp", 94)
    save_webp(make_source(), "source.webp", 94)
    save_webp(make_coupler(), "coupler.webp", 94)
    save_webp(make_lock(), "lock.webp", 94)
    legacy_mechanism = OUT / "mechanism.webp"
    if legacy_mechanism.exists():
        legacy_mechanism.unlink()

    leak=crop_object(board,(422,232,553,416),foreground_ellipses=[(.54,.62,.34,.40),(.54,.33,.23,.34)],definite_ellipses=[(.54,.63,.18,.26),(.54,.28,.09,.22)],shape_ellipses=[(.54,.58,.37,.46)],foreground_rects=[(.30,.58,.46,.29)],erase_rects=[(0,0,.30,.28)],output_size=(480,640),object_scale=.90,anchor_y=.91)
    save_webp(leak,"leak.webp",94)

    plant_specs={
        "lumen-orchid":((646,93,782,268),[(.50,.34,.27,.28),(.50,.68,.25,.24)],[(.50,.38,.41,.36),(.50,.69,.35,.29)]),
        "sun-dahlia":((876,91,1019,272),[(.50,.34,.27,.27),(.50,.68,.27,.25)],[(.50,.37,.40,.36),(.50,.69,.35,.30)]),
        "moonbell":((1160,210,1334,412),[(.53,.33,.28,.28),(.53,.67,.27,.23)],[(.53,.37,.39,.36),(.53,.68,.34,.29)]),
        "mist-lily":((574,345,744,528),[(.51,.31,.31,.29),(.51,.68,.26,.24)],[(.51,.36,.42,.38),(.51,.68,.35,.29)]),
        "ember-bloom":((628,668,792,820),[(.50,.33,.30,.28),(.50,.69,.29,.25)],[(.50,.38,.41,.38),(.50,.69,.37,.30)]),
    }
    for kind,(box,fg,shape) in plant_specs.items():
        on=crop_object(board,box,foreground_ellipses=fg,definite_ellipses=[(.50,.31,.15,.17),(.50,.66,.18,.18)],shape_ellipses=shape,foreground_rects=[(.34,.58,.32,.29)],output_size=(480,640),object_scale=.89,anchor_y=.91)
        on=sharpen_specimen(on)
        save_webp(grade_dormant(on),f"plant-{kind}-off.webp",92)
        save_webp(on,f"plant-{kind}-on.webp",94)


if __name__ == "__main__":
    main()
