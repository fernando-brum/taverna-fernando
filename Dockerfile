# ---------------------------------------------------
# Estágio 1: Builder (Prepara as dependências)
# ---------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

# ---------------------------------------------------
# Estágio 2: Imagem Final (Enxuta e segura)
# ---------------------------------------------------
FROM node:18-alpine

ENV NODE_ENV=production

USER node

WORKDIR /app

COPY --chown=node:node package*.json ./

COPY --chown=node:node --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

RUN chmod -R a-w /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "start"]
