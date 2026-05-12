FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci \
    --no-audit \
    --prefer-offline \
    --fetch-retries=6 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=300000

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
