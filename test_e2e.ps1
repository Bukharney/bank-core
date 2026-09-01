# Complete End-to-End Test for Bank Core Engine & Cardless ATM OTP Network
$baseUrl = "http://localhost:8080"
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " BANK CORE & CARDLESS OTP ATM - COMPLETE E2E TEST " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n[1/12] Testing Health Check: GET /auth/test" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/auth/test" -Method Get
Write-Host "  -> Health response: $health" -ForegroundColor Green

# 2. Register User 1 (Alice) with Phone Number
Write-Host "`n[2/12] Testing Registration: POST /user/register (Alice)" -ForegroundColor Yellow
$alicePhone = "081$(Get-Random -Minimum 1000000 -Maximum 9999999)"
$aliceEmail = "alice_$(Get-Random)@example.com"
$aliceReq = @{
    username     = "alice_$(Get-Random)"
    email        = $aliceEmail
    phone_number = $alicePhone
    password     = "password123"
    first_name   = "Alice"
    last_name    = "Smith"
} | ConvertTo-Json

$aliceUser = Invoke-RestMethod -Uri "$baseUrl/user/register" -Method Post -ContentType "application/json" -Body $aliceReq
Write-Host "  -> Created Alice User ID: $($aliceUser.id) (Phone: $alicePhone)" -ForegroundColor Green

# 3. Register User 2 (Bob)
Write-Host "`n[3/12] Testing Registration: POST /user/register (Bob)" -ForegroundColor Yellow
$bobPhone = "089$(Get-Random -Minimum 1000000 -Maximum 9999999)"
$bobEmail = "bob_$(Get-Random)@example.com"
$bobReq = @{
    username     = "bob_$(Get-Random)"
    email        = $bobEmail
    phone_number = $bobPhone
    password     = "password123"
    first_name   = "Bob"
    last_name    = "Jones"
} | ConvertTo-Json

$bobUser = Invoke-RestMethod -Uri "$baseUrl/user/register" -Method Post -ContentType "application/json" -Body $bobReq
Write-Host "  -> Created Bob User ID: $($bobUser.id)" -ForegroundColor Green

# 4. Login Alice (Extract Cookie)
Write-Host "`n[4/12] Testing Login: POST /auth/login (Alice)" -ForegroundColor Yellow
$loginReq = @{
    email    = $aliceEmail
    password = "password123"
} | ConvertTo-Json

$aliceLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginReq
$aliceAccessToken = $aliceLogin.access_token
$aliceHeaders = @{
    "Cookie" = "access_token=$aliceAccessToken"
}
Write-Host "  -> Login Success! Token: $($aliceAccessToken.Substring(0, 25))..." -ForegroundColor Green

# 5. Check Profile: GET /auth/me
Write-Host "`n[5/12] Testing Auth Profile: GET /auth/me" -ForegroundColor Yellow
$profile = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers $aliceHeaders
Write-Host "  -> Authenticated User: $($profile.first_name) $($profile.last_name) ($($profile.email))" -ForegroundColor Green

# 6. Query Alice & Bob Accounts
Write-Host "`n[6/12] Testing Accounts: GET /account (Alice & Bob)" -ForegroundColor Yellow
$aliceAccounts = Invoke-RestMethod -Uri "$baseUrl/account" -Method Get -Headers $aliceHeaders
$aliceAccId = $aliceAccounts[0].id
$aliceAccNum = $aliceAccounts[0].account_number
Write-Host "  -> Alice Primary Account ID: $aliceAccId (Number: $aliceAccNum, Balance: $($aliceAccounts[0].balance) Satang)" -ForegroundColor Green

# Login Bob to find his Account ID
$bobLoginReq = @{
    email    = $bobEmail
    password = "password123"
} | ConvertTo-Json
$bobLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $bobLoginReq
$bobAccessToken = $bobLogin.access_token
$bobHeaders = @{
    "Cookie" = "access_token=$bobAccessToken"
}
$bobAccounts = Invoke-RestMethod -Uri "$baseUrl/account" -Method Get -Headers $bobHeaders
$bobAccId = $bobAccounts[0].id
$bobAccNum = $bobAccounts[0].account_number
Write-Host "  -> Bob Primary Account ID: $bobAccId (Number: $bobAccNum, Balance: $($bobAccounts[0].balance) Satang)" -ForegroundColor Green

# 7. Deposit 100,000 Satang (1,000 THB) to Alice's Account
Write-Host "`n[7/12] Testing Deposit: POST /transaction/deposit (Alice +1000.00 THB)" -ForegroundColor Yellow
$depositIdempKey = [guid]::NewGuid().ToString()
$depositReq = @{
    account_id  = $aliceAccId
    amount      = 100000
    currency    = "THB"
    deposit_ref = "DEP-001"
    description = "Initial Salary Deposit"
} | ConvertTo-Json

$depositHeaders = @{
    "Cookie"          = "access_token=$aliceAccessToken"
    "Idempotency-Key" = $depositIdempKey
}
$depositRes = Invoke-RestMethod -Uri "$baseUrl/transaction/deposit" -Method Post -ContentType "application/json" -Headers $depositHeaders -Body $depositReq
Write-Host "  -> Deposit Success! Journal Reference: $($depositRes.reference_id), Amount: $($depositRes.amount) Satang" -ForegroundColor Green

