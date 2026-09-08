# OCR sample images — MetrIQ `/inspection/analyze` model check

Drop these into the **Inspection** tab (or `curl -F image=@<file> http://127.0.0.1:8000/inspection/analyze`)
to sanity-check the local OCR pipeline (`rapidocr-onnxruntime`, PP-OCRv3 weights).

Nothing here is production data. The `synth_*` labels are generated locally by
`make_synth_labels.py` (in this folder) with **fictional** company / address /
FSSAI / batch details — they exist only to give OCR a known ground truth. Regen:
`../../backend/.venv/bin/python make_synth_labels.py`.

## Synthetic — known ground truth (use these for pass/fail checks)

| File | What it tests | Expected |
|---|---|---|
| `synth_clean-declaration.png` | straight, sharp legal-metrology declaration panel | ~13 regions, mean confidence ≈ 0.9, quality **not** low, reads "Net Quantity: 200 g", "M.R.P. Rs. 45.00", "Batch No: SR2026-0342", "Mfg Date: 03/2026", "FSSAI Lic. No. 10012345000123" |
| `synth_photo-angled.jpg` | ~3.5° rotation + mild blur + JPEG, like a phone photo | same fields recognised; note PP-OCRv3 tends to drop the spaces between words here (`NetQuantity:200g`) — this is the engine, not the pipeline |
| `synth_low-light-blurry.jpg` | dark, low-contrast, out of focus | quality flagged **low** with notes "Image looks blurred…" + "Low contrast…"; text still mostly recovered but with character errors (`Piot 14`, `Maharashdra`) |

Ground-truth declaration text (all three):

```
ROASTED MASALA CHANA  (Roasted Bengal gram with spices)
Net Quantity: 200 g
M.R.P. Rs. 45.00  (inclusive of all taxes)
Packed by: SUNRISE FOODS PVT LTD
Plot 14, MIDC Industrial Area, Pune 411019, Maharashtra
Mfg Date: 03/2026        Batch No: SR2026-0342
Best Before: 9 months from date of packaging
Consumer Care: care@sunrisefoods.example
Toll Free 1800-000-1234  (Mon-Sat, 9am-6pm)
FSSAI Lic. No. 10012345000123
```

## Real label photos (Wikimedia Commons)

| File | Source | License | Notes |
|---|---|---|---|
| `real_fda-nutrition-facts-2016.png` | Commons: *FDA Nutrition Facts Label 2016* | Public domain (US Gov) | dense small type, ~37 regions, good clean test |
| `real_generic-food-label.png` | Commons: *Food Label* | CC BY-SA 4.0 | tall full label, ~52 regions |
| `real_china-nutrition-facts.png` | Commons: *China nutrition facts label* | CC BY-SA 4.0 | Chinese + Latin — checks the multilingual model |
| `real_confectionery-ingredients-photo.jpg` | Commons: *Ingredients and tartrazine warning on confectionery label* | CC BY-SA 3.0 | real-world **photo** of a curved label, Cyrillic — hard case, English model transliterates poorly (expected) |
| `real_tortilla-chips-ingredients.png` | Commons: *Ingredients label for tortilla chips* | CC BY-SA 4.0 | very low resolution (471×97) — stress case, engine under-detects |

Retrieved 2026-09-08 from `upload.wikimedia.org/wikipedia/commons/…`. Keep this
file with the images if you redistribute them — CC BY-SA requires attribution.

## Quick check-all

```bash
cd samples/ocr-labels
for f in *.png *.jpg; do
  echo "== $f =="
  curl -s -F "image=@$f" http://127.0.0.1:8000/inspection/analyze \
    | python3 -c "import sys,json;d=json.load(sys.stdin);o=d['ocr'];print(o['region_count'],'regions,',round(o['mean_confidence'],2),'conf');print(o['text'][:200])"
done
```
