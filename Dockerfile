# ==========================================
# Stage 1: Build the Application
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install full dependencies without running git lifecycle hooks (husky)
RUN npm ci --ignore-scripts

# Copy application source files
COPY . .

# Build the client SPA & server bundle (dist/server.js + tracker-aliases.json)
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --omit=dev --ignore-scripts

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install SQLite3, curl for healthchecks, and essential system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Install Playwright Chromium browser and its Linux OS dependencies
RUN npx playwright install --with-deps chromium

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Copy supporting assets and runtime modules
COPY career-ops/ ./career-ops/
COPY data/ ./data/
COPY public/ ./public/

# Ensure runtime directories exist for persistence
RUN mkdir -p /app/data /app/reports /app/career-ops/data

# Expose backend port
EXPOSE 3000

# Container healthcheck hitting Express health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]
