import type { Draft, SubCategory, CalendarTarget } from '../types';
import { CATEGORIES, COLOR_HEX } from '../data/defaults';
import { fmtDateShort, fmtReminder, fmtTime } from '../lib/format';

// 予定作成シート。タイムラインで枠をドラッグ調整できるよう、バックドロップなしの
// 非モーダル構成にしている（シート表示中もタイムラインは操作可能）。

interface Props {
  draft: Draft;
  categoryId: string;
  subCategory: SubCategory | null;
  subCategories: SubCategory[];
  title: string;
  target: CalendarTarget;
  hasSelfCalendar: boolean;
  enabledReminders: number[];
  hasOverlap: boolean;
  canSave: boolean;
  saveDisabledReason: string | null;
  busy: boolean;
  onCategoryChange: (id: string) => void;
  onSubCategoryChange: (sc: SubCategory) => void;
  onTitleChange: (t: string) => void;
  onTargetChange: (t: CalendarTarget) => void;
  onToggleReminder: (min: number) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function CreateSheet(p: Props) {
  const subs = p.subCategories.filter((s) => s.categoryId === p.categoryId);

  return (
    <div className="animate-sheet-up fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl rounded-t-2xl border-t border-x border-board-line bg-board-panel shadow-[0_-12px_40px_rgba(0,0,0,0.18)]">
      {/* ヘッダー：時刻表示 */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="font-mono text-lg font-semibold tracking-wide text-board-amber">
          <span className="mr-2 text-sm text-board-text">{fmtDateShort(p.draft.day)}</span>
          {fmtTime(p.draft.startMin)}
          <span className="mx-1 text-board-dim">–</span>
          {fmtTime(p.draft.endMin)}
          <span className="ml-2 text-sm font-normal text-board-dim">枠はドラッグで調整</span>
        </div>
        <button
          onClick={p.onClose}
          className="rounded-full px-2.5 py-1 text-sm text-board-dim hover:bg-board-raise"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[52dvh] overflow-y-auto px-4 pb-4 pt-2">
        {/* 大カテゴリ */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => {
            const active = c.id === p.categoryId;
            return (
              <button
                key={c.id}
                onClick={() => p.onCategoryChange(c.id)}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-bold transition-colors"
                style={
                  active
                    ? { background: c.badge, color: '#1c1b18' }
                    : { background: '#ecece6', color: c.badge }
                }
              >
                ＋{c.label}
              </button>
            );
          })}
        </div>

        {/* サブカテゴリ */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {subs.length === 0 && (
            <p className="text-sm text-board-dim">このカテゴリにサブカテゴリがありません（設定から追加できます）</p>
          )}
          {subs.map((s) => {
            const active = p.subCategory?.id === s.id;
            const hex = COLOR_HEX[s.colorId];
            return (
              <button
                key={s.id}
                onClick={() => p.onSubCategoryChange(s)}
                className="rounded-full border px-3 py-1 text-sm transition-colors"
                style={
                  active
                    ? { borderColor: hex, background: `${hex}26`, color: '#1c1b18', fontWeight: 700 }
                    : { borderColor: 'rgba(30,27,20,0.18)', color: '#4b4a45' }
                }
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: hex }} />
                {s.name}
              </button>
            );
          })}
        </div>

        {/* タイトル */}
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-board-line bg-board-base px-2.5 py-2">
          {p.subCategory?.prefix && (
            <span className="shrink-0 rounded bg-board-raise px-1.5 py-0.5 text-sm font-bold text-board-amber">
              {p.subCategory.prefix}
            </span>
          )}
          <input
            value={p.title}
            onChange={(e) => p.onTitleChange(e.target.value)}
            placeholder={p.subCategory ? `内容（空欄なら「${p.subCategory.name}」）` : '内容を入力'}
            className="w-full bg-transparent text-sm outline-none placeholder:text-board-dim/60"
          />
        </div>

        {/* 共有範囲（自分用カレンダー未設定なら全てファミリーに登録されるため非表示） */}
        {p.hasSelfCalendar && (
          <div className="mt-3 flex items-center gap-3">
            <span className="w-14 text-sm text-board-dim">登録先</span>
            <div className="flex overflow-hidden rounded-md border border-board-line font-mono text-sm">
              {(['self', 'family'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => p.onTargetChange(t)}
                  className={`px-3 py-1.5 transition-colors ${
                    p.target === t ? 'bg-board-amber font-bold text-board-base' : 'text-board-dim'
                  }`}
                >
                  {t === 'self' ? '自分用' : 'ファミリー'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 通知 */}
        <div className="mt-3 flex items-start gap-3">
          <span className="mt-1 w-14 shrink-0 text-sm text-board-dim">通知</span>
          <div className="flex flex-wrap gap-1.5">
            {(p.subCategory?.reminders ?? []).map((m) => {
              const on = p.enabledReminders.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => p.onToggleReminder(m)}
                  className={`rounded-full border px-2.5 py-0.5 text-sm transition-colors ${
                    on
                      ? 'border-board-amber/60 bg-board-amber/15 text-board-amber'
                      : 'border-board-line text-board-dim line-through'
                  }`}
                >
                  {fmtReminder(m)}
                </button>
              );
            })}
            {!p.subCategory && <span className="text-sm text-board-dim">サブカテゴリを選択</span>}
          </div>
        </div>

        {/* 重複警告 */}
        {p.hasOverlap && (
          <p className="mt-3 rounded-md border border-board-amber/40 bg-board-amber/10 px-3 py-1.5 text-sm text-board-amber">
            ⚠ 既存の予定と重複しています
          </p>
        )}

        {p.saveDisabledReason && (
          <p className="mt-3 text-sm text-board-dim">{p.saveDisabledReason}</p>
        )}

        {/* 保存 */}
        <button
          onClick={p.onSave}
          disabled={!p.canSave || p.busy}
          className="mt-3 w-full rounded-lg bg-board-amber py-3 font-mono text-base font-bold tracking-widest text-board-base transition-opacity disabled:opacity-30"
        >
          {p.busy ? '登録中…' : '登 録 す る'}
        </button>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
