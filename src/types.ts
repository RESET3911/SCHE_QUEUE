export type CalendarTarget = 'self' | 'family';

export interface Category {
  id: string;
  label: string;
  badge: string; // 路線カラー風のUIバッジ色
}

export interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
  prefix: string; // タイトル接頭辞（例:【確認】）
  target: CalendarTarget;
  colorId: string; // Google Calendar colorId '1'〜'11'
  reminders: number[]; // 通知タイミング（分前）
  defaultDurationMin: number;
}

export interface Settings {
  clientId: string;
  selfCalendarId: string;
  familyCalendarId: string;
  subCategories: SubCategory[];
}

export interface GCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string; // Googleカレンダー側で割り当てられたカレンダー自体の色
}

export interface GEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  colorId?: string;
  allDay: boolean;
  calendarHex?: string; // colorId未設定イベント用のフォールバック色（カレンダー既定色）
}

// 対象日の 0:00 からの経過分で予定枠を表す
export interface Draft {
  day: Date; // dayStart（週表示のどの列に属するか）
  startMin: number;
  endMin: number;
  origin: 'timeline' | 'category';
}
