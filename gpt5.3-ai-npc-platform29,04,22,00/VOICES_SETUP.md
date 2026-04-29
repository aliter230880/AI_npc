# Human-like Voices Setup

## Goal
Use more natural voices than browser default speech synthesis.

## Recommended path
Use Piper voices on backend and keep browser SpeechSynthesis only as fallback.

## 1) Download Piper voice models
Download Russian and English high-quality voices from official Piper releases or Hugging Face mirrors.

Suggested voice packs to test first:
- `ru_RU-ruslan-medium`
- `ru_RU-irina-medium`
- `en_US-lessac-medium`
- `en_US-amy-medium`

Each voice usually has 2 files:
- `voice_name.onnx`
- `voice_name.onnx.json`

## 2) Put voice files in backend storage
Create folder:

```bash
backend/voices/
```

Place all `.onnx` and `.onnx.json` files there.

## 3) Connect Piper service
Your Piper microservice should expose endpoint like:
- `POST /synthesize`

Request payload example:

```json
{
  "text": "Привет, это тест более живого голоса",
  "voice": "ru_RU-irina-medium",
  "speed": 1.0
}
```

Set env in `backend/.env`:

```bash
PIPER_URL=http://localhost:5002
```

## 4) STT for robust microphone support
Browser SpeechRecognition is unstable across browsers.
For production-like behavior, use faster-whisper service and set:

```bash
FASTER_WHISPER_URL=http://localhost:5001
```

Then switch frontend STT mode to `faster-whisper`.

## 5) How you can share voices with me
Yes, you can download voices and add them to the repo folder `backend/voices/`.
Then I can wire voice selector and backend mapping to those exact voices.