FROM node:alpine AS base
ENV PORT 8081
EXPOSE ${PORT}
WORKDIR /app

#COPY package.json ./
#COPY package-lock.json* ./

#COPY ../../**/package.json ../../**/package-lock.json /app/
#COPY ["../../package*.json","/app/package.json"]
#COPY ["../../package-lock.json*","./app/package-lock.json"]
#COPY ./**package.json ./package.json
COPY package*.json /app/

FROM base AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/app/node/cache npm install --cache /app/node/cache
RUN npm build

FROM base as production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/.env ./.env

USER nextjs
CMD npm start
