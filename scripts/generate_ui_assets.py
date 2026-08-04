#!/usr/bin/env python3
"""Generate original high-resolution UI ornaments for the interactive game."""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'hd'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
S = 2
C = SIZE * S


def sc(v: float) -> int: return round(v * S)
def layer() -> Image.Image: return Image.new('RGBA', (C, C), (0, 0, 0, 0))

def radial(box, stops):
    x0,y0,x1,y1=map(sc,box); w=max(1,x1-x0); h=max(1,y1-y0)
    out=Image.new('RGBA',(w,h)); p=out.load(); cx=w*.34; cy=h*.28; r=max(w,h)*.72
    stops=sorted(stops)
    for y in range(h):
        for x in range(w):
            t=min(1,max(0,math.hypot(x-cx,y-cy)/r))
            for i in range(len(stops)-1):
                if stops[i][0] <= t <= stops[i+1][0]:
                    a,ca=stops[i]; b,cb=stops[i+1]; q=(t-a)/max(.0001,b-a)
                    p[x,y]=tuple(round(ca[k]+(cb[k]-ca[k])*q) for k in range(4)); break
            else: p[x,y]=stops[-1][1]
    mask=Image.new('L',(w,h),0); ImageDraw.Draw(mask).ellipse((0,0,w-1,h-1),fill=255)
    full=layer(); full.paste(out,(x0,y0),mask); return full

def glow(img, shape, radius=18, gain=1.15):
    g=shape.filter(ImageFilter.GaussianBlur(sc(radius)))
    if gain!=1:g=ImageEnhance.Brightness(g).enhance(gain)
    img.alpha_composite(g)

def save(img,name,q=92):
    img=img.resize((SIZE,SIZE),Image.Resampling.LANCZOS)
    img.save(OUT/name,'WEBP',quality=q,method=6,exact=True)

def rivet(d,x,y,r=5):
    d.ellipse((sc(x-r),sc(y-r),sc(x+r),sc(y+r)),fill=(232,175,76,255),outline=(255,232,154,255),width=sc(1.2))
    d.ellipse((sc(x-r*.35),sc(y-r*.45),sc(x+r*.1),sc(y-r*.02)),fill=(255,248,207,210))

