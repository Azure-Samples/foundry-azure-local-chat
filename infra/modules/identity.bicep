// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ============================================================
// Workload Identity — Managed Identity + Federated Credential + RBAC
// ============================================================

@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('K8s namespace for the service account')
param namespace string

@description('OIDC issuer URL from AKS cluster')
param oidcIssuerUrl string

var identityName = '${prefix}-backend-id'
var fedCredName = '${prefix}-fed-cred'
var saName = '${prefix}-backend-sa'

// ─── Managed Identity ───────────────────────────────────────
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

// ─── Federated Credential (bound to K8s Service Account) ────
resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  name: fedCredName
  parent: backendIdentity
  properties: {
    issuer: oidcIssuerUrl
    subject: 'system:serviceaccount:${namespace}:${saName}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// ─── RBAC ────────────────────────────────────────────────────
// All RBAC is handled by postprovision.sh (az CLI) for idempotency.
// No RBAC assignments in Bicep.

output identityName string = backendIdentity.name
output identityClientId string = backendIdentity.properties.clientId
output identityPrincipalId string = backendIdentity.properties.principalId
