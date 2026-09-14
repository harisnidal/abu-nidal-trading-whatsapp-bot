#!/usr/bin/env bash
# One-time setup script for a fresh Hostinger VPS (Ubuntu/Debian).
# Run as a normal sudo-capable user, NOT as root directly (it uses sudo
# where needed). Review each step before running on a production box.
#
# Usage: bash deploy/setup.sh yourdomain.com
set -euo pipefail

DOMAIN="${1:-}"
REPO_URL="https://github.com/harisnidal/abu-nidal-trading-whatsapp-bot.git"
APP_DIR="$HOME/abu-nidal-trading-whatsapp-bot"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash deploy/setup.sh yourdomain.com"
  exit 1
fi

echo "==> Installing Node.js 20.x"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing nginx and certbot"
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx git

echo "==> Cloning the repo into $APP_DIR"
if [ -d "$APP_DIR" ]; then
  echo "    $APP_DIR already exists, pulling latest instead"
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
npm ci
npm run build

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from template — EDIT IT NOW with your real values:"
  echo "    nano $APP_DIR/.env"
fi

echo "==> Installing systemd service"
sudo cp deploy/abu-nidal-bot.service /etc/systemd/system/abu-nidal-bot.service
sudo sed -i "s#/home/deploy/abu-nidal-trading-whatsapp-bot#$APP_DIR#g" /etc/systemd/system/abu-nidal-bot.service
sudo sed -i "s#User=deploy#User=$(whoami)#g" /etc/systemd/system/abu-nidal-bot.service
sudo systemctl daemon-reload
sudo systemctl enable abu-nidal-bot

echo "==> Configuring nginx for $DOMAIN"
sudo cp deploy/nginx.conf "/etc/nginx/sites-available/abu-nidal-bot"
sudo sed -i "s/YOUR_DOMAIN/$DOMAIN/g" "/etc/nginx/sites-available/abu-nidal-bot"
sudo ln -sf "/etc/nginx/sites-available/abu-nidal-bot" /etc/nginx/sites-enabled/abu-nidal-bot
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "==> Almost done. Remaining manual steps:"
echo "1. Point $DOMAIN's DNS A record at this server's IP (in Hostinger's DNS settings)."
echo "2. Edit $APP_DIR/.env with your real WhatsApp/Anthropic/dashboard values."
echo "3. Get an HTTPS certificate:"
echo "     sudo certbot --nginx -d $DOMAIN"
echo "4. Start the bot:"
echo "     sudo systemctl start abu-nidal-bot"
echo "     sudo systemctl status abu-nidal-bot"
echo "5. In Meta's WhatsApp webhook settings, set the callback URL to:"
echo "     https://$DOMAIN/webhook"
