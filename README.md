# Ziwei & BaZi Services

This repository hosts two small services that can share the same deployment target:

- `index.js`: Node/Express API that exposes `/ziwei` and proxies `/bazi`.
- `bazi-go/`: Go HTTP server that calculates BaZi pillars using `chinese-calendar-golang`.

## Running locally

1. Build or run the BaZi service inside `bazi-go/`:

   ```bash
   cd bazi-go
   go run main.go            # or: GOOS=linux GOARCH=amd64 go build -o bazi-go
   ```

2. Start the Node service in another terminal:

   ```bash
   npm install
   npm start
   ```

   The Node app listens on port `3000` and forwards `/bazi` calls to `http://localhost:8081/bazi` by default. Override the target with `BAZI_SERVICE_URL`.

## Deploying as a single service

The Node server can spawn the Go binary automatically so that a single container exposes both `/ziwei` and `/bazi`. Pick one of the following:

- **Use the bundled binary**: this repo ships with a Linux AMD64 build at `bazi-go/bazi-go`, so Render (or any Linux deployment) can run without the Go toolchain.
- **Install Go in the container**: ensure the `go` command is available so the server can recompile when needed (`go run main.go`).

If neither a binary nor the Go toolchain is available, the server logs a warning and every `/bazi` request returns HTTP `503` (`bazi_service_unavailable`). In that case either install Go, supply a binary, or set `BAZI_SERVICE_URL` to point at an external BaZi deployment.

Example start command when Go is available:

```bash
bash -c "cd bazi-go && go build -o bazi-go && cd .. && node index.js"
```

The bundled binary was built with `GOOS=linux GOARCH=amd64`. If you make changes to `bazi-go/main.go`, rebuild it with the same command so the checked-in binary stays in sync:

```bash
cd bazi-go
GOOS=linux GOARCH=amd64 go build -o bazi-go
```

This compiles the standalone binary once per deployment and lets the Node process execute it directly. Delete or replace the binary if you prefer to rely on the Go toolchain instead.

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Node HTTP port | `3000` |
| `BAZI_GO_PORT` | Port for the embedded Go service | `8081` |
| `BAZI_SERVICE_URL` | Override URL for `/bazi` proxy. Set this when running BaZi as a separate deployment. | `http://127.0.0.1:${BAZI_GO_PORT}` |
| `EMBED_BAZI` | Set to `false` to skip launching the embedded Go process. | `true` |
| `BAZI_GO_BINARY` | Path to a compiled BaZi binary. Used when present even if Go source exists. | `./bazi-go/bazi-go` |
| `BAZI_GO_CMD` | Custom command to launch BaZi (advanced). | unset |

When `BAZI_SERVICE_URL` is provided, the server skips the embedded availability check so that `/bazi` will always proxy to your external service.
