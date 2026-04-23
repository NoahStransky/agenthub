package runtime

import (
	"context"
	"fmt"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
)

type ModelProxy struct {
	pb.UnimplementedModelProxyServer
}

func NewModelProxy() *ModelProxy {
	return &ModelProxy{}
}

func (p *ModelProxy) ProxyModelRequest(ctx context.Context, req *pb.ModelRequest) (*pb.ModelResponse, error) {
	// TODO: Phase 1 — 实现模型代理 + 计费计量
	return nil, fmt.Errorf("not implemented")
}
