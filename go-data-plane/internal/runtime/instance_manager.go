package runtime

import (
	"context"
	"fmt"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"google.golang.org/protobuf/types/known/emptypb"
)

type InstanceManager struct {
	pb.UnimplementedInstanceManagerServer
	docker        DockerClient
	dockerNetwork string
	hermesImage   string
}

type InstanceManagerOptions struct {
	DockerNetwork string
	HermesImage   string
}

func NewInstanceManager(dockerHost string, opts ...InstanceManagerOptions) *InstanceManager {
	cli, err := client.NewClientWithOpts(client.WithHost(dockerHost), client.WithAPIVersionNegotiation())
	if err != nil {
		panic(err)
	}
	options := instanceManagerOptions(opts)
	return &InstanceManager{
		docker:        cli,
		dockerNetwork: options.DockerNetwork,
		hermesImage:   options.HermesImage,
	}
}

func (m *InstanceManager) CreateInstance(ctx context.Context, req *pb.CreateInstanceRequest) (*pb.CreateInstanceResponse, error) {
	containerName := req.ContainerName
	if containerName == "" {
		containerName = fmt.Sprintf("agenthub-%s", req.TenantId)
	}
	image := m.hermesImage
	if image == "" {
		image = "agenthub/hermes-base:latest"
	}
	labels := map[string]string{
		"agenthub.tenant_id":     req.TenantId,
		"agenthub.instance_id":   req.InstanceId,
		"agenthub.tier":          req.Tier,
		"agenthub.runtime_class": req.RuntimeClass,
	}
	for key, value := range req.Labels {
		labels[key] = value
	}

	resources := container.Resources{}
	if req.Resources != nil {
		resources.Memory = int64(req.Resources.MemoryBytes)
		resources.NanoCPUs = int64(req.Resources.CpuMillicores) * 1000000
	}
	mountPath := workspaceMountPath(req.Workspace)
	hostConfig := &container.HostConfig{
		Privileged:     false,
		CapDrop:        []string{"ALL"},
		ReadonlyRootfs: true,
		Resources:      resources,
		Tmpfs: map[string]string{
			mountPath: "rw,nosuid,nodev,size=1g",
			"/tmp":    "rw,nosuid,nodev,size=128m",
		},
	}
	networkingConfig := dockerNetworkingConfig(m.dockerNetwork, containerName)
	if m.dockerNetwork != "" {
		hostConfig.NetworkMode = container.NetworkMode(m.dockerNetwork)
	}

	resp, err := m.docker.ContainerCreate(ctx,
		&container.Config{
			Image:  image,
			Labels: labels,
			User:   "10001:10001",
			Env:    runtimeEnv(req.Workspace, req.Gateway, mountPath),
		},
		hostConfig,
		networkingConfig, nil, containerName,
	)
	if err != nil {
		return nil, err
	}

	if err := m.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = m.docker.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true, RemoveVolumes: true})
		return nil, err
	}

	return &pb.CreateInstanceResponse{ContainerId: resp.ID}, nil
}

func (m *InstanceManager) StartInstance(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	if err := m.docker.ContainerStart(ctx, req.ContainerId, container.StartOptions{}); err != nil {
		return nil, err
	}
	return m.GetInstanceStatus(ctx, req)
}

func (m *InstanceManager) StopInstance(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	if err := m.docker.ContainerStop(ctx, req.ContainerId, container.StopOptions{}); err != nil {
		return nil, err
	}
	return m.GetInstanceStatus(ctx, req)
}

