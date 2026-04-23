package runtime

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// MockDockerClient mocks the Docker client interface used by InstanceManager.
type MockDockerClient struct {
	mock.Mock
}

func (m *MockDockerClient) ContainerCreate(
	ctx context.Context,
	config *container.Config,
	hostConfig *container.HostConfig,
	networkingConfig *network.NetworkingConfig,
	platform *v1.Platform,
	containerName string,
) (container.CreateResponse, error) {
	args := m.Called(ctx, config, hostConfig, networkingConfig, platform, containerName)
	return args.Get(0).(container.CreateResponse), args.Error(1)
}

func (m *MockDockerClient) ContainerStart(
	ctx context.Context,
	containerID string,
	options container.StartOptions,
) error {
	args := m.Called(ctx, containerID, options)
	return args.Error(0)
}

func (m *MockDockerClient) ContainerInspect(
	ctx context.Context,
	containerID string,
) (types.ContainerJSON, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(types.ContainerJSON), args.Error(1)
}

func TestCreateInstance(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.CreateInstanceRequest{
		TenantId: "tenant1",
		Tier:     "standard",
	}

	createResp := container.CreateResponse{ID: "abc123", Warnings: nil}
	mockClient.On("ContainerCreate",
		ctx,
		mock.AnythingOfType("*container.Config"),
		mock.AnythingOfType("*container.HostConfig"),
		mock.Anything,
		mock.Anything,
		"agenthub-tenant1",
	).Return(createResp, nil)

	mockClient.On("ContainerStart",
		ctx,
		"abc123",
		mock.AnythingOfType("container.StartOptions"),
	).Return(nil)

	resp, err := im.CreateInstance(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "abc123", resp.ContainerId)
	mockClient.AssertExpectations(t)
}

func TestGetInstanceStatus(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.InstanceIdentity{ContainerId: "abc123"}

	inspect := types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:    "abc123",
			State: &types.ContainerState{Status: "running"},
		},
		NetworkSettings: &types.NetworkSettings{
			DefaultNetworkSettings: types.DefaultNetworkSettings{
				IPAddress: "172.17.0.2",
			},
		},
	}
	mockClient.On("ContainerInspect", ctx, "abc123").Return(inspect, nil)

	status, err := im.GetInstanceStatus(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "abc123", status.ContainerId)
	assert.Equal(t, "running", status.Status)
	assert.Equal(t, "http://172.17.0.2:8080", status.Endpoint)
	mockClient.AssertExpectations(t)
}
