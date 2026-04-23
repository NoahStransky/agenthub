.PHONY: build run proto test

build:
	go build -o bin/dp-server ./cmd/dp-server

run:
	go run ./cmd/dp-server

proto:
	protoc --go_out=. --go-grpc_out=. api/proto/dataplane.proto

test:
	go test -v ./...

docker-build:
	docker build -t agenthub/data-plane:latest -f deployments/Dockerfile .
