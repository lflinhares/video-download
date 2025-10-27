# Usamos uma imagem Node.js padrão, baseada em Debian, para máxima compatibilidade.
FROM node:22.18.0

# Definimos o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# Copiamos os arquivos de dependência primeiro para aproveitar o cache do Docker.
COPY package*.json ./

# 1. Usamos o apt-get para instalar as dependências de sistema.
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg

# --- INÍCIO DA MUDANÇA ---

# 2. Usamos o pip para instalar a versão mais recente do yt-dlp do PyPI.
#    Adicionamos --break-system-packages para contornar a proteção PEP 668.
RUN pip install --upgrade yt-dlp --break-system-packages

RUN npm install -g @nestjs/cli
# Instalamos as dependências do nosso projeto Node.js.
RUN npm install

# Copiamos o resto do código da nossa aplicação para o contêiner.
COPY . .

# Comando padrão para rodar a aplicação em modo de desenvolvimento.
CMD ["npm", "run", "start:dev"]