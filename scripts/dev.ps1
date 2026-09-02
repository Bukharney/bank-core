# Bank Core - 1-Command Local Dev Launcher (Runs in current IDE Terminal)
param (
    [switch]$Windows,
    [switch]$KeepDocker,
    [switch]$InfraOnly,
    [switch]$NoDocker,
    [switch]$Help
)

if ($Help) {
    Write-Host "Bank Core - Local Dev Launcher" -ForegroundColor Cyan
    Write-Host "Usage:"
    Write-Host "  .\scripts\dev.ps1              # Start Docker infra, stream all 3 services in IDE, and stop Docker on exit"
    Write-Host "  .\scripts\dev.ps1 -KeepDocker  # Keep Docker containers running after stopping dev services"
    Write-Host "  .\scripts\dev.ps1 -Windows     # Open services in separate pop-up windows instead"
    Write-Host "  .\scripts\dev.ps1 -InfraOnly   # Only start PostgreSQL, Redis, Prometheus, Grafana"
    Write-Host "  .\scripts\dev.ps1 -NoDocker    # Launch services without starting/stopping Docker"
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) {
    $root = (Get-Location).Path
}
Set-Location $root

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       BANK CORE - 1-COMMAND LOCAL DEV LAUNCH     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Ensure .env exists
if (-not (Test-Path "$root\.env")) {
    Write-Host "`n[1/3] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host "  -> .env created!" -ForegroundColor Green
} else {
    Write-Host "`n[1/3] .env configuration found." -ForegroundColor Green
}

# 2. Check and start Docker Infrastructure
if (-not $NoDocker) {
    Write-Host "`n[2/3] Starting Docker infrastructure (Postgres, Redis, Grafana)..." -ForegroundColor Yellow
    try {
        docker compose up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  -> Docker infrastructure is UP and running!" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Docker compose reported an issue. Please verify Docker Desktop is running." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARN] Could not reach Docker. Ensure Docker Desktop is active: $_" -ForegroundColor Yellow
    }
}

if ($InfraOnly) {
    Write-Host "`nInfra startup complete." -ForegroundColor Cyan
    exit 0
}

# 3. Launch Services
if ($Windows) {
    Write-Host "`n[3/3] Launching Application Services in Separate Windows..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; if (Get-Command air -ErrorAction SilentlyContinue) { air } else { go run ./cmd/main.go }"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\atm'; go run main.go"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; pnpm dev"
} else {
    Write-Host "`n[3/3] Streaming All Services in this IDE Terminal..." -ForegroundColor Yellow
    Write-Host "  * Bank Core Engine: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "  * ATM Simulator:    http://localhost:8081, :8082, :8083" -ForegroundColor Magenta
    Write-Host "  * Frontend UI:      http://localhost:3000" -ForegroundColor Green
    Write-Host "  * Press Ctrl+C anytime to stop all services & shutdown Docker.`n" -ForegroundColor DarkGray

    $backendCmd = if (Get-Command air -ErrorAction SilentlyContinue) { "cd backend && air" } else { "cd backend && go run ./cmd/main.go" }
    
    try {
        npx -y concurrently `
            --kill-others-on-fail `
            --prefix-colors "cyan.bold,magenta.bold,green.bold" `
            --names "CORE,ATM,WEB" `
            "$backendCmd" `
            "cd backend/atm && go run main.go" `
            "cd frontend && pnpm dev"
    } finally {
        if (-not $NoDocker -and -not $KeepDocker) {
            Write-Host "`n[Shutdown] Stopping Docker infrastructure..." -ForegroundColor Yellow
            docker compose down
            Write-Host "[Shutdown] Docker infrastructure stopped cleanly." -ForegroundColor Green
        }
    }
}
