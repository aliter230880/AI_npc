# Google Cloud Text-to-Speech Setup

## Почему Google TTS?

✅ **1 млн символов/мес бесплатно** (Neural2/WaveNet премиум голоса)  
✅ **Качество 4.5/5** (сопоставимо с ElevenLabs)  
✅ **Стабильно**, не блокируют (в отличие от Edge TTS)  
✅ **220+ голосов**, 40+ языков  
✅ **SSML для эмоций** (pitch, rate, volume)

**Расчёт:** 1 млн символов = ~5000 сообщений персонажа бесплатно/месяц  
**После лимита:** $16 за доп. 1 млн = $0.016/1k символов (дёшево!)

---

## Шаг 1: Создать Google Cloud проект (5 минут)

### 1.1 Зарегистрироваться в Google Cloud

1. Перейти на https://console.cloud.google.com
2. Войти с Google аккаунтом
3. Согласиться с Terms of Service
4. (Опционально) Добавить платёжный метод для использования после free tier
   - **Но:** бесплатный tier работает без карты, просто не сможете превысить лимит

### 1.2 Создать новый проект

1. В верхнем меню нажать на выпадающий список проектов
2. Нажать **"New Project"**
3. Название: `character-platform-tts` (или любое)
4. Location: оставить как есть (No organization)
5. Нажать **Create**

---

## Шаг 2: Включить Text-to-Speech API

1. В боковом меню → **APIs & Services** → **Library**
2. Поиск: `Text-to-Speech API`
3. Кликнуть на **Cloud Text-to-Speech API**
4. Нажать **Enable**
5. Подождать 1-2 минуты пока API активируется

---

## Шаг 3: Создать Service Account и ключ

### 3.1 Создать Service Account

1. В боковом меню → **IAM & Admin** → **Service Accounts**
2. Нажать **+ Create Service Account**
3. Заполнить:
   - **Service account name**: `character-platform-tts`
   - **Service account ID**: автоматически `character-platform-tts@...`
   - **Description**: `TTS API access for character platform`
4. Нажать **Create and Continue**

### 3.2 Назначить роль

1. В разделе **Grant this service account access to project**
2. В поле **Role** выбрать: **Cloud Text-to-Speech Admin** (или **Cloud Text-to-Speech User**)
3. Нажать **Continue**
4. Нажать **Done**

### 3.3 Создать JSON ключ

1. В списке Service Accounts найти только что созданный
2. Кликнуть на email адрес service account
3. Перейти на вкладку **Keys**
4. Нажать **Add Key** → **Create new key**
5. Выбрать тип: **JSON**
6. Нажать **Create**
7. Файл `character-platform-tts-xxxxx.json` автоматически скачается

⚠️ **ВАЖНО:** Сохраните этот файл в безопасном месте! Его нельзя скачать повторно.

---

## Шаг 4: Настроить проект

### Вариант A: Service Account JSON файл (рекомендуется для локальной разработки)

```bash
# Скопировать JSON в безопасное место
cp ~/Downloads/character-platform-tts-xxxxx.json e:/AI/AI_folder/character-platform/backend/google-tts-key.json

# Добавить в .gitignore
echo "google-tts-key.json" >> .gitignore
```

В `.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=./google-tts-key.json
```

### Вариант B: Inline JSON (удобно для VPS)

Открыть скачанный JSON файл, скопировать всё содержимое (это одна строка).

В `.env`:
```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"character-platform-tts-xxxxx","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"character-platform-tts@....iam.gserviceaccount.com",...}
```

---

## Шаг 5: Установить зависимости

```bash
cd e:\AI\AI_folder\character-platform\backend
pip install google-cloud-texttospeech==2.17.2
```

---

## Шаг 6: Тест

Создать файл `test_google_tts.py`:

```python
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.voice.google_provider import (
    GOOGLE_TTS_AVAILABLE,
    list_google_voices,
    resolve_google_voice,
    synthesize_google_wav,
)


async def main():
    print(f"Google TTS available: {GOOGLE_TTS_AVAILABLE}")
    if not GOOGLE_TTS_AVAILABLE:
        print("google-cloud-texttospeech not installed")
        return
    
    print("\n=== Available Google voices ===")
    voices = list_google_voices()
    for v in voices:
        print(f"  {v.id:35s} {v.language} {v.gender:6s} {v.voice_type:10s} {v.name}")
    
    print("\n=== Testing English Neural2 ===")
    voice = resolve_google_voice("google_en_female_neural2_a", "en")
    if not voice:
        print("Voice not found!")
        return
    
    text = "Hello! This is a test of Google Cloud Text-to-Speech. It sounds amazing!"
    print(f"Synthesizing: {text}")
    
    try:
        audio = await synthesize_google_wav(text, voice, emotion="happy", cache_dir=Path("./test_cache"))
        print(f"✅ Success! Generated {len(audio)} bytes")
        Path("./test_google.mp3").write_bytes(audio)
        print("  Saved to test_google.mp3")
    except Exception as e:
        print(f"❌ Failed: {e}")
        print("\nCheck your credentials:")
        print("  1. GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON in .env")
        print("  2. Service account has 'Cloud Text-to-Speech User' role")
        print("  3. Text-to-Speech API is enabled in Google Cloud Console")


if __name__ == "__main__":
    asyncio.run(main())
```

Запустить:
```bash
python test_google_tts.py
```

Должно создаться `test_google.mp3` с озвучкой!

