import type { Category, SubCategory } from '../types';

// 大カテゴリ6種（固定）。badge はUI上の路線カラー風の色
export const CATEGORIES: Category[] = [
  { id: 'plan', label: '予定', badge: '#38bdf8' },
  { id: 'work', label: '仕事', badge: '#5b8cff' },
  { id: 'rena', label: 'れな', badge: '#f47bb0' },
  { id: 'money', label: 'お金', badge: '#f0a020' },
  { id: 'home', label: '家', badge: '#34d399' },
  { id: 'deadline', label: '締切', badge: '#f4574d' },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);

// Google Calendar イベント色（全11色、既存予定の描画用）
export const COLOR_HEX: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6c026',
  '6': '#f5511d',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d50000',
};

export const DEFAULT_EVENT_HEX = '#4285f4';

// サブカテゴリ作成時に選べる色（仕様2.3の6系統）
export const PICKABLE_COLORS: { id: string; label: string }[] = [
  { id: '9', label: '青（仕事系）' },
  { id: '3', label: '紫（作業系）' },
  { id: '11', label: '赤（締切・支払い系）' },
  { id: '10', label: '緑（家の予定）' },
  { id: '4', label: 'ピンク（れな関連）' },
  { id: '5', label: '黄（仮予定）' },
];

// 通知プリセット（仕様2.4）
export const REMINDER_PRESETS: { id: string; label: string; minutes: number[] }[] = [
  { id: 'normal', label: '通常（30分前）', minutes: [30] },
  { id: 'check', label: 'チェック（1時間前・10分前）', minutes: [60, 10] },
  { id: 'deadline', label: '締切（前日・3時間前・1時間前）', minutes: [1440, 180, 60] },
  { id: 'payment', label: '支払い（3日前・前日）', minutes: [4320, 1440] },
  { id: 'hospital', label: '病院（前日・2時間前）', minutes: [1440, 120] },
];

export const DEFAULT_SUBCATEGORIES: SubCategory[] = [
  // ＋予定
  { id: 'plan-normal', categoryId: 'plan', name: '予定', prefix: '', target: 'self', colorId: '7', reminders: [30], defaultDurationMin: 60 },
  { id: 'plan-tentative', categoryId: 'plan', name: '仮予定', prefix: '【仮】', target: 'self', colorId: '5', reminders: [30], defaultDurationMin: 60 },
  // ＋仕事
  { id: 'work-task', categoryId: 'work', name: '作業', prefix: '【作業】', target: 'self', colorId: '3', reminders: [30], defaultDurationMin: 60 },
  { id: 'work-check', categoryId: 'work', name: 'チェック', prefix: '【確認】', target: 'self', colorId: '9', reminders: [60, 10], defaultDurationMin: 30 },
  { id: 'work-mtg', categoryId: 'work', name: 'MTG', prefix: '【MTG】', target: 'self', colorId: '9', reminders: [30, 10], defaultDurationMin: 60 },
  { id: 'work-delivery', categoryId: 'work', name: '納品', prefix: '【納品】', target: 'self', colorId: '11', reminders: [1440, 180, 60], defaultDurationMin: 30 },
  { id: 'work-render', categoryId: 'work', name: 'レンダー', prefix: '【レンダー】', target: 'self', colorId: '3', reminders: [30], defaultDurationMin: 60 },
  // ＋れな
  { id: 'rena-hospital', categoryId: 'rena', name: '病院', prefix: '【病院】', target: 'family', colorId: '4', reminders: [1440, 120], defaultDurationMin: 60 },
  { id: 'rena-health', categoryId: 'rena', name: '体調', prefix: '【体調】', target: 'family', colorId: '4', reminders: [30], defaultDurationMin: 30 },
  { id: 'rena-outing', categoryId: 'rena', name: '外出', prefix: '【外出】', target: 'family', colorId: '4', reminders: [60], defaultDurationMin: 120 },
  { id: 'rena-anniversary', categoryId: 'rena', name: '記念日', prefix: '【記念日】', target: 'family', colorId: '4', reminders: [1440], defaultDurationMin: 60 },
  { id: 'rena-todo', categoryId: 'rena', name: 'やること', prefix: '【やること】', target: 'family', colorId: '4', reminders: [30], defaultDurationMin: 30 },
  // ＋お金
  { id: 'money-invoice', categoryId: 'money', name: '請求書', prefix: '【請求】', target: 'self', colorId: '11', reminders: [4320, 1440], defaultDurationMin: 30 },
  // ＋家
  { id: 'home-plan', categoryId: 'home', name: '家の予定', prefix: '【家】', target: 'family', colorId: '10', reminders: [30], defaultDurationMin: 60 },
  // ＋締切
  { id: 'deadline-due', categoryId: 'deadline', name: '締切', prefix: '【締切】', target: 'self', colorId: '11', reminders: [1440, 180, 60], defaultDurationMin: 30 },
  { id: 'deadline-payment', categoryId: 'deadline', name: '支払い', prefix: '【支払】', target: 'self', colorId: '11', reminders: [4320, 1440], defaultDurationMin: 30 },
];
