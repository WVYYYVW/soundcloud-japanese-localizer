"""拡張機能のアイコン（オレンジの角丸四角に白い「あ」）を生成する。

使い方: python3 scripts/make-icons.py
必要なもの: Pillow、日本語フォント（Noto Sans CJK など）
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "icons"
FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "C:/Windows/Fonts/YuGothB.ttc",
]
ORANGE = (255, 85, 0, 255)


def find_font():
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            return path
    sys.exit("日本語フォントが見つかりません。FONT_CANDIDATES にパスを追加してください。")


def render(size, font_path):
    scale = 8  # 大きく描いて縮小し、輪郭をなめらかにする
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=ORANGE)
    font = ImageFont.truetype(font_path, int(s * 0.68), index=0)
    box = d.textbbox((0, 0), "あ", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), "あ", font=font, fill="white")
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font_path = find_font()
    for size in (16, 32, 48, 128):
        render(size, font_path).save(OUT / f"icon-{size}.png")
        print(f"icons/icon-{size}.png")


if __name__ == "__main__":
    main()
