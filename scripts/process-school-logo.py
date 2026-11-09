#!/usr/bin/env python3
"""將校徽原圖做成透明圓外底＋多尺寸圖示。
用法：python3 scripts/process-school-logo.py /path/to/source.png
"""
from pathlib import Path
import sys
from collections import deque
from PIL import Image

def flood_outer_transparent(im: Image.Image, thresh=245):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])

    def whiteish(x, y):
        r, g, b, a = px[x, y]
        return r >= thresh and g >= thresh and b >= thresh

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        if not whiteish(x, y):
            continue
        seen[y][x] = True
        px[x, y] = (255, 255, 255, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im

def main():
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parents[1] / 'images'
    out.mkdir(exist_ok=True)
    im = flood_outer_transparent(Image.open(src))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    def save_sq(size, name):
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        tmp = im.copy()
        tmp.thumbnail((size, size), Image.Resampling.LANCZOS)
        ox = (size - tmp.width) // 2
        oy = (size - tmp.height) // 2
        canvas.paste(tmp, (ox, oy), tmp)
        dest = out / name
        canvas.save(dest, optimize=True)
        print('wrote', dest, dest.stat().st_size)

    save_sq(256, 'school-logo.png')
    try:
        save_sq(256, 'school-logo.webp')
    except Exception as e:
        print('webp skip', e)
    save_sq(32, 'favicon-32.png')
    save_sq(180, 'apple-touch-icon.png')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('need source png path')
    main()
