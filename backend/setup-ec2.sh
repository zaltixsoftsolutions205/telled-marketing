#!/bin/bash
# =============================================================================
# EC2 Initial Setup Script — Telled CRM Backend
# Run this ONCE on a fresh Amazon Linux 2023 / Ubuntu 22.04 EC2 instance
# Usage: chmod +x setup-ec2.sh && sudo ./setup-ec2.sh
# =============================================================================

set -e

echo "=========================================="
echo "  Telled CRM — EC2 Server Setup"
echo "=========================================="

# ─── 1. System update ─────────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "$ID" == "amzn" ]; then
    yum update -y
    INSTALL_CMD="yum install -y"
    PKG_GIT="git"
  else
    apt-get update -y && apt-get upgrade -y
    INSTALL_CMD="apt-get install -y"
    PKG_GIT="git"
  fi
fi

# ─── 2. Install Docker ────────────────────────────────────────────────────────
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  # Add ec2-user or ubuntu to docker group (no sudo needed)
  usermod -aG docker ec2-user 2>/dev/null || usermod -aG docker ubuntu 2>/dev/null || true
  echo "Docker installed: $(docker --version)"
else
  echo "Docker already installed: $(docker --version)"
fi

# ─── 3. Install Docker Compose ────────────────────────────────────────────────
echo "[3/8] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  COMPOSE_VERSION="2.24.6"
  curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "Docker Compose installed: $(docker-compose --version)"
else
  echo "Docker Compose already installed: $(docker-compose --version)"
fi

# ─── 4. Install AWS CLI ───────────────────────────────────────────────────────
echo "[4/8] Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  ./aws/install
  rm -rf aws awscliv2.zip
  echo "AWS CLI installed: $(aws --version)"
else
  echo "AWS CLI already installed: $(aws --version)"
fi

# ─── 5. Install Git ───────────────────────────────────────────────────────────
echo "[5/8] Installing Git..."
$INSTALL_CMD $PKG_GIT
echo "Git installed: $(git --version)"

# ─── 6. Clone repository ──────────────────────────────────────────────────────
echo "[6/8] Cloning repository..."
APP_DIR="/home/ubuntu/telled-marketing"
if [ ! -d "$APP_DIR" ]; then
  # Replace with your actual GitHub repo URL
  git clone https://github.com/YOUR_USERNAME/telled-marketing.git "$APP_DIR"
  echo "Repository cloned to $APP_DIR"
else
  echo "Repository already exists at $APP_DIR"
fi

# ─── 7. Create .env file ──────────────────────────────────────────────────────
echo "[7/8] Setting up .env..."
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'ENVFILE'
NODE_ENV=production
PORT=5000

# ── MongoDB ──────────────────────────────────
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/telled-crm?retryWrites=true&w=majority

# ── JWT ──────────────────────────────────────
JWT_ACCESS_SECRET=CHANGE_THIS_TO_STRONG_SECRET_MIN_32_CHARS
JWT_REFRESH_SECRET=CHANGE_THIS_TO_ANOTHER_STRONG_SECRET_MIN_32_CHARS
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── Frontend URL (your domain) ───────────────
FRONTEND_URL=https://yourdomain.com

# ── SMTP (Hostinger) ─────────────────────────
USER_SMTP_HOST=smtp.hostinger.com
USER_SMTP_PORT=465
USER_SMTP_USER=YOUR_EMAIL@yourdomain.com
USER_SMTP_PASS=YOUR_SMTP_PASSWORD
USER_EMAIL_FROM=YOUR_EMAIL@yourdomain.com

# ── SMTP (Gmail) ─────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=YOUR_GMAIL@gmail.com
SMTP_PASS=YOUR_APP_PASSWORD
EMAIL_FROM=YOUR_GMAIL@gmail.com
EMAIL_FROM_NAME=Telled CRM

# ── Upstash Redis ────────────────────────────
UPSTASH_REDIS_REST_URL=https://YOUR_UPSTASH_URL.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN

# ── Cloudinary (file uploads) ────────────────
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET

# ── Admin Config ─────────────────────────────
ALLOWED_ADMIN_EMAILS=admin@yourdomain.com
ALLOWED_DOMAINS=yourdomain.com
OTP_EXPIRE_MINUTES=5
ENVFILE

  chmod 600 "$ENV_FILE"
  echo ".env created at $ENV_FILE — EDIT IT BEFORE STARTING THE APP"
else
  echo ".env already exists at $ENV_FILE"
fi

# ─── 8. Create nginx certs directory ─────────────────────────────────────────
echo "[8/8] Creating nginx SSL directory..."
mkdir -p "$APP_DIR/backend/nginx/certs"
mkdir -p "$APP_DIR/backend/nginx/logs"

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo "1. Edit your .env file:"
echo "   nano $ENV_FILE"
echo ""
echo "2. Add SSL certificates to:"
echo "   $APP_DIR/backend/nginx/certs/fullchain.pem"
echo "   $APP_DIR/backend/nginx/certs/privkey.pem"
echo ""
echo "3. Update nginx.conf with your domain:"
echo "   nano $APP_DIR/backend/nginx/nginx.conf"
echo "   (replace api.yourdomain.com with your actual domain)"
echo ""
echo "4. Log into ECR and start the app:"
echo "   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin YOUR_ECR_URI"
echo "   cd $APP_DIR/backend"
echo "   docker-compose up -d"
echo ""
echo "5. Check status:"
echo "   docker ps"
echo "   docker logs telled-backend"
echo ""
