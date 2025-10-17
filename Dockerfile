# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN npm run build --workspace=client

FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=5174
ENV SERVE_CLIENT=true
COPY --from=build /app/server/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/server/src ./src
COPY --from=build /app/client/dist ../client/dist
EXPOSE 5174
CMD ["node", "src/index.js"]
