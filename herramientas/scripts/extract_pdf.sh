#!/bin/bash
# extract_pdf.sh — Extrae texto de un PDF usando pdfplumber/PyPDF2
# Uso: extract_pdf.sh <archivo_pdf>
# Salida: archivo .txt con el texto extraído en la misma carpeta

set -e

INPUT="$1"

if [ -z "$INPUT" ]; then
    echo "❌ Uso: extract_pdf.sh <archivo_pdf>"
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

echo "📄 Extrayendo texto de PDF: $BASENAME"

python -c "
import pdfplumber
import sys

try:
    with pdfplumber.open('$INPUT') as pdf:
        text_parts = []
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ''
            if page_text.strip():
                text_parts.append(f'--- Página {i+1} ---\n{page_text}')
        text = '\n\n'.join(text_parts)
        if not text.strip():
            # Fallback: intentar con PyPDF2
            import PyPDF2
            reader = PyPDF2.PdfReader('$INPUT')
            text_parts = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ''
                if page_text.strip():
                    text_parts.append(f'--- Página {i+1} ---\n{page_text}')
            text = '\n\n'.join(text_parts)
            if not text.strip():
                print('⚠️ El PDF no contiene texto extraíble (puede ser escaneado).', file=sys.stderr)
                print('  Usa ocr.sh para realizar OCR en las páginas del PDF.', file=sys.stderr)
                sys.exit(1)
        print(text, end='')
except Exception as e:
    print(f'❌ Error procesando PDF: {e}', file=sys.stderr)
    sys.exit(1)
" > "$OUTPUT"

echo "✅ Texto extraído guardado en: $OUTPUT"
echo "---"
head -50 "$OUTPUT"
