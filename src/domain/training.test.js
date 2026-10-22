import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { applyGrade, bulkAdd, saveProblem } from './actions';
import {
  canonicalUrl,
  createModel,
  dateAdd,
  defaultState,
  normalizeState,
  TODAY,
  validDate,
} from './training';
import { parseBackup } from '../storage/backup';
import problems from '../data/problems.json';
import materials from '../data/materials.json';

const fresh = () => ({ ...defaultState(), startDate: '2026-01-01' });
const grade = (state, date, rating, id = 'lc-1') =>
  applyGrade(state, id, date, rating, '2026-12-31');
const next = (state) => createModel(state, '2026-12-31').timeToNext('lc-1');

describe('migration integrity', () => {
  it('preserves every original problem and all learning material fields', () => {
    const html = fs.readFileSync(
      new URL('../../../LeetCode_Hot100_智能复习训练台.html', import.meta.url),
      'utf8',
    );
    const extract = (name) =>
      JSON.parse(html.match(new RegExp(`^const ${name}=(.*);\\s*$`, 'm'))[1]);
    expect(problems).toEqual(extract('FIXED'));
    expect(materials).toEqual(extract('MATERIALS'));
    expect(problems).toHaveLength(90);
    expect(Object.keys(materials)).toHaveLength(90);
  });
  it('accepts original v3 backup envelopes and raw legacy state', () => {
    const state = grade(fresh(), '2026-01-01', 'red');
    state.notes['lc-1'] = '边界与错因';
    expect(
      parseBackup(JSON.stringify({ app: 'leetcode-hot100-lab', version: 3, data: state })),
    ).toEqual(state);
    expect(parseBackup(JSON.stringify(state))).toEqual(state);
    expect(() => parseBackup('{"app":"other"}')).toThrow();
  });
  it('rejects broken state rather than silently overwriting records', () => {
    expect(() => normalizeState({})).toThrow();
    expect(() => parseBackup('not json')).toThrow();
  });
});

describe('review scheduling', () => {
  it.each([
    ['red', 1],
    ['yellow', 3],
    ['green', 7],
  ])('%s schedules +%s days', (rating, days) => {
    expect(next(grade(fresh(), '2026-01-01', rating)).date).toBe(dateAdd('2026-01-01', days));
  });
  it('uses 7, 21 and 45 days for consecutive green results', () => {
    let state = grade(fresh(), '2026-01-01', 'green');
    expect(next(state).days).toBe(7);
    state = grade(state, '2026-01-08', 'green');
    expect(next(state).days).toBe(21);
    state = grade(state, '2026-01-29', 'green');
    expect(next(state).days).toBe(45);
    state = grade(state, '2026-03-15', 'green');
    expect(next(state).days).toBe(45);
  });
  it('yellow resets a green streak', () => {
    let state = grade(grade(fresh(), '2026-01-01', 'green'), '2026-01-08', 'yellow');
    state = grade(state, '2026-01-11', 'green');
    expect(next(state).days).toBe(7);
  });
  it('replaces same-day ratings and does not count them as a green streak', () => {
    let state = grade(fresh(), '2026-01-01', 'red');
    state = grade(grade(state, '2026-01-01', 'green'), '2026-01-01', 'green');
    expect(state.logs['lc-1']).toEqual([{ date: '2026-01-01', rating: 'green', kind: 'new' }]);
    expect(next(state).days).toBe(7);
  });
  it('does not leak future history into historical views', () => {
    const state = grade(grade(fresh(), '2026-01-01', 'red'), '2026-01-05', 'green');
    expect(createModel(state, '2026-01-02').last('lc-1').rating).toBe('red');
    expect(createModel(state, '2025-12-31').counts().solved).toBe(0);
  });
  it('sorts due reviews red before yellow before green', () => {
    let state = grade(fresh(), '2026-01-01', 'green');
    state = grade(state, '2026-01-01', 'yellow', 'lc-49');
    state = grade(state, '2026-01-01', 'red', 'lc-128');
    expect(
      createModel(state, '2026-01-10')
        .dueList()
        .map((x) => x.p.key),
    ).toEqual(['lc-128', 'lc-49', 'lc-1']);
  });
  it('honors manual overrides until the next grade', () => {
    let state = grade(fresh(), '2026-01-01', 'red');
    state.dueOverrides['lc-1'] = {
      date: '2026-01-09',
      basedOn: '2026-01-01:red',
      setOn: '2026-01-02',
    };
    expect(next(state).date).toBe('2026-01-09');
    expect(createModel(state, '2026-01-01').timeToNext('lc-1').manual).toBe(false);
    state = grade(state, '2026-01-03', 'yellow');
    expect(next(state).date).toBe('2026-01-06');
    expect(state.dueOverrides['lc-1']).toBeUndefined();
  });
  it('qualifies two green grades only when at least 7 days apart', () => {
    expect(
      createModel(
        grade(grade(fresh(), '2026-01-01', 'green'), '2026-01-02', 'green'),
        '2026-01-10',
      ).counts().qualified,
    ).toBe(0);
    expect(
      createModel(
        grade(grade(fresh(), '2026-01-01', 'green'), '2026-01-08', 'green'),
        '2026-01-10',
      ).counts().qualified,
    ).toBe(1);
  });
  it('rejects future dates without mutating the original state', () => {
    const state = fresh();
    expect(() => applyGrade(state, 'lc-1', '2026-01-02', 'red', '2026-01-01')).toThrow();
    expect(state.logs).toEqual({});
  });
});

