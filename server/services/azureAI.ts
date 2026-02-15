/**
 * Azure AI Service
 * Handles Azure AI Foundry client initialization and operations
 * 
 * Authentication: Uses Azure Entra ID (DefaultAzureCredential) - the recommended
 * authentication method for Azure AI Foundry.
 * 
 * DefaultAzureCredential automatically handles:
 * - Local dev: az login
 * - Azure App Service: Managed Identity
 * - Azure Container Apps: Managed Identity
 * - GitHub Actions: Workload Identity
 */

import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

// Lazy initialization to ensure dotenv has loaded
let _projectClient: AIProjectClient | null = null;
let _agentName: string | null = null;
let _credential: DefaultAzureCredential | null = null;

const getConfig = () => {
  const projectEndpoint = process.env.AI_PROJECT_ENDPOINT;
  const agentId = process.env.AI_AGENT_ID;

  if (!projectEndpoint || !agentId) {
    console.error("Missing required env vars: AI_PROJECT_ENDPOINT and AI_AGENT_ID");
    process.exit(1);
  }

  return { projectEndpoint, agentId };
};

/**
 * Get the shared Azure credential instance
 */
export const getCredential = (): DefaultAzureCredential => {
  if (!_credential) {
    _credential = new DefaultAzureCredential();
  }
  return _credential;
};

/**
 * Get bearer token provider for direct OpenAI SDK usage
 * Scope: Azure Cognitive Services
 */
export const getTokenProvider = () => 
  getBearerTokenProvider(getCredential(), "https://cognitiveservices.azure.com/.default");

export const getAgentName = (): string => {
  if (!_agentName) {
    const { agentId } = getConfig();
    _agentName = agentId.split(":")[0];
  }
  return _agentName;
};

// For backwards compatibility
export const agentName = new Proxy({} as { value: string }, {
  get: () => getAgentName(),
}) as unknown as string;

export const projectClient = new Proxy({} as AIProjectClient, {
  get: (_, prop) => {
    if (!_projectClient) {
      const { projectEndpoint } = getConfig();
      console.log("🔐 Using Azure Entra ID authentication");
      _projectClient = new AIProjectClient(projectEndpoint, getCredential());
    }
    return (_projectClient as unknown as Record<string, unknown>)[prop as string];
  },
});

/**
 * Get the OpenAI client from the project
 */
export const getOpenAIClient = () => projectClient.getOpenAIClient();

/**
 * Get the configured agent
 */
export const getAgent = () => projectClient.agents.get(getAgentName());

/**
 * Generate a unique message ID
 */
export const generateMessageId = () => 
  `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Get agent request options for responses.create()
 * Use with: client.responses.create(params, getAgentRequestOptions(signal))
 */
export const getAgentRequestOptions = (signal?: AbortSignal) => ({
  body: { agent: { name: getAgentName(), type: "agent_reference" } },
  ...(signal && { signal }),
});
