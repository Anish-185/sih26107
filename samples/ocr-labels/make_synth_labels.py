"""Generate synthetic Indian legal-metrology declaration labels for OCR checks.

All company / address / licence details are fictional. Output -> this folder.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
SANS = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"
SANS_B = "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"

# The ground-truth declaration (fictional).
LINES = [
    ("ROASTED MASALA CHANA", 54, True),
    ("(Roasted Bengal gram with spices)", 30, False),
    ("", 18, False),
    ("Net Quantity: 200 g", 40, True),
    ("M.R.P. Rs. 45.00  (inclusive of all taxes)", 34, True),
    ("", 12, False),
    ("Packed by: SUNRISE FOODS PVT LTD", 30, False),
    ("Plot 14, MIDC Industrial Area, Pune 411019, Maharashtra", 26, False),
    ("Mfg Date: 03/2026        Batch No: SR2026-0342", 28, False),
    ("Best Before: 9 months from date of packaging", 28, False),
    ("", 12, False),
    ("Consumer Care: care@sunrisefoods.example", 26, False),
    ("Toll Free 1800-000-1234  (Mon-Sat, 9am-6pm)", 26, False),
    ("FSSAI Lic. No. 10012345000123", 26, False),
]


def render_base() -> Image.Image:
    W, H = 1000, 1150
    img = Image.new("RGB", (W, H), "#ece8dc")
    d = ImageDraw.Draw(img)
    d.rectangle([24, 24, W - 24, H - 24], outline="#1a1a1a", width=4)
    d.text((60, 44), "PRINCIPAL DISPLAY PANEL", font=ImageFont.truetype(SANS_B, 24),
           fill="#1a1a1a")
    y = 110
    for text, size, bold in LINES:
        if not text:
            y += size
            continue
        font = ImageFont.truetype(SANS_B if bold else SANS, size)
        d.text((60, y), text, font=font, fill="#111111")
        y += size + 16
    return img


def save(img: Image.Image, name: str, **kw) -> None:
    path = os.path.join(OUT, name)
    img.save(path, **kw)
    print(f"  wrote {name}  {img.size[0]}x{img.size[1]}  {os.path.getsize(path)//1024} KB")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    base = render_base()

    # 1 — clean, straight scan
    save(base, "synth_clean-declaration.png", format="PNG")

    # 2 — phone-photo-ish: slight rotation, mild blur, warm cast, JPEG
    photo = base.rotate(-3.5, expand=True, fillcolor="#e9e7de", resample=Image.BICUBIC)
    photo = photo.filter(ImageFilter.GaussianBlur(1.1))
    photo = ImageEnhance.Contrast(photo).enhance(0.92)
    photo = ImageEnhance.Color(photo).enhance(1.15)
    save(photo, "synth_photo-angled.jpg", format="JPEG", quality=72)

    # 3 — low-light + out of focus: should trip the quality "low quality" notes
    dim = ImageEnhance.Brightness(base).enhance(0.45)
    dim = ImageEnhance.Contrast(dim).enhance(0.70)
    dim = dim.filter(ImageFilter.GaussianBlur(2.4))
    dim = dim.rotate(1.5, expand=True, fillcolor="#20201c", resample=Image.BICUBIC)
    save(dim, "synth_low-light-blurry.jpg", format="JPEG", quality=55)


if __name__ == "__main__":
    main()
