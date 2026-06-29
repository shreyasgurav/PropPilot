#!/bin/bash
# ============================================================
# PropPilot — OpenWA VPS Setup Script
# Run this on a fresh Ubuntu 22.04+ VPS (Oracle Cloud, etc.)
# Usage: bash setup-openwa.sh
# ============================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 PropPilot — OpenWA VPS Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Update system
echo ""
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
echo ""
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed!"
else
    echo "✅ Docker already installed."
fi

# 3. Install Docker Compose
echo ""
echo "🔧 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    sudo apt install -y docker-compose-plugin
    echo "✅ Docker Compose installed!"
else
    echo "✅ Docker Compose already installed."
fi

# 4. Create project directory
echo ""
echo "📁 Setting up project directory..."
mkdir -p ~/openwa
cd ~/openwa

# 5. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: "3.8"

services:
  openwa:
    image: openwa/openwa:latest
    container_name: openwa
    restart: always
    ports:
      - "2785:3000"
    volumes:
      - openwa_data:/app/data
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  openwa_data:
    driver: local
EOF

echo "✅ docker-compose.yml created!"

# 6. Pull and start OpenWA
echo ""
echo "🔄 Pulling OpenWA Docker image..."
sudo docker compose pull

echo ""
echo "🟢 Starting OpenWA..."
sudo docker compose up -d

# 7. Wait for startup
echo ""
echo "⏳ Waiting for OpenWA to start..."
sleep 10

# 8. Get the API key
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✅ OpenWA is running!"
echo ""
echo "  🔑 Your API Key:"
sudo docker exec openwa cat /app/data/.api-key 2>/dev/null || echo "  (Check logs: sudo docker compose logs openwa)"
echo ""
echo "  🌐 Server URL: http://$(curl -s ifconfig.me):2785"
echo ""
echo "  📋 Next steps:"
echo "  1. Copy the API key above"
echo "  2. Update OPENWA_BASE_URL and OPENWA_API_KEY in Vercel"
echo "  3. Redeploy Vercel"
echo "  4. Scan QR code on PropPilot dashboard"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 9. Open firewall port
echo ""
echo "🔥 Opening port 2785 in firewall..."
sudo iptables -I INPUT -p tcp --dport 2785 -j ACCEPT
sudo apt install -y iptables-persistent 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true
echo "✅ Port 2785 opened!"

echo ""
echo "🎉 Setup complete! OpenWA is running on port 2785."
