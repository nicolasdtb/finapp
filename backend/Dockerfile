FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install
COPY --from=builder /app/dist ./dist
COPY drizzle.config.ts ./
COPY src/database/schema.ts ./src/database/schema.ts

EXPOSE 3001
CMD ["node", "dist/server.js"]
