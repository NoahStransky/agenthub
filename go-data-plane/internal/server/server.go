package server

import (
	"context"
	"net"
	"net/http"

	"github.com/NoahStransky/agenthub/data-plane/internal/config"
	"github.com/NoahStransky/agenthub/data-plane/internal/runtime"
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"github.com/gin-gonic/gin"
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
	instManager := runtime.NewInstanceManager(cfg.DockerHost, runtime.InstanceManagerOptions{
		DockerNetwork: cfg.RuntimeDockerNetwork,
		HermesImage:   cfg.HermesImage,
	})
	pb.RegisterInstanceManagerServer(grpcSrv, instManager)

	// HTTP server (health + metrics)
	r := gin.Default()
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	registerInstanceRoutes(r, instManager)
	httpSrv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}

	// Run both
	go func() { _ = grpcSrv.Serve(grpcLis) }()
	go func() { _ = httpSrv.ListenAndServe() }()

	<-ctx.Done()
	grpcSrv.GracefulStop()
	return httpSrv.Shutdown(context.Background())
}

type createInstanceRequest struct {
	InstanceID    string `json:"instanceId"`
	TenantID      string `json:"tenantId"`
	Tier          string `json:"tier"`
	RuntimeClass  string `json:"runtimeClass"`
	ContainerName string `json:"containerName"`
	Workspace     struct {
		Provider  string `json:"provider"`
		Endpoint  string `json:"endpoint"`
		Bucket    string `json:"bucket"`
		Region    string `json:"region"`
		Prefix    string `json:"prefix"`
		MountPath string `json:"mountPath"`
		AccessKey string `json:"accessKey"`
		SecretKey string `json:"secretKey"`
	} `json:"workspace"`
	Gateway struct {
		PublicBaseUrl   string `json:"publicBaseUrl"`
		ProxyPath       string `json:"proxyPath"`
		WebhookBasePath string `json:"webhookBasePath"`
	} `json:"gateway"`
}

func registerInstanceRoutes(r *gin.Engine, manager *runtime.InstanceManager) {
	r.POST("/instances", func(c *gin.Context) {
		var req createInstanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.TenantID == "" || req.InstanceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tenantId and instanceId are required"})
			return
		}

		resp, err := manager.CreateInstance(c.Request.Context(), &pb.CreateInstanceRequest{
			InstanceId:    req.InstanceID,
			TenantId:      req.TenantID,
			Tier:          req.Tier,
			RuntimeClass:  req.RuntimeClass,
			ContainerName: req.ContainerName,
			Workspace: &pb.WorkspaceSpec{
				Provider:  req.Workspace.Provider,
				Endpoint:  req.Workspace.Endpoint,
				Bucket:    req.Workspace.Bucket,
				Region:    req.Workspace.Region,
				Prefix:    req.Workspace.Prefix,
				MountPath: req.Workspace.MountPath,
				AccessKey: req.Workspace.AccessKey,
				SecretKey: req.Workspace.SecretKey,
			},
			Gateway: &pb.GatewaySpec{
				PublicBaseUrl:   req.Gateway.PublicBaseUrl,
				ProxyPath:       req.Gateway.ProxyPath,
				WebhookBasePath: req.Gateway.WebhookBasePath,
			},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		status, err := manager.GetInstanceStatus(c.Request.Context(), &pb.InstanceIdentity{ContainerId: resp.ContainerId})
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"containerId": resp.ContainerId, "endpoint": resp.Endpoint, "status": "unknown", "health": "unknown", "failureReason": err.Error()})
			return
		}
		writeInstanceStatus(c, http.StatusOK, status)
	})

	r.GET("/instances/:containerId/status", func(c *gin.Context) {
		status, err := manager.GetInstanceStatus(c.Request.Context(), &pb.InstanceIdentity{ContainerId: c.Param("containerId")})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		writeInstanceStatus(c, http.StatusOK, status)
	})

	r.POST("/instances/:containerId/start", func(c *gin.Context) {
		status, err := manager.StartInstance(c.Request.Context(), &pb.InstanceIdentity{ContainerId: c.Param("containerId")})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		writeInstanceStatus(c, http.StatusOK, status)
	})

	r.POST("/instances/:containerId/stop", func(c *gin.Context) {
		status, err := manager.StopInstance(c.Request.Context(), &pb.InstanceIdentity{ContainerId: c.Param("containerId")})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		writeInstanceStatus(c, http.StatusOK, status)
	})

	r.DELETE("/instances/:containerId", func(c *gin.Context) {
		if _, err := manager.DestroyInstance(c.Request.Context(), &pb.InstanceIdentity{ContainerId: c.Param("containerId")}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func writeInstanceStatus(c *gin.Context, statusCode int, status *pb.InstanceStatus) {
	health := status.Health
	if health == "" && status.Status == "running" {
		health = "healthy"
	}
	if health == "" {
		health = "unknown"
	}
	c.JSON(statusCode, gin.H{
		"containerId": status.ContainerId,
		"status":      status.Status,
		"endpoint":    status.Endpoint,
		"health":      health,
		"startedAt":   status.StartedAt,
	})
}
