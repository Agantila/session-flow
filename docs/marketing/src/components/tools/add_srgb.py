#!/usr/bin/env python3
"""Ergaenzt in allen Karten-PNGs einen expliziten sRGB-Chunk (Rendering-Intent
perceptual) direkt hinter IHDR. Chromium-Screenshots sind sRGB-kodiert, tragen
aber keine Kennzeichnung; der Brief verlangt sRGB explizit.
Laeuft idempotent (vorhandener sRGB-Chunk wird nicht doppelt eingefuegt).
"""
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PNG_SIG = b'\x89PNG\r\n\x1a\n'
SRGB_TYPE = b'sRGB'


def has_srgb(data: bytes) -> bool:
    pos = 8
    while pos + 8 <= len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        if typ == SRGB_TYPE:
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
    crc = zlib.crc32(SRGB_TYPE + payload) & 0xFFFFFFFF
    chunk = struct.pack('>I', len(payload)) + SRGB_TYPE + payload + struct.pack('>I', crc)
    path.write_bytes(data[:after_ihdr] + chunk + data[after_ihdr:])
    return 'sRGB ergaenzt'


if __name__ == '__main__':
    for f in sorted((ROOT / '..' / '..' / 'components').glob('sf-comp-*.png')):
        print(f.name, insert_srgb(f))
