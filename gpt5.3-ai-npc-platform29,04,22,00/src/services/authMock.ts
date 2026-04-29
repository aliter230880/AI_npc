export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type StoredUser = AuthUser & {
  password: string;
};

type Session = {
  token: string;
  user: AuthUser;
};

const USERS_KEY = "ai_npc_users_v1";
const SESSION_KEY = "ai_npc_session_v1";

export function registerMockUser(input: { name: string; email: string; password: string }): Session {
  const users = getStoredUsers();
  const email = input.email.trim().toLowerCase();

  if (users.some((user) => user.email === email)) {
    throw new Error("Пользователь с таким email уже существует");
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    password: input.password,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveStoredUsers(users);

  const session = createSession(newUser);
  saveSession(session);
  return session;
}

export function loginMockUser(input: { email: string; password: string }): Session {
  const users = getStoredUsers();
  const email = input.email.trim().toLowerCase();
  const user = users.find((item) => item.email === email && item.password === input.password);

  if (!user) {
    throw new Error("Неверный email или пароль");
  }

  const session = createSession(user);
  saveSession(session);
  return session;
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function logoutMockUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function clearMockAuthStorage() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USERS_KEY);
}

function createSession(user: StoredUser): Session {
  const { password: _password, ...safeUser } = user;
  return {
    token: crypto.randomUUID(),
    user: safeUser,
  };
}

function getStoredUsers(): StoredUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}