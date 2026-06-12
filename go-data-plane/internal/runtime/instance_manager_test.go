package runtime

import (
	"context"
	"errors"
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

func (m *MockDockerClient) ContainerStop(
	ctx context.Context,
	containerID string,
	options container.StopOptions,
) error {
	args := m.Called(ctx, containerID, options)
	return args.Error(0)
}

func (m *MockDockerClient) ContainerRemove(
	ctx context.Context,
	containerID string,
	options container.RemoveOptions,
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
	im := &InstanceManager{
		docker:        mockClient,
		dockerNetwork: "agenthub_local",
		hermesImage:   "agenthub/hermes-base:latest",
	}

	ctx := context.Background()
	req := &pb.CreateInstanceRequest{
		InstanceId:    "instance1",
		TenantId:      "tenant1",
		Tier:          "standard",
		RuntimeClass:  "gvisor",
		ContainerName: "agenthub-tenant1-instance1",
		Labels:        map[string]string{"traefik.enable": "true"},
		Workspace: &pb.WorkspaceSpec{
			Provider:  "minio",
			Endpoint:  "http://minio:9000",
			Bucket:    "agenthub-workspaces",
			Region:    "us-east-1",
			Prefix:    "tenants/tenant1/instances/instance1/workspace/",
			MountPath: "/workspace",
			AccessKey: "agenthub",
			SecretKey: "agenthub-secret",
		},
		Gateway: &pb.GatewaySpec{
			PublicBaseUrl:   "http://localhost:5173",
			ProxyPath:       "/api/instances/instance1/proxy/",
			WebhookBasePath: "/api/gateway/hermes/gateway-token/",
		},
		Resources: &pb.ResourceSpec{
			CpuMillicores: 500,
			MemoryBytes:   536870912,
		},
	}

	createResp := container.CreateResponse{ID: "abc123", Warnings: nil}
	mockClient.On("ContainerCreate",
		ctx,
		mock.MatchedBy(func(config *container.Config) bool {
			return config.Image == "agenthub/hermes-base:latest" &&
				config.User == "10001:10001" &&
				config.Labels["agenthub.tenant_id"] == "tenant1" &&
				config.Labels["agenthub.instance_id"] == "instance1" &&
				config.Labels["agenthub.tier"] == "standard" &&
				config.Labels["agenthub.runtime_class"] == "gvisor" &&
				config.Labels["traefik.enable"] == "true" &&
				containsEnv(config.Env, "AGENTHUB_WORKSPACE_PROVIDER=minio") &&
				containsEnv(config.Env, "AGENTHUB_WORKSPACE_BUCKET=agenthub-workspaces") &&
				containsEnv(config.Env, "AGENTHUB_WORKSPACE_PREFIX=tenants/tenant1/instances/instance1/workspace/") &&
				containsEnv(config.Env, "AGENTHUB_WORKSPACE_MOUNT=/workspace") &&
				containsEnv(config.Env, "AWS_ACCESS_KEY_ID=agenthub") &&
				containsEnv(config.Env, "AWS_SECRET_ACCESS_KEY=agenthub-secret") &&
				containsEnv(config.Env, "AGENTHUB_HERMES_PROXY_URL=http://localhost:5173/api/instances/instance1/proxy/") &&
				containsEnv(config.Env, "AGENTHUB_HERMES_WEBHOOK_BASE_URL=http://localhost:5173/api/gateway/hermes/gateway-token/")
		}),
		mock.MatchedBy(func(hostConfig *container.HostConfig) bool {
			return !hostConfig.Privileged &&
				hostConfig.ReadonlyRootfs &&
				len(hostConfig.CapDrop) == 1 &&
				hostConfig.CapDrop[0] == "ALL" &&
				len(hostConfig.SecurityOpt) == 1 &&
				hostConfig.SecurityOpt[0] == "no-new-privileges:true" &&
				hostConfig.Resources.PidsLimit != nil &&
				*hostConfig.Resources.PidsLimit == 256 &&
				hostConfig.Resources.Memory == 536870912 &&
				hostConfig.Resources.NanoCPUs == 500000000 &&
				hostConfig.Tmpfs["/workspace"] == "rw,nosuid,nodev,size=1g" &&
				hostConfig.Tmpfs["/tmp"] == "rw,nosuid,nodev,size=128m" &&
				hostConfig.NetworkMode == "agenthub_local"
		}),
		mock.MatchedBy(func(networkingConfig *network.NetworkingConfig) bool {
			endpoint := networkingConfig.EndpointsConfig["agenthub_local"]
			return endpoint != nil &&
				len(endpoint.Aliases) == 1 &&
				endpoint.Aliases[0] == "agenthub-tenant1-instance1"
		}),
		mock.Anything,
		"agenthub-tenant1-instance1",
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

func containsEnv(env []string, expected string) bool {
	for _, item := range env {
		if item == expected {
			return true
		}
	}
	return false
}

func TestCreateInstanceCleansUpWhenStartFails(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.CreateInstanceRequest{TenantId: "tenant1"}
	startErr := errors.New("start failed")

	mockClient.On("ContainerCreate",
		ctx,
		mock.Anything,
		mock.Anything,
		mock.Anything,
		mock.Anything,
		"agenthub-tenant1",
	).Return(container.CreateResponse{ID: "abc123"}, nil)
	mockClient.On("ContainerStart", ctx, "abc123", mock.AnythingOfType("container.StartOptions")).Return(startErr)
	mockClient.On("ContainerRemove", ctx, "abc123", mock.MatchedBy(func(options container.RemoveOptions) bool {
		return options.Force && options.RemoveVolumes
	})).Return(nil)

	resp, err := im.CreateInstance(ctx, req)

	assert.Nil(t, resp)
	assert.ErrorIs(t, err, startErr)
	mockClient.AssertExpectations(t)
}

func TestGetInstanceStatus(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient, dockerNetwork: "agenthub_local"}

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
			Networks: map[string]*network.EndpointSettings{
				"agenthub_local": {
					IPAddress: "172.20.0.8",
				},
			},
		},
	}
	mockClient.On("ContainerInspect", ctx, "abc123").Return(inspect, nil)

	status, err := im.GetInstanceStatus(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "abc123", status.ContainerId)
	assert.Equal(t, "running", status.Status)
	assert.Equal(t, "http://172.20.0.8:8080", status.Endpoint)
	mockClient.AssertExpectations(t)
}

