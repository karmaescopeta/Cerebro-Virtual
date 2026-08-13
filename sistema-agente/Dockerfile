FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    libffi-dev \
    python3-bcrypt \
    && rm -rf /var/lib/apt/lists/*

# Configurar HERMES_HOME y PATH (instalador pone hermes en /usr/local/lib)
ENV HERMES_HOME=/app/hermes-home
ENV PATH="/usr/local/lib/hermes-agent/venv/bin:${HERMES_HOME}/bin:${PATH}"

# Ejecutar el instalador oficial
RUN curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --no-venv --skip-setup

# Instalar pyyaml y bcrypt (por si acaso)
RUN pip install pyyaml bcrypt || true

# Crear directorios necesarios
RUN mkdir -p /app/config /app/vault /app/data

# Copiar scripts de entrada
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/entrypoint.sh

# Copiar perfiles de subagentes
COPY profiles/ /app/sistema-agente/profiles/

# Puerto para la interfaz web
EXPOSE 8080

ENTRYPOINT ["/app/scripts/entrypoint.sh"]