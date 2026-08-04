#!/usr/bin/env python3
"""Generate reproducible premium raster art for Clockwork Conservatory.

The renderer uses these transparent WebP sprites as high-detail layers while
keeping all gameplay geometry, lighting and animation dynamic in Canvas 2D.
"""
from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "hd"
OUT.mkdir(parents=True, exist_ok=True)

S = 2
SIZE = 512
CANVAS = SIZE * S
random.seed(104729)


def sc(value: float) -> int:
    return int(round(value * S))


def points(values: Iterable[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(sc(x), sc(y)) for x, y in values]


def layer() -> Image.Image:
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


def alpha_composite(base: Image.Image, overlay: Image.Image) -> None:
    base.alpha_composite(overlay)


def radial_gradient(size: tuple[int, int], center: tuple[float, float], radius: float,
                    stops: list[tuple[float, tuple[int, int, int, int]]]) -> Image.Image:
    import numpy as np
    w, h = size
    cx, cy = center
    yy, xx = np.ogrid[:h, :w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(radius, 1)
    stops = sorted(stops)
    xp = np.array([item[0] for item in stops], dtype=np.float32)
    rgba = np.empty((h, w, 4), dtype=np.uint8)
    flat = dist.ravel()
    for channel in range(4):
        fp = np.array([item[1][channel] for item in stops], dtype=np.float32)
        rgba[..., channel] = np.interp(flat, xp, fp).reshape(h, w).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def linear_gradient(size: tuple[int, int], start: tuple[int, int, int, int], end: tuple[int, int, int, int], vertical=True) -> Image.Image:
    w, h = size
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    length = h if vertical else w
    for i in range(length):
        t = i / max(1, length - 1)
        color = tuple(int(start[j] + (end[j] - start[j]) * t) for j in range(4))
        if vertical:
            draw.line((0, i, w, i), fill=color)
        else:
            draw.line((i, 0, i, h), fill=color)
    return image


def gradient_in_mask(mask: Image.Image, gradient: Image.Image) -> Image.Image:
    result = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    result.paste(gradient, (0, 0), mask)
    return result


def polygon_mask(vertices: list[tuple[int, int]]) -> Image.Image:
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).polygon(vertices, fill=255)
    return mask


def ellipse_gradient(box: tuple[float, float, float, float], stops: list[tuple[float, tuple[int, int, int, int]]]) -> Image.Image:
    x0, y0, x1, y1 = map(sc, box)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    grad = radial_gradient((w, h), (w * .38, h * .30), max(w, h) * .62, stops)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, w - 1, h - 1), fill=255)
    result = layer()
    result.paste(grad, (x0, y0), mask)
    return result


def draw_glow(base: Image.Image, shape: Image.Image, radius: float = 14, strength: float = 1.0) -> None:
    glow = shape.filter(ImageFilter.GaussianBlur(sc(radius)))
    if strength != 1:
        glow = ImageEnhance.Brightness(glow).enhance(strength)
    alpha_composite(base, glow)


def draw_radial_metal(base: Image.Image, box: tuple[float, float, float, float],
                      colors=((255, 232, 147, 255), (183, 119, 42, 255), (72, 40, 16, 255), (223, 164, 65, 255)),
                      outline=(255, 221, 124, 255), width=2.0) -> None:
    alpha_composite(base, ellipse_gradient(box, [(0, colors[0]), (.37, colors[1]), (.72, colors[2]), (1, colors[3])]))
    d = ImageDraw.Draw(base)
    d.ellipse(tuple(sc(v) for v in box), outline=outline, width=sc(width))


def downsave(image: Image.Image, name: str, quality: int = 90) -> None:
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    # Preserve transparency while reducing barely-visible alpha noise.
    r, g, b, a = image.split()
    a = a.point(lambda value: 0 if value < 2 else value)
    image = Image.merge("RGBA", (r, g, b, a))
    image.save(OUT / name, "WEBP", quality=quality, method=6, lossless=False, exact=True)


