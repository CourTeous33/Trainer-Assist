FROM rust:1.88-alpine AS builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY crates/ crates/

RUN cargo build --release -p api -p seed

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/target/release/api /usr/local/bin/api
COPY --from=builder /app/target/release/seed /usr/local/bin/seed

EXPOSE 3001

CMD ["api"]
