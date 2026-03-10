# Server Dockerfile — runs TypeScript directly with tsx
FROM mcr.microsoft.com/azurelinux/base/nodejs:20

WORKDIR /app

# Copy package files and install all deps (tsx is needed at runtime)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:3001/health || exit 1

# Run TypeScript directly with tsx
CMD ["npx", "tsx", "index.ts"]
