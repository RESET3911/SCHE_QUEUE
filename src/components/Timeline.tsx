import { useEffect, useMemo, useRef, useState } from 'react';
import type { Draft, GEvent } from '../types';
import { COLOR_HEX, DEFAULT_EVENT_HEX } from '../data/defaults';
import { WEEKDAYS, fmtTime, isSameDay, pad2 } from '../lib/format';
import { layoutColumns } from '../lib/layout';

const HOUR_H = 64; // px per hour
const GRID_H = 24 * HOUR_H;
const LABEL_W = 52; // 時刻ラベル列の幅(px)
const LONG_PRESS_MS = 450;
const DAY_COUNT = 7;

const minToPx = (min: number) => (min / 60) * HOUR_H;
const pxToMin = (px: number) => (px / HOUR_H) * 60;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snapTo = (min: number, step: number) => Math.round(min / step) * step;

interface LaidItem {
  key: string;
  start: number;
  end: number;
  event?: GEvent;
  isDraft?: boolean;
}

interface Props {
  days: Date[]; // 月曜始まり7日分
  events: GEvent[]; // 週全体の時間指定予定
  draft: Draft | null;
  draftHex: string;
  draftLabel: string;
  onSlot: (day: Date, startMin: number, durMin: number) => void;
  onDraftChange: (d: Draft) => void;
  onEventClick: (ev: GEvent) => void;
}

