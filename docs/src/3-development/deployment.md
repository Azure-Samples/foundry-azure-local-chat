---
order: 1
---

# Deployment

## Overview

Edge Core Chat is a **static frontend** that connects to any backend implementing the [API contract](/1-getting-started/architecture.md#api-contract).

## Frontend Deployment

The frontend can be deployed to any static hosting provider.

### Build

```bash
npm run build         # Standard build
npm run build:static  # Relative paths
```

### Configure Backend URL

For production with a different origin:

```env
# .env.production
VITE_API_URL=https://your-backend-api.com
```

### Deploy Options

**Azure Blob Storage:**
```bash
export AZURE_STORAGE_ACCOUNT=your-storage-account
npm run deploy:azure
```

**Vercel/Netlify:**
1. Connect repo
2. Set `VITE_API_URL` environment variable
3. Build command: `npm run build`
4. Output: `dist/`

**Any static host:**
Upload `dist/` folder contents

## Backend Deployment

You are responsible for deploying a backend that implements the [API contract](/1-getting-started/architecture.md#api-contract).

### API Contract

```
POST /api/responses
  Request:  { input, conversationId?, stream? }
  Response: { conversationId, isNew, response: { output: [...] } }
```

See [architecture.md#api-contract](/1-getting-started/architecture.md#api-contract) for full spec.

### CORS Requirements

Your backend must allow requests from your frontend's origin:

```javascript
Access-Control-Allow-Origin: https://your-frontend-url.com
```

### Reference Server

We provide a reference Express server with Azure AI Foundry integration.

**Documentation:**
- [Server Setup](../server/README.md)
- [Azure Deployment Guide](../server/DEPLOYMENT.md)

**This is optional** - you can implement your own backend.

## Local Development

```bash
npm run dev          # Frontend only (mock mode)
```

For reference server, see [server/README.md](../server/README.md).

---
*Last updated: 2026-02-10*