def draw_brass_rivet(base: Image.Image, x: float, y: float, radius: float) -> None:
    alpha_composite(base, ellipse_gradient((x-radius, y-radius, x+radius, y+radius), [
        (0, (255, 246, 189, 255)), (.28, (239, 188, 82, 255)), (.68, (117, 64, 21, 255)), (1, (44, 25, 13, 255)),
    ]))
    d = ImageDraw.Draw(base)
    d.arc(tuple(sc(v) for v in (x-radius*.65, y-radius*.65, x+radius*.65, y+radius*.65)), 205, 338, fill=(255, 242, 180, 215), width=sc(max(.6, radius*.15)))


def generate_tile() -> None:
    img = layer()
    top = points([(256, 42), (482, 174), (256, 307), (30, 174)])
    lower = [(x, y + sc(83)) for x, y in top]

    shadow = layer(); sd = ImageDraw.Draw(shadow)
    sd.ellipse((sc(44), sc(186), sc(470), sc(431)), fill=(0, 0, 0, 175))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sc(24)))
    alpha_composite(img, shadow)

    sides = layer(); d = ImageDraw.Draw(sides)
    d.polygon([top[3], top[2], lower[2], lower[3]], fill=(22, 57, 53, 255), outline=(111, 73, 29, 255))
    d.polygon([top[1], top[2], lower[2], lower[1]], fill=(5, 29, 31, 255), outline=(83, 52, 22, 255))
    # Ornate side rails.
    for offset in (17, 39, 61):
        yoff = sc(offset)
        d.line((top[3][0], top[3][1] + yoff, top[2][0], top[2][1] + yoff), fill=(157, 101, 40, 175), width=sc(2))
        d.line((top[1][0], top[1][1] + yoff, top[2][0], top[2][1] + yoff), fill=(114, 73, 32, 165), width=sc(2))
    # Decorative side diamonds.
    for t in (0.18, .42, .66, .86):
        x = top[3][0] + (top[2][0] - top[3][0]) * t
        y = top[3][1] + (top[2][1] - top[3][1]) * t + sc(42)
        rr = sc(5)
        d.polygon([(x, y-rr), (x+rr, y), (x, y+rr), (x-rr, y)], fill=(212, 155, 62, 210), outline=(255, 222, 138, 190))
    alpha_composite(img, sides)

    mask = polygon_mask(top)
    glass = linear_gradient((CANVAS, CANVAS), (42, 126, 115, 255), (5, 41, 44, 255), vertical=True)
    # Add subtle mottled glass texture.
    noise = Image.effect_noise((CANVAS, CANVAS), 26).convert("L")
    noise = ImageEnhance.Contrast(noise).enhance(.65)
    tint = Image.new("RGBA", (CANVAS, CANVAS), (100, 215, 190, 0))
    tint.putalpha(noise.point(lambda v: int(v * .14)))
    glass = Image.alpha_composite(glass, tint)
    alpha_composite(img, gradient_in_mask(mask, glass))

    d = ImageDraw.Draw(img)
    # Multi-layer beveled frame.
    for inset, color, width in [(0, (63, 36, 15, 255), 10), (4, (241, 191, 83, 255), 4), (10, (108, 69, 29, 255), 5), (16, (222, 162, 65, 245), 2)]:
        cx, cy = 256, 174
        w, h = 452 - inset * 2, 265 - inset * 1.25
        poly = points([(cx, cy-h/2), (cx+w/2, cy), (cx, cy+h/2), (cx-w/2, cy)])
        d.line(poly + [poly[0]], fill=color, width=sc(width), joint="curve")

    inner = points([(256, 73), (438, 174), (256, 276), (74, 174)])
    # Etched geometric circuits and botanical filigree.
    clip = polygon_mask(inner)
    engraving = layer(); e = ImageDraw.Draw(engraving)
    e.line(points([(92, 174), (256, 82), (420, 174), (256, 266), (92, 174)]), fill=(198, 240, 211, 58), width=sc(1.4))
    e.line(points([(128, 174), (256, 102), (384, 174), (256, 246), (128, 174)]), fill=(247, 205, 111, 50), width=sc(1))
    for r in (32, 54, 78):
        e.ellipse((sc(256-r), sc(174-r*.55), sc(256+r), sc(174+r*.55)), outline=(163, 227, 202, 38), width=sc(1))
    for angle in range(0, 360, 30):
        a = math.radians(angle)
        x1, y1 = 256 + math.cos(a)*38, 174 + math.sin(a)*22
        x2, y2 = 256 + math.cos(a)*116, 174 + math.sin(a)*66
        e.line((sc(x1), sc(y1), sc(x2), sc(y2)), fill=(230, 194, 105, 35), width=sc(1))
    # Fern curves.
    for side in (-1, 1):
        curve = []
        for i in range(28):
            t = i / 27
            x = 256 + side * (32 + 92*t)
            y = 174 + math.sin(t*math.pi*1.1) * 24 - 35 + t*70
            curve.append((sc(x), sc(y)))
        e.line(curve, fill=(198, 236, 197, 45), width=sc(1.3))
        for i in range(4, 25, 4):
            x, y = curve[i]
            e.ellipse((x-sc(7), y-sc(2.5), x+sc(7), y+sc(2.5)), outline=(204, 242, 205, 34), width=sc(1))
    engraving.putalpha(ImageChops.multiply(engraving.getchannel("A"), clip))
    alpha_composite(img, engraving)

    # Glass highlight bands.
    sheen = layer(); sh = ImageDraw.Draw(sheen)
    sh.polygon(points([(76, 147), (250, 47), (292, 70), (112, 173)]), fill=(255, 255, 245, 22))
    sh.line(points([(106, 204), (256, 118), (406, 204)]), fill=(170, 255, 230, 48), width=sc(2))
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"), mask))
    alpha_composite(img, sheen)

    for x, y in [(73, 174), (256, 68), (439, 174), (256, 280)]:
        draw_brass_rivet(img, x, y, 8.5)
    downsave(img, "tile-base.webp", 92)


