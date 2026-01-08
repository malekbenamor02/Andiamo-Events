#!/bin/bash
# ngrok Tunnel Starter for Andiamo Events
# This script starts ngrok tunnel for localhost:8082

echo "========================================"
echo "  Andiamo Events - ngrok Tunnel Setup"
echo "========================================"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "[ERROR] ngrok is not installed or not in PATH"
    echo ""
    echo "Please install ngrok:"
    echo "  1. Download from: https://ngrok.com/download"
    echo "  2. Or install via npm: npm install -g ngrok"
    echo "  3. Or install via Homebrew: brew install ngrok"
    echo ""
    exit 1
fi

echo "[INFO] Starting ngrok tunnel for localhost:8082..."
echo ""
echo "IMPORTANT:"
echo "  - Keep this terminal open while testing"
echo "  - Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "  - Set VITE_API_URL in Vercel environment variables"
echo "  - Redeploy preview after setting environment variable"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok
ngrok http 8082
