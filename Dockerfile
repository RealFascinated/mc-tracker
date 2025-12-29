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

# Copy the compiled binary
COPY --from=depends /app/tracker ./

CMD ["./tracker"]