package runtime

import (
	pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"
)

// BillingCheckerImpl is a stub implementation of BillingChecker
// that will eventually call the Control Plane BillingService via gRPC.
type BillingCheckerImpl struct{}

func NewBillingCheckerImpl() *BillingCheckerImpl {
	return &BillingCheckerImpl{}
}

func (b *BillingCheckerImpl) CheckQuota(tenantID string, requestedTokens int) error {
	// TODO: call Control Plane BillingService via gRPC
	return nil
}

func (b *BillingCheckerImpl) RecordUsage(tenantID string, usage pb.Usage) error {
	// TODO: call Control Plane BillingService via gRPC
	return nil
}
