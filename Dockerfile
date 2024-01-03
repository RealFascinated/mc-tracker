FROM fascinated/docker-images:node-pnpm-latest AS base

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]

RUN pnpm install --production --silent && mv node_modules ../

COPY . .

#RUN chown -R node /usr/src/app
#USER node

RUN pnpm run build

CMD pnpm run start
