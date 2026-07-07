// 重なる予定を Google カレンダー風に横並びで配置するための列割り当て。
// 重なり合う一連の予定（クラスタ）ごとに列数を確定し、各予定に col / cols を与える。
export interface ColumnPos {
  col: number;
  cols: number;
}

export function layoutColumns<T>(
  items: T[],
  getStart: (t: T) => number,
  getEnd: (t: T) => number,
): Map<T, ColumnPos> {
  const res = new Map<T, ColumnPos>();
  const sorted = [...items].sort((a, b) => getStart(a) - getStart(b) || getEnd(b) - getEnd(a));

  let cluster: T[] = [];
  let clusterEnd = -Infinity;
  let colEnds: number[] = [];

  const flush = () => {
    const cols = colEnds.length;
    for (const it of cluster) res.get(it)!.cols = cols;
    cluster = [];
    colEnds = [];
    clusterEnd = -Infinity;
  };

  for (const it of sorted) {
    const start = getStart(it);
    const end = Math.max(getEnd(it), start + 1);
    if (cluster.length > 0 && start >= clusterEnd) flush();

    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else {
      colEnds[col] = end;
    }
    res.set(it, { col, cols: 0 });
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return res;
}
