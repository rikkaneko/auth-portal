FROM node:alpine AS base
ENV PORT 8088
EXPOSE ${PORT}
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . /app
RUN --mount=type=cache,id=auth-portal-pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build:production

FROM base as production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist/ ./dist
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/.env /app/server.pem /app/server.pub ./

USER nextjs
CMD pnpm run start:production
