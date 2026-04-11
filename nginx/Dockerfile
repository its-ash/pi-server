FROM node:22-alpine AS frontend_builder
WORKDIR /app/frontend

COPY frontend/package.json ./
COPY frontend/vite.config.js ./
COPY frontend/index.html ./
COPY frontend/src ./src
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend_builder /app/frontend/dist /usr/share/nginx/html
