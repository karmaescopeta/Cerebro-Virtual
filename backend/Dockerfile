FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema incluyendo Docker CLI
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x scripts/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]