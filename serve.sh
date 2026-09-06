#!/usr/bin/env bash
# Serve the talk over http://localhost:8765 (avoids file:// quirks in some browsers).
cd "$(dirname "$0")"
exec uv run python -m http.server 8765
