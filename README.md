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

- **Provide a compiled binary**: copy a pre-built Linux binary to `bazi-go/bazi-go` (or point `BAZI_GO_BINARY` to its location). No Go toolchain is required at runtime.
- **Install Go in the container**: ensure the `go` command is available so the server can run `go run main.go`. On Render you can use a custom start/build script that installs Go before starting Node.

If neither a binary nor the Go toolchain is available, the server logs a warning and every `/bazi` request returns HTTP `503` (`bazi_service_unavailable`). In that case either install Go, supply a binary, or set `BAZI_SERVICE_URL` to point at an external BaZi deployment.

Example start command when Go is available:

```bash
bash -c "cd bazi-go && go build -o bazi-go && cd .. && node index.js"
```

This compiles the standalone binary once per deployment and lets the Node process execute it directly.

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
