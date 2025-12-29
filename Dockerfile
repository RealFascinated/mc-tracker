FROM oven/bun:1.3.5-alpine AS base

# Install dependencies and build
FROM base AS depends
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

# Run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy the data directory
COPY --from=depends /app/data ./data

# Copy the compiled binary
COPY --from=depends /app/tracker ./

ARG PORT=8080
ENV PORT=$PORT
EXPOSE $PORT

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

CMD ["./tracker"]