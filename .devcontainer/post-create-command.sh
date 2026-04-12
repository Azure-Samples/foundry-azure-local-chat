#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

echo "[1/2] Installing frontend dependencies..."
npm install

echo "[2/2] Installing server dependencies..."
cd server && npm install && cd ..

if [ $? -eq 0 ]; then
  echo ""
  echo "================================================"
  echo " Setup complete! Run 'az login' then 'azd up' to get started."
  echo "================================================"
fi