def dome(state: str):
    img=layer(); d=ImageDraw.Draw(img)
    active=state!='locked'; current=state=='current'
    # contact shadow
    shadow=layer(); sd=ImageDraw.Draw(shadow); sd.ellipse((sc(74),sc(358),sc(438),sc(450)),fill=(0,0,0,175)); shadow=shadow.filter(ImageFilter.GaussianBlur(sc(18))); img.alpha_composite(shadow)
    # base pedestal
    d.rounded_rectangle((sc(92),sc(346),sc(420),sc(414)),radius=sc(22),fill=(42,27,14,255),outline=(239,190,83,255),width=sc(5))
    d.rounded_rectangle((sc(112),sc(362),sc(400),sc(397)),radius=sc(13),fill=(20,67,61,255) if active else (28,32,31,255),outline=(122,79,30,255),width=sc(3))
    for x in (126,180,256,332,386): rivet(d,x,380,5)
    # glass dome fill
    glass=layer(); gd=ImageDraw.Draw(glass)
    fill=(42,197,188,50) if active else (75,83,82,55)
    gd.pieslice((sc(104),sc(70),sc(408),sc(390)),180,360,fill=fill,outline=(182,247,232,180) if active else (132,139,135,120),width=sc(4))
    gd.rectangle((sc(104),sc(230),sc(408),sc(360)),fill=fill)
    if current:
        glow_shape=layer(); g=ImageDraw.Draw(glow_shape); g.pieslice((sc(100),sc(65),sc(412),sc(394)),180,360,fill=(70,255,233,105)); g.rectangle((sc(100),sc(230),sc(412),sc(364)),fill=(70,255,233,72)); glow(img,glow_shape,22,1.3)
    img.alpha_composite(glass)
    d=ImageDraw.Draw(img)
    # ribs
    rib=(242,191,79,245) if active else (103,94,72,220)
    hi=(255,235,154,190) if active else (151,145,124,120)
    d.arc((sc(104),sc(70),sc(408),sc(390)),180,360,fill=rib,width=sc(9))
    d.arc((sc(112),sc(78),sc(400),sc(382)),180,360,fill=hi,width=sc(2))
    for x in (150,204,256,308,362):
        # curved-ish ribs using line to top
        d.line((sc(x),sc(352),sc(256),sc(78)),fill=(59,39,18,210),width=sc(7))
        d.line((sc(x-1),sc(350),sc(255),sc(82)),fill=rib,width=sc(3))
    for y in (202,270,330):
        d.arc((sc(104),sc(y-95),sc(408),sc(y+95)),195,345,fill=(217,166,70,190) if active else (91,82,62,170),width=sc(3))
    # finial
    d.ellipse((sc(236),sc(54),sc(276),sc(94)),fill=(96,57,22,255),outline=(255,222,125,255),width=sc(4))
    d.polygon([(sc(256),sc(34)),(sc(270),sc(58)),(sc(256),sc(72)),(sc(242),sc(58))],fill=(232,176,72,255),outline=(255,235,160,255))
    # plants inside
    if active:
        for bx,color in [(190,(102,207,110,230)),(250,(90,191,99,240)),(315,(111,217,126,225))]:
            d.line((sc(bx),sc(338),sc(bx+(-8 if bx<256 else 8)),sc(248)),fill=(52,125,68,240),width=sc(5))
            for offy in (0,28,52):
                cy=315-offy; side=-1 if (offy//20)%2 else 1
                d.ellipse((sc(bx-25*side-12),sc(cy-10),sc(bx-25*side+20),sc(cy+10)),fill=color)
        flower=(103,255,236,255) if current else (220,139,211,245)
        for a in range(8):
            ang=a*math.tau/8; cx=256+math.cos(ang)*34; cy=232+math.sin(ang)*22
            d.ellipse((sc(cx-11),sc(cy-8),sc(cx+11),sc(cy+8)),fill=flower,outline=(255,246,222,155))
        d.ellipse((sc(244),sc(220),sc(268),sc(244)),fill=(255,219,104,255))
    else:
        # lock badge
        d.rounded_rectangle((sc(207),sc(224),sc(305),sc(316)),radius=sc(17),fill=(18,24,24,235),outline=(176,150,87,230),width=sc(4))
        d.arc((sc(225),sc(178),sc(287),sc(259)),180,360,fill=(199,170,98,230),width=sc(10))
        d.ellipse((sc(248),sc(254),sc(264),sc(272)),fill=(218,187,105,255)); d.rectangle((sc(252),sc(265),sc(260),sc(290)),fill=(218,187,105,255))
    save(img,f'dome-{state}.webp')

def chest():
    img=layer(); d=ImageDraw.Draw(img)
    shadow=layer(); sd=ImageDraw.Draw(shadow); sd.ellipse((sc(75),sc(338),sc(440),sc(444)),fill=(0,0,0,170)); shadow=shadow.filter(ImageFilter.GaussianBlur(sc(18))); img.alpha_composite(shadow)
    # body
    d.rounded_rectangle((sc(90),sc(205),sc(422),sc(405)),radius=sc(28),fill=(77,42,19,255),outline=(240,185,73,255),width=sc(8))
    d.pieslice((sc(90),sc(88),sc(422),sc(330)),180,360,fill=(134,78,27,255),outline=(246,194,81,255),width=sc(8))
    d.rectangle((sc(90),sc(205),sc(422),sc(275)),fill=(118,67,24,255),outline=(239,183,69,255),width=sc(5))
    # bands
    for x in (133,256,379):
        d.rounded_rectangle((sc(x-18),sc(116),sc(x+18),sc(405)),radius=sc(8),fill=(206,144,49,255),outline=(255,224,132,255),width=sc(3))
    # decorative emerald panels
    d.rounded_rectangle((sc(158),sc(244),sc(354),sc(364)),radius=sc(18),fill=(10,73,62,255),outline=(228,174,62,255),width=sc(5))
    for i in range(8):
        a=i*math.tau/8; cx=256+math.cos(a)*68; cy=304+math.sin(a)*34
        d.ellipse((sc(cx-5),sc(cy-5),sc(cx+5),sc(cy+5)),fill=(245,203,102,255))
    # lock
    d.rounded_rectangle((sc(226),sc(275),sc(286),sc(349)),radius=sc(12),fill=(218,159,57,255),outline=(255,230,139,255),width=sc(4))
    d.arc((sc(235),sc(232),sc(277),sc(299)),180,360,fill=(250,214,121,255),width=sc(8))
    d.ellipse((sc(250),sc(300),sc(262),sc(315)),fill=(67,39,18,255)); d.rectangle((sc(253),sc(311),sc(259),sc(330)),fill=(67,39,18,255))
    # shine
    d.arc((sc(106),sc(105),sc(406),sc(319)),205,330,fill=(255,236,161,140),width=sc(4))
    save(img,'reward-chest.webp')

def crest():
    img=layer(); d=ImageDraw.Draw(img)
    gl=layer(); gd=ImageDraw.Draw(gl); gd.ellipse((sc(72),sc(72),sc(440),sc(440)),fill=(59,255,222,95)); glow(img,gl,28,1.25)
    # gear teeth
    for i in range(16):
        a=i*math.tau/16; cx=256+math.cos(a)*178; cy=256+math.sin(a)*178
        box=(sc(cx-15),sc(cy-25),sc(cx+15),sc(cy+25))
        tooth=layer(); td=ImageDraw.Draw(tooth); td.rounded_rectangle((sc(241),sc(222),sc(271),sc(290)),radius=sc(6),fill=(219,159,58,255),outline=(255,227,139,255),width=sc(3)); tooth=tooth.rotate(math.degrees(a),center=(sc(256),sc(256)),resample=Image.Resampling.BICUBIC); img.alpha_composite(tooth)
    d=ImageDraw.Draw(img)
    d.ellipse((sc(84),sc(84),sc(428),sc(428)),fill=(6,45,43,245),outline=(242,198,91,255),width=sc(12))
    d.ellipse((sc(116),sc(116),sc(396),sc(396)),fill=(5,31,33,255),outline=(104,243,218,175),width=sc(5))
    # botanical glyph
    d.line((sc(256),sc(342),sc(256),sc(190)),fill=(120,255,218,255),width=sc(11))
    for y,side in [(300,-1),(276,1),(246,-1),(222,1)]:
        d.bezier if False else None
        d.ellipse((sc(256+side*10-65),sc(y-28),sc(256+side*10+8),sc(y+20)),fill=(51,181,125,245),outline=(137,255,213,210),width=sc(3))
    for i in range(6):
        a=i*math.tau/6; cx=256+math.cos(a)*45; cy=170+math.sin(a)*33
        d.ellipse((sc(cx-22),sc(cy-14),sc(cx+22),sc(cy+14)),fill=(90,245,214,245),outline=(245,255,231,170),width=sc(2))
    d.ellipse((sc(240),sc(154),sc(272),sc(186)),fill=(255,216,95,255))
    save(img,'botanical-crest.webp')

if __name__=='__main__':
    for state in ('complete','current','locked'): dome(state)
    chest(); crest()
