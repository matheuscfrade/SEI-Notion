"""Ícones PNG 16/48/128 — N em degradê marinho."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "icons"


def png(w: int, h: int, pixels: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + pixels[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def icon(size: int) -> bytes:
    px = bytearray(size * size * 4)
    navy = (30, 58, 138)
    ink = (17, 24, 39)
    white = (255, 255, 255)

    def setp(x: int, y: int, c: tuple[int, int, int], a: int = 255) -> None:
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i : i + 4] = bytes((c[0], c[1], c[2], a))

    r = max(2, size // 6)
    for y in range(size):
        for x in range(size):
            t = y / max(1, size - 1)
            c = (
                lerp(navy[0], ink[0], t),
                lerp(navy[1], ink[1], t),
                lerp(navy[2], ink[2], t),
            )
            corners = (
                (x < r and y < r and (x - r) ** 2 + (y - r) ** 2 > r * r)
                or (
                    x >= size - r
                    and y < r
                    and (x - (size - 1 - r)) ** 2 + (y - r) ** 2 > r * r
                )
                or (
                    x < r
                    and y >= size - r
                    and (x - r) ** 2 + (y - (size - 1 - r)) ** 2 > r * r
                )
                or (
                    x >= size - r
                    and y >= size - r
                    and (x - (size - 1 - r)) ** 2 + (y - (size - 1 - r)) ** 2
                    > r * r
                )
            )
            if corners:
                setp(x, y, (0, 0, 0), 0)
            else:
                setp(x, y, c)

    def rect(x0: int, y0: int, w: int, h: int, c: tuple[int, int, int]) -> None:
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                setp(x, y, c)

    m = max(3, size // 5)
    bar = max(2, size // 8)
    # N estilizado
    rect(m, m, bar, size - 2 * m, white)
    rect(size - m - bar, m, bar, size - 2 * m, white)
    # diagonal
    for i in range(size - 2 * m):
        x = m + int(i * (size - 2 * m - bar) / max(1, size - 2 * m))
        y = m + i
        for t in range(bar):
            setp(x + t, y, white)

    return png(size, size, bytes(px))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (16, 48, 128):
        path = OUT / f"icon{s}.png"
        data = icon(s)
        path.write_bytes(data)
        assert data[:8] == b"\x89PNG\r\n\x1a\n", path
        print("wrote", path, path.stat().st_size)


if __name__ == "__main__":
    main()
