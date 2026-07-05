#!/bin/bash
# transcribe.sh — Extrae audio de un video y lo transcribe con Whisper
# Uso: transcribe.sh <archivo_video> [modelo_whisper]
# Salida: archivo .txt con la transcripción en la misma carpeta que el video

set -e

INPUT="$1"
MODEL="${2:-base}"

if [ -z "$INPUT" ]; then
    echo "❌ Uso: transcribe.sh <archivo_video> [modelo_whisper]"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "❌ No se encuentra el archivo: $INPUT"
    exit 1
fi

DIR=$(dirname "$INPUT")
BASENAME=$(basename "$INPUT")
STEM="${BASENAME%.*}"
AUDIO="$DIR/${STEM}.wav"
TRANSCRIPT="$DIR/${STEM}.txt"

echo "🎬 Extrayendo audio de: $BASENAME"
ffmpeg -y -i "$INPUT" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$AUDIO" 2>/dev/null

echo "📝 Transcribiendo con Whisper (modelo: $MODEL)..."
python -c "
import whisper
model = whisper.load_model('$MODEL')
result = model.transcribe('$AUDIO')
print(result['text'], end='')
" > "$TRANSCRIPT"

# Limpiar audio temporal
rm -f "$AUDIO"

echo "✅ Transcripción guardada en: $TRANSCRIPT"
echo "---"
cat "$TRANSCRIPT"