func TestStartInstance(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.InstanceIdentity{ContainerId: "abc123"}

	mockClient.On("ContainerStart", ctx, "abc123", mock.AnythingOfType("container.StartOptions")).Return(nil)
	mockClient.On("ContainerInspect", ctx, "abc123").Return(types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:    "abc123",
			State: &types.ContainerState{Status: "running"},
		},
	}, nil)

	status, err := im.StartInstance(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "running", status.Status)
	mockClient.AssertExpectations(t)
}

func TestStopInstance(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.InstanceIdentity{ContainerId: "abc123"}

	mockClient.On("ContainerStop", ctx, "abc123", mock.AnythingOfType("container.StopOptions")).Return(nil)
	mockClient.On("ContainerInspect", ctx, "abc123").Return(types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:    "abc123",
			State: &types.ContainerState{Status: "exited"},
		},
	}, nil)

	status, err := im.StopInstance(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "exited", status.Status)
	mockClient.AssertExpectations(t)
}

func TestDestroyInstance(t *testing.T) {
	mockClient := new(MockDockerClient)
	im := &InstanceManager{docker: mockClient}

	ctx := context.Background()
	req := &pb.InstanceIdentity{ContainerId: "abc123"}

	mockClient.On("ContainerRemove", ctx, "abc123", mock.MatchedBy(func(options container.RemoveOptions) bool {
		return options.Force && options.RemoveVolumes
	})).Return(nil)

	resp, err := im.DestroyInstance(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	mockClient.AssertExpectations(t)
}