def gear_shape(center=(256, 256), outer=150, inner=121, teeth=16) -> Image.Image:
    img = layer(); d = ImageDraw.Draw(img)
    cx, cy = center
    shadow = layer(); sd = ImageDraw.Draw(shadow)
    sd.ellipse((sc(cx-outer*1.04), sc(cy-outer*.75), sc(cx+outer*1.04), sc(cy+outer*.85)), fill=(0,0,0,160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sc(14)))
    alpha_composite(img, shadow)
    # Teeth with alternating brass shades.
    for i in range(teeth):
        angle = 2 * math.pi * i / teeth
        tangent = angle + math.pi / 2
        r = outer - 12
        x, y = cx + math.cos(angle)*r, cy + math.sin(angle)*r
        tooth = layer(); td = ImageDraw.Draw(tooth)
        w, h = 34, 22
        td.rounded_rectangle((sc(cx-w/2), sc(cy-h/2), sc(cx+w/2), sc(cy+h/2)), radius=sc(5), fill=(185 if i%2 else 225, 126 if i%2 else 169, 52 if i%2 else 74, 255), outline=(255, 225, 139, 240), width=sc(2))
        tooth = tooth.rotate(math.degrees(tangent), center=(sc(cx), sc(cy)), resample=Image.Resampling.BICUBIC)
        tooth = ImageChops.offset(tooth, sc(x-cx), sc(y-cy))
        alpha_composite(img, tooth)
    draw_radial_metal(img, (cx-inner, cy-inner, cx+inner, cy+inner), width=5)
    d = ImageDraw.Draw(img)
    d.ellipse((sc(cx-97), sc(cy-97), sc(cx+97), sc(cy+97)), fill=(23, 45, 40, 255), outline=(246, 205, 107, 255), width=sc(7))
    d.ellipse((sc(cx-77), sc(cy-77), sc(cx+77), sc(cy+77)), fill=(9, 27, 29, 255), outline=(122, 79, 31, 255), width=sc(5))
    # spokes
    for i in range(8):
        a = 2*math.pi*i/8
        x1, y1 = cx + math.cos(a)*42, cy + math.sin(a)*42
        x2, y2 = cx + math.cos(a)*72, cy + math.sin(a)*72
        d.line((sc(x1), sc(y1), sc(x2), sc(y2)), fill=(227, 170, 71, 255), width=sc(11))
        d.line((sc(x1), sc(y1-1), sc(x2), sc(y2-1)), fill=(255, 231, 151, 180), width=sc(2))
    # central glass aperture
    core = ellipse_gradient((cx-48, cy-48, cx+48, cy+48), [(0, (178,255,243,255)), (.25,(47,220,210,255)),(.72,(2,52,62,255)),(1,(0,10,18,255))])
    draw_glow(img, core, 14, 1.25)
    alpha_composite(img, core)
    d = ImageDraw.Draw(img)
    d.ellipse((sc(cx-50), sc(cy-50), sc(cx+50), sc(cy+50)), outline=(245, 217, 134, 255), width=sc(5))
    for i in range(8):
        a = 2*math.pi*i/8
        draw_brass_rivet(img, cx+math.cos(a)*102, cy+math.sin(a)*102, 7)
    return img


