// Типы данных, симметричные нашим Pydantic-схемам в backend/app/db/schemas.py.
// Только то что используется на фронте.

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_adult: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface Character {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  avatar_url: string | null;
  system_prompt: string;
  backstory: string;
  personality_traits: string;
  greeting: string;
  model: string;
  temperature: number;
  language: string;
  voice_provider: string | null;
  voice_id: string | null;
  is_public: boolean;
  nsfw: boolean;
  tags: string;
  created_at: string;
  updated_at: string;
}

export type CharacterCreate = Omit<Character, "id" | "owner_id" | "created_at" | "updated_at">;

export interface Conversation {
  id: string;
  user_id: string | null;
  character_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  emotion: string | null;
  action: string | null;
  tokens_in: number;
  tokens_out: number;
  model: string | null;
  created_at: string;
}

export interface ChatResponse {
  user_message: Message;
  assistant_message: Message;
}

export interface SystemInfo {
  app: string;
  env: string;
  llm_provider: string;
  default_model: string;
  openrouter_configured: boolean;
  memory_enabled?: boolean;
  memory_online?: boolean;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: string;
  style: string;
}
