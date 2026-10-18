# Image unique du jeu : le backend NestJS sert l'API /graphql, les images du
# monde (/icones) et le client Angular compilé, sur un seul port.

# --- client Angular ---
FROM node:24-alpine AS front
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build

# --- serveur NestJS ---
FROM node:24-alpine AS back
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# --- image finale ---
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    WORLDS_DIR=/data/userworlds
WORKDIR /app/backend
COPY --from=back /app/backend/package.json ./
COPY --from=back /app/backend/node_modules ./node_modules
COPY --from=back /app/backend/dist ./dist
COPY backend/src/schema.graphql ./src/schema.graphql
COPY backend/public ./public
COPY --from=front /app/frontend/dist/frontend/browser /app/frontend/dist/frontend/browser
# les sauvegardes des joueurs vivent dans un volume, hors de l'image
RUN mkdir -p /data/userworlds && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/main.js"]
