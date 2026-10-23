import {
  canonicalUrl,
  createModel,
  normalizeLogs,
  RATINGS,
  referenceUrl,
  slugOf,
  TODAY,
  validDate,
} from './training';

export const ratingName = (rating) =>
  ({ red: '未掌握', yellow: '待巩固', green: '已掌握' })[rating] || '未练习';

export function applyGrade(state, id, date, rating, today = TODAY()) {
  if (!createModel(state, date).getProblem(id) || !validDate(date) || !RATINGS.includes(rating))
    throw Error('练习信息不完整。');
  if (date > today) throw Error('不能提前记录未来的练习，请先保存为待做。');
  const next = structuredClone(state);
  next.logs[id] = normalizeLogs([
    ...(next.logs[id] || []).filter((h) => h.date !== date),
    { date, rating },
  ]);
  delete next.dueOverrides[id];
  if (next.relearnPending?.[id] && date >= next.relearnPending[id].date)
    delete next.relearnPending[id];
  return next;
}

export function saveProblem(state, fields, { id, practice = false, mode = 'edit' } = {}) {
  const model = createModel(state),
    old = model.getProblem(id);
  if (id && !old) throw Error('题目已删除，请先到回收站恢复。');
  const url = canonicalUrl(fields.url),
    num = Number(fields.num),
    title = fields.title.trim();
  if (!url) throw Error('请填写完整的 LeetCode 题目链接。');
  if (
    !Number.isInteger(num) ||
    num < 1 ||
    num > 99999999 ||
    !title ||
    title.length > 100 ||
    !validDate(fields.date)
  )
    throw Error('请完整填写有效题号、题名和日期。');
  if (mode === 'solved' && (!RATINGS.includes(fields.rating) || fields.date > TODAY()))
    throw Error(fields.date > TODAY() ? '未来日期只能加入待做。' : '请选择本次评级。');
  const duplicate = createModel({ ...state, deleted: [] })
    .allProblems()
    .find((p) => p.key !== id && (p.num === num || slugOf(p.url) === slugOf(url)));
  if (duplicate)
    throw Error(
      `已存在 ${duplicate.num}. ${duplicate.title}，请使用已有题目；已删除的题目请先到回收站恢复。`,
    );
  if (old && !id.startsWith('custom-') && slugOf(old.url) !== slugOf(url))
    throw Error('预设题目的链接必须对应原题。');
  const next = structuredClone(state),
    key = id || `custom-${num}`;
  const info = {
    title,
    topic: fields.topic.trim().slice(0, 40) || '综合',
    diff: ['简单', '中等', '困难'].includes(fields.diff) ? fields.diff : '中等',
    url,
  };
  if (!old)
    next.custom.push({
      ...info,
      key,
      num,
      origin: 'extra',
      plannedDate: fields.date,
      day: null,
      addedAt: TODAY(),
    });
  else if (id.startsWith('custom-'))
    Object.assign(
      next.custom.find((p) => p.key === id),
      info,
      practice ? {} : { plannedDate: fields.date },
    );
  const base = old ? model.material(old) : {};
  const changed = ['solution', 'memory', 'complexity'].some(
    (k) => (fields[k] || '') !== (base[k] || ''),
  );
  next.materials[key] = {
    solution: fields.solution.slice(0, 100000),
    memory: fields.memory.slice(0, 5000),
    complexity: fields.complexity.slice(0, 500),
    language: fields.language.slice(0, 30) || 'Python 3',
    source: changed || !old ? '个人维护' : base.source || '个人维护',
    sourceUrl: referenceUrl(fields.sourceUrl) || url,
  };
  next.notes[key] = fields.notes.slice(0, 20000);
  return {
    state: mode === 'solved' ? applyGrade(next, key, fields.date, fields.rating) : next,
    key,
  };
}

export function bulkAdd(state, input, date) {
  if (!validDate(date)) throw Error('请选择有效待做日期。');
  const next = structuredClone(state),
    errors = [],
    remaining = [];
  let count = 0;
  input.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    const parts = line.split('|').map((x) => x.trim());
    const [n, title, topic, diff, raw] = parts,
      num = Number(n),
      url = canonicalUrl(raw);
    let reason = '';
    if (
      parts.length !== 5 ||
      !Number.isInteger(num) ||
      num < 1 ||
      num > 99999999 ||
      !title ||
      title.length > 100 ||
      !url ||
      !['简单', '中等', '困难'].includes(diff)
    )
      reason = '需填写完整的 5 个字段、有效题号、难度及链接。';
    else if (
      createModel({ ...next, deleted: [] })
        .allProblems()
        .some((p) => p.num === num || slugOf(p.url) === slugOf(url))
    )
      reason = `${num} 已存在（包括回收站），请使用或恢复已有题目。`;
    if (reason) {
      errors.push(`第 ${index + 1} 行：${reason}`);
      remaining.push(line);
    } else {
      next.custom.push({
        key: `custom-${num}`,
        num,
        title,
        topic: topic.slice(0, 40) || '综合',
        diff,
        origin: 'extra',
        url,
        plannedDate: date,
        day: null,
        addedAt: TODAY(),
      });
      count++;
    }
  });
  return { state: next, count, errors, remaining: remaining.join('\n') };
}

// Keep associated records so deletion is reversible and survives backup round-trips.
export function deleteProblem(state, id) {
  if (!createModel(state).getProblem(id)) throw Error('题目不存在或已删除。');
  return { ...state, deleted: [...new Set([...(state.deleted || []), id])] };
}
export function restoreProblem(state, id) {
  return { ...state, deleted: (state.deleted || []).filter((key) => key !== id) };
}

export function startRelearning(state, id, date, today = TODAY()) {
  if (!validDate(date) || date > today) throw Error('请选择今天或之前的有效日期。');
  const model = createModel(state, date);
  if (!model.getProblem(id)) throw Error('题目不存在或已删除。');
  if (model.isRelearning(id)) return state;
  if (
    (state.logs[id] || []).some((h) => h.date > date) ||
    (state.relearns?.[id] || []).some((d) => d > date)
  )
    throw Error('该日期之后已有记录，请选择最近记录当天或之后的日期。');
  const previousDates = [...(state.relearns?.[id] || [])];
  return {
    ...state,
    relearns: { ...state.relearns, [id]: [...new Set([...previousDates, date])].sort() },
    relearnPending: { ...state.relearnPending, [id]: { date, previousDates } },
  };
}
export function cancelRelearning(state, id, date = TODAY()) {
  const model = createModel(state, date);
  const pending = state.relearnPending?.[id];
  if (pending && pending.date <= date) {
    const relearns = { ...state.relearns },
      relearnPending = { ...state.relearnPending };
    if (pending.previousDates.length) relearns[id] = [...pending.previousDates];
    else delete relearns[id];
    delete relearnPending[id];
    return { ...state, relearns, relearnPending };
  }

  if (!model.isRelearning(id)) throw Error('该题当前不在待重学状态。');
  if ((state.logs[id] || []).some((h) => h.date >= model.cycleStart(id)))
    throw Error('该轮重学已有练习记录，不能取消。');
  const dates = state.relearns[id];
  if (dates.at(-1) !== model.cycleStart(id)) throw Error('请先切换到最新的重学日期。');
  const relearns = { ...state.relearns };
  if (dates.length > 1) relearns[id] = dates.slice(0, -1);
  else delete relearns[id];
  return { ...state, relearns };
}
