#!/usr/bin/env bash
# extract_frames.sh — video → frames for screen-inventory + spec writing.
#
# Usage:
#   extract_frames.sh <video> <outdir>                 # 1fps + scene-cut frames, 390px wide
#   extract_frames.sh <video> <outdir> --full "3 11 145"   # full-res frames at those seconds
#
# Output layout under <outdir>:
#   frames-1fps/f_NNN.png    one frame per second, FRAME_WIDTH wide (NNN = second)
#   frames-scene/s_NNN.png   scene-change frames (threshold 0.22), FRAME_WIDTH wide
#   frames-full/t_NNN.png    full-resolution canonical frames (only with --full)
#
# FRAME_WIDTH (env, default 390 — set it to the profile's screens.renderWidth) is enough
# for clustering screens/states cheaply; spec writers re-extract the canonical timestamps
# at full resolution to transcribe exact copy (accents and special characters included).

set -euo pipefail

VIDEO="${1:?video path required}"
OUTDIR="${2:?output dir required}"
MODE="${3:-}"
WIDTH="${FRAME_WIDTH:-390}"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }

if [[ "$MODE" == "--full" ]]; then
  TIMES="${4:?--full needs a quoted list of seconds}"
  mkdir -p "$OUTDIR/frames-full"
  for t in $TIMES; do
    ffmpeg -v error -ss "$t" -i "$VIDEO" -frames:v 1 -y \
      "$OUTDIR/frames-full/t_$(printf '%03d' "$t").png"
  done
  echo "full-res: $(ls "$OUTDIR/frames-full" | wc -l | tr -d ' ') frames"
  exit 0
fi

ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,duration -of default=nw=1 "$VIDEO"

mkdir -p "$OUTDIR/frames-1fps" "$OUTDIR/frames-scene"
ffmpeg -v error -i "$VIDEO" -vf "fps=1,scale=${WIDTH}:-1" -y "$OUTDIR/frames-1fps/f_%03d.png"
ffmpeg -v error -i "$VIDEO" -vf "select='gt(scene,0.22)',scale=${WIDTH}:-1" -vsync vfr -y \
  "$OUTDIR/frames-scene/s_%03d.png"

echo "1fps:  $(ls "$OUTDIR/frames-1fps" | wc -l | tr -d ' ') frames"
echo "scene: $(ls "$OUTDIR/frames-scene" | wc -l | tr -d ' ') frames"
