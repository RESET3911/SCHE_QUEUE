import { useEffect, useMemo, useRef, useState } from 'react';
import type { Draft, GEvent } from '../types';
import { COLOR_HEX, DEFAULT_EVENT_HEX } from '../data/defaults';
import { fmtTime, isSameDay, pad2 } from '../lib/format';
import { layoutColumns } from '../lib/layout';

const HOUR_H = 56; // px per hour
const GRID_H = 24 * HOUR_H;
const LABEL_W = 52; // 時刻ラベル列の幅(px)
const LONG_PRESS_MS = 450;

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
  date: Date;
  events: GEvent[]; // 時間指定の予定のみ
  draft: Draft | null;
  draftHex: string;
  draftLabel: string;
  // 空き枠の操作（タップ=30分 / 長押し=1時間）。draft がある間は移動として扱うのは親側の責務
  onSlot: (startMin: number, durMin: number) => void;
  onDraftChange: (d: Draft) => void;
}

export default function Timeline({ date, events, draft, draftHex, draftLabel, onSlot, onDraftChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  // 長押し判定
  const press = useRef<{ y: number; moved: boolean; timer: number; fired: boolean } | null>(null);
  // ドラフトのドラッグ（移動 / 下端リサイズ）
  const drag = useRef<{ mode: 'move' | 'resize'; grabOffset: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // 初期スクロール：今日なら現在時刻の少し上、他の日は7:00へ
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = isSameDay(date, new Date()) ? clamp(nowMin - 90, 0, 1440) : 7 * 60;
    el.scrollTop = minToPx(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const minutesAtClientY = (clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    return clamp(pxToMin(clientY - rect.top), 0, 1440);
  };

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  const onGridPointerDown = (e: React.PointerEvent) => {
    if (drag.current || e.button !== 0) return;
    const m = minutesAtClientY(e.clientY);
    const startSlot = clamp(Math.floor(m / 30) * 30, 0, 1440 - 60);
    const timer = window.setTimeout(() => {
      if (press.current && !press.current.moved) {
        press.current.fired = true;
        navigator.vibrate?.(15);
        onSlot(startSlot, 60);
      }
    }, LONG_PRESS_MS);
    press.current = { y: e.clientY, moved: false, timer, fired: false };
  };

  const onGridPointerMove = (e: React.PointerEvent) => {
    if (press.current && Math.abs(e.clientY - press.current.y) > 8) {
      press.current.moved = true;
      window.clearTimeout(press.current.timer);
    }
    if (drag.current && draftRef.current) {
      const d = draftRef.current;
      const m = minutesAtClientY(e.clientY);
      if (drag.current.mode === 'move') {
        const dur = d.endMin - d.startMin;
        const s = clamp(snapTo(m - drag.current.grabOffset, 15), 0, 1440 - dur);
        if (s !== d.startMin) onDraftChange({ ...d, startMin: s, endMin: s + dur });
      } else {
        const end = clamp(snapTo(m, 15), d.startMin + 15, 1440);
        if (end !== d.endMin) onDraftChange({ ...d, endMin: end });
      }
    }
  };

  const onGridPointerUp = (e: React.PointerEvent) => {
    if (drag.current) {
      drag.current = null;
      return;
    }
    if (press.current) {
      const { moved, fired } = press.current;
      cancelPress();
      if (!moved && !fired) {
        const m = minutesAtClientY(e.clientY);
        onSlot(clamp(Math.floor(m / 30) * 30, 0, 1440 - 30), 30);
      }
    }
  };

  const onGridPointerCancel = () => {
    cancelPress();
    drag.current = null;
  };

  const startDraftDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (!draftRef.current) return;
    e.stopPropagation();
    cancelPress();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const m = minutesAtClientY(e.clientY);
    drag.current = { mode, grabOffset: m - draftRef.current.startMin };
  };

  // 既存予定＋ドラフトの列レイアウト（重複は横並び表示）
  const laid = useMemo(() => {
    const base = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const items: LaidItem[] = events.map((ev) => ({
      key: `${ev.calendarId}:${ev.id}`,
      start: clamp((ev.start.getTime() - base) / 60_000, 0, 1440),
      end: clamp((ev.end.getTime() - base) / 60_000, 0, 1440),
      event: ev,
    }));
    if (draft) items.push({ key: '__draft__', start: draft.startMin, end: draft.endMin, isDraft: true });
    const pos = layoutColumns(items, (i) => i.start, (i) => Math.max(i.end, i.start + 20));
    return items.map((it) => ({ ...it, ...pos.get(it)! }));
  }, [events, draft, date]);

  const showNow = isSameDay(date, new Date());

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto board-texture" style={{ overscrollBehavior: 'contain' }}>
      <div
        ref={gridRef}
        className="relative touch-pan-y select-none"
        style={{ height: GRID_H }}
        onPointerDown={onGridPointerDown}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
        onPointerCancel={onGridPointerCancel}
        onPointerLeave={cancelPress}
      >
        {/* 時刻グリッド */}
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="absolute inset-x-0 border-t border-board-line" style={{ top: h * HOUR_H }}>
            <span className="absolute -top-2.5 left-2 font-mono text-[11px] text-board-dim">
              {pad2(h)}:00
            </span>
            <div className="absolute inset-x-0 border-t border-board-line/50" style={{ top: HOUR_H / 2, borderTopStyle: 'dashed' }} />
          </div>
        ))}
        <div className="absolute inset-y-0 border-l border-board-line" style={{ left: LABEL_W }} />

        {/* 予定レイヤー（列割り当て済み） */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL_W + 4, right: 8 }}>
          {laid.map((it) => {
            const top = minToPx(it.start);
            const height = Math.max(minToPx(it.end - it.start), 18);
            const widthPct = 100 / it.cols;
            const leftPct = (it.col * 100) / it.cols;
            if (it.isDraft && draft) {
              return (
                <div
                  key={it.key}
                  className="pointer-events-auto absolute z-20 cursor-grab touch-none rounded-md border-2 border-dashed shadow-lg shadow-black/50"
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + 1px)`,
                    width: `calc(${widthPct}% - 3px)`,
                    borderColor: draftHex,
                    background: `${draftHex}33`,
                  }}
                  onPointerDown={startDraftDrag('move')}
                >
                  <div className="flex h-full flex-col justify-between overflow-hidden px-2 py-1">
                    <div className="truncate text-xs font-bold" style={{ color: '#fff' }}>
                      <span className="font-mono">{fmtTime(draft.startMin)}–{fmtTime(draft.endMin)}</span>
                      {draftLabel && <span className="ml-1.5">{draftLabel}</span>}
                    </div>
                  </div>
                  {/* 下端リサイズハンドル */}
                  <div
                    className="absolute inset-x-0 -bottom-2.5 flex h-5 cursor-ns-resize touch-none items-center justify-center"
                    onPointerDown={startDraftDrag('resize')}
                  >
                    <div className="h-1.5 w-8 rounded-full border" style={{ borderColor: draftHex, background: '#0c0f14' }} />
                  </div>
                </div>
              );
            }
            const ev = it.event!;
            const hex = (ev.colorId && COLOR_HEX[ev.colorId]) || DEFAULT_EVENT_HEX;
            return (
              <div
                key={it.key}
                className="absolute overflow-hidden rounded-md"
                style={{
                  top,
                  height,
                  left: `calc(${leftPct}% + 1px)`,
                  width: `calc(${widthPct}% - 3px)`,
                  background: `${hex}26`,
                  borderLeft: `3px solid ${hex}`,
                }}
              >
                <div className="px-1.5 py-0.5 text-[11px] leading-tight">
                  <span className="font-medium" style={{ color: hex, filter: 'brightness(1.6)' }}>
                    {ev.title}
                  </span>
                  <span className="ml-1 font-mono text-[10px] text-board-dim">
                    {fmtTime(Math.round(it.start))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 現在時刻ライン（LEDアンバー） */}
        {showNow && (
          <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: minToPx(nowMin) }}>
            <div className="absolute border-t-2 border-board-amber" style={{ left: LABEL_W - 6, right: 0 }} />
            <div className="absolute -top-[5px] h-2.5 w-2.5 rounded-full bg-board-amber animate-pulse-soft" style={{ left: LABEL_W - 10 }} />
            <span className="absolute -top-2.5 left-1 font-mono text-[10px] font-bold text-board-amber">
              {fmtTime(nowMin)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