func (m *InstanceManager) DestroyInstance(ctx context.Context, req *pb.InstanceIdentity) (*emptypb.Empty, error) {
	if err := m.docker.ContainerRemove(ctx, req.ContainerId, container.RemoveOptions{Force: true, RemoveVolumes: true}); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (m *InstanceManager) GetInstanceStatus(ctx context.Context, req *pb.InstanceIdentity) (*pb.InstanceStatus, error) {
	inspect, err := m.docker.ContainerInspect(ctx, req.ContainerId)
	if err != nil {
		return nil, err
	}

	endpoint := containerEndpoint(inspect, m.dockerNetwork)

	status := "unknown"
	health := "unknown"
	if inspect.State != nil {
		status = inspect.State.Status
		if inspect.State.Running {
			health = "healthy"
		} else if status == "dead" {
			health = "unhealthy"
		}
	}

	return &pb.InstanceStatus{
		ContainerId: req.ContainerId,
		Status:      status,
		Endpoint:    endpoint,
		Health:      health,
	}, nil
}

func (m *InstanceManager) StreamLogs(req *pb.InstanceIdentity, stream pb.InstanceManager_StreamLogsServer) error {
	return fmt.Errorf("not implemented")
}

func (m *InstanceManager) SubscribeEvents(_ *emptypb.Empty, stream pb.InstanceManager_SubscribeEventsServer) error {
	return fmt.Errorf("not implemented")
}

func workspaceMountPath(workspace *pb.WorkspaceSpec) string {
	if workspace != nil && workspace.MountPath != "" {
		return workspace.MountPath
	}
	return "/workspace"
}

func instanceManagerOptions(opts []InstanceManagerOptions) InstanceManagerOptions {
	if len(opts) == 0 {
		return InstanceManagerOptions{HermesImage: "agenthub/hermes-base:latest"}
	}
	if opts[0].HermesImage == "" {
		opts[0].HermesImage = "agenthub/hermes-base:latest"
	}
	return opts[0]
}

func dockerNetworkingConfig(networkName string, containerName string) *network.NetworkingConfig {
	if networkName == "" {
		return nil
	}
	return &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			networkName: {
				Aliases: []string{containerName},
			},
		},
	}
}

func containerEndpoint(inspect types.ContainerJSON, networkName string) string {
	if inspect.NetworkSettings == nil {
		return ""
	}
	if networkName != "" {
		if endpoint, ok := inspect.NetworkSettings.Networks[networkName]; ok && endpoint != nil && endpoint.IPAddress != "" {
			return fmt.Sprintf("http://%s:8080", endpoint.IPAddress)
		}
	}
	if inspect.NetworkSettings.DefaultNetworkSettings.IPAddress != "" {
		return fmt.Sprintf("http://%s:8080", inspect.NetworkSettings.DefaultNetworkSettings.IPAddress)
	}
	for _, endpoint := range inspect.NetworkSettings.Networks {
		if endpoint != nil && endpoint.IPAddress != "" {
			return fmt.Sprintf("http://%s:8080", endpoint.IPAddress)
		}
	}
	return ""
}

func workspaceEnv(workspace *pb.WorkspaceSpec, mountPath string) []string {
	env := []string{
		"AGENTHUB_WORKSPACE_MOUNT=" + mountPath,
	}
	if workspace == nil {
		return env
	}
	if workspace.Provider != "" {
		env = append(env, "AGENTHUB_WORKSPACE_PROVIDER="+workspace.Provider)
	}
	if workspace.Endpoint != "" {
		env = append(env, "AGENTHUB_WORKSPACE_ENDPOINT="+workspace.Endpoint)
		env = append(env, "AWS_ENDPOINT_URL="+workspace.Endpoint)
	}
	if workspace.Bucket != "" {
		env = append(env, "AGENTHUB_WORKSPACE_BUCKET="+workspace.Bucket)
	}
	if workspace.Region != "" {
		env = append(env, "AGENTHUB_WORKSPACE_REGION="+workspace.Region)
		env = append(env, "AWS_REGION="+workspace.Region)
		env = append(env, "AWS_DEFAULT_REGION="+workspace.Region)
	}
	if workspace.Prefix != "" {
		env = append(env, "AGENTHUB_WORKSPACE_PREFIX="+workspace.Prefix)
	}
	if workspace.AccessKey != "" {
		env = append(env, "AWS_ACCESS_KEY_ID="+workspace.AccessKey)
	}
	if workspace.SecretKey != "" {
		env = append(env, "AWS_SECRET_ACCESS_KEY="+workspace.SecretKey)
	}
	return env
}

func gatewayEnv(gateway *pb.GatewaySpec) []string {
	if gateway == nil {
		return nil
	}
	env := []string{}
	if gateway.PublicBaseUrl != "" {
		env = append(env, "AGENTHUB_PUBLIC_BASE_URL="+gateway.PublicBaseUrl)
	}
	if gateway.ProxyPath != "" {
		env = append(env, "AGENTHUB_HERMES_PROXY_URL="+gateway.PublicBaseUrl+gateway.ProxyPath)
	}
	if gateway.WebhookBasePath != "" {
		env = append(env, "AGENTHUB_HERMES_WEBHOOK_BASE_URL="+gateway.PublicBaseUrl+gateway.WebhookBasePath)
	}
	return env
}

func runtimeEnv(workspace *pb.WorkspaceSpec, gateway *pb.GatewaySpec, mountPath string) []string {
	env := workspaceEnv(workspace, mountPath)
	return append(env, gatewayEnv(gateway)...)
}
