// Client-side fetch wrapper
'use client';

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'request_failed' }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'request_failed' }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function apiPatch<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'request_failed' }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE', credentials: 'same-origin' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'request_failed' }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

// Helpers
export function formatINR(rupees: number): string {
  return (rupees || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function paiseToINR(paise: number): number {
  return Math.round((paise || 0) / 100);
}

export function formatDate(d?: string | Date | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return 'never';
  const then = new Date(d).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function daysUntil(d?: string | Date | null): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  const now = Date.now();
  return Math.ceil((t - now) / (24 * 60 * 60 * 1000));
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}
