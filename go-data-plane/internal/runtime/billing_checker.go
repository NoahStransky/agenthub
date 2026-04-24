package runtime

import pb "github.com/NoahStransky/agenthub/data-plane/pkg/protocol"

type BillingChecker interface {
	CheckQuota(tenantID string, requestedTokens int) error
	RecordUsage(tenantID string, usage pb.Usage) error
}
