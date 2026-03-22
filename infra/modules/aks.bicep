// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ============================================================
// AKS Cluster with OIDC + Workload Identity
// ============================================================

@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Node count')
param nodeCount int

@description('VM size')
param vmSize string

var clusterName = '${prefix}-cluster'

resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: clusterName
    nodeResourceGroup: '${prefix}-nodes'
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: nodeCount
        vmSize: vmSize
        mode: 'System'
        osType: 'Linux'
        osSKU: 'AzureLinux'
      }
    ]
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    aadProfile: {
      managed: true
    }
    ingressProfile: {
      webAppRouting: {
        enabled: true
      }
    }
  }
}

output clusterName string = aks.name
output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerUrl
