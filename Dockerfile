FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY frontend ./frontend
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    TRUST_PROXY=1 \
    DB_CLIENT=mysql \
    COOKIE_SECURE=true \
    UPLOAD_DIR=/data/uploads \
    PRIVATE_UPLOAD_DIR=/data/uploads/.privado
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY scripts ./scripts
COPY database ./database
RUN mkdir -p /data/uploads/.privado
EXPOSE 3001
CMD ["node", "backend/src/server.mjs"]
