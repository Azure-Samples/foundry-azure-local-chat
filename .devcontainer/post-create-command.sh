#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

echo "[1/3] Installing Azure CLI extensions..."
az extension add --name connectedk8s --yes 2>/dev/null || true

echo "[2/3] Installing frontend dependencies..."
npm install

echo "[3/3] Installing server dependencies..."
cd server && npm install && cd ..

if [ $? -eq 0 ]; then
  echo ""
  echo "================================================"
  echo " Setup complete! Run 'az login' then 'azd up' to get started."
  echo "================================================"
fi
