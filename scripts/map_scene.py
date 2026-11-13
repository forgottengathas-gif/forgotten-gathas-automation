"""Satellite map scene -> PNG frames (then FFmpeg makes the clip). Owner 2026-11-13: "map aur har kuch bhi real
dikhna chahiye" — real satellite imagery, not a drawn map.
Imagery: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel
data 2016)", CC BY 4.0 (layer s2cloudless_3857 = the 2016 mosaic; later years are NC, never use them). Tiles are
cached in ~/.cache/s2tiles. Two layers: z7 for the wide view of the subcontinent, z10 for the close push-in, cross-
faded; India's official outline (data/ne_10m_ind.geojson) as a soft gold glow; pulsing marker + label.
Usage: python -I map_scene.py <out_dir> <lon> <lat> "<LABEL>" "<sub label>" [seconds=5] [w=1920] [h=1080] [label_png]"""
import json, math, os, sys, time, urllib.request
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageStat

out, lon0, lat0, label, sub = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]
secs = float(sys.argv[6]) if len(sys.argv) > 6 else 5.0
W = int(sys.argv[7]) if len(sys.argv) > 7 else 1920
H = int(sys.argv[8]) if len(sys.argv) > 8 else 1080
LABEL_PNG = sys.argv[9] if len(sys.argv) > 9 and os.path.exists(sys.argv[9]) else None
FPS = 30
os.makedirs(out, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "s2tiles")
os.makedirs(CACHE, exist_ok=True)
URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"

def wx(lon, z): return (lon + 180) / 360 * 256 * 2 ** z
def wy(lat, z):
    s = math.sin(math.radians(max(-85, min(85, lat))))
    return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * 256 * 2 ** z

def tile(z, x, y):
    f = os.path.join(CACHE, f"{z}_{x}_{y}.jpg")
    if not os.path.exists(f):
        for attempt in range(3):
            try:
                req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={"User-Agent": "ForgottenGathasBot/1.0"})
                data = urllib.request.urlopen(req, timeout=30).read()
                open(f, "wb").write(data); break
            except Exception:
                time.sleep(2 * (attempt + 1))
        else:
            return Image.new("RGB", (256, 256), (20, 40, 60))
        time.sleep(0.05)
    return Image.open(f).convert("RGB")

