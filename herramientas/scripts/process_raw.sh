#!/bin/bash
# process_raw.sh — Detecta el tipo de archivo y aplica el pipeline correcto
# Uso: process_raw.sh <archivo> [modelo_whisper]
# Este script es llamado por el Sintetizador para pre-procesar archivos de raw/

set -e

INPUT="$1"
MODEL="${2:-base}"

if [ -z "$INPUT" ]; then
    echo "❌ Uso: process_raw.sh <archivo> [modelo_whisper]"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "❌ No se encuentra el archivo: $INPUT"
    exit 1
fi

BASENAME=$(basename "$INPUT")
EXT="${BASENAME##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
DIR=$(dirname "$INPUT")
STEM="${BASENAME%.*}"
OUTPUT="$DIR/${STEM}.txt"

# Si ya existe el archivo .txt procesado, no repetir
if [ -f "$OUTPUT" ]; then
    echo "✅ Ya existe transcripción/extracción: $OUTPUT"
    cat "$OUTPUT"
    exit 0
fi

echo "🔧 Procesando: $BASENAME (extensión: $EXT_LOWER)"

case "$EXT_LOWER" in
    mp4|avi|mkv|mov|wmv|flv|webm|m4v)
        echo "🎬 Archivo de video detectado → transcribiendo con Whisper..."
        bash /app/scripts/transcribe.sh "$INPUT" "$MODEL"
        ;;
    mp3|wav|m4a|aac|ogg|flac|wma)
        echo "🎵 Archivo de audio detectado → transcribiendo con Whisper..."
        # Para audio, saltamos la extracción de audio de FFmpeg y transcribimos directamente
        python -c "
import whisper
model = whisper.load_model('$MODEL')
result = model.transcribe('$INPUT')
print(result['text'], end='')
" > "$OUTPUT"
        echo "✅ Transcripción guardada en: $OUTPUT"
        echo "---"
        cat "$OUTPUT"
        ;;
    pdf)
        echo "📄 Archivo PDF detectado → extrayendo texto..."
        bash /app/scripts/extract_pdf.sh "$INPUT"
        ;;
    png|jpg|jpeg|bmp|tiff|tif|gif|webp)
        echo "🖼️ Imagen detectada → ejecutando OCR..."
        bash /app/scripts/ocr.sh "$INPUT"
        ;;
    txt|md|markdown)
        echo "📝 Archivo de texto detectado → copiando contenido..."
        cp "$INPUT" "$OUTPUT"
        echo "✅ Texto copiado a: $OUTPUT"
        ;;
    doc|docx)
        echo "📄 Documento Word detectado → extrayendo texto..."
        python -c "
import sys
try:
    from docx import Document
    doc = Document('$INPUT')
    text = '\n'.join([p.text for p in doc.paragraphs if p.text.strip()])
    print(text, end='')
except ImportError:
    print('❌ python-docx no instalado. Instala con: pip install python-docx', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}', file=sys.stderr)
    sys.exit(1)
" > "$OUTPUT"
        echo "✅ Texto extraído guardado en: $OUTPUT"
        ;;
    *)
        echo "⚠️ Tipo de archivo no soportado: $EXT_LOWER"
        echo "Tipos soportados: video (mp4,avi,mkv,mov), audio (mp3,wav,m4a), PDF, imágenes (png,jpg), texto (txt,md), Word (doc,docx)"
        exit 1
        ;;
esac

echo ""
echo "✅ Procesamiento completado para: $BASENAME"