---

## Шаг 7: Деплой на VPS

### Вариант A: Service Account JSON

```bash
# Локально
cd e:\AI\AI_folder\character-platform\deploy

# Скопировать JSON на VPS
scpk.cmd ../backend/google-tts-key.json root@168.222.143.103:/opt/character-platform/backend/

# SSH на VPS
sshk.cmd

# На VPS
cd /opt/character-platform/backend
nano .env
```

Добавить в `.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=/opt/character-platform/backend/google-tts-key.json
```

### Вариант B: Inline JSON (проще, рекомендуется)

```bash
# Локально: скопировать содержимое JSON в буфер обмена
cat e:\AI\AI_folder\character-platform\backend\google-tts-key.json

# SSH на VPS
sshk.cmd

# На VPS
cd /opt/character-platform/backend
nano .env
```

Добавить в `.env` (вставить скопированный JSON):
```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...целиком JSON...}
```

### Установить библиотеку на VPS

```bash
cd /opt/character-platform/backend
source venv/bin/activate  # если есть venv
pip install google-cloud-texttospeech==2.17.2
```

### Рестарт сервиса

```bash
systemctl restart character-platform
systemctl status character-platform

# Проверка логов
journalctl -u character-platform -n 50
```

### Тест

```bash
# Список голосов (должны быть google_*)
curl http://127.0.0.1:8001/api/voice/voices | jq

# TTS тест
curl "http://127.0.0.1:8001/api/voice/tts?text=Hello%20world&emotion=happy" --output test.mp3
```

---

## Troubleshooting

### ❌ "Google TTS credentials not found"

**Проблема:** Не нашёл credentials

**Решение:**
1. Проверить что `.env` содержит `GOOGLE_APPLICATION_CREDENTIALS` или `GOOGLE_SERVICE_ACCOUNT_JSON`
2. Проверить путь к файлу (должен быть абсолютный или относительный от backend/)
3. Перезапустить сервис: `systemctl restart character-platform`

### ❌ "Permission denied" или "Forbidden"

**Проблема:** Service account не имеет доступа

**Решение:**
1. В Google Cloud Console → IAM & Admin → IAM
2. Найти service account email
3. Проверить что есть роль **Cloud Text-to-Speech User** или **Admin**
4. Если нет — нажать Edit → Add Role → выбрать роль → Save

### ❌ "API not enabled"

**Проблема:** Text-to-Speech API не включен

**Решение:**
1. Google Cloud Console → APIs & Services → Library
2. Найти "Cloud Text-to-Speech API"
3. Нажать Enable
4. Подождать 1-2 минуты

### ❌ "Quota exceeded"

**Проблема:** Превышен лимит 1 млн символов/мес

**Решение:**
1. Проверить использование: Google Cloud Console → APIs & Services → Dashboard → Text-to-Speech API
2. Подождать начала следующего месяца (лимит обновится)
3. Или добавить платёжный метод для оплаты сверхлимита ($16/млн)
4. Fallback на Edge TTS или Piper сработает автоматически

---

## Мониторинг использования

1. Google Cloud Console → **APIs & Services** → **Dashboard**
2. Кликнуть на **Cloud Text-to-Speech API**
3. Посмотреть графики:
   - Requests per day
   - Characters per day
   - Errors

**Совет:** Настроить бюджет алерт:
- Billing → Budgets & alerts
- Create Budget → установить лимит $5-10/мес
- Получите email если расходы превысят порог

---

## Pricing (на 2026)

| Тип голоса | Free tier (ежемесячно) | После free tier |
|---|---|---|
| **Neural2** (премиум) | 1 млн символов | $16 / 1 млн |
| **WaveNet** (премиум) | 1 млн символов | $16 / 1 млн |
| **Standard** | 4 млн символов | $4 / 1 млн |

**Пример расчёта:**
- 1 сообщение персонажа ≈ 200 символов
- 1 млн символов = 5000 сообщений **бесплатно/месяц**
- 10k сообщений/месяц = 2 млн = 1 млн бесплатно + 1 млн платно = **$16/мес**

---

## Best Practices

✅ **Используйте кэш:** Повторные фразы не тратят quota (кэш в `/opt/character-platform/data/tts-cache`)  
✅ **Ограничьте длину:** max 5000 символов на запрос (автоматически обрезается)  
✅ **Мониторьте usage:** настройте budget alerts в Google Cloud  
✅ **Fallback работает:** если Google quota закончится — автоматически Edge TTS → Piper

---

## FAQ

**Q: Нужна ли кредитная карта?**  
A: Нет для free tier. Да если хотите автоматически платить сверх лимита.

**Q: Можно ли использовать без billing account?**  
A: Да! Free tier работает без billing. Просто не сможете превысить 1 млн/мес.

**Q: Безопасно ли хранить JSON ключ на VPS?**  
A: Относительно. Лучше использовать inline env var (`GOOGLE_SERVICE_ACCOUNT_JSON`), не хранить файл. Или ограничить права service account только на TTS.

**Q: Что если превышу лимит и нет карты?**  
A: Запросы будут отклоняться с ошибкой "quota exceeded". Fallback на Edge TTS сработает автоматически.

**Q: Работает ли в РФ?**  
A: Да! Google Cloud TTS доступен глобально (в отличие от Edge TTS, который блокирует РФ IP).

---

**Готово!** Теперь у вас премиум голоса с 1 млн символов бесплатно каждый месяц 🎉