def mosaic(z, lon_a, lon_b, lat_a, lat_b):
    """returns (image, origin world-pixel x, y) covering the box at zoom z"""
    x0, x1 = int(wx(lon_a, z) // 256), int(wx(lon_b, z) // 256)
    y0, y1 = int(wy(lat_a, z) // 256), int(wy(lat_b, z) // 256)
    img = Image.new("RGB", ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    for tx in range(x0, x1 + 1):
        for ty in range(y0, y1 + 1):
            img.paste(tile(z, tx, ty), ((tx - x0) * 256, (ty - y0) * 256))
    return seamless(img), x0 * 256, y0 * 256

def seamless(img):
    # TODO: EOX imagery has brightness steps between granules (visible band). Edge matching and step detection were
    # tried 2026-11-13 and made it worse (colour blocks) → left as is for now.
    return img

def grade(img):
    img = ImageEnhance.Contrast(img).enhance(1.15)
    img = ImageEnhance.Color(img).enhance(1.1)
    return Image.blend(img, Image.new("RGB", img.size, (255, 190, 110)), 0.07)

def outline_on(img, z, ox, oy):
    geo = json.load(open(os.path.join(ROOT, "data", "ne_10m_ind.geojson"), encoding="utf-8"))
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for f in geo["features"]:
        g = f["geometry"]
        for p in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
            pts = [(wx(lo, z) - ox, wy(la, z) - oy) for lo, la in p[0]]
            if not any(0 <= x <= img.size[0] and 0 <= y <= img.size[1] for x, y in pts[::5]):
                continue
            d.line(pts + [pts[0]], fill=(255, 214, 120, 170), width=max(2, int(3 * 2 ** (z - 7))), joint="curve")
    glow = lay.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(Image.alpha_composite(img.convert("RGBA"), glow), lay).convert("RGB")

# wide layer (z7, the subcontinent) and close layer (z10, ±2° around the place)
Z1, Z2 = 7, 9
wide, wox, woy = mosaic(Z1, 64, 98, 33, 6)
wide = outline_on(grade(wide), Z1, wox, woy)
near, nox, noy = mosaic(Z2, lon0 - 3.6, lon0 + 3.6, lat0 + 2.6, lat0 - 2.6)
near = outline_on(grade(near), Z2, nox, noy)

font_dir = os.path.join(ROOT, "fonts")
def font(name, size):
    try: return ImageFont.truetype(os.path.join(font_dir, name), size)
    except OSError: return ImageFont.load_default()
f_label = font("LibreBaskerville-VF.ttf", int(H * 0.06))
try: f_label.set_variation_by_name("Bold")
except Exception: pass
f_sub = font("LibreBaskerville-Italic-VF.ttf", int(H * 0.034))
f_credit = font("LibreBaskerville-Italic-VF.ttf", int(H * 0.016))
LBL = Image.open(LABEL_PNG).convert("RGBA") if LABEL_PNG else None

vig = Image.new("L", (W, H), 0); vd = ImageDraw.Draw(vig)
for i in range(80):
    vd.rectangle([i * 6, i * 4, W - i * 6, H - i * 4], outline=int(170 - i * 2.1))
vig = vig.filter(ImageFilter.GaussianBlur(60))
dark = Image.new("RGB", (W, H), (6, 5, 4))

def ease(t): return t * t * (3 - 2 * t)

def view(layer, z, ox, oy, clon, clat, span_deg):
    sw = span_deg / 360 * 256 * 2 ** z; sh = sw * H / W
    cx, cy = wx(clon, z) - ox, wy(clat, z) - oy
    x0 = max(0, min(layer.size[0] - sw, cx - sw / 2)); y0 = max(0, min(layer.size[1] - sh, cy - sh / 2))
    return layer.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + sw, y0 + sh)), (x0, y0, sw, sh)

n = int(secs * FPS)
for k in range(n):
    t = k / max(1, n - 1)
    span = math.exp(math.log(24) + (math.log(4.2) - math.log(24)) * ease(min(1, t * 1.1)))
    e = ease(min(1, t * 1.25))
    clon, clat = 80 + (lon0 - 80) * e, 20.5 + (lat0 - 20.5) * e
    if span > 6.5:
        img, box = view(wide, Z1, wox, woy, clon, clat, span); lay = (Z1, wox, woy)
    else:
        img, box = view(near, Z2, nox, noy, clon, clat, span); lay = (Z2, nox, noy)
    if 6.5 < span < 8.0:   # cross-fade into the sharp close layer
        img2, _ = view(near, Z2, nox, noy, clon, clat, min(span, 7.0))
        img = Image.blend(img, img2, (8.0 - span) / 1.5)
    img = Image.composite(dark, img, vig)
    d = ImageDraw.Draw(img, "RGBA")
    z, ox, oy = lay; x0, y0, sw, sh = box
    px = (wx(lon0, z) - ox - x0) / sw * W; py = (wy(lat0, z) - oy - y0) / sh * H
    a = ease(max(0, min(1, (t - 0.5) / 0.25)))
    if a > 0:
        r = H * 0.012; pulse = (k % 30) / 30; rr = r * (2 + 4 * pulse)
        d.ellipse([px - rr, py - rr, px + rr, py + rr], outline=(255, 80, 40, int(220 * a * (1 - pulse))), width=4)
        d.ellipse([px - r * 1.9, py - r * 1.9, px + r * 1.9, py + r * 1.9], fill=(255, 200, 90, int(80 * a)))
        d.ellipse([px - r, py - r, px + r, py + r], fill=(230, 40, 30, int(255 * a)), outline=(255, 240, 200, int(255 * a)), width=3)
        if LBL is not None:
            lw, lh = LBL.size; sc = min(1.0, (W * 0.42) / lw)
            lb = LBL.resize((int(lw * sc), int(lh * sc)), Image.LANCZOS)
            lb.putalpha(lb.getchannel("A").point(lambda v: int(v * a)))
            lx = int(px + H * 0.04) if px < W * 0.55 else int(px - H * 0.04 - lb.size[0])
            img.paste(lb, (lx, int(py - lb.size[1] / 2)), lb)
        else:
            tw = max(d.textlength(label, font=f_label), d.textlength(sub, font=f_sub))
            lx = px + H * 0.04 if px < W * 0.55 else px - H * 0.04 - tw
            ly = py - H * 0.06
            d.text((lx + 3, ly + 3), label, font=f_label, fill=(0, 0, 0, int(210 * a)))
            d.text((lx, ly), label, font=f_label, fill=(255, 214, 120, int(255 * a)))
            if sub:
                d.text((lx + 2, ly + H * 0.078 + 2), sub, font=f_sub, fill=(0, 0, 0, int(210 * a)))
                d.text((lx, ly + H * 0.078), sub, font=f_sub, fill=(255, 245, 230, int(255 * a)))
    # imagery credit (CC BY 4.0 requires attribution)
    d.text((W - H * 0.45, H - H * 0.035), "Sentinel-2 cloudless by EOX (Copernicus 2016)", font=f_credit, fill=(255, 255, 255, 120))
    img.save(os.path.join(out, f"f{k:04d}.png"))
print(f"{n} frames")
