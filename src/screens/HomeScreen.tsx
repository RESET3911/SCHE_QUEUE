import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarTarget, Draft, GEvent, Settings, SubCategory } from '../types';
import { CATEGORIES, COLOR_HEX } from '../data/defaults';
import { addDays, dayStart, fmtDate, isSameDay } from '../lib/format';
import { connect, deleteEvent, getValidToken, insertEvent, listEvents } from '../lib/google';
import Timeline from '../components/Timeline';
import CreateSheet from '../components/CreateSheet';
import Snackbar, { type SnackState } from '../components/Snackbar';

interface Props {
  settings: Settings;
  onOpenSettings: () => void;
}

export default function HomeScreen({ settings, onOpenSettings }: Props) {
  const [date, setDate] = useState(() => dayStart(new Date()));
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

  const configured = !!settings.clientId;
  const calendarsMapped = !!settings.selfCalendarId && !!settings.familyCalendarId;

  const loadEvents = useCallback(async () => {
    const token = getValidToken();
    if (!token) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setLoadError(null);
    const from = dayStart(date);
    const to = addDays(from, 1);
    const calIds = [...new Set([settings.selfCalendarId, settings.familyCalendarId].filter(Boolean))];
    try {
      const results = await Promise.all(calIds.map((id) => listEvents(token, id, from, to)));
      setEvents(results.flat());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '予定の取得に失敗しました');
    }
  }, [date, settings.selfCalendarId, settings.familyCalendarId]);

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
  const handleSlot = (startMin: number, durMin: number) => {
    if (draft) {
      const dur = draft.endMin - draft.startMin;
      const s = Math.min(startMin, 1440 - dur);
      setDraft({ ...draft, startMin: s, endMin: s + dur });
      return;
    }
    setDraft({ startMin, endMin: Math.min(startMin + durMin, 1440), origin: 'timeline' });
  };

  // 大カテゴリボタン：直近の30分区切りに枠を作ってシートを開く
  const handleCategoryButton = (catId: string) => {
    setCategoryId(catId);
    setSubCategory(null);
    if (!draft) {
      const now = new Date();
      let startMin: number;
      if (isSameDay(date, now)) {
        startMin = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30, 1440 - 30);
      } else {
        startMin = 9 * 60;
      }
      setDraft({ startMin, endMin: startMin + 30, origin: 'category' });
    }
  };

  const hasOverlap = useMemo(() => {
    if (!draft) return false;
    const base = dayStart(date).getTime();
    return timedEvents.some((ev) => {
      const s = (ev.start.getTime() - base) / 60_000;
      const e = (ev.end.getTime() - base) / 60_000;
      return s < draft.endMin && e > draft.startMin;
    });
  }, [draft, timedEvents, date]);

  const saveDisabledReason = !configured
    ? '設定でGoogleクライアントIDを設定してください'
    : !authed
      ? 'Googleに接続すると登録できます'
      : !calendarsMapped
        ? '設定でカレンダーを紐付けてください'
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
      const calendarId = target === 'family' ? settings.familyCalendarId : settings.selfCalendarId;
      const base = dayStart(date);
      const start = new Date(base.getTime() + draft.startMin * 60_000);
      const end = new Date(base.getTime() + draft.endMin * 60_000);
      const summary = title.trim()
        ? `${subCategory.prefix}${title.trim()}`
        : subCategory.prefix || subCategory.name;
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

  const draftHex = subCategory ? COLOR_HEX[subCategory.colorId] : '#ffb52e';
  const today = isSameDay(date, new Date());

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      {/* ヘッダー：発車標風ワードマーク */}
      <header className="flex items-center justify-between pb-1 pl-[76px] pr-4 pt-3">
        <h1 className="font-mono text-sm font-bold tracking-[0.3em] text-board-amber">
          SCHE<span className="text-board-dim">/</span>QUEUE
        </h1>
        <button
          onClick={onOpenSettings}
          className="rounded-md px-2 py-1 text-sm text-board-dim hover:bg-board-raise"
          aria-label="設定"
        >
          ⚙ 設定
        </button>
      </header>

      {/* 日付ナビ */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button onClick={() => setDate((d) => addDays(d, -1))} className="rounded-md px-3 py-1 text-lg text-board-dim hover:bg-board-raise">‹</button>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold">{fmtDate(date)}</span>
          {!today && (
            <button onClick={() => setDate(dayStart(new Date()))} className="rounded border border-board-line px-2 py-0.5 text-xs text-board-amber">
              今日
            </button>
          )}
        </div>
        <button onClick={() => setDate((d) => addDays(d, 1))} className="rounded-md px-3 py-1 text-lg text-board-dim hover:bg-board-raise">›</button>
      </div>

      {/* 大カテゴリ6ボタン */}
      <div className="grid grid-cols-6 gap-1.5 px-4 pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => handleCategoryButton(c.id)}
            className="rounded-lg py-2 text-center text-[13px] font-bold leading-none transition-transform active:scale-95"
            style={{ background: `${c.badge}1f`, color: c.badge, border: `1px solid ${c.badge}55` }}
          >
            ＋{c.label}
          </button>
        ))}
      </div>

      {/* クイック入力（v1.1予定） */}
      <div className="px-4 pb-2">
        <input
          disabled
          placeholder="クイック入力（v1.1 で対応予定）"
          className="w-full rounded-lg border border-board-line bg-board-panel/60 px-3 py-2 text-sm placeholder:text-board-dim/50"
        />
      </div>

      {/* 接続状態バナー */}
      {!configured && (
        <button onClick={onOpenSettings} className="mx-4 mb-2 rounded-md border border-board-amber/40 bg-board-amber/10 px-3 py-2 text-left text-xs text-board-amber">
          初回設定：GoogleクライアントIDとカレンダーの紐付けが必要です → 設定を開く
        </button>
      )}
      {configured && !authed && (
        <button onClick={() => void handleReconnect()} className="mx-4 mb-2 rounded-md border border-board-amber/40 bg-board-amber/10 px-3 py-2 text-left text-xs text-board-amber">
          ⚡ Googleに接続して今日の予定を表示（タップ）
        </button>
      )}
      {loadError && <p className="mx-4 mb-2 text-xs text-red-400">{loadError}</p>}

      {/* 終日予定 */}
      {allDayEvents.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-1.5">
          {allDayEvents.map((ev) => {
            const hex = (ev.colorId && COLOR_HEX[ev.colorId]) || '#8b98a9';
            return (
              <span key={`${ev.calendarId}:${ev.id}`} className="shrink-0 rounded px-2 py-0.5 text-xs" style={{ background: `${hex}26`, color: hex, filter: 'brightness(1.4)' }}>
                {ev.title}
              </span>
            );
          })}
        </div>
      )}

      {/* タイムライン */}
      <div className="relative mx-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-board-line bg-board-panel/40">
        <Timeline
          date={date}
          events={timedEvents}
          draft={draft}
          draftHex={draftHex}
          draftLabel={subCategory ? subCategory.prefix || subCategory.name : '新規'}
          onSlot={handleSlot}
          onDraftChange={setDraft}
        />
        {/* シート分の余白確保 */}
        {draft && <div className="h-[52dvh] shrink-0 md:h-[40dvh]" />}
      </div>

      {draft && (
        <CreateSheet
          draft={draft}
          categoryId={categoryId}
          subCategory={subCategory}
          subCategories={settings.subCategories}
          title={title}
          target={target}
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

      {snack && <Snackbar snack={snack} onDismiss={() => setSnack(null)} />}
    </div>
  );
}
