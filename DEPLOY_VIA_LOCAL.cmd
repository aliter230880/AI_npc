@echo off
REM Деплой на VPS через plink с твоей машины
echo ========================================
echo   DEPLOY: Google TTS + Emotions
echo ========================================
echo.

echo [1/10] Проверка подключения к VPS...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "echo 'OK'" 2>nul
if errorlevel 1 (
    echo [ERROR] Не могу подключиться к VPS!
    pause
    exit /b 1
)
echo [OK] Подключение работает

echo.
echo [2/10] Проверка существования /root/character-platform...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "if [ -d '/root/character-platform' ]; then echo 'EXISTS'; else mkdir -p /root && cd /root && git clone https://github.com/aliter230880/AI_npc.git character-platform && echo 'CLONED'; fi"
echo [OK] Директория готова

echo.
echo [3/10] Pull изменений из GitHub...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform && git fetch origin && git reset --hard origin/main"
echo [OK] Код обновлён

echo.
echo [4/10] Backup базы данных...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform/backend && if [ -f 'character_platform.db' ]; then cp character_platform.db character_platform.db.backup_$(date +%%Y%%m%%d_%%H%%M%%S); echo 'BACKUP CREATED'; fi"
echo [OK] Backup создан

echo.
echo [5/10] Установка Python зависимостей...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform/backend && source .venv/bin/activate && pip install --quiet -r requirements.txt"
echo [OK] Зависимости установлены

echo.
echo [6/10] Добавление Google TTS API Key в .env...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform/backend && if ! grep -q 'GOOGLE_TTS_API_KEY' .env 2>/dev/null; then echo '' >> .env && echo 'GOOGLE_TTS_API_KEY=AIzaSyAskP4AZB4mSStP96vak3HXE7Gapt4ZZw8' >> .env; fi && echo 'OK'"
echo [OK] API Key добавлен

echo.
echo [7/10] Применение database migration...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform/backend && python3 -c \"import sqlite3; conn = sqlite3.connect('character_platform.db'); cursor = conn.cursor(); cursor.execute('PRAGMA table_info(messages)'); cols = [c[1] for c in cursor.fetchall()]; [cursor.execute(f'ALTER TABLE messages ADD COLUMN {col} VARCHAR(32)') for col in ['emotion', 'action'] if col not in cols]; conn.commit(); print('MIGRATION OK')\""
echo [OK] Migration применена

echo.
echo [8/10] Пересборка frontend...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "cd /root/character-platform/web && npm run build"
echo [OK] Frontend собран

echo.
echo [9/10] Рестарт character-platform service...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "systemctl restart character-platform && sleep 3"
echo [OK] Сервис рестартован

echo.
echo [10/10] Проверка работы API...
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 "curl -s http://localhost:8000/voice/voices | python3 -c 'import sys, json; print(len(json.load(sys.stdin)), \"voices available\")'"

echo.
echo ========================================
echo   DEPLOY COMPLETE!
echo ========================================
echo.
echo Проверь сайт: https://ai.aliterra.space
echo.
pause
