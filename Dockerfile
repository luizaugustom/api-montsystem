FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
# Migrations + boot. App Platform health check: GET /api/health
CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js && node dist/src/main.js"]
