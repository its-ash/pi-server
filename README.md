# PI Server

Rust + Axum backend, React frontend, and Nginx reverse proxy.

## Features

- Streaming multipart upload (`/api/upload`)
- Save uploads to `files/`
- FTP explorer for nested folders in `ftp/`
- Download files (`/api/download?path=...`)
- Stream media inline (`/api/media?path=...`)
- API index endpoint (`/api/apis`)
- System stats endpoint (`/api/system`)

## Project Structure

- `backend/` Rust API server
- `frontend/` React UI
- `nginx/` reverse proxy config
- `files/` uploaded files
- `ftp/` browsable explorer files

## Run With Docker

```bash
docker compose up --build
```

Then open:

- App: `http://localhost/`
- API via Nginx: `http://localhost/api/...`

## Local Development

### Backend

```bash
cd backend
cargo run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

- `POST /api/upload`
  - `multipart/form-data`
  - fields:
    - `file` (required)
    - `filename` (optional)
- `GET /api/files?path=<relative-folder>`
- `GET /api/download?path=<relative-file>`
- `GET /api/media?path=<relative-file>`
- `GET /api/apis`
- `GET /api/system`

## Notes

- Default upload directory is project root `files/`.
- Default explorer directory is project root `ftp/`.
- Nginx routes:
  - `/api` -> Rust backend
  - `/` -> React app
