package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ModelProxy struct {
	pb.UnimplementedModelProxyServer
	BillingChecker BillingChecker
	HTTPClient     *http.Client
	UpstreamURL    string
	APIKey         string
}

func NewModelProxy() *ModelProxy {
	return &ModelProxy{
		HTTPClient:  http.DefaultClient,
		UpstreamURL: "https://openrouter.ai/api/v1/chat/completions",
		APIKey:      os.Getenv("OPENROUTER_API_KEY"),
	}
}

func (p *ModelProxy) ProxyModelRequest(ctx context.Context, req *pb.ModelRequest) (*pb.ModelResponse, error) {
	requestedTokens := estimateTokens(req.Body)
	billingChecker := p.BillingChecker
	if billingChecker == nil {
		billingChecker = noopBillingChecker{}
	}

	if err := billingChecker.CheckQuota(req.TenantId, requestedTokens); err != nil {
		return nil, status.Errorf(codes.ResourceExhausted, "quota exceeded: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.UpstreamURL, bytes.NewReader(req.Body))
	if err != nil {
		return nil, fmt.Errorf("failed to create upstream request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	if p.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.APIKey)
	}
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
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, status.Errorf(codes.Unavailable, "upstream returned HTTP %d: %s", resp.StatusCode, truncateBody(respBody, 512))
	}

	usage := extractUsage(respBody)
	if usage == nil {
		usage = &pb.Usage{TotalTokens: uint32(requestedTokens)}
	}

	if usage != nil {
		_ = billingChecker.RecordUsage(req.TenantId, *usage)
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

type noopBillingChecker struct{}

func (noopBillingChecker) CheckQuota(tenantID string, requestedTokens int) error {
	return nil
}

func (noopBillingChecker) RecordUsage(tenantID string, usage pb.Usage) error {
	return nil
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

func truncateBody(body []byte, max int) string {
	if len(body) <= max {
		return string(body)
	}
	return string(body[:max]) + "..."
}
