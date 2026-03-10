// ============================================================
// Azure Container Registry
// ============================================================

@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

// ACR names must be alphanumeric
var acrName = replace('${prefix}acr', '-', '')

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
