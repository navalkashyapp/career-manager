FROM node:20-alpine

# Install SQLite required by tracker.mjs
RUN apk add --no-cache sqlite

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built code and configuration
COPY dist/ ./dist/
COPY career-ops/ ./career-ops/
COPY data/ ./data/
COPY reports/ ./reports/
COPY .env ./
COPY service-account.json ./

EXPOSE 3000

# Start the built server
CMD ["node", "dist/server.js"]