def generate_mechanism() -> None:
    img = gear_shape()
    # Tiny engraved arcs and highlights.
    d = ImageDraw.Draw(img)
    for r, alpha in [(116, 95), (90, 70), (58, 80)]:
        d.arc((sc(256-r), sc(256-r), sc(256+r), sc(256+r)), 205, 338, fill=(255,239,180,alpha), width=sc(2))
    downsave(img, "mechanism.webp", 93)


def generate_source() -> None:
    img = layer()
    # glow behind
    glow = ellipse_gradient((86, 68, 426, 408), [(0,(83,255,245,150)),(.38,(26,222,210,92)),(1,(0,0,0,0))])
    draw_glow(img, glow, 24, 1.2)
    # pedestal
    d = ImageDraw.Draw(img)
    shadow = layer(); sd = ImageDraw.Draw(shadow)
    sd.ellipse((sc(103),sc(350),sc(409),sc(444)),fill=(0,0,0,170)); shadow=shadow.filter(ImageFilter.GaussianBlur(sc(16))); alpha_composite(img,shadow)
    draw_radial_metal(img, (118, 295, 394, 425), width=5)
    d = ImageDraw.Draw(img)
    d.ellipse((sc(142),sc(312),sc(370),sc(406)), fill=(17,38,36,255), outline=(255,216,124,255), width=sc(5))
    # lower gear ring
    for i in range(12):
        a=2*math.pi*i/12
        x=256+math.cos(a)*112; y=356+math.sin(a)*44
        d.rounded_rectangle((sc(x-11),sc(y-8),sc(x+11),sc(y+8)),radius=sc(3),fill=(190,128,45,255),outline=(255,224,141,220),width=sc(1.5))
    # orb and cage
    orb = ellipse_gradient((158, 110, 354, 306), [(0,(255,255,255,255)),(.12,(147,255,247,255)),(.35,(42,230,219,235)),(.72,(9,85,101,225)),(1,(0,20,34,220))])
    draw_glow(img, orb, 22, 1.45)
    alpha_composite(img, orb)
    d=ImageDraw.Draw(img)
    d.ellipse((sc(158),sc(110),sc(354),sc(306)),outline=(247,211,119,255),width=sc(8))
    # Cage arcs
    for dx in (-58,0,58):
        d.arc((sc(256-100+dx*.34),sc(94),sc(256+100+dx*.34),sc(330)),205,335,fill=(234,174,69,230),width=sc(5))
    d.arc((sc(139),sc(145),sc(373),sc(342)),185,355,fill=(255,226,143,235),width=sc(6))
    # Core star and energy filaments.
    core = ellipse_gradient((214,166,298,250),[(0,(255,255,255,255)),(.22,(137,255,246,255)),(.62,(24,223,215,245)),(1,(0,50,67,0))])
    draw_glow(img,core,16,1.5); alpha_composite(img,core)
    for i in range(7):
        a=2*math.pi*i/7 + .2
        pts=[]
        for step in range(5):
            r=20+step*16; jitter=(random.random()-.5)*8
            pts.append((sc(256+math.cos(a)*r+jitter),sc(208+math.sin(a)*r*.7+jitter)))
        d.line(pts,fill=(208,255,252,210),width=sc(2))
    # top finial
    draw_brass_rivet(img,256,92,11)
    d.polygon(points([(256,50),(272,88),(256,78),(240,88)]),fill=(255,235,159,255))
    downsave(img,"source.webp",94)


