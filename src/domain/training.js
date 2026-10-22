import FIXED from '../data/problems.json';
import MATERIALS from '../data/materials.json';

export const TODAY = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const validDate = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  s >= '2000-01-01' &&
  s <= '2199-12-31' &&
  Number.isFinite(Date.parse(s + 'T12:00:00Z')) &&
  new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
export function dateAdd(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const dateDiff = (a, b) =>
  Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
export function fmt(s) {
  if (!validDate(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${+m}月${+d}日`;
}
export const safe = (t) =>
  String(t ?? '').replace(
    /[&<>"']/g,
    (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x],
  );
export const cleanText = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
export const validId = (s) => typeof s === 'string' && /^(lc|custom)-[1-9]\d{0,7}$/.test(s);
export const RATINGS = ['red', 'yellow', 'green'];
export const defaultState = () => ({
  version: 3,
  startDate: TODAY(),
  maxReviews: 5,
  logs: {},
  notes: {},
  custom: [],
  materials: {},
  dueOverrides: {},
});
export function canonicalUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (
      u.protocol !== 'https:' ||
      !['leetcode.cn', 'leetcode.com', 'www.leetcode.cn', 'www.leetcode.com'].includes(
        u.hostname,
      ) ||
      u.username ||
      u.password ||
      u.port
    )
      return '';
    const m = u.pathname.match(/^\/problems\/([A-Za-z0-9_-]+)(?:\/|$)/);
    return m ? `https://${u.hostname.replace(/^www\./, '')}/problems/${m[1]}/` : '';
  } catch {
    return '';
  }
}
export const slugOf = (url) => {
  const c = canonicalUrl(url);
  return c ? new URL(c).pathname.split('/')[2].toLowerCase() : '';
};
export function referenceUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}
export function normalizeLogs(arr) {
  const daily = new Map();
  for (const h of Array.isArray(arr) ? arr : []) {
    if (!h || !validDate(h.date) || !RATINGS.includes(h.rating)) continue;
    daily.set(h.date, {
      date: h.date,
      rating: h.rating,
      kind: h.kind === 'review' ? 'review' : 'new',
    });
  }
  return [...daily.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h, i) => ({ ...h, kind: i ? 'review' : 'new' }));
}
export function normalizeState(raw) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    !validDate(raw.startDate) ||
    !raw.logs ||
    typeof raw.logs !== 'object' ||
    Array.isArray(raw.logs) ||
    !raw.notes ||
    typeof raw.notes !== 'object' ||
    Array.isArray(raw.notes) ||
    !Array.isArray(raw.custom)
  )
    throw Error('备份结构不正确：需要训练起始日期、记录、笔记和自定义题目。');
  const s = {
    ...defaultState(),
    startDate: raw.startDate,
    maxReviews: [2, 3, 4, 5, 6, 8, 10, 15, 20].includes(raw.maxReviews) ? raw.maxReviews : 5,
  };
  const seen = new Set(FIXED.map((p) => p.num)),
    slugs = new Set(FIXED.map((p) => slugOf(p.url)));
  for (const p of raw.custom) {
    if (
      !p ||
      !Number.isInteger(p.num) ||
      p.num < 1 ||
      p.num > 99999999 ||
      seen.has(p.num) ||
      typeof p.title !== 'string' ||
      !p.title.trim()
    )
      continue;
    const url = canonicalUrl(p.url),
      slug = slugOf(url);
    if (slug && slugs.has(slug)) continue;
    seen.add(p.num);
    if (slug) slugs.add(slug);
    s.custom.push({
      key: 'custom-' + p.num,
      num: p.num,
      title: p.title.slice(0, 100),
      topic: cleanText(p.topic, 40) || '综合',
      diff: ['简单', '中等', '困难'].includes(p.diff) ? p.diff : '中等',
      origin: 'extra',
      url,
      day:
        Number.isInteger(p.day) && p.day > 0 && p.day < 10000
          ? p.day
          : validDate(p.plannedDate)
            ? null
            : 10 + Math.floor(s.custom.length / 10),
      plannedDate: validDate(p.plannedDate) ? p.plannedDate : null,
      addedAt: validDate(p.addedAt) ? p.addedAt : TODAY(),
    });
  }
  const known = new Set([...FIXED, ...s.custom].map((p) => p.key));
  for (const [id, arr] of Object.entries(raw.logs))
    if (validId(id) && known.has(id)) s.logs[id] = normalizeLogs(arr).slice(-2000);
  for (const [id, n] of Object.entries(raw.notes))
    if (validId(id) && known.has(id) && typeof n === 'string') s.notes[id] = n.slice(0, 20000);
  for (const [id, m] of Object.entries(raw.materials || {})) {
    if (!validId(id) || !known.has(id) || !m || typeof m !== 'object') continue;
    s.materials[id] = {};
    for (const [k, max] of Object.entries({
      solution: 100000,
      memory: 5000,
      complexity: 500,
      language: 30,
      source: 80,
      sourceUrl: 2000,
    }))
      if (typeof m[k] === 'string') s.materials[id][k] = m[k].slice(0, max);
    s.materials[id].sourceUrl = referenceUrl(s.materials[id].sourceUrl) || '';
  }
  for (const [id, o] of Object.entries(raw.dueOverrides || {}))
    if (known.has(id) && o && validDate(o.date) && typeof o.basedOn === 'string')
      s.dueOverrides[id] = {
        date: o.date,
        basedOn: o.basedOn,
        setOn: validDate(o.setOn) ? o.setOn : TODAY(),
      };
  return s;
}

