// Package protocol contains generated gRPC stubs.
// TODO: Run `make proto` to generate from api/proto/dataplane.proto
package protocol

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
)

// ---- Messages ----

type CreateInstanceRequest struct {
	TenantId  string
	Tier      string
	Labels    map[string]string
	Resources *ResourceSpec
}

type ResourceSpec struct {
	CpuMillicores uint32
	MemoryBytes   uint64
	GpuCount      uint32
}

type CreateInstanceResponse struct {
	ContainerId string
	Endpoint    string
}

type InstanceIdentity struct {
	ContainerId string
}

type InstanceStatus struct {
	ContainerId       string
	Status            string
	Endpoint          string
	CpuMillicoresUsed uint32
	MemoryBytesUsed   uint64
	Health            string
	StartedAt         int64
}

type LogChunk struct {
	ContainerId string
	Timestamp   int64
	Source      string
	Payload     []byte
}

type ContainerEvent struct {
	ContainerId string
	EventType   string
	Metadata    map[string]string
}

type ModelRequest struct {
	TenantId    string
	ContainerId string
	ModelAlias  string
	Body        []byte
	Stream      bool
}

type ModelResponse struct {
	Body     []byte
	Usage    *Usage
	Upstream string
}

type Usage struct {
	PromptTokens     uint32
	CompletionTokens uint32
	TotalTokens      uint32
}

// ---- Server Interfaces ----

type InstanceManagerServer interface {
	CreateInstance(context.Context, *CreateInstanceRequest) (*CreateInstanceResponse, error)
	StartInstance(context.Context, *InstanceIdentity) (*InstanceStatus, error)
	StopInstance(context.Context, *InstanceIdentity) (*InstanceStatus, error)
	DestroyInstance(context.Context, *InstanceIdentity) (*emptypb.Empty, error)
	GetInstanceStatus(context.Context, *InstanceIdentity) (*InstanceStatus, error)
	StreamLogs(*InstanceIdentity, InstanceManager_StreamLogsServer) error
	SubscribeEvents(*emptypb.Empty, InstanceManager_SubscribeEventsServer) error
}

type InstanceManager_StreamLogsServer interface {
	Send(*LogChunk) error
	Context() context.Context
}

type InstanceManager_SubscribeEventsServer interface {
	Send(*ContainerEvent) error
	Context() context.Context
}

type ModelProxyServer interface {
	ProxyModelRequest(context.Context, *ModelRequest) (*ModelResponse, error)
}

// ---- Unimplemented structs ----

type UnimplementedInstanceManagerServer struct{}

func (UnimplementedInstanceManagerServer) CreateInstance(context.Context, *CreateInstanceRequest) (*CreateInstanceResponse, error) {
	return nil, nil
}
func (UnimplementedInstanceManagerServer) StartInstance(context.Context, *InstanceIdentity) (*InstanceStatus, error) {
	return nil, nil
}
func (UnimplementedInstanceManagerServer) StopInstance(context.Context, *InstanceIdentity) (*InstanceStatus, error) {
	return nil, nil
}
func (UnimplementedInstanceManagerServer) DestroyInstance(context.Context, *InstanceIdentity) (*emptypb.Empty, error) {
	return nil, nil
}
func (UnimplementedInstanceManagerServer) GetInstanceStatus(context.Context, *InstanceIdentity) (*InstanceStatus, error) {
	return nil, nil
}
func (UnimplementedInstanceManagerServer) StreamLogs(*InstanceIdentity, InstanceManager_StreamLogsServer) error {
	return nil
}
func (UnimplementedInstanceManagerServer) SubscribeEvents(*emptypb.Empty, InstanceManager_SubscribeEventsServer) error {
	return nil
}

type UnimplementedModelProxyServer struct{}

func (UnimplementedModelProxyServer) ProxyModelRequest(context.Context, *ModelRequest) (*ModelResponse, error) {
	return nil, nil
}

// ---- Registration stubs ----

func RegisterInstanceManagerServer(s interface{}, srv InstanceManagerServer)   {}
func RegisterModelProxyServer(s interface{}, srv ModelProxyServer)             {}
