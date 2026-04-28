import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, Zap, Globe, Shield, MessageCircle, Terminal } from 'lucide-react';

const endpoints = [
  {
    method: 'POST',
    path: '/v1/character/{id}/message',
    desc: 'Отправить текстовое сообщение персонажу',
    color: 'bg-green-900/40 text-green-400',
    request: `{
  "message": "Привет, как дела?",
  "session_id": "user_123",
  "language": "ru"
}`,
    response: `{
  "id": "msg_abc123",
  "character_id": "char_001",
  "text": "Приветствую, воин! Всё хорошо...",
  "emotion": "neutral",
  "action": null,
  "tokens_used": 128,
  "latency_ms": 340
}`,
  },
  {
    method: 'POST',
    path: '/v1/character/{id}/voice',
    desc: 'Отправить голосовое сообщение (аудио → текст → AI → аудио)',
    color: 'bg-blue-900/40 text-blue-400',
    request: `// Multipart form-data
{
  "audio": <audio_file.webm>,
  "session_id": "user_123",
  "return_audio": true
}`,
    response: `{
  "transcript": "Привет, как дела?",
  "text": "Приветствую, воин! Всё хорошо...",
  "audio_url": "https://api.example.com/audio/resp_xyz.mp3",
  "emotion": "happy",
  "duration_ms": 2400
}`,
  },
  {
    method: 'GET',
    path: '/v1/characters',
    desc: 'Получить список всех персонажей',
    color: 'bg-yellow-900/40 text-yellow-400',
    request: `// Query params
?category=fantasy&limit=20&offset=0`,
    response: `{
  "total": 42,
  "characters": [
    {
      "id": "char_001",
      "name": "Лира",
      "role": "Эльфийский маг",
      "avatar": "🧝‍♀️",
      "tags": ["Магия", "Мудрость"],
      "rating": 4.8,
      "is_online": true
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/v1/characters',
    desc: 'Создать нового персонажа через API',
    color: 'bg-purple-900/40 text-purple-400',
    request: `{
  "name": "Мой персонаж",
  "role": "Мастер меча",
  "description": "Легендарный воин...",
  "personality": ["Смелый", "Честный"],
  "backstory": "Родился в горах...",
  "model": "deepseek",
  "language": "ru",
  "system_prompt": "Ты — легендарный..."
}`,
    response: `{
  "id": "char_new123",
  "name": "Мой персонаж",
  "api_key": "char_sk_...",
  "created_at": "2025-01-01T00:00:00Z"
}`,
  },
  {
    method: 'WS',
    path: 'wss://api.example.com/v1/character/{id}/stream',
    desc: 'WebSocket для потокового общения в реальном времени',
    color: 'bg-orange-900/40 text-orange-400',
    request: `// Connect & send
ws.send(JSON.stringify({
  "type": "message",
  "content": "Привет!",
  "session_id": "user_123"
}))`,
    response: `// Streaming chunks
{ "type": "chunk", "text": "Привет" }
{ "type": "chunk", "text": ", воин" }
{ "type": "chunk", "text": "!" }
{ "type": "done", "emotion": "happy", "action": "wave" }`,
  },
];

const sdkExamples = {
  javascript: `import { NeuralCastClient } from '@neuralcast/sdk';

const client = new NeuralCastClient({
  apiKey: 'nc_sk_your_key_here',
});

// Текстовый чат
const response = await client.character('char_001').send({
  message: 'Расскажи о себе',
  sessionId: 'user_123',
});
console.log(response.text);
// → "Приветствую! Я Лира, хранительница..."

// Голосовой чат
const voiceResp = await client.character('char_001').sendVoice({
  audio: audioBlob,
  returnAudio: true,
});
// Play audio response
const audio = new Audio(voiceResp.audioUrl);
audio.play();`,

  python: `from neuralcast import NeuralCastClient

client = NeuralCastClient(api_key="nc_sk_your_key_here")

# Текстовый чат
response = client.character("char_001").send(
    message="Расскажи о себе",
    session_id="user_123"
)
print(response.text)
# → "Приветствую! Я Лира, хранительница..."

# Потоковый вывод
for chunk in client.character("char_001").stream(
    message="Расскажи длинную историю"
):
    print(chunk.text, end="", flush=True)`,

  unity: `// Unity C# SDK
using NeuralCast;

public class NPCController : MonoBehaviour 
{
    private NeuralCastCharacter character;
    
    void Start() {
        character = NeuralCast.GetCharacter("char_001");
        character.OnResponse += OnCharacterResponse;
    }
    
    public void PlayerSpeaks(string text) {
        character.SendMessage(text, sessionId: "player_1");
    }
    
    void OnCharacterResponse(CharacterResponse resp) {
        // Показать субтитры
        subtitle.text = resp.Text;
        // Воспроизвести голос
        audioSource.clip = resp.AudioClip;
        audioSource.Play();
        // Запустить анимацию эмоции
        animator.SetTrigger(resp.Emotion);
    }
}`,

  curl: `# Отправить сообщение персонажу
curl -X POST https://api.neuralcast.io/v1/character/char_001/message \\
  -H "Authorization: Bearer nc_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Привет, расскажи о себе!",
    "session_id": "user_123"
  }'

# Получить список персонажей  
curl https://api.neuralcast.io/v1/characters \\
  -H "Authorization: Bearer nc_sk_your_key"`,
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-purple-900/20">
        <span className="text-xs text-gray-500 font-mono">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>
      <pre className="bg-black/30 p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<keyof typeof sdkExamples>('javascript');
  const [activeEndpoint, setActiveEndpoint] = useState(0);

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 gradient-bg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-3">
            <span className="gradient-text">API</span> Документация
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Встраивай AI-персонажей в любые проекты — игры, приложения, сайты
          </p>
        </motion.div>

        {/* Features row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Zap, label: 'REST API', desc: 'OpenAPI 3.0' },
            { icon: Globe, label: 'WebSocket', desc: 'Стриминг' },
            { icon: MessageCircle, label: 'SDK', desc: 'JS / Python / C#' },
            { icon: Shield, label: 'Auth', desc: 'Bearer Token' },
          ].map(f => (
            <div key={f.label} className="glass rounded-xl p-4 text-center">
              <f.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div className="font-semibold text-sm text-white">{f.label}</div>
              <div className="text-xs text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Endpoints list */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-300 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Endpoints
            </h2>
            {endpoints.map((ep, i) => (
              <button
                key={i}
                onClick={() => setActiveEndpoint(i)}
                className={`w-full text-left glass rounded-xl p-3 transition-all ${
                  activeEndpoint === i ? 'border-purple-600/50 bg-purple-900/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${ep.color}`}>
                    {ep.method}
                  </span>
                </div>
                <div className="font-mono text-xs text-gray-300 truncate">{ep.path}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-1">{ep.desc}</div>
              </button>
            ))}
          </div>

          {/* Right — Endpoint detail */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${endpoints[activeEndpoint].color}`}>
                  {endpoints[activeEndpoint].method}
                </span>
                <code className="text-sm text-gray-300 font-mono">{endpoints[activeEndpoint].path}</code>
              </div>
              <p className="text-gray-400 text-sm mb-5">{endpoints[activeEndpoint].desc}</p>

              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Request</div>
                  <CodeBlock code={endpoints[activeEndpoint].request} lang="json" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Response</div>
                  <CodeBlock code={endpoints[activeEndpoint].response} lang="json" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SDK Examples */}
        <div className="mt-10">
          <h2 className="font-semibold text-gray-300 text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
            <Code2 className="w-4 h-4" /> SDK Примеры
          </h2>

          <div className="glass rounded-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex gap-0 border-b border-purple-900/20">
              {(Object.keys(sdkExamples) as (keyof typeof sdkExamples)[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/10'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab === 'javascript' ? 'JavaScript' :
                   tab === 'python' ? 'Python' :
                   tab === 'unity' ? 'Unity C#' : 'cURL'}
                </button>
              ))}
            </div>

            <div className="p-5">
              <CodeBlock code={sdkExamples[activeTab]} lang={activeTab} />
            </div>
          </div>
        </div>

        {/* Auth section */}
        <div className="mt-10 glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Аутентификация
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Все запросы должны содержать заголовок <code className="text-purple-300 bg-purple-900/20 px-1.5 py-0.5 rounded text-xs">Authorization</code>:
          </p>
          <CodeBlock code={`Authorization: Bearer nc_sk_your_api_key_here`} lang="http" />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="glass-light rounded-xl p-4">
              <div className="text-green-400 font-semibold mb-1">Free Tier</div>
              <div className="text-gray-400 text-xs">1,000 запросов/день · 1 персонаж</div>
            </div>
            <div className="glass-light rounded-xl p-4">
              <div className="text-blue-400 font-semibold mb-1">Pro</div>
              <div className="text-gray-400 text-xs">50,000 запросов/день · 20 персонажей</div>
            </div>
            <div className="glass-light rounded-xl p-4">
              <div className="text-purple-400 font-semibold mb-1">Enterprise</div>
              <div className="text-gray-400 text-xs">Без лимитов · On-premise · SLA 99.9%</div>
            </div>
          </div>
        </div>

        {/* Game Engine integrations */}
        <div className="mt-10 glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
            🎮 Интеграции с игровыми движками
          </h2>
          <p className="text-gray-400 text-sm mb-5">Готовые плагины для популярных платформ</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Unity', icon: '🎮', status: 'Скоро' },
              { name: 'Unreal Engine', icon: '🔵', status: 'Скоро' },
              { name: 'Godot', icon: '🤖', status: 'Скоро' },
              { name: 'Web (JS)', icon: '🌐', status: 'Готово' },
            ].map(e => (
              <div key={e.name} className="glass-light rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{e.icon}</div>
                <div className="text-sm font-medium text-white">{e.name}</div>
                <div className={`text-xs mt-1 ${e.status === 'Готово' ? 'text-green-400' : 'text-gray-500'}`}>
                  {e.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
