# Inventory Manager

A web app for taking an IT inventory at a customer site. Record devices, users,
network components, applications, licenses, locations, rooms and mailboxes, link
them to each other, and export the result to Excel.

Everything for one customer lives in a single `.xlsx` document, so there is no
database to set up.

## Features

- **Eight collections:** devices, users, network, applications, licenses,
  locations, rooms and mailboxes, shown as a tree with a detail pane.
- **Associations:** link entities to each other, for example a device to its
  user, room or license.
- **Switch ports:** model network switches and the devices plugged into each
  port, including ports marked faulty.
- **Customer header:** name, customer number, main contact, inventory date, who
  took the inventory, and version.
- **Excel export:** one `.xlsx` document per customer, built with
  [ExcelJS](https://github.com/exceljs/exceljs).
- **Legacy import:** older save files are migrated to the current format when
  they are opened.
- **Themes:** pick a colour theme from the toolbar (olive by default).

## Tech stack

- [Astro](https://astro.build) 7 with the Node standalone adapter
- [Preact](https://preactjs.com) and Preact Signals for the UI state
- [Tailwind CSS](https://tailwindcss.com) 4
- [ExcelJS](https://github.com/exceljs/exceljs) for reading and writing `.xlsx`
- TypeScript, tested with the built-in `node --test` runner

## Getting started

You need Node.js 22.23.4 or newer.

```sh
cd web
npm install
npm run dev        # http://localhost:4321
```

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload        |
| `npm run build`   | Build the production server into `dist/`    |
| `npm run preview` | Preview the production build                |
| `npm test`        | Run the test suite                          |

## Running with Docker

```sh
docker compose up -d --build
```

The app is then served at <http://localhost:4321>. Set `PORT=8080` to use a
different host port. Documents are stored in the `inventory-data` volume and
survive restarts.

To develop inside a container with hot reload:

```sh
docker compose -f docker-compose.dev.yml up
```

See [docs/deploy.md](docs/deploy.md) for plain `docker run`, data directory
settings and more.

## Where documents are stored

The server reads and writes `.xlsx` documents in a data directory. It defaults
to `web/data/` when you run locally and `/app/web/data` in the container.
Override it with the `INVENTORY_DATA_DIR` environment variable.

## Project layout

```text
.
├── web/                  # the Astro app
│   ├── src/
│   │   ├── components/   # Preact UI: tree, detail pane, modals, toolbar
│   │   ├── lib/          # schema, store, Excel export, file I/O, migration
│   │   ├── pages/        # index page and the /api/files endpoints
│   │   ├── actions/      # file and global-listener actions
│   │   └── state/        # UI and theme signals
│   └── test/             # node:test suites
├── docs/                 # deployment notes and agent/project docs
├── Dockerfile
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Contributing

Issues are tracked on GitHub at
[der-faebu/inventory-manager](https://github.com/der-faebu/inventory-manager/issues).