def generate_leak() -> None:
    img=layer(); d=ImageDraw.Draw(img)
    shadow=layer(); sd=ImageDraw.Draw(shadow); sd.ellipse((sc(110),sc(350),sc(402),sc(433)),fill=(0,0,0,165)); shadow=shadow.filter(ImageFilter.GaussianBlur(sc(14))); alpha_composite(img,shadow)
    draw_radial_metal(img,(130,292,382,420),width=5)
    d=ImageDraw.Draw(img); d.ellipse((sc(170),sc(315),sc(342),sc(397)),fill=(10,31,33,255),outline=(245,205,111,255),width=sc(5))
    for i in range(8):
        a=2*math.pi*i/8
        draw_brass_rivet(img,256+math.cos(a)*96,356+math.sin(a)*42,6.5)
    # water/energy plume, multiple translucent layers
    plume=layer(); pd=ImageDraw.Draw(plume)
    path=[(256,330),(224,286),(247,252),(229,210),(265,176),(246,130),(278,82),(267,46)]
    pts2=[(sc(x),sc(y)) for x,y in path]
    pd.line(pts2,fill=(47,239,235,180),width=sc(34),joint="curve")
    pd.line(pts2,fill=(138,255,250,210),width=sc(14),joint="curve")
    pd.line(pts2,fill=(255,255,255,230),width=sc(4),joint="curve")
    draw_glow(img,plume,18,1.35); alpha_composite(img,plume)
    d=ImageDraw.Draw(img)
    for i in range(22):
        y=random.uniform(45,305); spread=(330-y)*.12+10; x=256+random.uniform(-spread,spread)
        r=random.uniform(2,6)
        d.ellipse((sc(x-r),sc(y-r*1.4),sc(x+r),sc(y+r*1.4)),fill=(116,255,248,random.randint(110,230)))
    downsave(img,"leak.webp",94)


def generate_lock() -> None:
    img=layer(); d=ImageDraw.Draw(img)
    glow=ellipse_gradient((100,100,412,440),[(0,(255,211,113,90)),(1,(0,0,0,0))]); draw_glow(img,glow,20,.8)
    d.rounded_rectangle((sc(116),sc(220),sc(396),sc(426)),radius=sc(42),fill=(45,30,18,255),outline=(255,217,124,255),width=sc(12))
    metal=linear_gradient((CANVAS,CANVAS),(255,226,145,255),(126,73,26,255),vertical=True)
    bodymask=Image.new("L",(CANVAS,CANVAS),0); ImageDraw.Draw(bodymask).rounded_rectangle((sc(135),sc(240),sc(377),sc(405)),radius=sc(30),fill=255)
    alpha_composite(img,gradient_in_mask(bodymask,metal))
    d=ImageDraw.Draw(img)
    d.arc((sc(165),sc(72),sc(347),sc(286)),180,360,fill=(255,224,139,255),width=sc(28))
    d.arc((sc(184),sc(91),sc(328),sc(268)),180,360,fill=(77,44,21,255),width=sc(12))
    d.ellipse((sc(235),sc(282),sc(277),sc(324)),fill=(26,29,24,255),outline=(255,234,166,200),width=sc(4))
    d.polygon(points([(246,315),(266,315),(282,371),(230,371)]),fill=(26,29,24,255),outline=(255,234,166,190))
    for x,y in [(153,260),(359,260),(153,385),(359,385)]: draw_brass_rivet(img,x,y,8)
    downsave(img,"lock.webp",92)


def paste_rotated_ellipse(base: Image.Image, cx: float, cy: float, rx: float, ry: float,
                          angle: float, fill, outline=None, width: float = 1.0,
                          highlight: bool = False) -> None:
    pad = max(4, int(max(rx, ry) * .35))
    w = sc(rx * 2 + pad * 2)
    h = sc(ry * 2 + pad * 2)
    sprite = Image.new("RGBA", (max(2, w), max(2, h)), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sprite)
    box = (sc(pad), sc(pad), sc(pad + rx * 2), sc(pad + ry * 2))
    sd.ellipse(box, fill=fill, outline=outline, width=max(1, sc(width)))
    if highlight:
        sd.arc(box, 200, 330, fill=(255, 255, 245, min(180, fill[3] if len(fill) > 3 else 180)), width=max(1, sc(width)))
    sprite = sprite.rotate(math.degrees(angle), expand=True, resample=Image.Resampling.BICUBIC)
    x = sc(cx) - sprite.width // 2
    y = sc(cy) - sprite.height // 2
    base.alpha_composite(sprite, (x, y))


