# Сборка SPA (Vite). VITE_API_URL пустой → в бандле запросы идут на /api относительно
# текущего хоста, nginx ниже проксирует их на бэкенд (см. docker-compose).
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Пустая строка = относительные URL /api… (удобно с reverse-proxy в nginx).
# Если задать полный URL (например https://api.example.com), браузер ходит на API напрямую (нужен CORS на бэке).
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Раздача статики + прокси API (подстановка BACKEND_HTTP_HOST делает официальный entrypoint nginx-образа).
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_HTTP_HOST=host.docker.internal:8080

EXPOSE 80
