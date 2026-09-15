#!/bin/bash
# process_raw.sh — Detecta el tipo de archivo y aplica el pipeline correcto
# Uso: process_raw.sh <archivo> [modelo_whisper]
# Este script es llamado por el Sintetizador para pre-procesar archivos de raw/
# Salida: .txt hermano (contenido Markdown desde markitdown; extensión .txt
# porque el backend gestiona el hermano .txt en delete/rename/cleanup).

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
    png|jpg|jpeg|bmp|tiff|tif|gif|webp)
        echo "🖼️ Imagen detectada → ejecutando OCR..."
        bash /app/scripts/ocr.sh "$INPUT"
        ;;
    txt|md|markdown)
        echo "📝 Archivo de texto detectado → copiando contenido..."
        cp "$INPUT" "$OUTPUT"
        echo "✅ Texto copiado a: $OUTPUT"
        ;;
    *)
        # ponytail: todo lo demás → markitdown (pdf/docx/xlsx/pptx/epub/html/csv/json/xml/…).
        # Escaneado → salida vacía → fallback ocr.sh solo para pdf/imágenes.
        echo "📄 Convirtiendo a Markdown con markitdown..."
        if markitdown "$INPUT" > "$OUTPUT" 2>/dev/null && [ -s "$OUTPUT" ] && [ "$(tr -d '[:space:]' < "$OUTPUT" | head -c 1)" != "" ]; then
            echo "✅ Markdown guardado en: $OUTPUT"
        else
            rm -f "$OUTPUT"
            case "$EXT_LOWER" in
                pdf)
                    echo "⚠️ markitdown sin texto (¿PDF escaneado?) → fallback OCR..."
                    bash /app/scripts/ocr.sh "$INPUT"
                    ;;
                *)
                    echo "❌ markitdown no pudo extraer contenido de: $BASENAME"
                    exit 1
                    ;;
            esac
        fi
        echo "---"
        cat "$OUTPUT"
        ;;
esac

echo ""
echo "✅ Procesamiento completado para: $BASENAME"
