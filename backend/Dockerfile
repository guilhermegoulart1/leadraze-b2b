FROM node:22-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Criar .npmrc com token do GitHub
ARG GITHUB_TOKEN
RUN echo "@guilhermegoulart1:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# Instalar dependências
RUN npm install --omit=dev

# Remover .npmrc após instalação (segurança)
RUN rm -f .npmrc

# Copiar código fonte
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
