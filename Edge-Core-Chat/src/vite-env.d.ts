/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Azure Foundry AI Configuration
  // These match the Azure Foundry generated .env format with VITE_ prefix
  readonly VITE_AZURE_EXISTING_AGENT_ID: string;
  readonly VITE_AZURE_ENV_NAME?: string;
  readonly VITE_AZURE_LOCATION?: string;
  readonly VITE_AZURE_SUBSCRIPTION_ID?: string;
  readonly VITE_AZURE_EXISTING_AIPROJECT_ENDPOINT: string;
  readonly VITE_AZURE_EXISTING_AIPROJECT_RESOURCE_ID?: string;
  readonly VITE_AZURE_EXISTING_RESOURCE_ID?: string;
  readonly VITE_AZD_ALLOW_NON_EMPTY_FOLDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
