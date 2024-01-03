FROM fascinated/docker-images:node-pnpm-latest AS base

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]
COPY . .

RUN pnpm install --production --silent

RUN pnpm run build

CMD pnpm run start
