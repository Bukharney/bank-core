#!/usr/bin/env bash
# ==============================================================================
# Bank Core - Production Deployment Script (Linux ARM / Podman Compose)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
ENV_FILE="${SCRIPT_DIR}/.env.prod"

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# 1. Verify Podman installation
if ! command -v podman &>/dev/null; then
    log_error "Podman is not installed on this system. Please install podman first."
    exit 1
fi

# 2. Determine compose command ('podman compose' vs 'podman-compose')
if podman compose version &>/dev/null; then
    COMPOSE_CMD="podman compose"
elif command -v podman-compose &>/dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v docker &>/dev/null && docker compose version &>/dev/null; then
    log_warn "Neither 'podman compose' nor 'podman-compose' found, falling back to 'docker compose'."
    COMPOSE_CMD="docker compose"
else
    log_error "No podman compose provider found! Please install 'podman-compose' or docker-compose-plugin."
    exit 1
fi

# 3. Check for .env.prod
check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Missing configuration file: ${ENV_FILE}"
        if [[ -f "${SCRIPT_DIR}/.env.prod.example" ]]; then
            log_warn "Create it now from the template:"
            echo "  cp ${SCRIPT_DIR}/.env.prod.example ${ENV_FILE}"
            echo "  nano ${ENV_FILE}"
        fi
        exit 1
    fi
}

cmd_pull() {
    check_env_file
    log_info "Pulling latest container images from GHCR via ${COMPOSE_CMD}..."
    ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull
    log_success "All images pulled successfully."
}

cmd_up() {
    check_env_file
    log_info "Starting Bank Core production stack..."
    ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
    log_success "Containers started."
    cmd_status
}

cmd_down() {
    check_env_file
    log_info "Stopping Bank Core production stack..."
    ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down
    log_success "All containers stopped."
}

cmd_restart() {
    check_env_file
    log_info "Restarting Bank Core stack..."
    cmd_down
    cmd_up
}

cmd_status() {
    log_info "Checking container status..."
    ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
}

cmd_logs() {
    local target_service="${1:-}"
    if [[ -n "$target_service" ]]; then
        ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs -f "$target_service"
    else
        ${COMPOSE_CMD} --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs -f
    fi
}

cmd_login() {
    log_info "Logging into GitHub Container Registry (ghcr.io)..."
    read -rp "GitHub Username: " gh_user
    read -rsp "Personal Access Token (with read:packages permission): " gh_pat
    echo
    echo "$gh_pat" | podman login ghcr.io -u "$gh_user" --password-stdin
    log_success "Logged in to ghcr.io successfully."
}

usage() {
    echo -e "${CYAN}Bank Core - Linux ARM Podman Deployment Utility${NC}"
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  up         - Start production containers in detached mode"
    echo "  down       - Stop and remove production containers"
    echo "  pull       - Pull latest images from GitHub Container Registry"
    echo "  restart    - Restart all production containers"
    echo "  status     - Show running containers and health state"
    echo "  logs [svc] - Follow logs (e.g. ./deploy.sh logs backend)"
    echo "  login      - Authenticate Podman with ghcr.io using a PAT"
    echo "  help       - Show this help message"
}

# Main command router
ACTION="${1:-help}"
case "$ACTION" in
    up)
        cmd_up
        ;;
    down)
        cmd_down
        ;;
    pull)
        cmd_pull
        ;;
    restart)
        cmd_restart
        ;;
    status|ps)
        cmd_status
        ;;
    logs)
        cmd_logs "${2:-}"
        ;;
    login)
        cmd_login
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $ACTION"
        usage
        exit 1
        ;;
esac
