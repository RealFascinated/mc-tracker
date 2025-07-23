FROM oven/bun:1.2.19-alpine AS base

# Install dependencies
FROM base AS depends
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --filter '@mc-tracker/common' --filter 'tracker' --filter './'

# Run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV APP_ENV tracker

# Copy the depends
COPY --from=depends /app/package.json* /app/bun.lock* ./
COPY --from=depends /app/node_modules ./node_modules

# Build the common library
COPY --from=depends /app/projects/common ./projects/common
RUN bun i -g typescript
RUN bun --filter '@mc-tracker/common' build

# Copy the tracker project
COPY --from=depends /app/projects/tracker ./projects/tracker

# Build the tracker
RUN bun run --filter 'tracker' build

ARG PORT=8080
ENV PORT $PORT
EXPOSE $PORT

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

WORKDIR /app/projects/tracker
CMD ["bun", "src/index.ts"]
