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
}

export interface GEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  colorId?: string;
  allDay: boolean;
}

// 選択中の日の 0:00 からの経過分で予定枠を表す
export interface Draft {
  startMin: number;
  endMin: number;
  origin: 'timeline' | 'category';
}
