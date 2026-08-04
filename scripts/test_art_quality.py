#!/usr/bin/env python3
"""Release guardrails for the cinematic runtime art pack.

The high-quality renderer depends on real alpha-cut illustrated assets rather than
flat placeholder vectors. These checks intentionally look at measurable image
properties so a later optimization cannot silently replace the cinematic pack
with low-resolution or opaque mockup crops.
"""
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "assets" / "cinematic"

EXPECTED = {
    "platform-0.webp": (900, 620),
    "platform-1.webp": (900, 620),
    "platform-2.webp": (900, 620),
    "platform-3.webp": (900, 620),
    "mechanism-terminal.webp": (560, 560),
    "mechanism-straight.webp": (560, 560),
    "mechanism-elbow.webp": (560, 560),
    "mechanism-junction.webp": (560, 560),
    "source.webp": (480, 480),
    "leak.webp": (360, 480),
    "pipe.webp": (420, 120),
    "coupler.webp": (220, 220),
    "lock.webp": (260, 300),
    "plant-lumen-orchid-off.webp": (460, 620),
    "plant-lumen-orchid-on.webp": (460, 620),
    "plant-moonbell-off.webp": (460, 620),
    "plant-moonbell-on.webp": (460, 620),
    "plant-sun-dahlia-off.webp": (460, 620),
    "plant-sun-dahlia-on.webp": (460, 620),
    "plant-mist-lily-off.webp": (460, 620),
    "plant-mist-lily-on.webp": (460, 620),
    "plant-ember-bloom-off.webp": (460, 620),
    "plant-ember-bloom-on.webp": (460, 620),
}


def entropy(gray: np.ndarray, mask: np.ndarray) -> float:
    pixels = gray[mask]
    if pixels.size == 0:
        return 0.0
    hist = np.bincount(pixels, minlength=256).astype(np.float64)
    hist /= hist.sum()
    nonzero = hist[hist > 0]
    return float(-(nonzero * np.log2(nonzero)).sum())


def assert_asset(name: str, minimum: tuple[int, int]) -> int:
    path = ART / name
    if not path.exists():
        raise AssertionError(f"missing cinematic runtime asset: {path.relative_to(ROOT)}")

    with Image.open(path) as source:
        rgba = np.asarray(source.convert("RGBA"))
        width, height = source.size

    if width < minimum[0] or height < minimum[1]:
        raise AssertionError(f"{name}: expected at least {minimum}, got {(width, height)}")

    alpha = rgba[..., 3]
    visible = alpha > 24
    coverage = float(visible.mean())
    if not 0.035 <= coverage <= 0.94:
        raise AssertionError(f"{name}: suspicious alpha coverage {coverage:.3f}")

    rgb = rgba[..., :3]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    detail_entropy = entropy(gray, visible)
    if detail_entropy < 5.25:
        raise AssertionError(f"{name}: insufficient tonal detail ({detail_entropy:.2f} bits)")

    laplacian = cv2.Laplacian(gray, cv2.CV_32F)
    edge_energy = float(np.mean(np.abs(laplacian[visible]))) if np.any(visible) else 0.0
    if edge_energy < 4.25:
        raise AssertionError(f"{name}: insufficient edge detail ({edge_energy:.2f})")

    # Illustrated brass/glass assets need real colour separation, not monochrome
    # opacity masks or a screenshot pasted behind the whole canvas.
    chroma = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    chroma_mean = float(chroma[visible].mean()) if np.any(visible) else 0.0
    if chroma_mean < 24:
        raise AssertionError(f"{name}: insufficient material colour separation ({chroma_mean:.1f})")

    if name.startswith("plant-") and name.endswith("-on.webp"):
        # Professional cutout art must not carry pieces of the source screenshot or
        # cyan matte around the specimen. Ignore one-pixel dust, then require the
        # pot, stems and flowers to read as one authored object.
        component_mask = (alpha > 40).astype(np.uint8)
        count, _, stats, _ = cv2.connectedComponentsWithStats(component_mask, 8)
        areas = stats[1:, cv2.CC_STAT_AREA] if count > 1 else np.array([], dtype=np.int32)
        significant = areas[areas > 20]
        largest_share = float(significant.max() / significant.sum()) if significant.size else 0.0
        if largest_share < 0.55 or (significant.size > 24 and largest_share < 0.95):
            raise AssertionError(
                f"{name}: fragmented/matted specimen silhouette "
                f"({significant.size} components, largest {largest_share:.3f})"
            )

    return path.stat().st_size


def main() -> None:
    total = sum(assert_asset(name, minimum) for name, minimum in EXPECTED.items())
    if total > 4_200_000:
        raise AssertionError(f"cinematic art pack exceeds mobile-friendly budget: {total} bytes")
    print(f"Cinematic art quality checks passed for {len(EXPECTED)} assets ({total / 1024:.1f} KiB).")


if __name__ == "__main__":
    main()
