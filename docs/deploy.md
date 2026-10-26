# Deploy

The app is built from `web/` but its Dockerfile lives at the repo root, because
`web/src/lib/excel-export.ts` imports the vendored `lib/xlsx.full.min.js` from
outside the `web/` directory — the build context must include both.

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
