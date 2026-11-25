FROM nginx:1.29-alpine

RUN apk add --no-cache gettext-envsubst \
  && mkdir -p \
  /opt/rebroid-edge \
  /tmp/nginx/client \
  /tmp/nginx/fastcgi \
  /tmp/nginx/proxy \
  /tmp/nginx/scgi \
  /tmp/nginx/uwsgi \
  && chown -R 1000:1000 /opt/rebroid-edge /tmp/nginx

COPY nginx.conf.template /opt/rebroid-edge/nginx.conf.template
COPY external-display.conf /opt/rebroid-edge/external-display.conf
COPY --chmod=755 docker-entrypoint.sh /opt/rebroid-edge/docker-entrypoint.sh

USER 1000:1000

EXPOSE 3443

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget --no-check-certificate --header='Host: rebroid-web' -qO- https://127.0.0.1:3443/edge-health >/dev/null || exit 1

ENTRYPOINT ["/opt/rebroid-edge/docker-entrypoint.sh"]
