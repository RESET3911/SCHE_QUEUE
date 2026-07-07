import type { GCalendar, GEvent } from '../types';

// Google Identity Services（トークンフロー）+ Calendar REST API。
// サーバー不要の完全クライアントサイド構成。アクセストークンは約1時間有効で
// sessionStorage に保持し、期限切れ時はユーザー操作起点で再取得する。

const SCOPES =
  'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
const TOKEN_KEY = 'schequeue:token:v1';
const API = 'https://www.googleapis.com/calendar/v3';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface StoredToken {
  token: string;
  exp: number; // epoch ms
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export function getValidToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (Date.now() > t.exp - 60_000) return null;
    return t.token;
  } catch {
    return null;
  }
}

export function connect(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google認証スクリプトが読み込まれていません。通信環境を確認してください。'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(`認証に失敗しました: ${resp.error ?? 'unknown'}`));
          return;
        }
        const stored: StoredToken = {
          token: resp.access_token,
          exp: Date.now() + (resp.expires_in ?? 3600) * 1000,
        };
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
        resolve(resp.access_token);
      },
      error_callback: () => reject(new Error('認証がキャンセルされました')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function disconnect() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    disconnect();
    throw new Error('Googleとの接続が切れました。再接続してください。');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google API エラー (${res.status}): ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listCalendars(token: string): Promise<GCalendar[]> {
  const data = await api<{ items?: { id: string; summary: string; primary?: boolean; accessRole: string }[] }>(
    token,
    '/users/me/calendarList?minAccessRole=writer&maxResults=100',
  );
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary, primary: c.primary }));
}

// タイムライン表示用：登録先に関わらず、ユーザーが自分のGoogleカレンダーで
// 表示チェックを入れている全カレンダーの予定を拾う（既存の予定を見えるようにするため）
export async function listViewableCalendars(token: string): Promise<GCalendar[]> {
  const data = await api<{
    items?: { id: string; summary: string; primary?: boolean; selected?: boolean; hidden?: boolean; backgroundColor?: string }[];
  }>(token, '/users/me/calendarList?maxResults=250');
  return (data.items ?? [])
    .filter((c) => c.selected !== false && !c.hidden)
    .map((c) => ({ id: c.id, summary: c.summary, primary: c.primary, backgroundColor: c.backgroundColor }));
}

interface RawEvent {
  id: string;
  summary?: string;
  colorId?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GEvent[]> {
  const q = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const data = await api<{ items?: RawEvent[] }>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
  );
  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
    .map((e) => {
      const allDay = !e.start?.dateTime;
      const start = new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00`);
      const end = new Date(e.end?.dateTime ?? `${e.end?.date}T00:00:00`);
      return {
        id: e.id,
        calendarId,
        title: e.summary ?? '(タイトルなし)',
        start,
        end,
        colorId: e.colorId,
        allDay,
      };
    });
}

export interface NewEvent {
  summary: string;
  start: Date;
  end: Date;
  colorId: string;
  reminderMinutes: number[];
}

export async function insertEvent(
  token: string,
  calendarId: string,
  ev: NewEvent,
): Promise<{ id: string }> {
  const body = {
    summary: ev.summary,
    start: { dateTime: ev.start.toISOString() },
    end: { dateTime: ev.end.toISOString() },
    colorId: ev.colorId,
    reminders: {
      useDefault: false,
      overrides: ev.reminderMinutes.slice(0, 5).map((m) => ({ method: 'popup' as const, minutes: m })),
    },
  };
  return api<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  await api<void>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}
