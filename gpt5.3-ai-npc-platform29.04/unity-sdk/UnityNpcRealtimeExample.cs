using System;
using NativeWebSocket;
using UnityEngine;

// Requires NativeWebSocket package in Unity project.
// Realtime WS example for NPC events: chunk, transcript, audio_chunk, npc_action.
public class UnityNpcRealtimeExample : MonoBehaviour
{
    [SerializeField] private string wsUrl = "wss://api.web3.aliterra.space/v1/realtime";
    [SerializeField] private string apiKey = "";
    [SerializeField] private string sessionId = "";

    private WebSocket _webSocket;

    private async void Start()
    {
        var finalUrl = wsUrl;
        if (!string.IsNullOrEmpty(apiKey))
        {
            var separator = wsUrl.Contains("?") ? "&" : "?";
            finalUrl = $"{wsUrl}{separator}api_key={apiKey}";
        }

        _webSocket = new WebSocket(finalUrl);

        _webSocket.OnOpen += () => Debug.Log("NPC WS connected");
        _webSocket.OnError += (e) => Debug.LogError($"NPC WS error: {e}");
        _webSocket.OnClose += (e) => Debug.Log($"NPC WS closed: {e}");
        _webSocket.OnMessage += (bytes) =>
        {
            var json = System.Text.Encoding.UTF8.GetString(bytes);
            Debug.Log($"NPC WS event: {json}");
        };

        await _webSocket.Connect();
    }

    public async void SendText(string text)
    {
        if (_webSocket == null || _webSocket.State != WebSocketState.Open)
        {
            Debug.LogWarning("WS is not connected");
            return;
        }

        var payload = JsonUtility.ToJson(new RealtimePayload
        {
            type = "user_message",
            sessionId = sessionId,
            text = text,
        });

        await _webSocket.SendText(payload);
    }

    public async void SendVoiceTranscript(string transcript)
    {
        if (_webSocket == null || _webSocket.State != WebSocketState.Open)
        {
            Debug.LogWarning("WS is not connected");
            return;
        }

        var payload = JsonUtility.ToJson(new RealtimePayload
        {
            type = "user_voice",
            sessionId = sessionId,
            transcript = transcript,
        });

        await _webSocket.SendText(payload);
    }

    private async void Update()
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        if (_webSocket != null)
        {
            _webSocket.DispatchMessageQueue();
        }
#endif
        await System.Threading.Tasks.Task.Yield();
    }

    private async void OnApplicationQuit()
    {
        if (_webSocket != null)
        {
            await _webSocket.Close();
        }
    }

    [Serializable]
    private class RealtimePayload
    {
        public string type;
        public string sessionId;
        public string text;
        public string transcript;
    }
}
