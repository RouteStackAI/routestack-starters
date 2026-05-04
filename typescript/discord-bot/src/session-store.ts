import crypto from "node:crypto";
import type { TravelSession } from "./types.js";

const SESSION_TTL_MS = 1000 * 60 * 30;
const sessions = new Map<string, TravelSession>();

export function createSession(
  session: Omit<TravelSession, "id" | "createdAt" | "updatedAt">,
) {
  cleanupExpiredSessions();
  const now = Date.now();
  const fullSession: TravelSession = {
    ...session,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } as TravelSession;
  sessions.set(fullSession.id, fullSession);
  return fullSession;
}

export function getSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function updateSession(sessionId: string, session: TravelSession) {
  const updated: TravelSession = {
    ...session,
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, updated);
  return updated;
}

export function assertSessionOwner(session: TravelSession, userId: string) {
  return session.userId === userId;
}

export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}
