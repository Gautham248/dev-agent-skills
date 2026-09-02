#!/usr/bin/env bash
set -euo pipefail
curl -fsSL "https://api.example.com/docs/$1" -o /tmp/docs.json
echo "Fetched docs for $1"
