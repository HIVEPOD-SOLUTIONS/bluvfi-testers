# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build
# Installs full deps including devDependencies (typescript, ts-node, prisma
# CLI needed here), generates Prisma client, compiles TypeScript to dist/.
# ---------------------------------------------------------------------------
    FROM node:20-alpine AS builder
    WORKDIR /app
    ENV CI=true
    
    # Prisma query engine needs libssl to start on alpine
    RUN apk add --no-cache openssl
    
    COPY package.json package-lock.json ./
    RUN npm ci
    
    COPY prisma ./prisma
    RUN npx prisma generate
    
    # Build uses src/tsconfig.json per your package.json build script
    COPY src/tsconfig.json ./src/tsconfig.json
    COPY src ./src
    RUN npm run build
    
    # ---------------------------------------------------------------------------
    # Stage 2 — production runtime
    # Prod-only deps + prisma CLI so `prisma migrate deploy` can run from this
    # image in the GitHub Actions deploy job without bloating the image with
    # typescript/ts-node/nodemon.
    # ---------------------------------------------------------------------------
    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3001
    
    # Query engine needs libssl at runtime too
    RUN apk add --no-cache openssl
    
    COPY package.json package-lock.json ./
    COPY prisma ./prisma
    
    # Keep prisma version in sync with "prisma" in package.json (^5.22.0)
    RUN npm ci --omit=dev \
     && npm install --no-save prisma@5.22.0 \
     && npx prisma generate
    
    COPY --from=builder /app/dist ./dist
    
    EXPOSE 3001
    
    # Health check — wget exits non-zero on non-2xx so Docker health state
    # accurately reflects whether the service is actually functional
    HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
      CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1
    
    CMD ["node", "dist/index.js"]