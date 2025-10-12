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
# O build atual gera arquivos em dist/src (preserva a estrutura src), então
# apontamos o entrypoint para o main gerado dentro de dist/src.
CMD ["node", "dist/src/main.js"]
