#!/bin/bash
# Скачать набор голосов Piper. Каждая модель — пара .onnx + .onnx.json
set -e
cd /opt/piper/voices

BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# voice_id → путь в репо
declare -A VOICES=(
  ["en_us_amy_medium"]="en/en_US/amy/medium/en_US-amy-medium"
  ["en_us_ryan_medium"]="en/en_US/ryan/medium/en_US-ryan-medium"
  ["ru_dmitri_medium"]="ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium"
  ["ru_irina_medium"]="ru/ru_RU/irina/medium/ru_RU-irina-medium"
)

for vid in "${!VOICES[@]}"; do
  src="${VOICES[$vid]}"
  if [ -f "${vid}.onnx" ] && [ -f "${vid}.onnx.json" ]; then
    echo "=== $vid: already there ==="
    continue
  fi
  echo "=== downloading $vid ==="
  curl -sLf -o "${vid}.onnx" "${BASE}/${src}.onnx"
  curl -sLf -o "${vid}.onnx.json" "${BASE}/${src}.onnx.json"
  ls -la "${vid}.onnx" | awk '{print $5, $NF}'
done

echo "=== voices ready ==="
ls -la /opt/piper/voices/
du -sh /opt/piper/voices/
