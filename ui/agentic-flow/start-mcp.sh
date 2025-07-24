#!/bin/bash

# Start script for Agentic Flow with MCP WebSocket server

echo "🚀 Starting Agentic Flow with MCP WebSocket Integration..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
fi

# Install additional dependencies if needed
echo -e "${BLUE}Checking dependencies...${NC}"
npm install --save ws chalk ora mocha chai

# Kill any existing processes on our ports
echo -e "${BLUE}Cleaning up existing processes...${NC}"
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3007 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start MCP WebSocket server
echo -e "${GREEN}Starting MCP WebSocket server on port 8080...${NC}"
node server/websocket-server.js &
MCP_PID=$!

# Wait for MCP server to start
sleep 2

# Verify MCP server is running
if lsof -i:8080 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP WebSocket server is running${NC}"
else
    echo -e "${RED}❌ Failed to start MCP WebSocket server${NC}"
    exit 1
fi

# Start backend services
echo -e "${GREEN}Starting backend services...${NC}"
npm run dev:backend &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start Vite dev server
echo -e "${GREEN}Starting Vite development server...${NC}"
npm run dev &
VITE_PID=$!

# Wait for all services to be ready
sleep 5

# Display status
echo -e "\n${GREEN}🎉 All services started successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}MCP WebSocket:${NC} http://localhost:8080"
echo -e "${GREEN}Backend API:${NC} http://localhost:3001"
echo -e "${GREEN}UI:${NC} http://localhost:5173"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down services...${NC}"
    kill $MCP_PID $BACKEND_PID $VITE_PID 2>/dev/null
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Run tool verification (optional)
read -p "Do you want to verify all 87 MCP tools? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Running tool verification...${NC}"
    node verify-tools.js
fi

# Keep script running
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"
wait