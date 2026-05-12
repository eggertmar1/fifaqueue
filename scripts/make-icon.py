#!/usr/bin/env python3
"""Generate a fun app icon for FIFA Queue: a soccer ball wearing sunglasses
on a sage gradient background. 1024x1024, no transparency (iOS-safe)."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

SIZE = 1024
OUT_ICON = os.path.join(os.path.dirname(__file__), "..", "assets", "icon.png")
OUT_SPLASH = os.path.join(os.path.dirname(__file__), "..", "assets", "splash-icon.png")


def gradient_bg(size: int) -> Image.Image:
    """Diagonal sage gradient from a brighter top-left to a deeper bottom-right."""
    top = (127, 217, 168)       # sage #7FD9A8
    bot = (39, 84, 67)          # deep forest
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(top[0] + (bot[0] - top[0]) * t)
            g = int(top[1] + (bot[1] - top[1]) * t)
            b = int(top[2] + (bot[2] - top[2]) * t)
            px[x, y] = (r, g, b)
    return img


def add_glow(img: Image.Image, center, radius, color=(255, 255, 255, 70)):
    """Add a soft radial glow behind the ball."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
        fill=color,
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius // 3))
    img.paste(overlay, (0, 0), overlay)


def draw_soccer_ball(img: Image.Image, cx: int, cy: int, r: int):
    """Approximate a soccer ball with a white circle and stylized black pentagons."""
    d = ImageDraw.Draw(img, "RGBA")

    # Drop shadow
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([cx - r + 12, cy - r + 28, cx + r + 12, cy + r + 28], fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    img.paste(shadow, (0, 0), shadow)

    # Ball
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(252, 252, 252))

    # Subtle highlight
    hl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse([cx - r * 0.75, cy - r * 0.85, cx + r * 0.15, cy - r * 0.05],
               fill=(255, 255, 255, 130))
    hl = hl.filter(ImageFilter.GaussianBlur(30))
    img.paste(hl, (0, 0), hl)

    # Pentagons (5 around + 1 center) — stylised
    def pentagon(center, size, rotation=0):
        cxp, cyp = center
        pts = []
        for i in range(5):
            ang = math.radians(rotation - 90 + i * 72)
            pts.append((cxp + size * math.cos(ang), cyp + size * math.sin(ang)))
        return pts

    d.polygon(pentagon((cx, cy), r * 0.22), fill=(20, 22, 28))
    for i in range(5):
        ang = math.radians(-90 + i * 72)
        px_ = cx + (r * 0.62) * math.cos(ang)
        py_ = cy + (r * 0.62) * math.sin(ang)
        d.polygon(pentagon((px_, py_), r * 0.16, rotation=i * 72), fill=(20, 22, 28))


def draw_sunglasses(img: Image.Image, cx: int, cy: int, ball_r: int):
    """Two rounded rectangles over the ball — the punchline."""
    d = ImageDraw.Draw(img, "RGBA")
    lens_w = int(ball_r * 0.46)
    lens_h = int(ball_r * 0.32)
    gap = int(ball_r * 0.12)
    bridge_y = cy - int(ball_r * 0.08)

    left_x = cx - gap // 2 - lens_w
    right_x = cx + gap // 2

    def lens(x1, y1, x2, y2):
        # outer frame
        d.rounded_rectangle([x1 - 6, y1 - 6, x2 + 6, y2 + 6],
                            radius=int(lens_h * 0.55),
                            fill=(20, 22, 28))
        # dark lens
        d.rounded_rectangle([x1, y1, x2, y2],
                            radius=int(lens_h * 0.5),
                            fill=(15, 18, 24))
        # glossy diagonal reflection
        refl = Image.new("RGBA", img.size, (0, 0, 0, 0))
        rd = ImageDraw.Draw(refl)
        rd.polygon([
            (x1 + lens_w * 0.18, y1 + lens_h * 0.08),
            (x1 + lens_w * 0.55, y1 + lens_h * 0.08),
            (x1 + lens_w * 0.30, y1 + lens_h * 0.85),
            (x1 + lens_w * -0.05, y1 + lens_h * 0.85),
        ], fill=(255, 255, 255, 170))
        refl = refl.filter(ImageFilter.GaussianBlur(3))
        img.paste(refl, (0, 0), refl)

    lens(left_x, bridge_y - lens_h // 2, left_x + lens_w, bridge_y + lens_h // 2)
    lens(right_x, bridge_y - lens_h // 2, right_x + lens_w, bridge_y + lens_h // 2)

    # Bridge
    d.rectangle(
        [left_x + lens_w - 2, bridge_y - 6, right_x + 2, bridge_y + 6],
        fill=(20, 22, 28),
    )


def main():
    img = gradient_bg(SIZE)
    cx, cy = SIZE // 2, SIZE // 2 - 20
    ball_r = int(SIZE * 0.30)
    add_glow(img, (cx, cy), int(ball_r * 1.4))
    draw_soccer_ball(img, cx, cy, ball_r)
    draw_sunglasses(img, cx, cy, ball_r)

    img = img.convert("RGB")
    img.save(OUT_ICON, "PNG", optimize=True)
    img.save(OUT_SPLASH, "PNG", optimize=True)
    print(f"Wrote {OUT_ICON}")
    print(f"Wrote {OUT_SPLASH}")


if __name__ == "__main__":
    main()
