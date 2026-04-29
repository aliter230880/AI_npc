# NPC Action Contract (Web and Unity)

## Realtime event
Server emits:

```json
{
  "type": "npc_action",
  "action": "move_to",
  "confidence": 0.94,
  "params": {
    "zone": "left_flank",
    "x": 18,
    "y": 42
  }
}
```

## Supported actions (v1)
- `move_to`
  - params: `zone`, `x`, `y`
- `start_quest`
  - params: `questId`
- `offer_trade`
  - params: `discountPercent`
- `lore_hint`
  - params: `thread`

## Web integration
- Endpoint: `wss://api.web3.aliterra.space/v1/realtime`
- Client sends `user_message` or `user_voice`
- Listen for `npc_action` and route to local game hook executor.

## Unity integration (mapping idea)
- `move_to` -> NavMeshAgent destination update
- `start_quest` -> QuestManager.StartQuest(questId)
- `offer_trade` -> CommerceUI.ApplyDiscount(discountPercent)
- `lore_hint` -> JournalSystem.UnlockHint(thread)
