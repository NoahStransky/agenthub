package runtime

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/protobuf/types/known/emptypb"
)

type InstanceManager struct {
	pb.UnimplementedInstanceManagerServer
	docker DockerClient
}

func NewInstanceManager(dockerHost string) *InstanceManager {
	cli, err := client.NewClientWithOpts(client.WithHost(dockerHost), client.WithAPIVersionNegotiation())
	if err != nil {
		panic(err)
	}
	return &InstanceManager{docker: cli}
}

func (m *InstanceManager) CreateInstance(ctx context.Context, req *pb.CreateInstanceRequest) (*pb.CreateInstanceResponse, error) {
	containerName := fmt.Sprintf("agenthub-%s", req.TenantId)
	image := "agenthub/hermes-base:latest"

	resp, err := m.docker.ContainerCreate(ctx,
		&container.Config{Image: image},
		&container.HostConfig{},
		nil, nil, containerName,
	)
	if err != nil {
		return nil, err
	}

	if err := m.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, err
	}

	return &pb.CreateInstanceResponse{ContainerId: resp.ID}, nil
}

func (m *InstanceManager) StartInstance(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *InstanceManager) StopInstance(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *InstanceManager) DestroyInstance(ctx context.Context, req *pb.InstanceIdentity) (*emptypb.Empty, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *InstanceManager) GetInstanceStatus(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	inspect, err := m.docker.ContainerInspect(ctx, req.ContainerId)
	if err != nil {
		return nil, err
	}

	endpoint := ""
	if inspect.NetworkSettings != nil {
		endpoint = fmt.Sprintf("http://%s:8080", inspect.NetworkSettings.DefaultNetworkSettings.IPAddress)
	}

	status := "unknown"
	if inspect.State != nil {
		status = inspect.State.Status
	}

	return &pb.InstanceStatus{
		ContainerId: req.ContainerId,
		Status:      status,
		Endpoint:    endpoint,
	}, nil
}

func (m *InstanceManager) StreamLogs(req *pb.InstanceIdentity, stream pb.InstanceManager_StreamLogsServer) error {
	return fmt.Errorf("not implemented")
}

func (m *InstanceManager) SubscribeEvents(_ *emptypb.Empty, stream pb.InstanceManager_SubscribeEventsServer) error {
	return fmt.Errorf("not implemented")
}