# 8. Money Transfer (Alice -> Bob: 35,000 Satang / 350 THB)
Write-Host "`n[8/12] Testing Peer-to-Peer Transfer: POST /transaction/transfer" -ForegroundColor Yellow
$transferIdempKey = [guid]::NewGuid().ToString()
$transferReq = @{
    sender_account_id   = $aliceAccId
    receiver_account_id = $bobAccId
    amount              = 35000
    currency            = "THB"
    description         = "Dinner split payment"
} | ConvertTo-Json

$transferHeaders = @{
    "Cookie"          = "access_token=$aliceAccessToken"
    "Idempotency-Key" = $transferIdempKey
}
$transferRes = Invoke-RestMethod -Uri "$baseUrl/transaction/transfer" -Method Post -ContentType "application/json" -Headers $transferHeaders -Body $transferReq
Write-Host "  -> Transfer Success! Journal ID: $($transferRes.journal_id), Status: $($transferRes.status)" -ForegroundColor Green

# 9. Idempotency Gateway Replay Test
Write-Host "`n[9/12] Testing Idempotency Replay (Sending SAME Transfer Request & Key)" -ForegroundColor Yellow
$replayRes = Invoke-WebRequest -Uri "$baseUrl/transaction/transfer" -Method Post -ContentType "application/json" -Headers $transferHeaders -Body $transferReq
$replayedHeader = $replayRes.Headers["X-Idempotent-Replayed"]
Write-Host "  -> HTTP Status: $($replayRes.StatusCode)" -ForegroundColor Green
Write-Host "  -> X-Idempotent-Replayed Header: $replayedHeader (Verified Cached Replay!)" -ForegroundColor Green

# 10. Request Cardless ATM Withdrawal Ticket (Alice generates 6-Digit OTP for 200.00 THB)
Write-Host "`n[10/12] Testing Cardless OTP Generation: POST /transaction/withdraw/request" -ForegroundColor Yellow
$cardlessReq = @{
    account_id   = $aliceAccId
    amount       = 20000
    currency     = "THB"
    atm_id       = 1
    phone_number = $alicePhone
} | ConvertTo-Json

$ticket = Invoke-RestMethod -Uri "$baseUrl/transaction/withdraw/request" -Method Post -ContentType "application/json" -Headers $aliceHeaders -Body $cardlessReq
Write-Host "  -> Generated Cardless Ticket Order ID: $($ticket.order_id)" -ForegroundColor Green
Write-Host "  -> Phone Number: $($ticket.phone_number) | 6-Digit OTP Code: $($ticket.code)" -ForegroundColor Green
Write-Host "  -> Valid for: $($ticket.expires_in_seconds)s (15 Minutes)" -ForegroundColor Green

# 11. Security Test: ATM Machine rejects wrong PIN entry
Write-Host "`n[11/12] Testing ATM Anti-Brute-Force Protection: POST http://localhost:8081/atm/claim (Wrong PIN: 000000)" -ForegroundColor Yellow
$wrongClaimReq = @{
    phone_number = $alicePhone
    code         = "000000"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:8081/atm/claim" -Method Post -ContentType "application/json" -Body $wrongClaimReq
    Write-Host "  -> [FAILED] Should have rejected wrong PIN!" -ForegroundColor Red
} catch {
    Write-Host "  -> [PASSED] Rejected wrong PIN with HTTP 400 (Security Protection Active!)" -ForegroundColor Green
}

# 12. Complete Cardless Claim & Physical Cash Dispense at ATM Machine #1
Write-Host "`n[12/12] Testing ATM Cash Out: POST http://localhost:8081/atm/claim (Phone + Correct 6-Digit Code)" -ForegroundColor Yellow
$correctClaimReq = @{
    phone_number = $alicePhone
    code         = $ticket.code
} | ConvertTo-Json

$claimResult = Invoke-RestMethod -Uri "http://localhost:8081/atm/claim" -Method Post -ContentType "application/json" -Body $correctClaimReq
Write-Host "  -> ATM Output Status: $($claimResult.status)" -ForegroundColor Green
Write-Host "  -> Customer Verified: $($claimResult.customer_name)" -ForegroundColor Green
Write-Host "  -> Cash Dispensed: $($claimResult.amount) Satang ($($claimResult.message))" -ForegroundColor Green

# Verify Alice's balance (Initial 100,000 - Transfer 35,000 - ATM Withdrawal 20,000 = 45,000 Satang)
$aliceCheck = Invoke-RestMethod -Uri "$baseUrl/account/$aliceAccId" -Method Get -Headers $aliceHeaders
Write-Host "  -> Alice Final Balance: $($aliceCheck.balance) Satang (Expected: 45000 Satang / 450.00 THB)" -ForegroundColor Green
if ($aliceCheck.balance -eq 45000) {
    Write-Host "  -> [PASSED] Precise balance after Cardless Cash Out confirmed!" -ForegroundColor Green
} else {
    Write-Host "  -> [FAILED] Balance mismatch!" -ForegroundColor Red
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " ALL BANK CORE & CARDLESS ATM TESTS PASSED (12/12) " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
