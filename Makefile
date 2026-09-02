.PHONY: up down dev dev-backend dev-atm dev-frontend test e2e clean

# Start all docker infrastructure
up:
	docker compose up -d

# Stop docker infrastructure
down:
	docker compose down

# Start backend with Air hot reload
dev-backend:
	cd backend && air

# Start ATM simulator
dev-atm:
	cd backend/atm && go run main.go

# Start Next.js frontend
dev-frontend:
	cd frontend && pnpm dev

# Run unit and integration tests
test:
	cd backend && go test ./internal/... -v

# Run complete End-to-End test suite
e2e:
	powershell -File ./test_e2e.ps1

# Clean temporary build artifacts
clean:
	rm -rf backend/tmp/ frontend/.next/
