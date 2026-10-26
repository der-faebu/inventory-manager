FROM node:22-alpine AS build
WORKDIR /app
COPY lib ./lib
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY web ./web
RUN npm --prefix web run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci --omit=dev
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/web/data && chown -R node:node /app
USER node

VOLUME /app/web/data
EXPOSE 4321

CMD ["node", "./web/dist/server/entry.mjs"]
