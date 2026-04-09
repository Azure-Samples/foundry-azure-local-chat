#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

echo "[1/4] Upgrading Azure CLI..."
az upgrade --yes || echo "⚠️ Azure CLI upgrade failed"

echo "[2/4] Installing Azure CLI extensions..."
az extension add --name connectedk8s --yes || echo "⚠️ connectedk8s extension install failed"

echo "[3/4] Installing frontend dependencies..."
npm install

echo "[4/4] Installing server dependencies..."
cd server && npm install && cd ..

if [ $? -eq 0 ]; then
  echo ""
  echo "================================================"
  echo " Setup complete! Run 'az login' then 'azd up' to get started."
  echo "================================================"
fi
