FROM fascinated/docker-images:node-pnpm-latest AS base

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]

RUN pnpm install --production --silent

COPY . .

CMD pnpm run build && pnpm run start
