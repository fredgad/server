FROM node:16

WORKDIR /server

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000 9000

CMD ["node", "index.js"]