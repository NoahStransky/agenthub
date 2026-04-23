package main

import (
	"log"

	"github.com/NoahStransky/agenthub/data-plane/internal/config"
	"github.com/NoahStransky/agenthub/data-plane/internal/server"
)

func main() {
	cfg := config.Load()
	log.Printf("Data Plane starting on gRPC:%s HTTP:%s", cfg.GRPCAddr, cfg.HTTPAddr)
	if err := server.Run(cfg); err != nil {
		log.Fatal(err)
	}
}
