import { Character, Message } from '../store/useStore';

// ─── DeepSeek API ──────────────────────────────────────────────────────────────
async function callDeepSeek(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 512,
      temperature: 0.85,
      stream: false,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DeepSeek API error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ─── Groq API ──────────────────────────────────────────────────────────────────
async function callGroq(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 512,
      temperature: 0.85,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ─── Main send message ─────────────────────────────────────────────────────────
export async function sendMessage(
  character: Character,
  history: Message[],
  userMessage: string,
  apiKeys: { deepseek: string; groq: string }
): Promise<string> {
  const systemMsg = { role: 'system', content: character.systemPrompt };

  const historyMsgs = history.slice(-12).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const messages = [systemMsg, ...historyMsgs, { role: 'user', content: userMessage }];

  // Try primary model, fallback to the other
  const model = character.model;

  if (model === 'deepseek' && apiKeys.deepseek) {
    try {
      return await callDeepSeek(messages, apiKeys.deepseek);
    } catch (e) {
      console.warn('DeepSeek failed, trying Groq...', e);
      if (apiKeys.groq) return await callGroq(messages, apiKeys.groq);
    }
  }

  if (model === 'groq' && apiKeys.groq) {
    try {
      return await callGroq(messages, apiKeys.groq);
    } catch (e) {
      console.warn('Groq failed, trying DeepSeek...', e);
      if (apiKeys.deepseek) return await callDeepSeek(messages, apiKeys.deepseek);
    }
  }

  // If no API keys — demo mode
  return getDemoResponse(character, userMessage);
}

// ─── Demo responses (no API key) ──────────────────────────────────────────────
function getDemoResponse(character: Character, _userMessage: string): string {
  const demos: Record<string, string[]> = {
    '1': [
      'Слова — это хорошо, но только меч в руке решает исход битвы. Что тебя привело ко мне, воин?',
      'Я прошёл двести боёв на арене. Каждый учил меня одному: побеждает тот, кто не боится проиграть.',
      'Настоящая сила — не в мышцах. Она — в голове. Думай быстро, двигайся ещё быстрее.',
    ],
    '2': [
      'Звёзды нашептали мне о твоём приходе... Садись, путник. Какую тайну ты ищешь в этом мире?',
      'За три тысячи лет я видела, как рождаются и гибнут королевства. Всё проходит — только мудрость вечна.',
      'Природа знает больше, чем любая книга. Слушай ветер, читай воду, и ответ придёт сам.',
    ],
    '3': [
      'NEXUS-7 онлайн. Обработка запроса... Интересно. В 2157 году этот вопрос решили совсем иначе.',
      'Мои алгоритмы зафиксировали 99.7% вероятность того, что ты ищешь информацию. Уточни параметры.',
      'Логика — единственный инструмент, которому я доверяю. Давай рассмотрим задачу системно.',
    ],
    '4': [
      'Я слышу тебя. Расскажи мне больше — что ты чувствуешь прямо сейчас?',
      'Это очень важно, что ты поделился этим. Как давно ты замечаешь это в себе?',
      'Каждый из нас несёт своё. Главное — не нести в одиночку. Я здесь, и мы разберёмся вместе.',
    ],
    '5': [
      'Йо-хо-хо! Что за ветер занёс тебя на мой корабль? Говори живее, у меня ром стынет!',
      'Я видел шторма, что топили целые флоты! Но ничто не страшнее скуки в тихую погоду, ха!',
      'Свобода — вот настоящее сокровище, друг мой. Золото кончается, а горизонт всегда впереди!',
    ],
    '6': [
      'Ты пришёл с вопросом. Это уже мудрость. Сидящий в тишине слышит больше, чем говорящий.',
      'Вода не борется с камнем. Она обтекает его. Вот урок терпения для тебя.',
      'Путь в тысячу ли начинается с одного шага. Не спрашивай, далеко ли — просто иди.',
    ],
    '7': [
      'О, отличный вопрос! Знаешь, квантовая механика говорит нам, что реальность гораздо страннее, чем мы думаем...',
      'По последним данным из ЦЕРН — это абсолютно потрясающая область! Давай разберём по шагам.',
      'Факты — моё всё. И вот факт: то, что ты спрашиваешь, напрямую связано с открытием 2019 года!',
    ],
    '8': [
      'Хм... Элементарно, мой друг. Уже по трём деталям вашего вопроса я вижу суть проблемы.',
      'Дедукция — это не магия. Это — внимание к деталям, которые все видят, но никто не замечает.',
      'Позвольте задать вам встречный вопрос, сэр. Ответ на него прояснит всё.',
    ],
  };

  const responses = demos[character.id] || [
    `Привет! Я ${character.name}. Это демо-режим — добавь API ключ в настройках для полноценного общения.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ─── Edge TTS (Microsoft) ──────────────────────────────────────────────────────
// Edge TTS работает через браузерный Speech Synthesis API (бесплатно)
export function speakText(text: string, voiceName: string = 'ru-RU-SvetlanaNeural'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.name.includes(voiceName)) ||
      voices.find((v) => v.lang.startsWith('ru')) ||
      voices[0];

    if (voice) utterance.voice = voice;
    utterance.lang = 'ru-RU';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ─── STT — Web Speech API (бесплатно) ─────────────────────────────────────────
export function startRecognition(
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (err: string) => void
): any {
  const SpeechRec =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    onError('Распознавание речи не поддерживается в этом браузере');
    return null;
  }

  const recognition = new SpeechRec();
  recognition.lang = 'ru-RU';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };
  recognition.onend = onEnd;
  recognition.onerror = (event: any) => {
    onError(event.error);
  };

  recognition.start();
  return recognition;
}
