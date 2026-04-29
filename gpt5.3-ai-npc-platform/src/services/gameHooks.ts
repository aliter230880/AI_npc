export type GameActionParams = Record<string, string | number>;

export type GameHookResult = {
  status: "executed" | "ignored";
  message: string;
};

function getNumber(value: string | number | undefined, fallback: number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function executeNpcAction(action: string, params: GameActionParams = {}): GameHookResult {
  // This switch is the integration seam where game-engine specific calls are plugged in.
  switch (action) {
    case "move_to": {
      const x = getNumber(params.x, 0);
      const y = getNumber(params.y, 0);
      const zone = String(params.zone ?? "unknown");
      return {
        status: "executed",
        message: `NPC moving to ${zone} (${x}, ${y})`,
      };
    }
    case "start_quest": {
      const questId = String(params.questId ?? "main_quest");
      return {
        status: "executed",
        message: `Quest started: ${questId}`,
      };
    }
    case "offer_trade": {
      const discount = getNumber(params.discountPercent, 0);
      return {
        status: "executed",
        message: `Trade offer updated. Discount: ${discount}%`,
      };
    }
    case "lore_hint": {
      const thread = String(params.thread ?? "world_lore");
      return {
        status: "executed",
        message: `Lore hint unlocked for thread: ${thread}`,
      };
    }
    default:
      return {
        status: "ignored",
        message: `No handler for action: ${action}`,
      };
  }
}
