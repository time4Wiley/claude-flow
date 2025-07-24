# Multi-stage build for production
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --only=production
RUN cd server && npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine

# Install production dependencies
RUN apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/server ./server
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/ecosystem.config.js ./

# Create necessary directories
RUN mkdir -p logs memory .swarm && \
    chown -R nodejs:nodejs logs memory .swarm

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start with PM2
CMD ["npx", "pm2-runtime", "start", "ecosystem.config.js"]