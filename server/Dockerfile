# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data && chown -R nestjs:nestjs /app/data /app/node_modules/.prisma

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