export function createModel(state, viewDate = TODAY()) {
  const allProblems = () => [...FIXED, ...state.custom];
  const getProblem = (id) => allProblems().find((p) => p.key === id);
  const material = (p) => ({ ...MATERIALS[p.key], ...state.materials[p.key] });
  const trainingDay = (date = viewDate) => dateDiff(date, state.startDate) + 1;
  const plannedDate = (p) => p.plannedDate || dateAdd(state.startDate, p.day - 1);
  const planned = (date = viewDate) => allProblems().filter((p) => plannedDate(p) === date);
  const history = (id, date = viewDate) => (state.logs[id] || []).filter((h) => h.date <= date);
  const last = (id, date = viewDate) => history(id, date).at(-1) || null;
  const ratingName = (r) => ({ red: '未掌握', yellow: '待巩固', green: '已掌握' })[r] || '未练习';
  const fmtDay = (d) => (d < 1 ? '尚未开始' : 'D' + d);
  function timeToNext(id, date = viewDate) {
    const hs = history(id, date),
      x = hs.at(-1);
    if (!x) return null;
    let streak = 0;
    for (let i = hs.length - 1; i >= 0 && hs[i].rating === 'green'; i--) streak++;
    const days =
      x.rating === 'red' ? 1 : x.rating === 'yellow' ? 3 : streak >= 3 ? 45 : streak === 2 ? 21 : 7;
    const auto = dateAdd(x.date, days),
      o = state.dueOverrides[id],
      manual = o && o.basedOn === `${x.date}:${x.rating}` && o.setOn <= date;
    return { date: manual ? o.date : auto, days, last: x, streak, manual: !!manual };
  }
  function dueList(date = viewDate) {
    return allProblems()
      .map((p) => ({ p, latest: last(p.key, date), next: timeToNext(p.key, date) }))
      .filter((x) => x.next && x.next.date <= date && x.latest.date < date)
      .sort(
        (a, b) =>
          RATINGS.indexOf(a.latest.rating) - RATINGS.indexOf(b.latest.rating) ||
          a.next.date.localeCompare(b.next.date) ||
          a.p.num - b.p.num,
      );
  }
  function counts(date = viewDate) {
    const c = { solved: 0, red: 0, yellow: 0, green: 0, official: 0, extra: 0, qualified: 0 };
    for (const p of allProblems()) {
      const hs = history(p.key, date),
        h = hs.at(-1);
      if (!h) continue;
      c.solved++;
      c[h.rating]++;
      c[p.origin === 'official' ? 'official' : 'extra']++;
      if (
        hs.length > 1 &&
        h.rating === 'green' &&
        hs.at(-2).rating === 'green' &&
        dateDiff(h.date, hs.at(-2).date) >= 7
      )
        c.qualified++;
    }
    return c;
  }
  const doneOn = (date = viewDate) =>
    allProblems().filter((p) => (state.logs[p.key] || []).some((h) => h.date === date));
  const backlog = (date = viewDate) =>
    allProblems().filter((p) => plannedDate(p) < date && !last(p.key, date));
  return {
    allProblems,
    getProblem,
    material,
    trainingDay,
    plannedDate,
    planned,
    history,
    last,
    timeToNext,
    dueList,
    counts,
    doneOn,
    backlog,
  };
}
