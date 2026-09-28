// OPERA AI — Session management
// Server-side only. Signed session cookie holds userId, tenantId, role, isSuperAdmin.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const SESSION_COOKIE = 'opera_session';
const SECRET = process.env.SESSION_SECRET || 'opera-ai-dev-secret-change-in-production-min-32-chars-long';
const KEY = new TextEncoder().encode(SECRET);
const SESSION_DAYS = 7;

export interface SessionPayload {
  sub: string;        // userId
  tenantId: string | null;
  role: string;
  isSuperAdmin: boolean;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(KEY);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp'>) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, isSuperAdmin: true, tenantId: true, status: true },
  });
  if (!user || user.status !== 'active') return null;
  return { user, session };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
