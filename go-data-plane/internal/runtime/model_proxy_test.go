package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type mockBillingChecker struct {
	quotaExceeded bool
	recordedUsage *pb.Usage
}

func (m *mockBillingChecker) CheckQuota(tenantID string, requestedTokens int) error {
	if m.quotaExceeded {
		return fmt.Errorf("quota exceeded")
	}
	return nil
}

func (m *mockBillingChecker) RecordUsage(tenantID string, usage pb.Usage) error {
	m.recordedUsage = &usage
	return nil
}

type mockTransport struct {
	response *http.Response
	err      error
}

func (m *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.response, m.err
}

func TestProxyModelRequest(t *testing.T) {
	upstreamBody, _ := json.Marshal(map[string]interface{}{
		"id": "chatcmpl-123",
		"usage": map[string]interface{}{
			"prompt_tokens":     10,
			"completion_tokens": 20,
			"total_tokens":      30,
		},
	})

	transport := &mockTransport{
		response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader(upstreamBody)),
			Header:     make(http.Header),
		},
	}

	bc := &mockBillingChecker{}
	proxy := &ModelProxy{
		BillingChecker: bc,
		HTTPClient:     &http.Client{Transport: transport},
		UpstreamURL:    "http://mock-upstream",
	}

	req := &pb.ModelRequest{
		TenantId:    "tenant-1",
		ContainerId: "container-1",
		ModelAlias:  "gpt-4o",
		Body:        []byte(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":100}`),
		Stream:      false,
	}

	resp, err := proxy.ProxyModelRequest(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Upstream != "http://mock-upstream" {
		t.Errorf("expected upstream http://mock-upstream, got %s", resp.Upstream)
	}

	if resp.Usage == nil {
		t.Fatal("expected usage, got nil")
	}
	if resp.Usage.PromptTokens != 10 || resp.Usage.CompletionTokens != 20 || resp.Usage.TotalTokens != 30 {
		t.Errorf("unexpected usage: %+v", resp.Usage)
	}

	if bc.recordedUsage == nil {
		t.Fatal("expected recorded usage")
	}
	if bc.recordedUsage.TotalTokens != 30 {
		t.Errorf("unexpected recorded usage total tokens: %d", bc.recordedUsage.TotalTokens)
	}
}

func TestProxyModelRequestQuotaExceeded(t *testing.T) {
	bc := &mockBillingChecker{quotaExceeded: true}
	proxy := &ModelProxy{
		BillingChecker: bc,
		HTTPClient:     &http.Client{Transport: &mockTransport{}},
		UpstreamURL:    "http://mock-upstream",
	}

	req := &pb.ModelRequest{
		TenantId:    "tenant-1",
		ContainerId: "container-1",
		ModelAlias:  "gpt-4o",
		Body:        []byte(`{"messages":[{"role":"user","content":"hello"}]}`),
		Stream:      false,
	}

	_, err := proxy.ProxyModelRequest(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %T", err)
	}
	if st.Code() != codes.ResourceExhausted {
		t.Errorf("expected code ResourceExhausted, got %v", st.Code())
	}
	if !strings.Contains(st.Message(), "quota exceeded") {
		t.Errorf("expected message to contain 'quota exceeded', got %s", st.Message())
	}
}
