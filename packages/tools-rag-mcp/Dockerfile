# Stage 1: Build the entire monorepo
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages
RUN find packages -mindepth 2 -maxdepth 2 -type f -not -name 'package.json' -delete || true
RUN find packages -mindepth 3 -delete || true
RUN pnpm install --frozen-lockfile
COPY . .
# Use 'run build' explicitly with filter to avoid potential issues with root turbo script
RUN pnpm --filter=@sylphlab/tools-rag-mcp... run build

# Stage 2: Create the final production image for the Node.js server ONLY
FROM node:20-alpine

WORKDIR /app

# Copy necessary files from the builder stage
# Copy production node_modules (consider using `pnpm deploy` in builder stage for cleaner copy)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/tools-rag-mcp/package.json ./packages/tools-rag-mcp/package.json
COPY --from=builder /app/packages/tools-rag-mcp/dist ./packages/tools-rag-mcp/dist
# Copy dependencies' dist folders
COPY --from=builder /app/packages/tools-core/dist ./packages/tools-core/dist
COPY --from=builder /app/packages/tools-rag/dist ./packages/tools-rag/dist
COPY --from=builder /app/packages/tools-rag-service/dist ./packages/tools-rag-service/dist
COPY --from=builder /app/packages/tools-adaptor-mcp/dist ./packages/tools-adaptor-mcp/dist
# Add other workspace:* dependencies' dist folders as needed

# Set the entrypoint to run the server
# Assumes ChromaDB and Ollama are running externally and accessible via URLs passed as args
# Default args point to typical local setups, override at runtime
CMD ["node", "./packages/tools-rag-mcp/dist/index.js", "--db-host=http://localhost:8000", "--ollama-base-url=http://localhost:11434"]