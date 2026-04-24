package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ModelProxy struct {
	pb.UnimplementedModelProxyServer
	BillingChecker BillingChecker
	HTTPClient     *http.Client
	UpstreamURL    string
}

func NewModelProxy() *ModelProxy {
	return &ModelProxy{
		HTTPClient:  http.DefaultClient,
		UpstreamURL: "https://openrouter.ai/api/v1/chat/completions",
	}
}

func (p *ModelProxy) ProxyModelRequest(ctx context.Context, req *pb.ModelRequest) (*pb.ModelResponse, error) {
	requestedTokens := estimateTokens(req.Body)

	if err := p.BillingChecker.CheckQuota(req.TenantId, requestedTokens); err != nil {
		return nil, status.Errorf(codes.ResourceExhausted, "quota exceeded: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.UpstreamURL, bytes.NewReader(req.Body))
	if err != nil {
		return nil, fmt.Errorf("failed to create upstream request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if req.ModelAlias != "" {
		httpReq.Header.Set("X-Model-Alias", req.ModelAlias)
	}

	resp, err := p.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read upstream response: %w", err)
	}

	usage := extractUsage(respBody)

	if usage != nil {
		_ = p.BillingChecker.RecordUsage(req.TenantId, *usage)
	}

	return &pb.ModelResponse{
		Body:     respBody,
		Usage:    usage,
		Upstream: p.UpstreamURL,
	}, nil
}

func estimateTokens(body []byte) int {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err == nil {
		if mt, ok := payload["max_tokens"].(float64); ok {
			return int(mt)
		}
	}
	return len(body) / 4
}

func extractUsage(body []byte) *pb.Usage {
	var result struct {
		Usage struct {
			PromptTokens     uint32 `json:"prompt_tokens"`
			CompletionTokens uint32 `json:"completion_tokens"`
			TotalTokens      uint32 `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}
	if result.Usage.TotalTokens == 0 {
		return nil
	}
	return &pb.Usage{
		PromptTokens:     result.Usage.PromptTokens,
		CompletionTokens: result.Usage.CompletionTokens,
		TotalTokens:      result.Usage.TotalTokens,
	}
}
