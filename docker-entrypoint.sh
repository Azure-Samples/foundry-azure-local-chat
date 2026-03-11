#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# docker-entrypoint.sh
# Generates runtime config from ALL VITE_* environment variables before starting nginx.
# This allows Helm charts to inject any VITE_* env var without rebuilding the image.

CONFIG_FILE="/usr/share/nginx/html/config.js"

# Start the config object
printf 'window.__RUNTIME_CONFIG__ = {\n' > "$CONFIG_FILE"

# Dynamically export every VITE_* env var
# Use process substitution to avoid subshell issues with pipe
first=true
while IFS='=' read -r key value; do
  if [ "$first" = true ]; then
    first=false
  else
    printf ',\n' >> "$CONFIG_FILE"
  fi
  # Escape backslashes and double quotes for JSON string values
  # Note: Environment variables rarely contain newlines, but if they do, they'll be preserved as-is
  escaped_value=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\"/g')
  printf '  "%s": "%s"' "$key" "$escaped_value" >> "$CONFIG_FILE"
done < <(env | grep '^VITE_')

printf '\n};\n' >> "$CONFIG_FILE"

echo "Runtime config written:"
cat "$CONFIG_FILE"

exec nginx -g "daemon off;"