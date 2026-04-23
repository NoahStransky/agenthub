package runtime

import (
	"context"
	"errors"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// ---- Mock Docker Client ----

type mockDockerClient struct {
	createFunc  func(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *v1.Platform, containerName string) (container.CreateResponse, error)
	startFunc   func(ctx context.Context, containerID string, options container.StartOptions) error
	inspectFunc func(ctx context.Context, containerID string) (types.ContainerJSON, error)
}

func (m *mockDockerClient) ContainerCreate(
	ctx context.Context,
	config *container.Config,
	hostConfig *container.HostConfig,
	networkingConfig *network.NetworkingConfig,
	platform *v1.Platform,
	containerName string,
) (container.CreateResponse, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, config, hostConfig, networkingConfig, platform, containerName)
	}
	return container.CreateResponse{}, errors.New("ContainerCreate not mocked")
}

func (m *mockDockerClient) ContainerStart(
	ctx context.Context,
	containerID string,
	options container.StartOptions,
) error {
	if m.startFunc != nil {
		return m.startFunc(ctx, containerID, options)
	}
	return errors.New("ContainerStart not mocked")
}

func (m *mockDockerClient) ContainerInspect(
	ctx context.Context,
	containerID string,
) (types.ContainerJSON, error) {
	if m.inspectFunc != nil {
		return m.inspectFunc(ctx, containerID)
	}
	return types.ContainerJSON{}, errors.New("ContainerInspect not mocked")
}

// ---- Tests ----

func TestCreateInstance(t *testing.T) {
	ctx := context.Background()
	req := &pb.CreateInstanceRequest{
		TenantId: "tenant1",
		Tier:     "standard",
	}

	mock := &mockDockerClient{
		createFunc: func(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *v1.Platform, containerName string) (container.CreateResponse, error) {
			if containerName != "agenthub-tenant1" {
				t.Errorf("expected container name agenthub-tenant1, got %s", containerName)
			}
			if config.Image != "agenthub/hermes-base:latest" {
				t.Errorf("expected image agenthub/hermes-base:latest, got %s", config.Image)
			}
			return container.CreateResponse{ID: "abc123"}, nil
		},
		startFunc: func(ctx context.Context, containerID string, options container.StartOptions) error {
			if containerID != "abc123" {
				t.Errorf("expected containerID abc123, got %s", containerID)
			}
			return nil
		},
	}

	im := &InstanceManager{docker: mock}
	resp, err := im.CreateInstance(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ContainerId != "abc123" {
		t.Errorf("expected container_id abc123, got %s", resp.ContainerId)
	}
}

func TestGetInstanceStatus(t *testing.T) {
	ctx := context.Background()
	req := &pb.InstanceIdentity{ContainerId: "abc123"}

	mock := &mockDockerClient{
		inspectFunc: func(ctx context.Context, containerID string) (types.ContainerJSON, error) {
			if containerID != "abc123" {
				t.Errorf("expected containerID abc123, got %s", containerID)
			}
			return types.ContainerJSON{
				ContainerJSONBase: &types.ContainerJSONBase{
					ID:    "abc123",
					State: &types.ContainerState{Status: "running"},
				},
				NetworkSettings: &types.NetworkSettings{
					DefaultNetworkSettings: types.DefaultNetworkSettings{
						IPAddress: "172.17.0.2",
					},
				},
			}, nil
		},
	}

	im := &InstanceManager{docker: mock}
	status, err := im.GetInstanceStatus(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.ContainerId != "abc123" {
		t.Errorf("expected container_id abc123, got %s", status.ContainerId)
	}
	if status.Status != "running" {
		t.Errorf("expected status running, got %s", status.Status)
	}
	if status.Endpoint != "http://172.17.0.2:8080" {
		t.Errorf("expected endpoint http://172.17.0.2:8080, got %s", status.Endpoint)
	}
}
