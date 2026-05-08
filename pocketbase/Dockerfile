FROM alpine:3.19

ARG PB_VERSION=0.22.20
ARG TARGETARCH
ARG TARGETVARIANT

RUN apk add --no-cache wget unzip ca-certificates && \
    if [ "$TARGETARCH" = "arm" ] && [ "$TARGETVARIANT" = "v7" ]; then \
        PB_ARCH="armv7"; \
    else \
        PB_ARCH="$TARGETARCH"; \
    fi && \
    wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip

WORKDIR /pb
EXPOSE 8090
VOLUME /pb/pb_data

COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

CMD ["/pb/entrypoint.sh"]
