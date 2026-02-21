#!/bin/bash
set -euo pipefail

# ============================================
# Codebase RAG Assistant — Deploy Script
# One-command deployment with Docker
# ============================================

APP_NAME="rag-assistant"
COMPOSE_FILE="docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions for logging
log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Trap interrupts for cleaner exit
trap "echo ''; warn 'Script interrupted.'; exit 1" SIGINT SIGTERM

# --- Pre-flight checks ---
log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || error "Docker is not installed. Install it: https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || error "Docker daemon is not running."

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  error "Docker Compose is not installed."
fi

success "Docker & Compose available"

# --- Parse arguments ---
ACTION="${1:-deploy}"

case "$ACTION" in
  deploy|up)
    log "Building and deploying ${APP_NAME}..."

    # Check for .env file
    if [ ! -f .env ]; then
        warn ".env file not found. Creating default..."
        echo "APP_PORT=3000" > .env
    fi

    $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
    success "Build complete"

    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    success "Containers started"

    # Wait for health check
    log "Waiting for health check..."
    MAX_RETRIES=30
    COUNT=0
    HEALTHY=false

    while [ $COUNT -lt $MAX_RETRIES ]; do
      STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$APP_NAME" 2>/dev/null || echo "not-found")
      
      if [ "$STATUS" == "healthy" ]; then
        HEALTHY=true
        break
      fi
      
      if [ "$STATUS" == "unhealthy" ]; then
        error "Container became unhealthy. Check logs: $0 logs"
      fi

      echo -n "."
      sleep 1
      COUNT=$((COUNT+1))
    done
    echo ""

    if [ "$HEALTHY" = true ]; then
        success "Application is healthy!"
    else
        error "Health check timed out after ${MAX_RETRIES}s."
    fi

    # Robust way to get port from .env
    PORT=$(grep "^APP_PORT=" .env | cut -d= -f2 || echo "3000")
    # Remove any potential carriage returns or spaces
    PORT=$(echo "$PORT" | tr -d '\r ' )

    echo ""
    success "Deployed successfully!"
    log "Access: ${GREEN}http://localhost:${PORT}${NC}"
    echo ""
    ;;

  stop|down)
    log "Stopping ${APP_NAME}..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down || warn "Failed to stop some containers, they might be already stopped."
    success "Stopped"
    ;;

  restart)
    log "Restarting ${APP_NAME}..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build
    success "Restarted"
    ;;

  logs)
    $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
    ;;

  status)
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps
    ;;

  clean)
    warn "Removing containers, images, and volumes..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down --rmi all --volumes --remove-orphans
    success "Cleaned"
    ;;

  *)
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  deploy   Build and start (default)"
    echo "  stop     Stop all containers"
    echo "  restart  Rebuild and restart"
    echo "  logs     Follow container logs"
    echo "  status   Show container status"
    echo "  clean    Remove everything"
    echo ""
    ;;
esac
