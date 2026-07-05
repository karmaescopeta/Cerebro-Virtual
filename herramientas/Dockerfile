FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema: FFmpeg, Tesseract OCR (inglés + español)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python para procesamiento de archivos
RUN pip install --no-cache-dir \
    openai-whisper \
    pytesseract \
    pdfplumber \
    PyPDF2 \
    Pillow

# Copiar scripts de procesamiento
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# El contenedor se ejecuta bajo demanda, no como servicio
CMD ["sleep", "infinity"]
