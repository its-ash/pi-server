FROM rust:1.87-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev

COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/pi_server_backend /usr/local/bin/pi_server_backend

ENV RUST_LOG=info
ENV UPLOAD_DIR=/app/files
ENV FTP_DIR=/app/ftp

RUN mkdir -p /app/files /app/ftp
EXPOSE 8080
CMD ["pi_server_backend"]
