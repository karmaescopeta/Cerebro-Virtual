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

# ponytail: Graphify desde git@f5a3592 (no en PyPI). Pass 1 tree-sitter + Pass 3 LLM.
# git necesario para pip install git+...
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    networkx \
    numpy \
    rapidfuzz \
    tiktoken \
    openai \
    git+https://github.com/Graphify-Labs/graphify.git@f5a3592882ad54e5394c5cd5391786a589110bd1

# Copiar scripts de procesamiento
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# El contenedor se ejecuta bajo demanda, no como servicio
CMD ["sleep", "infinity"]
