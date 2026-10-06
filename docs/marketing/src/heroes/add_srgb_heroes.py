#!/usr/bin/env python3
"""Ergaenzt in allen Hero-/Crop-PNGs einen expliziten sRGB-Chunk (Rendering-Intent
perceptual) direkt hinter IHDR. Chromium-Screenshots sind sRGB-kodiert, tragen aber
keine Kennzeichnung; der Brief §6 verlangt sRGB explizit. Idempotent.
Ziele:  ../../heroes/*.png  und  ../../crops/*.png
"""
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent      # = src/heroes/
PNG_SIG = b'\x89PNG\r\n\x1a\n'


def has_srgb(data: bytes) -> bool:
    pos = 8
    while pos + 8 <= len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        if typ == b'sRGB':
            return True
        if typ == b'IEND':
            return False
        pos += 12 + ln
    return False


def insert_srgb(path: pathlib.Path) -> str:
    data = path.read_bytes()
    assert data[:8] == PNG_SIG, f'{path}: kein PNG'
    if has_srgb(data):
        return 'schon vorhanden'
    pos = 8
    ln = struct.unpack('>I', data[pos:pos + 4])[0]
    typ = data[pos + 4:pos + 8]
    assert typ == b'IHDR', f'{path}: erstes Chunk ist {typ!r}'
    after_ihdr = pos + 12 + ln
    payload = b'\x00'  # Rendering-Intent: perceptual
    crc = zlib.crc32(b'sRGB' + payload) & 0xFFFFFFFF
    chunk = struct.pack('>I', len(payload)) + b'sRGB' + payload + struct.pack('>I', crc)
    path.write_bytes(data[:after_ihdr] + chunk + data[after_ihdr:])
    return 'sRGB ergaenzt'


if __name__ == '__main__':
    for d in (ROOT / '..' / '..' / 'heroes', ROOT / '..' / '..' / 'crops'):
        for f in sorted(d.glob('*.png')):
            print(f.name, insert_srgb(f))
