#!/bin/bash
# run_graphify.sh <input_path> <output_dir>
# ponytail: Graphify extract. Pass 1 (code, tree-sitter, free) + Pass 3 (docs, LLM).
# Pass 2 (Whisper) no se ejecuta: el backend solo pasa archivos no-audio/video.
# Output: graph.json en <output_dir>.
# ponytail: sin set -e — Pass 1 (tree-sitter) puede producir nodos aunque Pass 3 (LLM) falle
INPUT="$1"
OUTPUT_DIR="${2:-/tmp/graphify-out}"

if [ -z "$INPUT" ]; then
  echo "Usage: $0 <input_path> [output_dir]" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
graphify extract "$INPUT" --backend openai --output "$OUTPUT_DIR" --no-gitignore --no-cluster 2>&1