export default function Timeline({ days, events, draft, draftHex, draftLabel, onSlot, onDraftChange, onEventClick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  const press = useRef<{ y: number; moved: boolean; timer: number; fired: boolean; dayIdx: number } | null>(null);
  const drag = useRef<{ mode: 'move' | 'resize' } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const todayIdx = useMemo(() => days.findIndex((d) => isSameDay(d, new Date())), [days]);

  // 週が変わったら現在時刻付近までページをスクロールする
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const target = todayIdx >= 0 ? clamp(nowMin - 90, 0, 1440) : 7 * 60;
    const top = el.getBoundingClientRect().top + window.scrollY + minToPx(target) - 90;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]?.getTime()]);

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  // 列(日)ごとの空き枠タップ／長押し
  const columnPointerDown = (dayIdx: number) => (e: React.PointerEvent) => {
    if (drag.current || e.button !== 0) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const m = clamp(pxToMin(e.clientY - rect.top), 0, 1440);
    const startSlot = clamp(Math.floor(m / 30) * 30, 0, 1440 - 60);
    const timer = window.setTimeout(() => {
      if (press.current && !press.current.moved) {
        press.current.fired = true;
        navigator.vibrate?.(15);
        onSlot(days[dayIdx], startSlot, 60);
      }
    }, LONG_PRESS_MS);
    press.current = { y: e.clientY, moved: false, timer, fired: false, dayIdx };
  };

  const columnPointerMove = (e: React.PointerEvent) => {
    if (press.current && Math.abs(e.clientY - press.current.y) > 8) {
      press.current.moved = true;
      window.clearTimeout(press.current.timer);
    }
  };

  const columnPointerUp = (dayIdx: number) => (e: React.PointerEvent) => {
    if (drag.current) return;
    if (press.current) {
      const { moved, fired } = press.current;
      cancelPress();
      if (!moved && !fired) {
        const rect = (e.currentTarget as Element).getBoundingClientRect();
        const m = clamp(pxToMin(e.clientY - rect.top), 0, 1440);
        onSlot(days[dayIdx], clamp(Math.floor(m / 30) * 30, 0, 1440 - 30), 30);
      }
    }
  };

  const columnPointerCancel = () => {
    cancelPress();
    drag.current = null;
  };

  // ドラフトの移動／リサイズは列コンテナ全体の座標から日・分を割り出す（列をまたいで移動できるように）
  const pointToDayMinute = (clientX: number, clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect();
    const relX = clamp(clientX - rect.left, 0, rect.width - 0.01);
    const dayIdx = clamp(Math.floor((relX / rect.width) * DAY_COUNT), 0, DAY_COUNT - 1);
    const minutes = clamp(pxToMin(clientY - rect.top), 0, 1440);
    return { dayIdx, minutes };
  };

  const startDraftDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (!draftRef.current) return;
    e.stopPropagation();
    cancelPress();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode };
  };

  const onDraftPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !draftRef.current) return;
    const d = draftRef.current;
    const { dayIdx, minutes } = pointToDayMinute(e.clientX, e.clientY);
    if (drag.current.mode === 'move') {
      const dur = d.endMin - d.startMin;
      const s = clamp(snapTo(minutes, 15), 0, 1440 - dur);
      const day = days[dayIdx] ?? d.day;
      if (s !== d.startMin || day.getTime() !== d.day.getTime()) {
        onDraftChange({ ...d, day, startMin: s, endMin: s + dur });
      }
    } else {
      const end = clamp(snapTo(minutes, 15), d.startMin + 15, 1440);
      if (end !== d.endMin) onDraftChange({ ...d, endMin: end });
    }
  };

  const onDraftPointerUp = () => {
    drag.current = null;
  };

  const draftDayIdx = draft ? days.findIndex((d) => isSameDay(d, draft.day)) : -1;

  const dayHex = (dayIdx: number, evs: GEvent[]) => {
    const items: LaidItem[] = evs.map((ev) => ({
      key: `${ev.calendarId}:${ev.id}`,
      start: clamp((ev.start.getTime() - days[dayIdx].getTime()) / 60_000, 0, 1440),
      end: clamp((ev.end.getTime() - days[dayIdx].getTime()) / 60_000, 0, 1440),
      event: ev,
    }));
    if (dayIdx === draftDayIdx && draft) {
      items.push({ key: '__draft__', start: draft.startMin, end: draft.endMin, isDraft: true });
    }
    const pos = layoutColumns(items, (i) => i.start, (i) => Math.max(i.end, i.start + 20));
    return items.map((it) => ({ ...it, ...pos.get(it)! }));
  };

  const eventsByDay = useMemo(
    () => days.map((day, idx) => dayHex(idx, events.filter((e) => isSameDay(e.start, day)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, days, draft],
  );

  return (
    <div className="flex flex-col board-texture">
      {/* 曜日ヘッダー（スクロールしても上部に固定） */}
      <div className="sticky top-0 z-10 flex border-b border-board-line bg-board-panel" style={{ paddingLeft: LABEL_W }}>
        {days.map((day, idx) => {
          const isToday = idx === todayIdx;
          return (
            <div key={idx} className={`flex-1 border-l border-board-line py-1.5 text-center ${isToday ? 'bg-board-amber/10' : ''}`}>
              <div className={`font-mono text-xs ${idx === 5 ? 'text-sky-600' : idx === 6 ? 'text-rose-600' : 'text-board-dim'}`}>
                {WEEKDAYS[day.getDay()]}
              </div>
              <div className={`font-mono text-lg font-bold leading-tight ${isToday ? 'text-board-amber' : 'text-board-text'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={gridRef} className="relative flex" style={{ height: GRID_H }}>
        {/* 時刻ラベル列 */}
        <div className="relative shrink-0" style={{ width: LABEL_W }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="absolute -top-2.5 left-1.5 font-mono text-xs text-board-dim" style={{ top: h * HOUR_H }}>
              {pad2(h)}:00
            </span>
          ))}
        </div>

        {/* 日カラム */}
        <div ref={columnsRef} className="relative flex flex-1 touch-pan-y select-none">
          {/* 時間の水平線（全列共通） */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(180deg, transparent 0, transparent ${HOUR_H - 1}px, rgba(30,27,20,0.13) ${HOUR_H - 1}px, rgba(30,27,20,0.13) ${HOUR_H}px)`,
            }}
          />

          {days.map((_day, dayIdx) => (
            <div
              key={dayIdx}
              className="relative flex-1 border-l border-board-line"
              onPointerDown={columnPointerDown(dayIdx)}
              onPointerMove={columnPointerMove}
              onPointerUp={columnPointerUp(dayIdx)}
              onPointerCancel={columnPointerCancel}
              onPointerLeave={cancelPress}
            >
              {eventsByDay[dayIdx].map((it) => {
                const top = minToPx(it.start);
                const height = Math.max(minToPx(it.end - it.start), 20);
                const widthPct = 100 / it.cols;
                const leftPct = (it.col * 100) / it.cols;
                if (it.isDraft && draft) {
                  return (
                    <div
                      key={it.key}
                      className="pointer-events-auto absolute z-20 cursor-grab touch-none rounded-md border-2 border-dashed shadow-lg shadow-black/20"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                        borderColor: draftHex,
                        background: `${draftHex}26`,
                      }}
                      onPointerDown={startDraftDrag('move')}
                      onPointerMove={onDraftPointerMove}
                      onPointerUp={onDraftPointerUp}
                      onPointerCancel={onDraftPointerUp}
                    >
                      <div className="flex h-full flex-col overflow-hidden px-1.5 py-1">
                        <div className="truncate text-xs font-bold leading-tight" style={{ color: '#1c1b18' }}>
                          <span className="font-mono">{fmtTime(draft.startMin)}</span>
                          {draftLabel && <span className="ml-1">{draftLabel}</span>}
                        </div>
                      </div>
                      <div
                        className="absolute inset-x-0 -bottom-2.5 flex h-5 cursor-ns-resize touch-none items-center justify-center"
                        onPointerDown={startDraftDrag('resize')}
                        onPointerMove={onDraftPointerMove}
                        onPointerUp={onDraftPointerUp}
                        onPointerCancel={onDraftPointerUp}
                      >
                        <div className="h-1.5 w-6 rounded-full border" style={{ borderColor: draftHex, background: '#ffffff' }} />
                      </div>
                    </div>
                  );
                }
                const ev = it.event!;
                const hex = (ev.colorId && COLOR_HEX[ev.colorId]) || ev.calendarHex || DEFAULT_EVENT_HEX;
                return (
                  <button
                    key={it.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className="absolute overflow-hidden rounded-sm text-left"
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                      background: `${hex}22`,
                      borderLeft: `3px solid ${hex}`,
                    }}
                  >
                    <div className="px-1.5 py-0.5 text-xs leading-tight">
                      <span className="font-medium" style={{ color: hex, filter: 'brightness(0.85)' }}>
                        {ev.title}
                      </span>
                    </div>
                  </button>
                );
              })}

              {dayIdx === todayIdx && (
                <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: minToPx(nowMin) }}>
                  <div className="absolute inset-x-0 border-t-2 border-board-amber" />
                  <div className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-board-amber animate-pulse-soft" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
