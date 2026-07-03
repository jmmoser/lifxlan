#!/bin/bash
set -euo pipefail

# Install dependencies for Claude Code on the web sessions so tests,
# lint, and typecheck work immediately. No-op for local sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

bun install
