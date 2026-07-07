import { useState } from 'react';
import type { GEvent } from '../types';
import { COLOR_HEX, DEFAULT_EVENT_HEX } from '../data/defaults';
import { addDays, fmtDateShort } from '../lib/format';

export interface EventUpdate {
  title: string;
  start: Date;
  end: Date;
  colorId?: string; // 未指定=色は変更しない（触っていないのに既定色を上書きしないため）
  allDay: boolean;
}

interface Props {
  event: GEvent;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
  onUpdate: (update: EventUpdate) => Promise<boolean>;
  saving: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Googleカレンダーの既知の直リンク形式（イベントID+カレンダーIDをbase64化）
function gcalEventUrl(eventId: string, calendarId: string): string | null {
  try {
    const eid = btoa(`${eventId} ${calendarId}`).replace(/=+$/, '');
    return `https://calendar.google.com/calendar/event?eid=${eid}`;
  } catch {
    return null;
  }
}

export default function EventDetailPanel({ event, onClose, onDelete, deleting, onUpdate, saving }: Props) {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);
  const [dateDraft, setDateDraft] = useState(toDateInput(event.start));
  const [startDraft, setStartDraft] = useState(toTimeInput(event.start));
  const [endDraft, setEndDraft] = useState(toTimeInput(event.end));
  const [colorDraft, setColorDraft] = useState(event.colorId ?? '');
  const [colorTouched, setColorTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hex = (event.colorId && COLOR_HEX[event.colorId]) || event.calendarHex || DEFAULT_EVENT_HEX;
  const gcalUrl = gcalEventUrl(event.id, event.calendarId);

  const startEdit = () => {
    setTitleDraft(event.title);
    setDateDraft(toDateInput(event.start));
    setStartDraft(toTimeInput(event.start));
    setEndDraft(toTimeInput(event.end));
    setColorDraft(event.colorId ?? '');
    setColorTouched(false);
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!titleDraft.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    const [y, m, d] = dateDraft.split('-').map(Number);
    let newStart: Date;
    let newEnd: Date;
    if (event.allDay) {
      const spanDays = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 86_400_000));
      newStart = new Date(y, m - 1, d);
      newEnd = addDays(newStart, spanDays);
    } else {
      const [sh, sm] = startDraft.split(':').map(Number);
      const [eh, em] = endDraft.split(':').map(Number);
      newStart = new Date(y, m - 1, d, sh, sm);
      newEnd = new Date(y, m - 1, d, eh, em);
      if (newEnd.getTime() <= newStart.getTime()) {
        setError('終了時刻は開始時刻より後にしてください');
        return;
      }
    }
    setError(null);
    const ok = await onUpdate({
      title: titleDraft.trim(),
      start: newStart,
      end: newEnd,
      colorId: colorTouched ? colorDraft : undefined,
      allDay: event.allDay,
    });
    if (ok) setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="animate-panel-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-board-line bg-board-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-board-line px-5 py-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} />
            <h2 className="text-base font-bold leading-snug">{editing ? '予定を編集' : event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-board-dim hover:bg-board-raise"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {!editing ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="text-sm text-board-dim">{fmtDateShort(event.start)}</div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {event.allDay ? '終日' : `${fmtHM(event.start)} – ${fmtHM(event.end)}`}
              </div>
              {event.calendarName && (
                <div className="mt-4 flex items-center gap-2 text-sm text-board-dim">
                  <span className="h-2 w-2 rounded-sm" style={{ background: hex }} />
                  {event.calendarName}
                </div>
              )}
              {gcalUrl && (
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-block text-sm font-bold text-board-amber underline underline-offset-2"
                >
                  Googleカレンダーで開く ↗
                </a>
              )}
            </div>

            <div className="flex gap-2 border-t border-board-line px-5 py-4">
              <button
                onClick={startEdit}
                className="flex-1 rounded-lg border border-board-line bg-board-base py-2.5 text-sm font-bold text-board-text"
              >
                編集
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-bold text-red-600 transition-opacity disabled:opacity-40"
              >
                {deleting ? '削除中…' : '削除'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <label className="block text-sm text-board-dim">タイトル</label>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="mt-1 w-full rounded-md border border-board-line bg-board-base px-3 py-2 text-sm"
              />

              <label className="mt-4 block text-sm text-board-dim">日付</label>
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="mt-1 w-full rounded-md border border-board-line bg-board-base px-3 py-2 text-sm"
              />

              {!event.allDay && (
                <div className="mt-4 flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm text-board-dim">開始</label>
                    <input
                      type="time"
                      value={startDraft}
                      onChange={(e) => setStartDraft(e.target.value)}
                      className="mt-1 w-full rounded-md border border-board-line bg-board-base px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-board-dim">終了</label>
                    <input
                      type="time"
                      value={endDraft}
                      onChange={(e) => setEndDraft(e.target.value)}
                      className="mt-1 w-full rounded-md border border-board-line bg-board-base px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <label className="mt-4 block text-sm text-board-dim">色</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(COLOR_HEX).map(([id, c]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setColorDraft(id);
                      setColorTouched(true);
                    }}
                    className={`h-7 w-7 rounded-md transition-transform ${
                      colorDraft === id ? 'scale-110 ring-2 ring-board-text ring-offset-2 ring-offset-board-panel' : 'opacity-70'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-board-line px-5 py-4">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 rounded-lg border border-board-line py-2.5 text-sm font-bold text-board-dim disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 rounded-lg bg-board-amber py-2.5 text-sm font-bold text-board-base disabled:opacity-40"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