describe('editing, import validation and dates', () => {
  const fields = () => ({
    url: 'https://leetcode.cn/problems/length-of-last-word/',
    num: '58',
    title: '最后一个单词的长度',
    topic: '字符串',
    diff: '简单',
    date: TODAY(),
    rating: 'green',
    memory: '逆向扫描',
    complexity: 'O(n)',
    language: 'JavaScript',
    sourceUrl: '',
    solution: 'return 0;',
    notes: '注意空格',
  });
  it('saves pending custom problems without creating a practice log', () => {
    const { state, key } = saveProblem(fresh(), fields(), { mode: 'pending' });
    expect(state.custom[0].key).toBe(key);
    expect(state.logs[key]).toBeUndefined();
    expect(normalizeState(state).materials[key].memory).toBe('逆向扫描');
    expect(parseBackup(JSON.stringify({ app: 'leetcode-hot100-lab', data: state }))).toEqual(state);
  });
  it('retains D10 scheduling for older questions without explicit dates', () => {
    const state = fresh();
    state.custom.push({ ...fields(), num: 58, key: 'custom-58', day: null });
    const normalized = normalizeState(state);
    expect(normalized.custom[0].day).toBe(10);
    expect(createModel(normalized).plannedDate(normalized.custom[0])).toBe('2026-01-10');
  });
  it('does not move a custom pending date when recording practice', () => {
    const { state, key } = saveProblem(
      fresh(),
      { ...fields(), date: '2025-01-01' },
      { mode: 'pending' },
    );
    const result = saveProblem(state, fields(), { id: key, practice: true, mode: 'solved' });
    expect(result.state.custom[0].plannedDate).toBe('2025-01-01');
    expect(result.state.logs[key]).toHaveLength(1);
  });
  it('blocks duplicate numbers and duplicate slugs', () => {
    expect(() => saveProblem(fresh(), { ...fields(), num: '1' })).toThrow(/已存在/);
    expect(() =>
      saveProblem(fresh(), { ...fields(), url: 'https://leetcode.com/problems/two-sum/' }),
    ).toThrow(/已存在/);
  });
  it('bulk adds valid lines and preserves rejected lines', () => {
    const line =
      '58 | 最后一个单词的长度 | 字符串 | 简单 | https://leetcode.cn/problems/length-of-last-word/';
    const result = bulkAdd(fresh(), `${line}\n${line}\ninvalid`, '2026-01-01');
    expect(result.count).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(result.remaining).toContain('invalid');
  });
  it('moving the first round leaves explicit custom dates and history unchanged', () => {
    const state = grade(fresh(), '2026-01-01', 'green');
    state.custom = [{ key: 'custom-58', num: 58, plannedDate: '2026-02-01' }];
    state.startDate = '2026-03-01';
    const model = createModel(state);
    expect(model.plannedDate(problems[0])).toBe('2026-03-01');
    expect(model.plannedDate(state.custom[0])).toBe('2026-02-01');
    expect(state.logs['lc-1'][0].date).toBe('2026-01-01');
  });
  it('validates dates and canonicalizes safe problem links', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2024-02-29')).toBe(true);
    expect(dateAdd('2026-12-31', 1)).toBe('2027-01-01');
    expect(canonicalUrl('javascript:alert(1)')).toBe('');
    expect(canonicalUrl('https://example.com/problems/two-sum/')).toBe('');
    expect(canonicalUrl('https://leetcode.cn/problems/two-sum/?x=1')).toBe(
      'https://leetcode.cn/problems/two-sum/',
    );
  });
});