def leaf(base: Image.Image, cx: float, cy: float, w: float, h: float, angle: float, fill,
         outline=(148, 226, 134, 180)) -> None:
    paste_rotated_ellipse(base, cx, cy, w / 2, h / 2, angle, fill, outline, 1.5, True)
    # A small vein keeps leaves readable after downsampling.
    d = ImageDraw.Draw(base)
    length = w * .30
    dx, dy = math.cos(angle) * length, math.sin(angle) * length
    d.line((sc(cx - dx), sc(cy - dy), sc(cx + dx), sc(cy + dy)), fill=(216, 255, 197, 96), width=max(1, sc(.8)))


def petal_layer(base: Image.Image, cx: float, cy: float, count: int, rx: float, ry: float,
                reach: float, colors: list[tuple[int, int, int, int]], rotation: float = 0) -> None:
    for i in range(count):
        a = rotation + 2 * math.pi * i / count
        x = cx + math.cos(a) * reach
        y = cy + math.sin(a) * reach * .72
        color = colors[i % len(colors)]
        paste_rotated_ellipse(
            base, x, y, rx, ry, a + math.pi / 2, color,
            (255, 255, 245, min(205, color[3])), 1.2, True,
        )

def generate_plant(kind: str, index: int, powered: bool) -> None:
    img=layer(); d=ImageDraw.Draw(img)
    # Base shadow and ornate pot.
    shadow=layer(); sd=ImageDraw.Draw(shadow); sd.ellipse((sc(132),sc(373),sc(380),sc(450)),fill=(0,0,0,150)); shadow=shadow.filter(ImageFilter.GaussianBlur(sc(12))); alpha_composite(img,shadow)
    # saucer
    draw_radial_metal(img,(140,350,372,430),width=4)
    potmask=Image.new("L",(CANVAS,CANVAS),0); pd=ImageDraw.Draw(potmask)
    pd.polygon(points([(164,292),(348,292),(325,404),(187,404)]),fill=255)
    potgrad=linear_gradient((CANVAS,CANVAS),(225,162,85,255),(73,34,24,255),vertical=True)
    alpha_composite(img,gradient_in_mask(potmask,potgrad))
    d=ImageDraw.Draw(img); d.line(points([(164,292),(348,292),(325,404),(187,404),(164,292)]),fill=(255,218,133,255),width=sc(5),joint="curve")
    d.ellipse((sc(155),sc(276),sc(357),sc(320)),fill=(66,37,24,255),outline=(255,216,124,255),width=sc(5))
    d.ellipse((sc(176),sc(288),sc(336),sc(309)),fill=(27,35,25,255))
    # pot filigree
    for x in (205,256,307):
        d.arc((sc(x-31),sc(326),sc(x+31),sc(382)),200,340,fill=(245,188,86,160),width=sc(3))
    d.line(points([(191,349),(321,349)]),fill=(255,224,143,120),width=sc(2))
    # Stems and leaves.
    greens=[(34,84,43,255),(52,120,59,255),(91,164,78,255)]
    stems=[(256,298,250,175),(240,299,208,202),(274,299,307,205),(252,250,190,245),(265,245,327,252)]
    for x1,y1,x2,y2 in stems:
        d.line((sc(x1),sc(y1),sc(x2),sc(y2)),fill=greens[2 if powered else 1],width=sc(6),joint="curve")
    leaf_specs=[(216,245,62,25,-.45),(294,245,58,24,.42),(206,206,52,22,-.66),(309,206,52,22,.66),(248,222,50,20,-1.18),(269,214,50,20,1.16)]
    for j,(x,y,w,h,a) in enumerate(leaf_specs):
        leaf(img,x,y,w,h,a,greens[(j+index)%len(greens)])
    # Flower varieties.
    palettes=[
        [(58,142,255,255),(116,216,255,255),(230,252,255,255)],
        [(128,104,255,255),(204,164,255,255),(244,230,255,255)],
        [(255,91,119,255),(255,157,108,255),(255,232,140,255)],
        [(236,250,255,255),(168,230,255,255),(132,255,218,255)],
        [(255,91,52,255),(255,157,72,255),(255,218,78,255)],
    ]
    palette=palettes[index]
    alpha=255 if powered else 168
    colors=[(r,g,b,alpha) for r,g,b,_ in palette]
    centers={
        0:[(214,190),(256,155),(302,190),(244,205),(282,213)],
        1:[(212,188),(255,162),(300,190),(235,215),(279,217)],
        2:[(210,196),(256,158),(306,197)],
        3:[(213,192),(258,158),(303,193),(257,208)],
        4:[(207,198),(258,157),(307,197),(256,218)],
    }[index]
    for k,(cx,cy) in enumerate(centers):
        if index==2:
            petal_layer(img,cx,cy,12,9 if powered else 7,22 if powered else 17,12 if powered else 9,colors,k*.14)
            petal_layer(img,cx,cy,8,6,15,7,colors[::-1],k*.2)
        elif index==3:
            petal_layer(img,cx,cy,6,8,24,11 if powered else 8,colors,k*.17)
        elif index==4:
            petal_layer(img,cx,cy,9,8,20,11 if powered else 8,colors,k*.2)
        else:
            petal_layer(img,cx,cy,7,8,18,10 if powered else 7,colors,k*.22)
        # luminous centers
        center=ellipse_gradient((cx-11,cy-11,cx+11,cy+11),[(0,(255,255,255,alpha)),(.35,colors[2]),(1,(80,40,20,0))])
        if powered: draw_glow(img,center,7,1.2)
        alpha_composite(img,center)
    if powered:
        # glass cloche for rare, luminous display; subtle enough not to obscure plant.
        dome=layer(); dd=ImageDraw.Draw(dome)
        dd.arc((sc(126),sc(64),sc(386),sc(354)),180,360,fill=(208,255,249,135),width=sc(5))
        dd.line((sc(126),sc(209),sc(126),sc(334)),fill=(194,255,247,90),width=sc(3))
        dd.line((sc(386),sc(209),sc(386),sc(334)),fill=(194,255,247,90),width=sc(3))
        dd.arc((sc(126),sc(307),sc(386),sc(363)),0,180,fill=(239,255,252,100),width=sc(4))
        dd.arc((sc(158),sc(80),sc(332),sc(320)),205,282,fill=(255,255,255,90),width=sc(5))
        draw_glow(img,dome,8,.75); alpha_composite(img,dome)
        # sparkles
        d=ImageDraw.Draw(img)
        for n in range(11):
            x=random.uniform(160,350); y=random.uniform(95,280); r=random.uniform(1.5,3.6)
            d.line((sc(x-r*2),sc(y),sc(x+r*2),sc(y)),fill=(230,255,250,170),width=sc(1))
            d.line((sc(x),sc(y-r*2),sc(x),sc(y+r*2)),fill=(230,255,250,170),width=sc(1))
    downsave(img,f"plant-{kind}-{'on' if powered else 'off'}.webp",93)


