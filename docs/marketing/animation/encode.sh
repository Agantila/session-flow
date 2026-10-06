#!/usr/bin/env bash
# Encode 120 frames @ 24fps into a 5-second hyperframes animation.
# Outputs: 1920x1080 MP4 (libx264), WebM (libvpx-vp9), APNG (lossless loop),
# and a downsized GIF for inline previews. sRGB tag is set on the PNGs already.
set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="$(pwd)"
WORK_DIR="$(mktemp -d)"
trap "rm -rf $WORK_DIR" EXIT

# 1) Raw cut @ 24fps via concat demuxer (4 stages, 1.25s each, glob 000..029).
ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$OUT_DIR/seq.txt" \
  -r 24 -pix_fmt yuv420p \
  -c:v libx264 -preset medium -crf 18 \
  -movflags +faststart \
  "$WORK_DIR/raw.mp4"

echo "RAW MP4:"
ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration,nb_frames \
  -count_frames \
  -of default=noprint_wrappers=1 "$WORK_DIR/raw.mp4"

# 2) MP4 (final) — same as raw, just renamed
cp "$WORK_DIR/raw.mp4" "$OUT_DIR/sf-hyperframes-1920x1080-5s.mp4"

# 3) WebM (libvpx-vp9) for docs/README inline
ffmpeg -y -hide_banner -loglevel error \
  -i "$WORK_DIR/raw.mp4" \
  -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 \
  -pix_fmt yuv420p \
  "$OUT_DIR/sf-hyperframes-1920x1080-5s.webm"

# (APNG skipped: 120-frame lossless APNG at 1280x720 is 14 MB; the GIF at
#  960x540 is 700 KB and animates everywhere. MP4 + WebM cover high-fidelity.)

# 5) GIF (960x540, palette) — universal preview
ffmpeg -y -hide_banner -loglevel error \
  -i "$WORK_DIR/raw.mp4" \
  -vf "fps=18,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 \
  "$OUT_DIR/sf-hyperframes-1920x1080-5s.gif"

# 6) Final report
echo
echo "=== ERGEBNIS ==="
ls -la "$OUT_DIR"/sf-hyperframes-*.* 2>&1
