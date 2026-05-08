FROM alpine:3.19

ARG PB_VERSION=0.22.20
RUN apk add --no-cache wget unzip ca-certificates && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip

WORKDIR /pb
EXPOSE 8090
VOLUME /pb/pb_data

COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

CMD ["/pb/entrypoint.sh"]