def generate_coupler() -> None:
    img=layer(); d=ImageDraw.Draw(img)
    draw_radial_metal(img,(122,122,390,390),width=7)
    d=ImageDraw.Draw(img)
    d.ellipse((sc(162),sc(162),sc(350),sc(350)),fill=(24,38,34,255),outline=(255,218,127,255),width=sc(6))
    for i in range(12):
        a=2*math.pi*i/12
        x=256+math.cos(a)*108; y=256+math.sin(a)*108
        draw_brass_rivet(img,x,y,7)
    core=ellipse_gradient((194,194,318,318),[(0,(255,255,255,255)),(.25,(89,255,241,255)),(.68,(10,93,105,255)),(1,(0,19,27,255))])
    draw_glow(img,core,12,1.3); alpha_composite(img,core)
    downsave(img,"coupler.webp",93)


def main() -> None:
    generators = {
        "tile-base.webp": generate_tile,
        "mechanism.webp": generate_mechanism,
        "source.webp": generate_source,
        "leak.webp": generate_leak,
        "lock.webp": generate_lock,
        "coupler.webp": generate_coupler,
    }
    for filename, generator in generators.items():
        if not (OUT / filename).exists():
            generator()
    kinds=["lumen-orchid","moonbell","sun-dahlia","mist-lily","ember-bloom"]
    for idx,kind in enumerate(kinds):
        for powered in (False, True):
            filename=f"plant-{kind}-{'on' if powered else 'off'}.webp"
            if not (OUT / filename).exists():
                generate_plant(kind,idx,powered)
    print(f"Generated premium assets in {OUT}")

if __name__ == "__main__":
    main()
