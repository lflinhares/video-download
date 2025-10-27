FROM node:22-bookworm

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg

RUN pip install --upgrade yt-dlp --break-system-packages

RUN npm install -g @nestjs/cli

RUN npm install

COPY . .

CMD ["npm", "run", "start:dev"]