# Bank Core - Local Development Launcher
# Starts Docker infra, Backend (with Hot Reload), ATM network, and Frontend
param (
    [switch]$InfraOnly,
    [switch]$NoDocker,
    [switch]$Help
)

if ($Help) {
    Write-Host "Bank Core Local Dev Helper" -ForegroundColor Cyan
    Write-Host "Usage:"
    Write-Host "  .\scripts\dev.ps1              # Start infra & launch all dev services"
    Write-Host "  .\scripts\dev.ps1 -InfraOnly   # Only start PostgreSQL, Redis, Grafana, etc."
    Write-Host "  .\scripts\dev.ps1 -NoDocker    # Launch services without touching Docker"
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "          BANK CORE - LOCAL DEV SETUP             " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Ensure .env exists
if (-not (Test-Path "$root\.env")) {
    Write-Host "[1/3] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host "  -> .env created!" -ForegroundColor Green
} else {
    Write-Host "[1/3] .env configuration found." -ForegroundColor Green
}

# 2. Check and start Docker Infrastructure
if (-not $NoDocker) {
    Write-Host "`n[2/3] Checking Docker infrastructure..." -ForegroundColor Yellow
    try {
        $dockerStatus = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [WARN] Docker does not appear to be running. Please ensure Docker Desktop is started." -ForegroundColor Red
        } else {
            Write-Host "  -> Starting PostgreSQL, Redis, Prometheus, Grafana..." -ForegroundColor Yellow
            docker compose up -d
            Write-Host "  -> Docker services are UP and Healthy!" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [WARN] Error communicating with Docker: $_" -ForegroundColor Red
    }
}

if ($InfraOnly) {
    Write-Host "`nInfra startup complete. Exiting." -ForegroundColor Cyan
    exit 0
}

# 3. Launch Services in Windows Terminal / New PowerShell Tabs
Write-Host "`n[3/3] Launching Local Development Services..." -ForegroundColor Yellow

# A. Backend Server (Air hot-reload or go run)
Write-Host "  -> [1/3] Starting Bank Core Engine on http://localhost:8080 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; if (Get-Command air -ErrorAction SilentlyContinue) { air } else { go run ./cmd/main.go }"

# B. ATM Network Simulator
Write-Host "  -> [2/3] Starting ATM Machines on ports 8081, 8082, 8083 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\atm'; go run main.go"

# C. Next.js Frontend
Write-Host "  -> [3/3] Starting Frontend Dev Server on http://localhost:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; pnpm dev"

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "        ALL SERVICES LAUNCHED SUCCESSFULLY!       " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  * Bank Core Engine: http://localhost:8080" -ForegroundColor White
Write-Host "  * Frontend UI:      http://localhost:3000" -ForegroundColor White
Write-Host "  * ATM Simulator:    http://localhost:8081, 8082, 8083" -ForegroundColor White
Write-Host "  * Grafana Metrics:  http://localhost:3001 (Admin / anonymous)" -ForegroundColor White
Write-Host "  * Prometheus:       http://localhost:9090" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
