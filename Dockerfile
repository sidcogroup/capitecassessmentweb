# syntax=docker/dockerfile:1

# ---- Build stage: type-check and produce static assets ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the bundle at build time: "mock" (in-browser store) or "live"
ARG VITE_DISPUTES_API=live
ENV VITE_DISPUTES_API=$VITE_DISPUTES_API
RUN npm run build

# ---- Runtime stage: nginx serves the SPA and proxies /api ----
FROM nginx:1.27-alpine

# Rendered with envsubst at container start (official nginx image feature)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Back end that /api/* is proxied to (no trailing slash or path)
ENV API_PROXY_TARGET=https://capitecassessment-api.lemonbush-17bdcca3.southafricanorth.azurecontainerapps.io

EXPOSE 80
