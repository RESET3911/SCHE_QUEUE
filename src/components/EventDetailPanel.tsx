import type { GEvent } from '../types';
import { COLOR_HEX, DEFAULT_EVENT_HEX } from '../data/defaults';
import { fmtDateShort } from '../lib/format';

interface Props {
  event: GEvent;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}

const fmtHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Googleカレンダーの既知の直リンク形式（イベントID+カレンダーIDをbase64化）
function gcalEventUrl(eventId: string, calendarId: string): string | null {
  try {
    const eid = btoa(`${eventId} ${calendarId}`).replace(/=+$/, '');
    return `https://calendar.google.com/calendar/event?eid=${eid}`;
  } catch {
    return null;
  }
}

export default function EventDetailPanel({ event, onClose, onDelete, deleting }: Props) {
  const hex = (event.colorId && COLOR_HEX[event.colorId]) || event.calendarHex || DEFAULT_EVENT_HEX;
  const gcalUrl = gcalEventUrl(event.id, event.calendarId);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="animate-panel-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-board-line bg-board-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-board-line px-5 py-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} />
            <h2 className="text-base font-bold leading-snug">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-board-dim hover:bg-board-raise"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

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

        <div className="border-t border-board-line px-5 py-4">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="w-full rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-bold text-red-600 transition-opacity disabled:opacity-40"
          >
            {deleting ? '削除中…' : 'この予定を削除'}
          </button>
        </div>
      </div>
    </div>
  );
}
