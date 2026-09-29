FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc* ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json .npmrc* ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/postcss.config.mjs ./
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
