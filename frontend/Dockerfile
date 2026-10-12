FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Empty base URL: the browser calls /api/ on the same origin and nginx proxies it.
ARG VITE_API_BASE_URL=""
ARG VITE_CURRENCY=USD
ARG VITE_LOCALE=en-US
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_CURRENCY=$VITE_CURRENCY VITE_LOCALE=$VITE_LOCALE
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Files copied from filesystems without Unix permissions may be owner-only; nginx must read them.
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
