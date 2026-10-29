# Deploy

The app is built from `web/`; its Dockerfile lives at the repo root.

## Docker Compose

```sh
docker compose up -d --build   # build and start in the background
docker compose logs -f         # follow logs
docker compose down            # stop (keeps the inventory-data volume)
```

The app is served at http://localhost:4321 (set `PORT=8080` to change the host
port). Documents persist in the `inventory-data` volume; `docker compose down -v`
deletes it.

## Docker

Build and run from the repo root:

```sh
docker build -t inventory-manager-web .
docker run -d -p 4321:4321 -v inventory-data:/app/web/data inventory-manager-web
```

- The app listens on port 4321 and serves both the built static client and the
  file-browsing API (`/api/files`) from the same Node process
  (`@astrojs/node` standalone adapter).
- `.xlsx` documents are read/written under `/app/web/data` inside the
  container. Mount a named volume or bind mount there to persist them across
  container restarts — without it, files are lost when the container is
  removed.
- Override the data directory inside the container with `INVENTORY_DATA_DIR`
  if needed; it defaults to `data` (resolved relative to the working
  directory, i.e. `/app/web/data`).

## Development with Compose

`docker-compose.dev.yml` mounts `web/` into a Node container and runs `astro dev`, so
edits on the host hot-reload without rebuilding the image:

```sh
docker compose -f docker-compose.dev.yml up
docker compose -f docker-compose.dev.yml down      # stop; add -v to reset node_modules
```

Dependencies live in the `dev-node-modules` volume (re-run `up` after changing
`package.json`). Documents are written to `web/data/` on the host.
