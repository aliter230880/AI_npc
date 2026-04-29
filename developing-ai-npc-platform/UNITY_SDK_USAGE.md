# Unity SDK Quick Start

## Files
- `unity-sdk/UnityNpcClient.cs` - REST client for characters, sessions, messages.
- `unity-sdk/UnityNpcRealtimeExample.cs` - WebSocket realtime example.

## Dependencies
- Unity 2021+
- Package: `NativeWebSocket` (for realtime websocket support)

## Setup
1. Copy both files into your Unity project (for example `Assets/Scripts/Npc`).
2. Install `NativeWebSocket` package.
3. Create a GameObject and attach `UnityNpcRealtimeExample`.
4. Configure:
- `wsUrl`: `wss://api.web3.aliterra.space/v1/realtime`
- `apiKey`: backend `API_KEY` value (if enabled)
- `sessionId`: session id from REST `POST /v1/sessions`

## REST usage example
```csharp
var client = new UnityNpcClient("https://api.web3.aliterra.space/v1", "<API_KEY>");
var chars = await client.ListCharactersAsync();
var session = await client.CreateSessionAsync(chars[0].id);
var reply = await client.SendTextMessageAsync(session.id, chars[0].id, "Start mission");
Debug.Log(reply.content);
```

## Realtime usage example
Call from any MonoBehaviour:
```csharp
realtimeExample.SendText("Move to left flank");
realtimeExample.SendVoiceTranscript("Начни квест");
```
