#!/bin/bash
# ocr.sh — Extrae texto de imágenes y PDFs usando Tesseract OCR
# Uso: ocr.sh <archivo_imagen_o_pdf>
# Salida: archivo .txt con el texto extraído en la misma carpeta

set -e

INPUT="$1"

if [ -z "$INPUT" ]; then
    echo "❌ Uso: ocr.sh <archivo_imagen_o_pdf>"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "❌ No se encuentra el archivo: $INPUT"
    exit 1
fi

DIR=$(dirname "$INPUT")
BASENAME=$(basename "$INPUT")
STEM="${BASENAME%.*}"
OUTPUT="$DIR/${STEM}.txt"

EXT="${BASENAME##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

echo "🔍 Procesando: $BASENAME (tipo: $EXT_LOWER)"

case "$EXT_LOWER" in
    pdf)
        echo "📄 Extrayendo texto de PDF..."
        # audit run-1: INPUT por env var — un ' en el nombre rompía el literal y ejecutaba Python
        PDF_INPUT="$INPUT" python -c "
import os, pdfplumber
import sys
try:
    with pdfplumber.open(os.environ['PDF_INPUT']) as pdf:
        text = ''
        for page in pdf.pages:
            page_text = page.extract_text() or ''
            text += page_text + '\n'
        if not text.strip():
            print('⚠️ El PDF no tiene texto extraíble. Se necesita OCR en las imágenes del PDF.', file=sys.stderr)
            print(' Para OCR de PDFs escaneados, convierte las páginas a imágenes primero.', file=sys.stderr)
        else:
            print(text, end='')
except Exception as e:
    print(f'❌ Error procesando PDF: {e}', file=sys.stderr)
    sys.exit(1)
" > "$OUTPUT"
        ;;
    png|jpg|jpeg|bmp|tiff|tif|gif|webp)
        echo "🖼️ Ejecutando OCR en imagen..."
        # audit run-1: INPUT por env var — un ' en el nombre rompía el literal y ejecutaba Python
        OCR_INPUT="$INPUT" python -c "
import os, pytesseract
from PIL import Image
import sys
try:
    img = Image.open(os.environ['OCR_INPUT'])
    text = pytesseract.image_to_string(img, lang='spa+eng')
    print(text, end='')
except Exception as e:
    print(f'❌ Error en OCR: {e}', file=sys.stderr)
    sys.exit(1)
" > "$OUTPUT"
        ;;
    *)
        echo "❌ Formato no soportado para OCR: $EXT_LOWER"
        echo "Formatos soportados: PDF, PNG, JPG, JPEG, BMP, TIFF, GIF, WEBP"
        exit 1
        ;;
esac

echo "✅ Texto extraído guardado en: $OUTPUT"
echo "---"
cat "$OUTPUT"
