// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ============================================================
// MS Foundry — Hub + Project + Model Deployment
// ============================================================
// Creates an Azure AI Services account (hub), a project under it,
// and a model deployment. Used when AI_MODE=create.
// ============================================================

@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Model name to deploy (e.g. gpt-4o-mini)')
param modelName string

@description('Model version (e.g. 2024-07-18)')
param modelVersion string

@description('Model deployment SKU capacity (tokens-per-minute in thousands)')
param modelCapacity int = 1

var accountName = '${prefix}-ai-hub'
var projectName = '${prefix}-ai-project'
var deploymentName = '${prefix}-chat'

// ─── AI Services Account (Hub) ──────────────────────────────
resource aiAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    allowProjectManagement: true
  }
}

// ─── Project (child of hub account) ─────────────────────────
resource aiProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: aiAccount
  name: projectName
  location: location
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  properties: {}
}

// ─── Model Deployment ───────────────────────────────────────
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: aiAccount
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: modelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
  }
}

// ─── Outputs ────────────────────────────────────────────────
output aiAccountName string = aiAccount.name
output aiProjectName string = aiProject.name
output aiEndpoint string = 'https://${accountName}.cognitiveservices.azure.com/api/projects/${projectName}'
output aiModelDeploymentName string = modelDeployment.name
