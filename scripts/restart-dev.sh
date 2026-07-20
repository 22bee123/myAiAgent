#!/bin/bash
# Restart the Next.js dev server in a fully detached way.
cd /home/z/my-project

# Kill any existing dev server
pkill -f "next dev" 2>/dev/null
sleep 1

# Start fresh dev server, fully detached
nohup /home/z/my-project/node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo $DEV_PID > /home/z/my-project/.zscripts/dev.pid
disown $DEV_PID 2>/dev/null

# Wait for it to be ready (max 30s)
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200\|304"; then
    echo "Dev server ready after ${i}s (pid $DEV_PID)"
    exit 0
  fi
  sleep 1
done

echo "Dev server did not become ready in 30s"
exit 1
