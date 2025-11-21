# Ziwei & BaZi Services

This repository hosts two small services that can share the same deployment target:

- `index.js`: Node/Express API that exposes `/ziwei` and proxies `/bazi`.
- `bazi-go/`: Go HTTP server that calculates BaZi pillars using `chinese-calendar-golang`.

## Running locally

1. Start the BaZi Go service (needs `TZ=PRC`):

   ```bash
   cd bazi-go
   go run main.go
   ```

2. In another terminal, start the Node service:

   ```bash
   npm install
   npm start
   ```

   The Node app listens on port `3000` and forwards `/bazi` calls to `http://localhost:8081/bazi` by default. Override the target with `BAZI_SERVICE_URL`.

## Deploying on a single Render service

Use a start command that launches both processes inside one container, for example:

```bash
bash -c "cd bazi-go && go run main.go & node index.js"
```

The `/ziwei` route will be served directly by Node, and `/bazi` will be reverse-proxied to the Go service running on the same host.
