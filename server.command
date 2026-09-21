#!/bin/bash
# Переходим в директорию скрипта
cd "$(dirname "$0")"

echo "==================================================="
echo "  Truespace -- Event Finance Management"
echo "==================================================="
echo ""

# 1. Завершаем старые процессы на портах 3001 и 5173 (защита от дубликатов)
echo "[1/3] Checking and freeing ports 3001 and 5173..."
for PORT in 3001 5173; do
  PIDS=$(lsof -ti :$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "Freeing port $PORT (PID: $PIDS)..."
    kill -9 $PIDS 2>/dev/null
  fi
done

# 2. Проверяем наличие зависимостей
if [ ! -d "node_modules" ]; then
  echo "[2/3] Installing dependencies..."
  npm install
else
  echo "[2/3] Dependencies OK."
fi

# 3. Открываем браузер через 2 секунды в фоне
(sleep 2 && open "http://localhost:5173") &

# 4. Ловушка очистки портов при выходе (Ctrl+C или закрытие окна)
cleanup() {
  echo ""
  echo "Stopping server and freeing ports..."
  for PORT in 3001 5173; do
    PIDS=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
      kill -9 $PIDS 2>/dev/null
    fi
  done
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[3/3] Starting server..."
echo "==================================================="
echo " Server is running: http://localhost:5173"
echo " Press Ctrl + C or close this window to stop."
echo "==================================================="
echo ""

npm run dev
