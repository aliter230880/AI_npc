using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

// Minimal client for NPC REST API. Realtime WS is shown in UnityNpcRealtimeExample.cs.
public class UnityNpcClient
{
    [Serializable]
    public class Character
    {
        public string id;
        public string name;
        public string role;
        public string tone;
        public string opening;
    }

    [Serializable]
    public class Session
    {
        public string id;
        public string characterId;
        public string createdAt;
    }

    [Serializable]
    public class Message
    {
        public string id;
        public string sessionId;
        public string role;
        public string content;
        public string createdAt;
    }

    [Serializable]
    private class SessionCreateRequest
    {
        public string characterId;
    }

    [Serializable]
    private class MessageRequest
    {
        public string sessionId;
        public string characterId;
        public string text;
    }

    private readonly string _apiBaseUrl;
    private readonly string _apiKey;

    public UnityNpcClient(string apiBaseUrl, string apiKey = "")
    {
        _apiBaseUrl = apiBaseUrl.TrimEnd('/');
        _apiKey = apiKey;
    }

    public async Task<Character[]> ListCharactersAsync()
    {
        var response = await SendAsync("/characters", "GET");
        return JsonArrayHelper.FromJson<Character>(response);
    }

    public async Task<Session> CreateSessionAsync(string characterId)
    {
        var payload = JsonUtility.ToJson(new SessionCreateRequest { characterId = characterId });
        var response = await SendAsync("/sessions", "POST", payload);
        return JsonUtility.FromJson<Session>(response);
    }

    public async Task<Message[]> GetSessionMessagesAsync(string sessionId)
    {
        var response = await SendAsync($"/sessions/{sessionId}/messages", "GET");
        return JsonArrayHelper.FromJson<Message>(response);
    }

    public async Task<Message> SendTextMessageAsync(string sessionId, string characterId, string text)
    {
        var payload = JsonUtility.ToJson(
            new MessageRequest { sessionId = sessionId, characterId = characterId, text = text }
        );
        var response = await SendAsync("/messages", "POST", payload);
        return JsonUtility.FromJson<Message>(response);
    }

    private async Task<string> SendAsync(string path, string method, string jsonBody = null)
    {
        var url = $"{_apiBaseUrl}{path}";
        using var request = new UnityWebRequest(url, method);
        request.downloadHandler = new DownloadHandlerBuffer();

        if (!string.IsNullOrEmpty(_apiKey))
        {
            request.SetRequestHeader("x-api-key", _apiKey);
        }

        if (!string.IsNullOrEmpty(jsonBody))
        {
            request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(jsonBody));
            request.SetRequestHeader("Content-Type", "application/json");
        }

        var op = request.SendWebRequest();
        while (!op.isDone)
        {
            await Task.Yield();
        }

        if (request.result != UnityWebRequest.Result.Success)
        {
            throw new Exception($"HTTP {request.responseCode}: {request.error}");
        }

        return request.downloadHandler.text;
    }
}

public static class JsonArrayHelper
{
    [Serializable]
    private class Wrapper<T>
    {
        public T[] items;
    }

    public static T[] FromJson<T>(string json)
    {
        var wrapped = $"{{\"items\":{json}}}";
        var result = JsonUtility.FromJson<Wrapper<T>>(wrapped);
        return result?.items ?? Array.Empty<T>();
    }
}
