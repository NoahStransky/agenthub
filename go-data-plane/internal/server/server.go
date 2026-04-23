package server

import (
	"context"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/NoahStransky/agenthub/data-plane/internal/config"
	"github.com/NoahStransky/agenthub/data-plane/internal/runtime"
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/grpc"
)

func Run(cfg *config.Config) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// gRPC server
	grpcLis, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		return err
	}
	grpcSrv := grpc.NewServer()
	instManager := runtime.NewInstanceManager(cfg.DockerHost)
	pb.RegisterInstanceManagerServer(grpcSrv, instManager)

	// HTTP server (health + metrics)
	r := gin.Default()
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	httpSrv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}

	// Run both
	go func() { _ = grpcSrv.Serve(grpcLis) }()
	go func() { _ = httpSrv.ListenAndServe() }()

	<-ctx.Done()
	grpcSrv.GracefulStop()
	return httpSrv.Shutdown(context.Background())
}
