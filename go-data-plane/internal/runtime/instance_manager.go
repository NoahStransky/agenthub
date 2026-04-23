package runtime

import (
	"context"
	"fmt"

	"github.com/docker/docker/client"
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/protobuf/types/known/emptypb"
)

type InstanceManager struct {
	pb.UnimplementedInstanceManagerServer
	docker *client.Client
}

func NewInstanceManager(dockerHost string) *InstanceManager {
	cli, err := client.NewClientWithOpts(client.WithHost(dockerHost), client.WithAPIVersionNegotiation())
	if err != nil {
		panic(err)
	}
	return &InstanceManager{docker: cli}
}

func (m *InstanceManager) CreateInstance(ctx context.Context, req *pb.CreateInstanceRequest) (*pb.CreateInstanceResponse, error) {
	// TODO: Phase 1 — 实现 Docker 容器创建
	return nil, fmt.Errorf("not implemented")
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
	return nil, fmt.Errorf("not implemented")
}

func (m *InstanceManager) StreamLogs(req *pb.InstanceIdentity, stream pb.InstanceManager_StreamLogsServer) error {
	return fmt.Errorf("not implemented")
}

func (m *InstanceManager) SubscribeEvents(_ *emptypb.Empty, stream pb.InstanceManager_SubscribeEventsServer) error {
	return fmt.Errorf("not implemented")
}
