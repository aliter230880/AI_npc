#!/bin/bash
set -e
cd /opt/piper/voices
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# voice_id_local → src_path в HF
declare -A VOICES=(
  ["en_us_kristin_medium"]="en/en_US/kristin/medium/en_US-kristin-medium"
  ["ru_ruslan_medium"]="ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium"
)

for vid in "${!VOICES[@]}"; do
  if [ -f "${vid}.onnx" ] && [ -f "${vid}.onnx.json" ]; then
    echo "$vid: already there"; continue
  fi
  src="${VOICES[$vid]}"
  echo "=== $vid ==="
  if curl -sLfo "${vid}.onnx" "${BASE}/${src}.onnx" \
     && curl -sLfo "${vid}.onnx.json" "${BASE}/${src}.onnx.json"; then
    echo "  ok size=$(stat -c %s ${vid}.onnx)"
  else
    echo "  FAIL"
    rm -f "${vid}.onnx" "${vid}.onnx.json"
  fi
done

echo "---"
ls /opt/piper/voices/*.onnx
df -h / | tail -1
