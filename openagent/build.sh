#!/bin/bash
#try to connect to google to determine whether user need to use proxy
curl www.google.com -o /dev/null --connect-timeout 5 2> /dev/null
if [ $? == 0 ]
then
    echo "Successfully connected to Google, no need to use Go proxy"
else
    echo "Google is blocked, Go proxy is enabled: GOPROXY=https://goproxy.cn,direct"
    export GOPROXY="https://goproxy.cn,direct"
fi

VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"
COMMIT="${COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
BUILD_DATE="${BUILD_DATE:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
LDFLAGS="-w -s -X github.com/the-open-agent/openagent/internal/cli.Version=${VERSION} -X github.com/the-open-agent/openagent/internal/cli.Commit=${COMMIT} -X github.com/the-open-agent/openagent/internal/cli.BuildDate=${BUILD_DATE}"

CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o server_linux_amd64 .
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="${LDFLAGS}" -o server_linux_arm64 .
CGO_ENABLED=0 GOOS=linux GOARCH=riscv64 go build -ldflags="${LDFLAGS}" -o server_linux_riscv64 .
