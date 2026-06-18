#!/bin/bash

# Exit on error
set -e

# Clear screen and show header
clear || true
echo -e "\033[1;32m"
echo "=========================================================="
echo "    OMNIPLAYER: SPOTIFY CLONE - OMNITRIX EDITION          "
echo "=========================================================="
echo -e "\033[0m"

# Ensure downloads directory exists
mkdir -p /home/edu/Dev/Omniplayer/downloads

# Check if local ffmpeg is present
if [ ! -f "/home/edu/Dev/Omniplayer/bin/ffmpeg" ]; then
    echo -e "\033[1;31m[ERROR]\033[0m Local ffmpeg static build was not found in ./bin."
    exit 1
fi

# Port checking helper function
check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
    return 0 # Port is in use
  else
    return 1 # Port is free
  fi
}

# Ensure ports are free
for port in 8000 3000 5173; do
  if check_port $port; then
    echo -e "\033[1;33m[ADVERTENCIA]\033[0m El puerto $port ya está en uso. Puede causar conflictos."
  fi
done

# Cleanup processes on exit
cleanup() {
    echo -e "\n\033[1;33mDeteniendo servicios en ejecución...\033[0m"
    kill $PYTHON_PID $HONO_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "\033[1;32m¡Todos los servicios detenidos correctamente! ¡Hasta la próxima, Ben!\033[0m"
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python FastAPI Microservice (Downloader API)
echo -e "\033[1;34m[1/3]\033[0m Iniciando microservicio de descargas de YouTube (Python FastAPI, Puerto 8000)..."
cd /home/edu/Dev/Omniplayer/backend-python
./venv/bin/python main.py > python_service.log 2>&1 &
PYTHON_PID=$!

# Wait for Python service to start
sleep 2

# 2. Start Hono Node Server (Main API gateway and audio host)
echo -e "\033[1;34m[2/3]\033[0m Iniciando servidor principal Hono (Node.js, Puerto 3000)..."
cd /home/edu/Dev/Omniplayer/backend-hono
npm run dev > hono_server.log 2>&1 &
HONO_PID=$!

# Wait for Hono to start
sleep 2

# 3. Start Vite React Frontend
echo -e "\033[1;34m[3/3]\033[0m Iniciando interfaz de usuario (React/Vite, Puerto 5173)..."
cd /home/edu/Dev/Omniplayer/frontend
npm run dev -- --host 0.0.0.0 > frontend_vite.log 2>&1 &
FRONTEND_PID=$!

echo -e "\033[1;32m"
echo "=========================================================="
echo "    ¡TODO LISTO! ACCEDE EN TU NAVEGADOR:                  "
echo "    -> http://localhost:5173                             "
echo "=========================================================="
echo -e "\033[0m"
echo "Logs de salida creados en archivos locales (.log)"
echo "Presiona [Ctrl+C] para apagar todos los servidores."

# Block and keep script running
wait
