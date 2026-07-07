import { useEffect, useState } from 'react';
import type { GCalendar, Settings, SubCategory } from '../types';
import { CATEGORIES, COLOR_HEX, DEFAULT_SUBCATEGORIES, PICKABLE_COLORS, REMINDER_PRESETS } from '../data/defaults';
import { fmtReminder } from '../lib/format';
import { connect, disconnect, getValidToken, listCalendars } from '../lib/google';
import Sheet from '../components/ui/Sheet';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}

const DURATIONS = [30, 60, 90, 120, 180];

export default function SettingsScreen({ settings, onChange, onBack }: Props) {
  const [clientIdInput, setClientIdInput] = useState(settings.clientId);
  const [authed, setAuthed] = useState(() => !!getValidToken());
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubCategory | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadCalendars = async (token: string) => {
    try {
      setCalendars(await listCalendars(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'カレンダー一覧の取得に失敗しました');
    }
  };

  useEffect(() => {
    const token = getValidToken();
    if (token) void loadCalendars(token);
  }, []);

  const handleConnect = async () => {
    const cid = clientIdInput.trim();
    if (!cid) {
      setError('クライアントIDを入力してください');
      return;
    }
    onChange({ ...settings, clientId: cid });
    try {
      const token = await connect(cid);
      setAuthed(true);
      await loadCalendars(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続に失敗しました');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setAuthed(false);
    setCalendars([]);
  };

  const saveSub = (sc: SubCategory) => {
    const next = isNew
      ? [...settings.subCategories, sc]
      : settings.subCategories.map((s) => (s.id === sc.id ? sc : s));
    onChange({ ...settings, subCategories: next });
    setEditing(null);
  };

  const deleteSub = (id: string) => {
    onChange({ ...settings, subCategories: settings.subCategories.filter((s) => s.id !== id) });
    setEditing(null);
  };

  const calendarSelect = (label: string, value: string, onSel: (id: string) => void) => (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-board-dim">{label}</span>
      <select
        value={value}
        onChange={(e) => onSel(e.target.value)}
        className="w-full rounded-md border border-board-line bg-board-base px-2 py-1.5 text-sm"
      >
        <option value="">未設定</option>
        {calendars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.summary}{c.primary ? '（メイン）' : ''}
          </option>
        ))}
        {/* 一覧未取得でも既存設定値は表示する */}
        {value && !calendars.some((c) => c.id === value) && <option value={value}>{value}</option>}
      </select>
    </div>
  );

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="flex items-center gap-2 pb-2 pl-[76px] pr-4 pt-3">
        <button onClick={onBack} className="rounded-md px-2 py-1 text-board-dim hover:bg-board-raise">‹ 戻る</button>
        <h1 className="font-mono text-sm font-bold tracking-[0.2em] text-board-amber">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Google接続 */}
        <section className="rounded-xl border border-board-line bg-board-panel p-4">
          <h2 className="text-sm font-bold">Google接続</h2>
          <p className="mt-1 text-xs leading-relaxed text-board-dim">
            Google Cloud Console で OAuth クライアントID（ウェブアプリ）を作成し、
            「承認済みの JavaScript 生成元」にこのアプリのURL（開発時は http://localhost:5173）を追加。
            Google Calendar API を有効化してから、下にクライアントIDを貼り付けてください。
          </p>
          <input
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            className="mt-2 w-full rounded-md border border-board-line bg-board-base px-2.5 py-2 font-mono text-xs placeholder:text-board-dim/50"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => void handleConnect()}
              className="rounded-md bg-board-amber px-4 py-2 text-sm font-bold text-board-base"
            >
              {authed ? '再接続' : 'Googleに接続'}
            </button>
            {authed && (
              <>
                <span className="text-xs text-emerald-400">● 接続済み</span>
                <button onClick={handleDisconnect} className="ml-auto text-xs text-board-dim underline">
                  切断
                </button>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </section>

        {/* カレンダー紐付け */}
        <section className="mt-3 rounded-xl border border-board-line bg-board-panel p-4">
          <h2 className="text-sm font-bold">カレンダー紐付け</h2>
          <p className="mt-1 text-xs text-board-dim">
            サブカテゴリの「登録先」に応じて、ここで選んだカレンダーに予定が入ります。
          </p>
          {calendarSelect('自分用', settings.selfCalendarId, (id) => onChange({ ...settings, selfCalendarId: id }))}
          {calendarSelect('ファミリー', settings.familyCalendarId, (id) => onChange({ ...settings, familyCalendarId: id }))}
          {!authed && <p className="mt-2 text-xs text-board-dim">※ カレンダー一覧の取得にはGoogle接続が必要です</p>}
        </section>

        {/* サブカテゴリ管理 */}
        <section className="mt-3 rounded-xl border border-board-line bg-board-panel p-4">
          <h2 className="text-sm font-bold">サブカテゴリ</h2>
          {CATEGORIES.map((cat) => {
            const subs = settings.subCategories.filter((s) => s.categoryId === cat.id);
            return (
              <div key={cat.id} className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: cat.badge }}>＋{cat.label}</span>
                  <button
                    onClick={() => {
                      setIsNew(true);
                      setEditing({
                        id: `sc-${Date.now()}`,
                        categoryId: cat.id,
                        name: '',
                        prefix: '',
                        target: 'self',
                        colorId: '9',
                        reminders: [30],
                        defaultDurationMin: 60,
                      });
                    }}
                    className="text-xs text-board-amber"
                  >
                    ＋追加
                  </button>
                </div>
                <div className="mt-1.5 space-y-1">
                  {subs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setIsNew(false);
                        setEditing(s);
                      }}
                      className="flex w-full items-center gap-2 rounded-md border border-board-line bg-board-base px-2.5 py-2 text-left text-sm hover:bg-board-raise"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COLOR_HEX[s.colorId] }} />
                      <span className="font-medium">{s.name}</span>
                      {s.prefix && <span className="text-xs text-board-dim">{s.prefix}</span>}
                      <span className="ml-auto font-mono text-[10px] text-board-dim">
                        {s.target === 'family' ? 'ファミリー' : '自分用'}・{s.defaultDurationMin}分・
                        {s.reminders.map(fmtReminder).join('/')}
                      </span>
                    </button>
                  ))}
                  {subs.length === 0 && <p className="text-xs text-board-dim">なし</p>}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => {
              if (window.confirm('サブカテゴリを初期設定に戻しますか？（追加・編集した内容は消えます）')) {
                onChange({ ...settings, subCategories: DEFAULT_SUBCATEGORIES });
              }
            }}
            className="mt-4 text-xs text-board-dim underline"
          >
            サブカテゴリを初期設定に戻す
          </button>
        </section>
      </div>

      {editing && (
        <SubCategoryEditor
          sub={editing}
          isNew={isNew}
          onSave={saveSub}
          onDelete={deleteSub}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SubCategoryEditor({
  sub,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  sub: SubCategory;
  isNew: boolean;
  onSave: (s: SubCategory) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SubCategory>(sub);
  const set = <K extends keyof SubCategory>(k: K, v: SubCategory[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const row = (label: string, node: React.ReactNode) => (
    <div className="mt-3 flex items-start gap-3">
      <span className="mt-1.5 w-16 shrink-0 text-xs text-board-dim">{label}</span>
      <div className="min-w-0 flex-1">{node}</div>
    </div>
  );

  return (
    <Sheet title={isNew ? 'サブカテゴリを追加' : 'サブカテゴリを編集'} onClose={onClose}>
      {row('カテゴリ', (
        <select
          value={draft.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
          className="w-full rounded-md border border-board-line bg-board-base px-2 py-1.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>＋{c.label}</option>
          ))}
        </select>
      ))}
      {row('名前', (
        <input
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="例: チェック"
          className="w-full rounded-md border border-board-line bg-board-base px-2.5 py-1.5 text-sm"
        />
      ))}
      {row('接頭辞', (
        <input
          value={draft.prefix}
          onChange={(e) => set('prefix', e.target.value)}
          placeholder="例:【確認】"
          className="w-full rounded-md border border-board-line bg-board-base px-2.5 py-1.5 text-sm"
        />
      ))}
      {row('色', (
        <div className="flex flex-wrap gap-1.5">
          {PICKABLE_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => set('colorId', c.id)}
              title={c.label}
              className={`h-8 w-8 rounded-md transition-transform ${draft.colorId === c.id ? 'scale-110 ring-2 ring-white' : 'opacity-70'}`}
              style={{ background: COLOR_HEX[c.id] }}
            />
          ))}
        </div>
      ))}
      {row('登録先', (
        <div className="flex overflow-hidden rounded-md border border-board-line font-mono text-sm">
          {(['self', 'family'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set('target', t)}
              className={`px-3 py-1.5 ${draft.target === t ? 'bg-board-amber font-bold text-board-base' : 'text-board-dim'}`}
            >
              {t === 'self' ? '自分用' : 'ファミリー'}
            </button>
          ))}
        </div>
      ))}
      {row('所要時間', (
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => set('defaultDurationMin', d)}
              className={`rounded-full border px-3 py-1 text-xs ${
                draft.defaultDurationMin === d
                  ? 'border-board-amber bg-board-amber/15 text-board-amber'
                  : 'border-board-line text-board-dim'
              }`}
            >
              {d}分
            </button>
          ))}
        </div>
      ))}
      {row('通知', (
        <div className="space-y-1.5">
          {REMINDER_PRESETS.map((p) => {
            const active = JSON.stringify(draft.reminders) === JSON.stringify(p.minutes);
            return (
              <button
                key={p.id}
                onClick={() => set('reminders', p.minutes)}
                className={`block w-full rounded-md border px-3 py-1.5 text-left text-xs ${
                  active
                    ? 'border-board-amber bg-board-amber/15 text-board-amber'
                    : 'border-board-line text-board-dim'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => draft.name.trim() && onSave({ ...draft, name: draft.name.trim() })}
          disabled={!draft.name.trim()}
          className="flex-1 rounded-lg bg-board-amber py-2.5 font-bold text-board-base disabled:opacity-30"
        >
          保存
        </button>
        {!isNew && (
          <button
            onClick={() => window.confirm(`「${sub.name}」を削除しますか？`) && onDelete(sub.id)}
            className="rounded-lg border border-red-500/40 px-4 py-2.5 text-sm text-red-400"
          >
            削除
          </button>
        )}
      </div>
    </Sheet>
  );
}
