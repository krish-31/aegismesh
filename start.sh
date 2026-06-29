#!/bin/bash
# AegisMesh — Start Script

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         AEGISMESH NOC PLATFORM v1.0              ║"
echo "║   Self-Healing IoT Mesh Network Dashboard        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Start backend in background
echo "[1/2] Starting AegisMesh Backend (port 4000)..."
cd backend && node src/app.js &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start frontend
echo "[2/2] Starting AegisMesh Frontend (port 5173)..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Dashboard:  http://localhost:5173"
echo "  ✓ Backend:    http://localhost:4000"
echo "  ✓ Health:     http://localhost:4000/health"
echo "  ✓ API:        http://localhost:4000/api/topology"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press CTRL+C to stop all services"
echo ""

# Wait and handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'AegisMesh stopped.'" SIGINT SIGTERM
wait
