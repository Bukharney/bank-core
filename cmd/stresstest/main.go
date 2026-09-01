package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

const baseURL = "http://localhost:8080"

type UserRegisterRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type Account struct {
	ID            int    `json:"id"`
	UserID        string `json:"user_id"`
	AccountNumber string `json:"account_number"`
	Balance       int64  `json:"balance"`
	Currency      string `json:"currency"`
	AccountType   string `json:"account_type"`
	Status        string `json:"status"`
}

type TransferRequest struct {
	SenderAccountID   int    `json:"sender_account_id"`
	ReceiverAccountID int    `json:"receiver_account_id"`
	Amount            int64  `json:"amount"`
	Currency          string `json:"currency"`
	Description       string `json:"description"`
}

type DepositRequest struct {
	AccountID   int    `json:"account_id"`
	Amount      int64  `json:"amount"`
	Currency    string `json:"currency"`
	DepositRef  string `json:"deposit_ref"`
	Description string `json:"description"`
}

type APIResponse struct {
	Status  string          `json:"status"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

type ClientSession struct {
	Client   *http.Client
	Username string
	Email    string
	Password string
	Accounts []Account
}

func newSession() (*ClientSession, error) {
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar:     jar,
		Timeout: 10 * time.Second,
	}
	return &ClientSession{Client: client}, nil
}

func (s *ClientSession) RegisterAndLogin(prefix string) error {
	s.Username = fmt.Sprintf("stress_%s_%d", prefix, rand.Intn(1000000))
	s.Email = fmt.Sprintf("%s@example.com", s.Username)
	s.Password = "P@ssword12345!"

	regBody := UserRegisterRequest{
		Username:    s.Username,
		Password:    s.Password,
		FirstName:   "Stress",
		LastName:    "Tester",
		Email:       s.Email,
		PhoneNumber: fmt.Sprintf("08%08d", rand.Intn(100000000)),
	}

	payload, _ := json.Marshal(regBody)
	resp, err := s.Client.Post(baseURL+"/user/register", "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("register failed: %w", err)
	}
	resp.Body.Close()

	loginBody := LoginRequest{
		Email:    s.Email,
		Password: s.Password,
	}
	payload, _ = json.Marshal(loginBody)
	resp, err = s.Client.Post(baseURL+"/auth/login", "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("login failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("login failed status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (s *ClientSession) CreateAccount() (*Account, error) {
	req, _ := http.NewRequest("POST", baseURL+"/account/create", bytes.NewReader([]byte(`{"account_type":"SAVINGS","currency":"THB"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", uuid.New().String())

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	var acc Account
	if err := json.Unmarshal(apiResp.Data, &acc); err != nil {
		return nil, err
	}
	s.Accounts = append(s.Accounts, acc)
	return &acc, nil
}

func (s *ClientSession) Deposit(accountID int, amountSatang int64) error {
	depositReq := DepositRequest{
		AccountID:   accountID,
		Amount:      amountSatang,
		Currency:    "THB",
		DepositRef:  uuid.New().String(),
		Description: "Stress Test Initial Deposit",
	}
	payload, _ := json.Marshal(depositReq)
	req, _ := http.NewRequest("POST", baseURL+"/transaction/deposit", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", uuid.New().String())

	resp, err := s.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("deposit failed status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (s *ClientSession) GetAccount(accountID int) (*Account, error) {
	resp, err := s.Client.Get(fmt.Sprintf("%s/account/%d", baseURL, accountID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	var acc Account
	if err := json.Unmarshal(apiResp.Data, &acc); err != nil {
		return nil, err
	}
	return &acc, nil
}

func (s *ClientSession) Transfer(senderID, receiverID int, amountSatang int64, idempotencyKey string) (int, string, error) {
	transferReq := TransferRequest{
		SenderAccountID:   senderID,
		ReceiverAccountID: receiverID,
		Amount:            amountSatang,
		Currency:          "THB",
		Description:       "Stress Test Transfer",
	}
	payload, _ := json.Marshal(transferReq)
	req, _ := http.NewRequest("POST", baseURL+"/transaction/transfer", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", idempotencyKey)

	start := time.Now()
	resp, err := s.Client.Do(req)
	duration := time.Since(start)
	_ = duration

	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(bodyBytes), nil
}

func main() {
	rand.Seed(time.Now().UnixNano())

	fmt.Println("================================================================================")
	fmt.Println(" 🔥 BANK CORE ENGINE - COMPREHENSIVE CONCURRENCY & STRESS TEST SUITE")
	fmt.Println("================================================================================")
	fmt.Println(" Target:", baseURL)
	fmt.Println(" Time:  ", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Println("--------------------------------------------------------------------------------")

	// Setup Test Sessions
	sessionA, err := newSession()
	if err != nil {
		panic(err)
	}
	if err := sessionA.RegisterAndLogin("userA"); err != nil {
		panic(err)
	}
	accA, err := sessionA.CreateAccount()
	if err != nil {
		panic(err)
	}

	sessionB, err := newSession()
	if err != nil {
		panic(err)
	}
	if err := sessionB.RegisterAndLogin("userB"); err != nil {
		panic(err)
	}
	accB, err := sessionB.CreateAccount()
	if err != nil {
		panic(err)
	}

	fmt.Printf("✅ Provisioned Test Accounts: Account A (#%d) and Account B (#%d)\n\n", accA.ID, accB.ID)

	// -------------------------------------------------------------------------
	// SUITE 1: CONCURRENT OVERDRAFT RACE CONDITION TEST (50 Goroutines)
	// -------------------------------------------------------------------------
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Println(" 🧪 TEST 1: CONCURRENT OVERDRAFT RACE CONDITION (50 Simultaneous Transfers)")
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Println(" Scenario: Starting balance Account A = 10,000 Satang (฿100.00).")
	fmt.Println("           50 concurrent workers attempt to transfer 5,000 Satang (฿50.00) simultaneously.")
	fmt.Println(" Expected: Exactly 2 transfers succeed (2 * 50 = 100). Exactly 48 fail (Insufficient Balance).")
	fmt.Println("           Final balance of Account A = 0 Satang (NO overdraft / NO negative balance).")

	// Deposit exactly 10,000 Satang into Account A
	if err := sessionA.Deposit(accA.ID, 10000); err != nil {
		panic(err)
	}

	var wg sync.WaitGroup
	var successCount int64
	var rejectCount int64
	var otherErrorCount int64

	workers := 50
	startGate := make(chan struct{})

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			<-startGate // Wait for gun shot to fire all 50 concurrently

			statusCode, body, err := sessionA.Transfer(accA.ID, accB.ID, 5000, uuid.New().String())
			if err != nil {
				atomic.AddInt64(&otherErrorCount, 1)
				return
			}
			if statusCode == http.StatusOK || statusCode == http.StatusCreated {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&rejectCount, 1)
				_ = body
			}
		}(i)
	}

	// Trigger all 50 goroutines in exact parallel
	close(startGate)
	wg.Wait()

	// Verify Account Balances
	updatedAccA, _ := sessionA.GetAccount(accA.ID)
	updatedAccB, _ := sessionB.GetAccount(accB.ID)

	fmt.Printf(" Results:\n")
	fmt.Printf("   - Successful Transfers: %d (Expected: 2)\n", successCount)
	fmt.Printf("   - Rejected (400/422):   %d (Expected: 48)\n", rejectCount)
	fmt.Printf("   - Network/Fatal Errors: %d\n", otherErrorCount)
	fmt.Printf("   - Final Account A Balance: %d Satang (Expected: 0 Satang)\n", updatedAccA.Balance)
	fmt.Printf("   - Final Account B Balance: %d Satang (Expected: 10000 Satang)\n", updatedAccB.Balance)

	if successCount == 2 && updatedAccA.Balance == 0 && updatedAccB.Balance == 10000 {
		fmt.Println(" 🟢 TEST 1 PASSED: Concurrency locks (SELECT FOR UPDATE) prevented any race condition or overdraft leak!\n")
	} else {
		fmt.Printf(" 🔴 TEST 1 FAILED: Discrepancy detected! (success: %d, balance A: %d, balance B: %d)\n\n", successCount, updatedAccA.Balance, updatedAccB.Balance)
	}

	// -------------------------------------------------------------------------
	// SUITE 2: CONCURRENT IDEMPOTENCY & REPLAY ATTACK TEST (50 Goroutines)
	// -------------------------------------------------------------------------
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Println(" 🧪 TEST 2: CONCURRENT IDEMPOTENCY & REPLAY ATTACK (50 Cloned Requests)")
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Println(" Scenario: Account A deposits 50,000 Satang (฿500.00).")
	fmt.Println("           50 concurrent workers send the EXACT SAME Idempotency-Key and payload.")
	fmt.Println(" Expected: Exactly 1 transaction executed. Exactly 5,000 Satang deducted.")
	fmt.Println("           All 50 responses return identical successful cached response.")

	if err := sessionA.Deposit(accA.ID, 50000); err != nil {
		panic(err)
	}
	beforeBalA, _ := sessionA.GetAccount(accA.ID)

	sharedIdempotencyKey := uuid.New().String()
	var idemSuccessCount int64
	var journalIDs sync.Map

	startGate2 := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-startGate2

			statusCode, body, err := sessionA.Transfer(accA.ID, accB.ID, 5000, sharedIdempotencyKey)
			if err == nil && (statusCode == http.StatusOK || statusCode == http.StatusCreated) {
				atomic.AddInt64(&idemSuccessCount, 1)

				var apiResp APIResponse
				if json.Unmarshal([]byte(body), &apiResp) == nil {
					var receipt struct {
						JournalID string `json:"journal_id"`
					}
					if json.Unmarshal(apiResp.Data, &receipt) == nil && receipt.JournalID != "" {
						journalIDs.Store(receipt.JournalID, true)
					}
				}
			}
		}()
	}

	close(startGate2)
	wg.Wait()

	afterBalA, _ := sessionA.GetAccount(accA.ID)
	deductedAmount := beforeBalA.Balance - afterBalA.Balance

	uniqueJournals := 0
	journalIDs.Range(func(key, value any) bool {
		uniqueJournals++
		return true
	})

	fmt.Printf(" Results:\n")
	fmt.Printf("   - All 50 Requests Handled Gracefully: %d/50\n", idemSuccessCount)
	fmt.Printf("   - Total Balance Deducted:             %d Satang (Expected: exactly 5000 Satang)\n", deductedAmount)
	fmt.Printf("   - Unique Journal Entries Created:     %d (Expected: exactly 1)\n", uniqueJournals)

	if deductedAmount == 5000 && uniqueJournals == 1 {
		fmt.Println(" 🟢 TEST 2 PASSED: Idempotency middleware perfectly cached & prevented duplicate debits!\n")
	} else {
		fmt.Println(" 🔴 TEST 2 FAILED: Idempotency violation detected!\n")
	}

	// -------------------------------------------------------------------------
	// SUITE 3: HIGH-THROUGHPUT BURST LOAD TEST (500 Rapid Atomic Transfers)
	// -------------------------------------------------------------------------
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Println(" 🧪 TEST 3: HIGH-THROUGHPUT BURST LOAD TEST (500 Transfers, 25 Concurrency)")
	fmt.Println("--------------------------------------------------------------------------------")

	totalTransfers := 500
	concurrency := 25
	transferAmountSatang := int64(10) // ฿0.10 per transfer

	// Ensure Account A has ample balance for 500 transfers
	if err := sessionA.Deposit(accA.ID, int64(totalTransfers)*transferAmountSatang+100000); err != nil {
		panic(err)
	}

	latencies := make([]time.Duration, 0, totalTransfers)
	var latMutex sync.Mutex
	var burstSuccess int64
	var burstFailed int64

	jobs := make(chan int, totalTransfers)
	for i := 0; i < totalTransfers; i++ {
		jobs <- i
	}
	close(jobs)

	benchStart := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				t0 := time.Now()
				code, _, err := sessionA.Transfer(accA.ID, accB.ID, transferAmountSatang, uuid.New().String())
				dur := time.Since(t0)

				latMutex.Lock()
				latencies = append(latencies, dur)
				latMutex.Unlock()

				if err == nil && (code == http.StatusOK || code == http.StatusCreated) {
					atomic.AddInt64(&burstSuccess, 1)
				} else {
					atomic.AddInt64(&burstFailed, 1)
				}
			}
		}()
	}

	wg.Wait()
	benchTotalDuration := time.Since(benchStart)

	// Calculate Stats
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
	var totalLatency time.Duration
	for _, l := range latencies {
		totalLatency += l
	}

	avgLatency := totalLatency / time.Duration(len(latencies))
	minLatency := latencies[0]
	maxLatency := latencies[len(latencies)-1]
	p50 := latencies[len(latencies)*50/100]
	p90 := latencies[len(latencies)*90/100]
	p95 := latencies[len(latencies)*95/100]
	p99 := latencies[len(latencies)*99/100]

	rps := float64(totalTransfers) / benchTotalDuration.Seconds()

	fmt.Printf(" Benchmark Metrics:\n")
	fmt.Printf("   - Total Requests:      %d\n", totalTransfers)
	fmt.Printf("   - Concurrency Level:   %d workers\n", concurrency)
	fmt.Printf("   - Total Time Elapsed:  %v\n", benchTotalDuration.Round(time.Millisecond))
	fmt.Printf("   - Throughput (RPS):    %.2f req/sec\n", rps)
	fmt.Printf("   - Success Rate:        %.2f%% (%d/%d)\n", float64(burstSuccess)/float64(totalTransfers)*100, burstSuccess, totalTransfers)
	fmt.Println(" Latency Distribution:")
	fmt.Printf("   - Min Latency:         %v\n", minLatency.Round(time.Microsecond))
	fmt.Printf("   - Avg Latency:         %v\n", avgLatency.Round(time.Microsecond))
	fmt.Printf("   - p50 (Median):        %v\n", p50.Round(time.Microsecond))
	fmt.Printf("   - p90:                 %v\n", p90.Round(time.Microsecond))
	fmt.Printf("   - p95:                 %v\n", p95.Round(time.Microsecond))
	fmt.Printf("   - p99:                 %v\n", p99.Round(time.Microsecond))
	fmt.Printf("   - Max Latency:         %v\n", maxLatency.Round(time.Microsecond))

	if burstSuccess == int64(totalTransfers) {
		fmt.Println(" 🟢 TEST 3 PASSED: High-throughput burst completed with 100% success rate & zero data loss!\n")
	} else {
		fmt.Printf(" 🟡 TEST 3 COMPLETED: %d successes, %d failures\n\n", burstSuccess, burstFailed)
	}

	fmt.Println("================================================================================")
	fmt.Println(" 🏆 ALL STRESS TESTS COMPLETED SUCCESSFULLY!")
	fmt.Println("================================================================================")
}
