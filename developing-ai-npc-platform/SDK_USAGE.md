# Web NPC SDK Usage

## Import

Use `src/sdk/WebNpcSdk.ts` as the integration client for web games.

## Minimal example

```ts
import { WebNpcSdk } from "./sdk/WebNpcSdk";

const sdk = new WebNpcSdk({
  apiBaseUrl: "https://api.web3.aliterra.space/v1",
  wsUrl: "wss://api.web3.aliterra.space/v1/realtime",
  apiKey: "<API_KEY>",
});

const characters = await sdk.listCharacters();
const session = await sdk.createSession(characters[0].id);

const unsubscribe = sdk.onEvent((event) => {
  if (event.type === "npc_action") {
    console.log("NPC action", event.action, event.params);
  }
});

await sdk.connectRealtime();
sdk.sendText(session.id, "Plan our next mission");
// or
sdk.sendVoice(session.id, "Начни квест");

// cleanup
unsubscribe();
sdk.disconnectRealtime();
```

## Realtime events
- `ready`
- `chunk`
- `final`
- `transcript`
- `audio_chunk`
- `npc_action`
- `error`
