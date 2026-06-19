# Build stage
# Built from the repo root so the npm workspace setup (root package.json +
# lockfile + packages/app) is available. See .dockerignore at the repo root.
FROM node:24-alpine AS builder

WORKDIR /app

# Workspace manifests first so `npm ci` is cached until a dependency changes.
COPY package.json package-lock.json ./
COPY packages/app/package.json packages/app/.npmrc ./packages/app/
RUN npm ci

COPY . .
RUN npm run build -w @dahamm/app

# Production stage
FROM node:24-slim

WORKDIR /app

# Reinstall prod-only deps here so better-sqlite3's native binary is built for
# this (glibc/Debian) image rather than copied from the Alpine builder.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/packages/app/package.json ./packages/app/package.json
COPY --from=builder /app/packages/app/.npmrc ./packages/app/.npmrc
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/packages/app/build ./packages/app/build
COPY --from=builder /app/packages/app/drizzle ./packages/app/drizzle

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run from the app workspace so the startup migration (drizzle-orm migrator with
# the relative `./drizzle` folder) and DB_PATH default resolve correctly. The
# hoisted node_modules at /app are still found via normal upward resolution.
WORKDIR /app/packages/app

# @sveltejs/adapter-node reads the public origin from $ORIGIN. We expose it
# externally as $BASE_URL (single source for origin/CSRF and magic-link URLs)
# and map it back to $ORIGIN here.
ENTRYPOINT ["/bin/sh", "-c", "if [ -n \"$BASE_URL\" ]; then export ORIGIN=\"$BASE_URL\"; fi; exec \"$@\"", "--"]
CMD ["node", "build/index.js"]
