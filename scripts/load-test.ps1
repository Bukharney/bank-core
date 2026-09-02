param (
    [ValidateSet("deposit", "transfer", "atm", "spike", "all")]
    [string]$Scenario = "deposit"
)

$scriptMap = @{
    "deposit"  = "/scripts/01-concurrent-deposits.js"
    "transfer" = "/scripts/02-transfer-deadlock.js"
    "atm"      = "/scripts/03-atm-withdrawal.js"
    "spike"    = "/scripts/04-full-spike-test.js"
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Bank Core k6 Load Testing Suite" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Grafana Dashboard: http://localhost:3001/d/bank-core-k6-loadtest/k6-load-testing-and-stress-performance" -ForegroundColor Yellow
Write-Host ""

if ($Scenario -eq "all") {
    $scenarios = @("deposit", "transfer", "atm", "spike")
    foreach ($key in $scenarios) {
        $targetScript = $scriptMap[$key]
        Write-Host "[RUNNING] Scenario: $key ($targetScript)" -ForegroundColor Green
        docker compose run --rm k6 run -o experimental-prometheus-rw $targetScript
        Write-Host "[DONE] Scenario $key completed" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
} else {
    $targetScript = $scriptMap[$Scenario]
    Write-Host "[RUNNING] Scenario: $Scenario ($targetScript)" -ForegroundColor Green
    docker compose run --rm k6 run -o experimental-prometheus-rw $targetScript
}
