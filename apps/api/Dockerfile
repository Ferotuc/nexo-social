FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w apps/api
WORKDIR /app/apps/api
USER node
EXPOSE 4100
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]
