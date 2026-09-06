#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
echo '🚀 راه‌اندازی خودکار شیپورک'
command -v pkg >/dev/null || { echo '❌ این فایل را داخل Termux اجرا کنید.'; exit 1; }
if ! command -v node >/dev/null; then pkg update -y; pkg install nodejs-lts -y || pkg install nodejs -y; fi
npm install --no-audit --no-fund
if [ ! -f .env ]; then
  printf '🔑 توکن ربات را فقط یک بار وارد کنید: '; read -r TOKEN
  [ -n "$TOKEN" ] || { echo '❌ توکن خالی است.'; exit 1; }
  printf 'BOT_TOKEN=%s\n' "$TOKEN" > .env
  chmod 600 .env
else echo '✅ توکن قبلی موجود است.'; fi
npm test
echo '✅ تست خودکار موفق بود.'
echo '🚀 اجرای ربات...'
exec npm start
