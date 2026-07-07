export const pad2 = (n: number) => String(n).padStart(2, '0');

export const fmtTime = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export const fmtDate = (d: Date) =>
  `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;

export function fmtReminder(min: number): string {
  if (min >= 1440 && min % 1440 === 0) {
    const days = min / 1440;
    return days === 1 ? '前日' : `${days}日前`;
  }
  if (min >= 60 && min % 60 === 0) return `${min / 60}時間前`;
  return `${min}分前`;
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
