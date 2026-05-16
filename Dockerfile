# ---------------------------------------------------
# Estágio 1: Builder (Prepara as dependências)
# ---------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev --registry=https://registry.npmjs.org

# ---------------------------------------------------
# Estágio 2: Imagem Final (Enxuta e segura)
# ---------------------------------------------------
FROM node:20-alpine

ENV NODE_ENV=production

# Remove o npm — não é necessário em produção e carrega dependências vulneráveis.
# O app é iniciado diretamente pelo Node.js.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

USER node

WORKDIR /app

COPY --chown=node:node package*.json ./

COPY --chown=node:node --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

RUN chmod -R a-w /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "index.js"]
