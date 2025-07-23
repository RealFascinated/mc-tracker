FROM oven/bun:1.2.19-alpine AS base

# Install dependencies
FROM base AS depends
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --filter '@mc-tracker/common' --filter 'tracker' --filter './'

# Run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV APP_ENV=tracker

# Copy the data directory
COPY --from=depends /app/data ./data

# Copy the depends
COPY --from=depends /app/package.json* /app/bun.lock* ./
COPY --from=depends /app/node_modules ./node_modules

# Build the common library
COPY --from=depends /app/projects/common ./projects/common
RUN bun i -g typescript
RUN bun --filter '@mc-tracker/common' build

# Copy the tracker project
COPY --from=depends /app/projects/tracker ./projects/tracker

WORKDIR /app/projects/tracker
CMD ["bun", "src/index.ts"]
