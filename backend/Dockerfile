FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema incluyendo Docker CLI
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# ponytail: docker compose v2 plugin — download binary directly, no repo needed
RUN mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -fsSL https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x scripts/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]