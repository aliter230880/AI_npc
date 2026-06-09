#!/bin/bash
# Безопасный деплой на VPS — не трогаем соседей
# Использование: bash SAFE_DEPLOY.sh

set -e  # выход при ошибке

echo "🚀 === SAFE DEPLOY: Google TTS + Emotions ==="
echo ""

# 1. Проверка что мы в правильной директории
if [ ! -d "/root/character-platform" ]; then
    echo "📁 Создаём /root/character-platform..."
    cd /root
    git clone https://github.com/aliter230880/AI_npc.git character-platform
    cd character-platform
else
    echo "✅ Директория /root/character-platform существует"
    cd /root/character-platform
fi

# 2. Backup текущей базы данных (если есть)
if [ -f "backend/character_platform.db" ]; then
    echo "💾 Backup базы данных..."
    cp backend/character_platform.db backend/character_platform.db.backup_$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup создан"
fi

# 3. Pull изменений из GitHub
echo "📥 Pull изменений из GitHub..."
git fetch origin
git reset --hard origin/main
echo "✅ Код обновлён"

# 4. Установка зависимостей
echo "📦 Установка зависимостей..."
cd backend

if [ ! -d ".venv" ]; then
    echo "🐍 Создаём virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "✅ Зависимости установлены"

# 5. Проверка .env файла
if [ ! -f ".env" ]; then
    echo "⚠️  Файл .env не найден! Создаём из .env.example..."
    cp .env.example .env
    echo ""
    echo "❗ ВАЖНО: Добавь API ключи в /root/character-platform/backend/.env"
    echo "   - OPENROUTER_API_KEY=..."
    echo "   - GOOGLE_TTS_API_KEY=AIzaSyAskP4AZB4mSStP96vak3HXE7Gapt4ZZw8"
    echo ""
fi

# Проверяем наличие Google TTS API Key
if ! grep -q "GOOGLE_TTS_API_KEY" .env; then
    echo "➕ Добавляем GOOGLE_TTS_API_KEY в .env..."
    echo "" >> .env
    echo "# Google Cloud TTS (added by deploy script)" >> .env
    echo "GOOGLE_TTS_API_KEY=AIzaSyAskP4AZB4mSStP96vak3HXE7Gapt4ZZw8" >> .env
    echo "✅ GOOGLE_TTS_API_KEY добавлен"
fi

# 6. Применение миграции базы данных
echo "🗄️  Проверка миграции базы данных..."
python3 -c "
import sqlite3
import sys

conn = sqlite3.connect('character_platform.db')
cursor = conn.cursor()

# Проверяем есть ли уже колонки emotion и action
cursor.execute('PRAGMA table_info(messages)')
columns = [col[1] for col in cursor.fetchall()]

if 'emotion' in columns and 'action' in columns:
    print('✅ Миграция уже применена (emotion и action существуют)')
    sys.exit(0)

# Применяем миграцию
try:
    cursor.execute('ALTER TABLE messages ADD COLUMN emotion VARCHAR(32)')
    cursor.execute('ALTER TABLE messages ADD COLUMN action VARCHAR(200)')
    conn.commit()
    print('✅ Миграция применена успешно')
except Exception as e:
    if 'duplicate column' in str(e).lower():
        print('✅ Колонки уже существуют')
    else:
        print(f'❌ Ошибка миграции: {e}')
        sys.exit(1)
finally:
    conn.close()
"

# 7. Пересборка фронтенда
echo "🎨 Пересборка frontend..."
cd ../web
npm install
npm run build
echo "✅ Frontend собран"

# 8. Проверка systemd сервиса
cd ..
echo "🔧 Проверка systemd сервиса..."

if [ ! -f "/etc/systemd/system/character-platform.service" ]; then
    echo "📝 Создаём systemd service..."
    sudo cp deploy/character-platform.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable character-platform
    echo "✅ Service создан и включен"
fi

# 9. Рестарт сервиса
echo "🔄 Рестарт character-platform service..."
sudo systemctl restart character-platform

# Ждём 3 секунды чтобы сервис успел запуститься
sleep 3

# 10. Проверка статуса
echo ""
echo "📊 Статус сервиса:"
sudo systemctl status character-platform --no-pager -l

# 11. Проверка что сервис слушает на порту
echo ""
echo "🔍 Проверка порта 8000..."
if netstat -tuln | grep -q ":8000"; then
    echo "✅ Сервис слушает на порту 8000"
else
    echo "⚠️  Порт 8000 не открыт! Проверь логи:"
    echo "   sudo journalctl -u character-platform -n 50 --no-pager"
fi

# 12. Тест API
echo ""
echo "🧪 Тест API endpoints..."

# Test voices endpoint
VOICES_COUNT=$(curl -s http://localhost:8000/voice/voices | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$VOICES_COUNT" -gt 0 ]; then
    echo "✅ /voice/voices работает ($VOICES_COUNT голосов)"
else
    echo "⚠️  /voice/voices не отвечает"
fi

# 13. Финальный статус
echo ""
echo "═════════════════════════════════════════"
echo "✅ DEPLOY ЗАВЕРШЁН"
echo "═════════════════════════════════════════"
echo ""
echo "🌐 Проверь сайт: https://ai.aliterra.space"
echo ""
echo "📋 Полезные команды:"
echo "   - Логи:    sudo journalctl -u character-platform -f"
echo "   - Рестарт: sudo systemctl restart character-platform"
echo "   - Статус:  sudo systemctl status character-platform"
echo ""
echo "⚠️  НЕ ЗАБУДЬ:"
echo "   1. Проверить что соседи работают (web3.aliterra.space, trade.aliterra.space)"
echo "   2. Ротировать Google API Key после публичного теста"
echo ""
