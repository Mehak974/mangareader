FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc* ./
COPY prisma ./prisma
# Prisma query engine binary target for Alpine (musl).
# Cache mount speeds up npm installs across builds by reusing downloaded tarballs.
RUN --mount=type=cache,target=/root/.npm npm ci && npx prisma generate --schema=prisma/schema.prisma
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# Standalone output: Next.js bundles only the runtime dependencies needed
# to serve the app into .next/standalone (including compiled Prisma engine).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
