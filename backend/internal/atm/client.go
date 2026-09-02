package atm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	logger "github.com/bukharney/bank-core/internal/logs"
)

// DispenseResult represents the result of a physical cash dispense operation
type DispenseResult struct {
	Status       string `json:"status"`
	Message      string `json:"message"`
	DispensedSat int64  `json:"dispensed_sat"`
	ATMId        int    `json:"atm_id"`
}

// ATMClient is the interface for interacting with ATM physical machines
type ATMClient interface {
	DispenseCash(ctx context.Context, atmID int, amountInSatang int64) (*DispenseResult, error)
	HealthCheck(ctx context.Context, atmID int) bool
	GetATMEndpoint(atmID int) (string, error)
}

// HTTPATMClient implements ATMClient using standard HTTP requests
type HTTPATMClient struct {
	client    *http.Client
	endpoints map[int]string
}

func getEnvOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

// NewATMClient creates a new HTTPATMClient with configured ATM endpoints
func NewATMClient() ATMClient {
	return &HTTPATMClient{
		client: &http.Client{
			Timeout: 6 * time.Second,
		},
		endpoints: map[int]string{
			1: getEnvOrDefault("ATM_VAULT_1_URL", "http://localhost:8081"),
			2: getEnvOrDefault("ATM_VAULT_2_URL", "http://localhost:8082"),
			3: getEnvOrDefault("ATM_VAULT_3_URL", "http://localhost:8083"),
		},
	}
}

// GetATMEndpoint returns the base URL for a given ATM ID
func (c *HTTPATMClient) GetATMEndpoint(atmID int) (string, error) {
	endpoint, ok := c.endpoints[atmID]
	if !ok {
		return "", fmt.Errorf("ATM machine #%d is not registered in ATM network", atmID)
	}
	return endpoint, nil
}

// HealthCheck checks if an ATM machine is online and reachable
func (c *HTTPATMClient) HealthCheck(ctx context.Context, atmID int) bool {
	endpoint, err := c.GetATMEndpoint(atmID)
	if err != nil {
		return false
	}

	req, err := http.NewRequestWithContext(ctx, "GET", endpoint+"/atm/health", nil)
	if err != nil {
		return false
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// DispenseCash requests a session and triggers physical cash dispensing on the ATM machine
func (c *HTTPATMClient) DispenseCash(ctx context.Context, atmID int, amountInSatang int64) (*DispenseResult, error) {
	endpoint, err := c.GetATMEndpoint(atmID)
	if err != nil {
		return nil, err
	}

	// 1. Acquire ATM Session Token
	sessionReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/session", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create session request for ATM #%d: %w", atmID, err)
	}

	sessionResp, err := c.client.Do(sessionReq)
	if err != nil {
		return nil, fmt.Errorf("ATM #%d is unreachable or offline: %w", atmID, err)
	}
	defer sessionResp.Body.Close()

	if sessionResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ATM #%d rejected session creation (status: %d)", atmID, sessionResp.StatusCode)
	}

	var sessionData struct {
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(sessionResp.Body).Decode(&sessionData); err != nil {
		return nil, fmt.Errorf("invalid session response from ATM #%d: %w", atmID, err)
	}

	if sessionData.SessionID == "" {
		return nil, fmt.Errorf("ATM #%d returned an empty session ID", atmID)
	}

	// 2. Dispense Cash Command (Units = Satang / 100 for THB note units, minimum 1)
	units := int(amountInSatang / 100)
	if units <= 0 {
		units = 1
	}

	dispensePayload := map[string]interface{}{
		"session_id": sessionData.SessionID,
		"amount":     units,
	}
	payloadBytes, _ := json.Marshal(dispensePayload)

	dispenseReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/atm/dispense", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create dispense request: %w", err)
	}
	dispenseReq.Header.Set("Content-Type", "application/json")

	logger.Logger.Infof("[ATM Client] Dispatching dispense to ATM #%d (Units: %d, Satang: %d)", atmID, units, amountInSatang)

	dispenseResp, err := c.client.Do(dispenseReq)
	if err != nil {
		return nil, fmt.Errorf("ATM #%d dispense timeout or hardware communication failure: %w", atmID, err)
	}
	defer dispenseResp.Body.Close()

	bodyBytes, _ := io.ReadAll(dispenseResp.Body)

	var result struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(bodyBytes, &result)

	if dispenseResp.StatusCode != http.StatusOK || result.Status != "success" {
		errMsg := result.Message
		if errMsg == "" {
			errMsg = fmt.Sprintf("HTTP %d: %s", dispenseResp.StatusCode, string(bodyBytes))
		}
		logger.Logger.Errorf("[ATM Client] ATM #%d dispense failed: %s", atmID, errMsg)
		return nil, fmt.Errorf("ATM hardware failure (Cash not dispensed): %s", errMsg)
	}

	logger.Logger.Infof("[ATM Client] ATM #%d successfully dispensed %d units", atmID, units)

	return &DispenseResult{
		Status:       "success",
		Message:      result.Message,
		DispensedSat: amountInSatang,
		ATMId:        atmID,
	}, nil
}
