import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarTarget, Draft, GEvent, Settings, SubCategory } from '../types';
import { CATEGORIES, COLOR_HEX } from '../data/defaults';
import { addDays, fmtDateShort, fmtWeekRange, isSameDay, startOfWeek } from '../lib/format';
import { connect, deleteEvent, getValidToken, insertEvent, listEvents, listViewableCalendars, updateEvent } from '../lib/google';
import Timeline from '../components/Timeline';
import CreateSheet from '../components/CreateSheet';
import EventDetailPanel, { type EventUpdate } from '../components/EventDetailPanel';
import Snackbar, { type SnackState } from '../components/Snackbar';

interface Props {
  settings: Settings;
  onOpenSettings: () => void;
}

export default function HomeScreen({ settings, onOpenSettings }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [events, setEvents] = useState<GEvent[]>([]);
  const [authed, setAuthed] = useState(() => !!getValidToken());
  const [loadError, setLoadError] = useState<string | null>(null);

  // 作成中の予定
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryId, setCategoryId] = useState('plan');
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<CalendarTarget>('self');
  const [enabledReminders, setEnabledReminders] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<SnackState | null>(null);

  // 既存予定の詳細パネル
  const [selectedEvent, setSelectedEvent] = useState<GEvent | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [updatingSelected, setUpdatingSelected] = useState(false);

  const configured = !!settings.clientId;
  // ファミリーカレンダーのみ必須。自分用は任意（未設定なら全部ファミリーに登録される）
  const calendarsMapped = !!settings.familyCalendarId;
  const hasSelfCalendar = !!settings.selfCalendarId;

  const resolveCalendarId = useCallback(
    (t: CalendarTarget) => (t === 'self' && settings.selfCalendarId ? settings.selfCalendarId : settings.familyCalendarId),
    [settings.selfCalendarId, settings.familyCalendarId],
  );

  // 週が変わったら作成中の予定はリセット（別の週の日付を参照し続けるのを防ぐ）
  useEffect(() => {
    setDraft(null);
    setSubCategory(null);
    setTitle('');
  }, [weekStart]);

  const loadEvents = useCallback(async () => {
    const token = getValidToken();
    if (!token) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setLoadError(null);
    const from = weekStart;
    const to = addDays(weekStart, 7);
    try {
      const cals = await listViewableCalendars(token);
      const colorMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      cals.forEach((c) => {
        if (c.backgroundColor) colorMap[c.id] = c.backgroundColor;
        nameMap[c.id] = c.summary;
      });
      const calIds = cals.length > 0 ? cals.map((c) => c.id) : [settings.selfCalendarId, settings.familyCalendarId].filter(Boolean);
      const results = await Promise.all(calIds.map((id) => listEvents(token, id, from, to)));
      setEvents(results.flat().map((e) => ({ ...e, calendarHex: colorMap[e.calendarId], calendarName: nameMap[e.calendarId] })));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '予定の取得に失敗しました');
    }
  }, [weekStart, settings.selfCalendarId, settings.familyCalendarId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const timedEvents = useMemo(() => events.filter((e) => !e.allDay), [events]);
  const allDayEvents = useMemo(() => events.filter((e) => e.allDay), [events]);

  const applySubCategory = (sc: SubCategory, d: Draft | null) => {
    setSubCategory(sc);
    setTarget(sc.target);
    setEnabledReminders(sc.reminders);
    // カテゴリボタン起点の枠は、時間を手で選んでいないのでサブカテゴリの既定所要時間を反映
    if (d && d.origin === 'category') {
      setDraft({ ...d, endMin: Math.min(d.startMin + sc.defaultDurationMin, 1440) });
    }
  };

  const resetSheet = () => {
    setDraft(null);
    setSubCategory(null);
    setTitle('');
  };

  // タイムライン空き枠のタップ/長押し。作成中はその枠の移動として扱う
  const handleSlot = (day: Date, startMin: number, durMin: number) => {
    if (draft) {
      const dur = draft.endMin - draft.startMin;
      const s = Math.min(startMin, 1440 - dur);
      setDraft({ ...draft, day, startMin: s, endMin: s + dur });
      return;
    }
    setDraft({ day, startMin, endMin: Math.min(startMin + durMin, 1440), origin: 'timeline' });
  };

  // 大カテゴリボタン：今日が表示週内ならその直近30分区切り、それ以外は週の月曜9時に枠を作る
  const handleCategoryButton = (catId: string) => {
    setCategoryId(catId);
    setSubCategory(null);
    if (!draft) {
      const now = new Date();
      const todayIdx = days.findIndex((d) => isSameDay(d, now));
      let day: Date;
      let startMin: number;
      if (todayIdx >= 0) {
        day = days[todayIdx];
        startMin = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30, 1440 - 30);
      } else {
        day = weekStart;
        startMin = 9 * 60;
      }
      setDraft({ day, startMin, endMin: startMin + 30, origin: 'category' });
    }
  };

  const hasOverlap = useMemo(() => {
    if (!draft) return false;
    const base = draft.day.getTime();
    return timedEvents.some((ev) => {
      if (!isSameDay(ev.start, draft.day)) return false;
      const s = (ev.start.getTime() - base) / 60_000;
      const e = (ev.end.getTime() - base) / 60_000;
      return s < draft.endMin && e > draft.startMin;
    });
  }, [draft, timedEvents]);

  const saveDisabledReason = !configured
    ? '設定でGoogleクライアントIDを設定してください'
    : !authed
      ? 'Googleに接続すると登録できます'
      : !calendarsMapped
        ? '設定でファミリーカレンダーを紐付けてください'
        : !subCategory
          ? 'サブカテゴリを選択してください'
          : null;

  const handleReconnect = async () => {
    try {
      await connect(settings.clientId);
      setAuthed(true);
      void loadEvents();
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : '接続に失敗しました' });
    }
  };

  const handleSave = async () => {
    if (!draft || !subCategory || saveDisabledReason) return;
    setBusy(true);
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      const calendarId = resolveCalendarId(target);
      const base = draft.day;
      const start = new Date(base.getTime() + draft.startMin * 60_000);
      const end = new Date(base.getTime() + draft.endMin * 60_000);
      const summary = `${subCategory.prefix}${title.trim() || subCategory.name}`;
      const created = await insertEvent(token, calendarId, {
        summary,
        start,
        end,
        colorId: subCategory.colorId,
        reminderMinutes: enabledReminders,
      });
      // 楽観的にローカルへ反映
      setEvents((prev) => [
        ...prev,
        { id: created.id, calendarId, title: summary, start, end, colorId: subCategory.colorId, allDay: false },
      ]);
      resetSheet();
      setSnack({
        message: '登録しました',
        actionLabel: '取り消す',
        onAction: () => void undoCreate(calendarId, created.id),
      });
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : '登録に失敗しました' });
    } finally {
      setBusy(false);
    }
  };

  const undoCreate = async (calendarId: string, eventId: string) => {
    setSnack(null);
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      await deleteEvent(token, calendarId, eventId);
      setEvents((prev) => prev.filter((e) => !(e.id === eventId && e.calendarId === calendarId)));
      setSnack({ message: '取り消しました' });
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : '取り消しに失敗しました' });
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedEvent) return;
    if (!window.confirm(`「${selectedEvent.title}」を削除しますか？`)) return;
    setDeletingSelected(true);
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      await deleteEvent(token, selectedEvent.calendarId, selectedEvent.id);
      setEvents((prev) => prev.filter((e) => !(e.id === selectedEvent.id && e.calendarId === selectedEvent.calendarId)));
      setSelectedEvent(null);
      setSnack({ message: '削除しました' });
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : '削除に失敗しました' });
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleUpdateSelected = async (update: EventUpdate): Promise<boolean> => {
    if (!selectedEvent) return false;
    setUpdatingSelected(true);
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      await updateEvent(token, selectedEvent.calendarId, selectedEvent.id, {
        summary: update.title,
        start: update.start,
        end: update.end,
        colorId: update.colorId,
        allDay: update.allDay,
      });
      const updated: GEvent = {
        ...selectedEvent,
        title: update.title,
        start: update.start,
        end: update.end,
        ...(update.colorId !== undefined ? { colorId: update.colorId } : {}),
      };
      setEvents((prev) => prev.map((e) => (e.id === selectedEvent.id && e.calendarId === selectedEvent.calendarId ? updated : e)));
      setSelectedEvent(updated);
      setSnack({ message: '更新しました' });
      return true;
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : '更新に失敗しました' });
      return false;
    } finally {
      setUpdatingSelected(false);
    }
  };

  // タイムライン上で既存予定をドラッグ移動／リサイズした結果を確定させる
  const handleEventDragEnd = async (ev: GEvent, day: Date, startMin: number, endMin: number) => {
    const originalStart = ev.start;
    const originalEnd = ev.end;
    const newStart = new Date(day.getTime() + startMin * 60_000);
    const newEnd = new Date(day.getTime() + endMin * 60_000);
    if (newStart.getTime() === originalStart.getTime() && newEnd.getTime() === originalEnd.getTime()) return;

    // 楽観的にローカルへ反映
    setEvents((prev) =>
      prev.map((e) => (e.id === ev.id && e.calendarId === ev.calendarId ? { ...e, start: newStart, end: newEnd } : e)),
    );
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      await updateEvent(token, ev.calendarId, ev.id, { start: newStart, end: newEnd, allDay: false });
      setSnack({
        message: '予定を移動しました',
        actionLabel: '取り消す',
        onAction: () => void undoEventMove(ev, originalStart, originalEnd),
      });
    } catch (err) {
      // 失敗したら表示を元に戻す
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id && e.calendarId === ev.calendarId ? { ...e, start: originalStart, end: originalEnd } : e)),
      );
      setSnack({ message: err instanceof Error ? err.message : '移動に失敗しました' });
    }
  };

  const undoEventMove = async (ev: GEvent, start: Date, end: Date) => {
    setSnack(null);
    try {
      const token = getValidToken() ?? (await connect(settings.clientId));
      await updateEvent(token, ev.calendarId, ev.id, { start, end, allDay: false });
      setEvents((prev) => prev.map((e) => (e.id === ev.id && e.calendarId === ev.calendarId ? { ...e, start, end } : e)));
      setSnack({ message: '元に戻しました' });
    } catch (err) {
      setSnack({ message: err instanceof Error ? err.message : '取り消しに失敗しました' });
    }
  };

  const draftHex = subCategory ? COLOR_HEX[subCategory.colorId] : '#a8570d';
  const thisWeek = todayInWeek(days);

  return (
    <div className="mx-auto flex w-full flex-col px-4 sm:px-6 lg:px-10">
      {/* ヘッダー：発車標風ワードマーク */}
      <header className="flex items-center justify-between pb-1 pl-[64px] pt-3">
        <h1 className="font-mono text-base font-bold tracking-[0.3em] text-board-amber">
          SCHE<span className="text-board-dim">/</span>QUEUE
        </h1>
        <button
          onClick={onOpenSettings}
          className="rounded-md px-2.5 py-1.5 text-sm text-board-dim hover:bg-board-raise"
          aria-label="設定"
        >
          ⚙ 設定
        </button>
      </header>

      {/* 週ナビ */}
      <div className="flex items-center justify-between py-2">
        <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="rounded-md px-3 py-1.5 text-xl text-board-dim hover:bg-board-raise">‹</button>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold">{fmtWeekRange(weekStart)}</span>
          {!thisWeek && (
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded border border-board-line px-2.5 py-1 text-sm text-board-amber">
              今週
            </button>
          )}
        </div>
        <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="rounded-md px-3 py-1.5 text-xl text-board-dim hover:bg-board-raise">›</button>
      </div>

      {/* 大カテゴリ6ボタン */}
      <div className="grid grid-cols-3 gap-2 pb-2 sm:grid-cols-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => handleCategoryButton(c.id)}
            className="rounded-lg py-2.5 text-center text-sm font-bold leading-none transition-transform active:scale-95"
            style={{ background: `${c.badge}1f`, color: c.badge, border: `1px solid ${c.badge}55` }}
          >
            ＋{c.label}
          </button>
        ))}
      </div>

      {/* クイック入力（v1.1予定） */}
      <div className="pb-2">
        <input
          disabled
          placeholder="クイック入力（v1.1 で対応予定）"
          className="w-full rounded-lg border border-board-line bg-board-panel/60 px-3 py-2.5 text-sm placeholder:text-board-dim/60"
        />
      </div>

      {/* 接続状態バナー */}
      {!configured && (
        <button onClick={onOpenSettings} className="mb-2 rounded-md border border-board-amber/40 bg-board-amber/10 px-3 py-2.5 text-left text-sm text-board-amber">
          初回設定：GoogleクライアントIDとカレンダーの紐付けが必要です → 設定を開く
        </button>
      )}
      {configured && !authed && (
        <button onClick={() => void handleReconnect()} className="mb-2 rounded-md border border-board-amber/40 bg-board-amber/10 px-3 py-2.5 text-left text-sm text-board-amber">
          ⚡ Googleに接続して今週の予定を表示（タップ）
        </button>
      )}
      {loadError && <p className="mb-2 text-sm text-red-600">{loadError}</p>}

      {/* 終日予定 */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {allDayEvents.map((ev) => {
            const hex = (ev.colorId && COLOR_HEX[ev.colorId]) || ev.calendarHex || '#6b6a63';
            return (
              <button
                key={`${ev.calendarId}:${ev.id}`}
                onClick={() => setSelectedEvent(ev)}
                className="shrink-0 rounded px-2.5 py-1 text-sm"
                style={{ background: `${hex}1f`, color: hex, filter: 'brightness(0.85)' }}
              >
                {fmtDateShort(ev.start)} {ev.title}
              </button>
            );
          })}
        </div>
      )}

      {/* タイムライン */}
      <div className="relative overflow-hidden rounded-t-xl border border-board-line bg-board-panel/60">
        <Timeline
          days={days}
          events={timedEvents}
          draft={draft}
          draftHex={draftHex}
          draftLabel={subCategory ? subCategory.prefix || subCategory.name : '新規'}
          onSlot={handleSlot}
          onDraftChange={setDraft}
          onEventClick={setSelectedEvent}
          onEventDragEnd={(ev, day, startMin, endMin) => void handleEventDragEnd(ev, day, startMin, endMin)}
        />
      </div>
      {/* シート分の余白確保（作成シートが画面下を覆っても続きが見えるように） */}
      {draft && <div style={{ height: '55dvh' }} />}

      {draft && (
        <CreateSheet
          draft={draft}
          categoryId={categoryId}
          subCategory={subCategory}
          subCategories={settings.subCategories}
          title={title}
          target={target}
          hasSelfCalendar={hasSelfCalendar}
          enabledReminders={enabledReminders}
          hasOverlap={hasOverlap}
          canSave={!saveDisabledReason}
          saveDisabledReason={saveDisabledReason}
          busy={busy}
          onCategoryChange={(id) => {
            setCategoryId(id);
            setSubCategory(null);
          }}
          onSubCategoryChange={(sc) => applySubCategory(sc, draft)}
          onTitleChange={setTitle}
          onTargetChange={setTarget}
          onToggleReminder={(m) =>
            setEnabledReminders((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
          }
          onSave={() => void handleSave()}
          onClose={resetSheet}
        />
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={() => void handleDeleteSelected()}
          deleting={deletingSelected}
          onUpdate={handleUpdateSelected}
          saving={updatingSelected}
        />
      )}

      {snack && <Snackbar snack={snack} onDismiss={() => setSnack(null)} />}
    </div>
  );
}

function todayInWeek(days: Date[]) {
  const now = new Date();
  return days.some((d) => isSameDay(d, now));
}
