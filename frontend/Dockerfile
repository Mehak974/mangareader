FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc* ./
COPY prisma ./prisma
# Prisma query engine binary target for Alpine (musl). Without this, the
# default linux dynamic binary fails to load on musl-based images.
RUN npm ci && npx prisma generate --schema=prisma/schema.prisma
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone Next.js server binds to 0.0.0.0 by default in containers, but
# explicitly setting HOSTNAME avoids a warning and guarantees it listens on
# all interfaces rather than falling back to localhost in some images.
ENV HOSTNAME=0.0.0.0
COPY package*.json .npmrc* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate --schema=prisma/schema.prisma
# Standalone output: Next.js copies only the runtime deps needed to serve
# the app into .next/standalone. Copy that plus the static assets and public
# dir. The CMD is `node server.js` (not `npx next start`) so the container
# starts without a node_modules resolution step.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
