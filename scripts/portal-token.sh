#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# Generates a bearer token for viewing K8s resources in Azure Portal.
# Usage: ./scripts/portal-token.sh [resource-group] [cluster-name]
set -euo pipefail

RG="${1:-$(azd env get-value AZURE_RESOURCE_GROUP 2>/dev/null)}"
CLUSTER="${2:-$(azd env get-value AZURE_AKS_CLUSTER_NAME 2>/dev/null)}"

if [[ -z "$RG" || -z "$CLUSTER" ]]; then
  echo "❌ Could not resolve RG/cluster. Run 'azd provision' first or pass them as arguments."
  exit 1
fi
SA_NAME="portal-admin"
NAMESPACE="kube-system"
DURATION="48h"

# Ensure kubelogin is installed (required for AAD-enabled clusters)
if ! command -v kubelogin &>/dev/null; then
  echo "⚙️  kubelogin not found — installing..."
  INSTALL_DIR="$HOME/.azure-kubelogin/bin"
  mkdir -p "$INSTALL_DIR"
  az aks install-cli --install-location "$INSTALL_DIR/kubectl" --kubelogin-install-location "$INSTALL_DIR/kubelogin" --only-show-errors
  export PATH="$INSTALL_DIR:$PATH"
fi

echo "🔑 Connecting to AKS cluster: $CLUSTER (rg: $RG)"
az aks get-credentials -g "$RG" -n "$CLUSTER" --admin --overwrite-existing --only-show-errors
kubelogin convert-kubeconfig -l azurecli

# Create service account + binding if they don't exist
kubectl get serviceaccount "$SA_NAME" -n "$NAMESPACE" &>/dev/null ||
  kubectl create serviceaccount "$SA_NAME" -n "$NAMESPACE"

kubectl get clusterrolebinding "$SA_NAME" &>/dev/null ||
  kubectl create clusterrolebinding "$SA_NAME" --clusterrole=cluster-admin --serviceaccount="$NAMESPACE:$SA_NAME"

TOKEN=$(kubectl create token "$SA_NAME" -n "$NAMESPACE" --duration="$DURATION")

echo ""
echo "✅ Token valid for $DURATION — paste it into the Azure Portal:"
echo ""
echo "$TOKEN"

# Copy to clipboard if possible
if command -v pbcopy &>/dev/null; then
  echo "$TOKEN" | pbcopy
  echo ""
  echo "📋 Token copied to clipboard."
elif command -v clip.exe &>/dev/null; then
  echo "$TOKEN" | clip.exe
  echo ""
  echo "📋 Token copied to clipboard."
elif command -v xclip &>/dev/null; then
  echo "$TOKEN" | xclip -selection clipboard
  echo ""
  echo "📋 Token copied to clipboard."
fi
