FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# ponytail: instalador pm (2026.9+) — shim en /root/.local/bin, runtime en /app/hermes-home
# (sin venv clásico: el agente vive en installs/<hash>/environments/*/venv)
ENV HERMES_HOME=/app/hermes-home
ENV PATH="/root/.local/bin:${PATH}"
RUN curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup --skip-browser

# bcrypt+pyyaml para la auth del dashboard: el venv pm no trae pip → pip --python
RUN V=$(find /app/hermes-home/installs -name pyvenv.cfg | grep environments | head -1 | xargs -r dirname) \
    && /app/hermes-home/tools/python-*/bin/python3 -m pip --python "$V/bin/python" install bcrypt pyyaml || true

# pyyaml+bcrypt en el python del sistema (generate_config.py del entrypoint corre sin venv clásico)
RUN pip install --no-cache-dir pyyaml bcrypt || true

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