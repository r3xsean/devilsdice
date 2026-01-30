# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy client package
COPY apps/client ./apps/client

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first
RUN pnpm --filter @devilsdice/shared build

# Build client (pass build args as env vars)
ARG VITE_WS_URL
ARG VITE_BASE_PATH=/
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN pnpm --filter @devilsdice/client build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
