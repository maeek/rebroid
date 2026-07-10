# syntax=docker/dockerfile:1.7

FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive
LABEL com.rebroid.gapps-patcher.version="1"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      git \
      jq \
      make \
      openjdk-17-jdk-headless \
      python3 \
      unzip \
      wget \
      xz-utils \
      zip \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 worker \
    && useradd --uid 10001 --gid 10001 --create-home worker \
    && mkdir -p /work /output \
    && chown -R 10001:10001 /work /output

COPY --chmod=755 run.sh /usr/local/bin/build-gapps

USER 10001:10001
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/build-gapps"]
