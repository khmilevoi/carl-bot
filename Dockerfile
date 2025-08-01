# syntax=docker/dockerfile:1

# --------------------------------------------------------
# Build‑once, run‑anywhere Dockerfile for Fly.io / Node.js
# --------------------------------------------------------
# 1)  Builds TypeScript/SWC → plain JS during image build
# 2)  Prunes dev‑dependencies ➜ tiny production image
# 3)  Runs pre‑compiled JS, so @swc‑node/register не нужен
# --------------------------------------------------------

ARG NODE_VERSION=20.18.0

########################  Base image  ########################
FROM node:${NODE_VERSION}-slim AS base
LABEL fly_launch_runtime="Node.js"
WORKDIR /app
ENV NODE_ENV=production

########################  Build stage  #######################
FROM base AS build

# --- tooling required to compile native deps & build sources
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# --- install *all* deps (dev+prod) so that TS/SWC can compile
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# --- copy sources & transpile to dist/
COPY . .
RUN npm run build   # предполагает, что output = ./dist

# --- drop dev‑deps to shrink final layer
RUN npm prune --omit=dev

#######################  Runtime stage  ######################
FROM base AS runtime

# --- copy only pruned node_modules + built app
COPY --from=build /app /app

# --- sqlite volume
RUN mkdir -p /data
VOLUME /data
ENV DATABASE_URL="file:///data/memory.db"

# --- app listens here
EXPOSE 3000

# --- launch: миграция + сервер (оба уже JS)
CMD ["sh", "-c", "node dist/migrate.js up && node dist/index.js"]
