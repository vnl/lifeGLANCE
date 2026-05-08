FROM alpine:3.19

ARG PB_VERSION=0.22.20
RUN apk add --no-cache wget unzip ca-certificates && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip

EXPOSE 8090
VOLUME /pb/pb_data

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
