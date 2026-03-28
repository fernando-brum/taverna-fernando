# Usa a versão Alpine (muito mais leve)
FROM node:18-alpine

# Define o ambiente como produção (otimiza a performance do Node e ignora pacotes dev)
ENV NODE_ENV=production

WORKDIR /app

# Copia os arquivos de dependência primeiro para aproveitar o cache de camadas do Docker
COPY package*.json ./

# Usa 'npm install' já que o package-lock.json não está presente
# --omit=dev garante que dependências de desenvolvimento não sejam instaladas
# Limpa o cache do npm na mesma camada para economizar espaço
RUN npm install --omit=dev && npm cache clean --force

# Copia o restante do código para o container
COPY . .

# Por segurança, roda o container usando um usuário sem privilégios de root
USER node

EXPOSE 3000

# Executar o Node diretamente consome menos memória do que usar o 'npm start'
# Substitua 'index.js' pelo arquivo principal da sua aplicação (ex: server.js, app.js)
CMD ["node", "index.js"]
