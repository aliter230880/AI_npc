#!/bin/bash
# Расширяем каталог Piper. Уже есть amy, ryan (en) + dmitri, irina (ru). Качаем ещё.
set -e
cd /opt/piper/voices
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

declare -A VOICES=(
  ["en_us_hfc_female_medium"]="en/en_US/hfc_female/medium/en_US-hfc_female-medium"
  ["en_us_lessac_medium"]="en/en_US/lessac/medium/en_US-lessac-medium"
  ["en_us_kristin_medium"]="en/en_US/kristin/medium/en_US-kristin-medium"
  ["en_us_joe_medium"]="en/en_US/joe/medium/en_US-joe-medium"
  ["en_us_kusal_medium"]="en/en_US/kusal/medium/en_US-kusal-medium"
  ["en_us_norman_medium"]="en/en_US/norman/medium/en_US-norman-medium"
  ["en_us_bryce_medium"]="en/en_US/bryce/medium/en_US-bryce-medium"
  ["ru_denis_medium"]="ru/ru_RU/denis/medium/ru_RU-denis-medium"
  ["ru_ruslan_medium"]="ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium"
)

dl() {
  local url="$1"; local out="$2"
  for i in 1 2 3; do
    if curl -sSLf --connect-timeout 15 --max-time 180 -o "$out" "$url"; then
      return 0
    fi
    echo "    retry $i for $(basename $out)..."
    sleep 2
  done
  return 1
}

for vid in "${!VOICES[@]}"; do
  src="${VOICES[$vid]}"
  if [ -f "${vid}.onnx" ] && [ -f "${vid}.onnx.json" ]; then
    echo "=== $vid: already there ==="
    continue
  fi
  echo "=== downloading $vid ==="
  if dl "${BASE}/${src}.onnx" "${vid}.onnx" && dl "${BASE}/${src}.onnx.json" "${vid}.onnx.json"; then
    sz=$(stat -c %s "${vid}.onnx")
    echo "  ok size=$sz"
  else
    echo "  FAIL — removing partial files"
    rm -f "${vid}.onnx" "${vid}.onnx.json"
  fi
done

echo "=== summary ==="
ls /opt/piper/voices/*.onnx 2>/dev/null | xargs -n1 basename
echo "total:"
du -sh /opt/piper/voices/
df -h / | tail -1
