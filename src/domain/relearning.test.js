import { describe, expect, it } from 'vitest';
import {
  applyGrade,
  startRelearning,
  cancelRelearning,
  deleteProblem,
  restoreProblem,
} from './actions';
import { createModel, defaultState, normalizeState } from './training';
import { parseBackup } from '../storage/backup';
function fixture() {
  let s = { ...defaultState(), startDate: '2026-01-01' };
  s = applyGrade(s, 'lc-1', '2026-01-01', 'green', '2026-12-31');
  s = applyGrade(s, 'lc-1', '2026-01-08', 'green', '2026-12-31');
  s.notes['lc-1'] = '保留笔记';
  s.materials['lc-1'] = { memory: '思路', sourceUrl: '' };
  return s;
}
const start = (s) => startRelearning(s, 'lc-1', '2026-02-01', '2026-12-31');
describe('relearning due problems', () => {
  it('moves a due problem to daily learning without modifying historical records', () => {
    const before = fixture(),
      state = start(before),
      model = createModel(state, '2026-02-01');
    expect(state.logs).toEqual(before.logs);
    expect(state.notes).toEqual(before.notes);
    expect(state.materials).toEqual(before.materials);
    expect(before.relearns).toEqual({});
    expect(model.isRelearning('lc-1')).toBe(true);
    expect(model.planned().some((p) => p.key === 'lc-1')).toBe(true);
    expect(model.dueList().some((x) => x.p.key === 'lc-1')).toBe(false);
    expect(model.timeToNext('lc-1')).toBeNull();
    expect(model.counts().qualified).toBe(0);
    expect(model.counts().relearning).toBe(1);
  });
  it('retains unfinished learning in backlog on following days', () => {
    expect(
      createModel(start(fixture()), '2026-02-02')
        .backlog()
        .some((p) => p.key === 'lc-1'),
    ).toBe(true);
  });
  it.each([
    ['red', 1],
    ['yellow', 3],
    ['green', 7],
  ])('resets %s interval to %s days', (rating, days) => {
    const state = applyGrade(start(fixture()), 'lc-1', '2026-02-02', rating, '2026-12-31');
    const model = createModel(state, '2026-02-02');
    expect(model.isRelearning('lc-1')).toBe(false);
    expect(model.timeToNext('lc-1').days).toBe(days);
    expect(model.history('lc-1')).toHaveLength(3);
    expect(model.counts().qualified).toBe(0);
  });
  it('grows a new green streak independently from old results', () => {
    let state = applyGrade(start(fixture()), 'lc-1', '2026-02-01', 'green', '2026-12-31');
    state = applyGrade(state, 'lc-1', '2026-02-08', 'green', '2026-12-31');
    expect(createModel(state, '2026-02-08').timeToNext('lc-1').days).toBe(21);
    expect(createModel(state, '2026-02-08').counts().qualified).toBe(1);
  });
  it('preserves earlier views and planned dates', () => {
    const before = fixture(),
      after = start(before);
    expect(createModel(after, '2026-01-20').timeToNext('lc-1')).toEqual(
      createModel(before, '2026-01-20').timeToNext('lc-1'),
    );
    expect(createModel(after, '2026-01-20').planned('2026-01-01')).toEqual(
      createModel(before, '2026-01-20').planned('2026-01-01'),
    );
    expect(createModel(after, '2026-01-20').counts().qualified).toBe(1);
  });
  it('cancels pending relearning and exactly restores a manual due override', () => {
    const state = fixture();
    state.dueOverrides['lc-1'] = {
      date: '2026-01-30',
      basedOn: '2026-01-08:green',
      setOn: '2026-01-09',
    };
    expect(cancelRelearning(start(state), 'lc-1', '2026-02-01')).toEqual(state);
  });
  it('rejects cancellation after completion, including a historical date view', () => {
    const state = applyGrade(start(fixture()), 'lc-1', '2026-02-02', 'green', '2026-12-31');
    expect(() => cancelRelearning(state, 'lc-1', '2026-02-01')).toThrow();
  });
  it('allows a second relearning cycle without losing previous cycles', () => {
    const state = applyGrade(start(fixture()), 'lc-1', '2026-02-01', 'green', '2026-12-31');
    const again = startRelearning(state, 'lc-1', '2026-02-10', '2026-12-31');
    expect(again.relearns['lc-1']).toEqual(['2026-02-01', '2026-02-10']);
    expect(createModel(again, '2026-02-05').timeToNext('lc-1').days).toBe(7);
    expect(cancelRelearning(again, 'lc-1', '2026-02-10')).toEqual(state);
  });
  it('round trips pending relearning through backup and deletion recovery', () => {
    const state = start(fixture());
    expect(parseBackup(JSON.stringify({ app: 'leetcode-hot100-lab', data: state }))).toEqual(state);
    expect(restoreProblem(deleteProblem(state, 'lc-1'), 'lc-1')).toEqual(state);
  });
  it('supports custom questions', () => {
    let state = fixture();
    state.custom.push({
      key: 'custom-58',
      num: 58,
      title: '最后一个单词',
      topic: '字符串',
      diff: '简单',
      url: 'https://leetcode.cn/problems/length-of-last-word/',
      origin: 'extra',
      plannedDate: '2026-01-01',
    });
    state = applyGrade(state, 'custom-58', '2026-01-01', 'red', '2026-12-31');
    expect(
      createModel(
        startRelearning(state, 'custom-58', '2026-02-01', '2026-12-31'),
        '2026-02-01',
      ).isRelearning('custom-58'),
    ).toBe(true);
  });
  it('supports not-yet-due, same-day-completed and unpracticed questions', () => {
    for (const [id, date] of [
      ['lc-1', '2026-01-09'],
      ['lc-1', '2026-01-08'],
      ['lc-49', '2026-02-01'],
    ]) {
      const state = startRelearning(fixture(), id, date, '2026-12-31');
      expect(createModel(state, date).isRelearning(id)).toBe(true);
    }
  });
  it('rejects future, deleted and dates before later records', () => {
    expect(() => startRelearning(fixture(), 'lc-1', '2027-01-01', '2026-12-31')).toThrow();
    expect(() => start(deleteProblem(fixture(), 'lc-1'))).toThrow();
    const state = applyGrade(fixture(), 'lc-1', '2026-03-01', 'red', '2026-12-31');
    expect(() => start(state)).toThrow();
  });
  it('opening a pending review is idempotent', () => {
    const state = start(fixture());
    expect(start(state)).toBe(state);
  });
  it('keeps same-day history until a new grade and supports cancellation', () => {
    const before = fixture(),
      state = startRelearning(before, 'lc-1', '2026-01-08', '2026-12-31');
    expect(state.logs).toEqual(before.logs);
    expect(
      createModel(state, '2026-01-08')
        .doneOn()
        .some((p) => p.key === 'lc-1'),
    ).toBe(false);
    expect(cancelRelearning(state, 'lc-1', '2026-01-08')).toEqual(before);
    const graded = applyGrade(state, 'lc-1', '2026-01-08', 'green', '2026-12-31');
    expect(createModel(graded, '2026-01-08').timeToNext('lc-1').days).toBe(7);
    expect(graded.logs['lc-1']).toHaveLength(2);
  });
  it('supports another review on the same day and cancellation restores the earlier cycle', () => {
    const first = applyGrade(start(fixture()), 'lc-1', '2026-02-01', 'green', '2026-12-31');
    const second = startRelearning(first, 'lc-1', '2026-02-01', '2026-12-31');
    expect(createModel(second, '2026-02-01').isRelearning('lc-1')).toBe(true);
    expect(cancelRelearning(second, 'lc-1', '2026-02-01')).toEqual(first);
  });
  it('counts new pending questions separately without changing solved totals', () => {
    const state = startRelearning(fixture(), 'lc-49', '2026-02-01', '2026-12-31');
    const counts = createModel(state, '2026-02-01').counts();
    expect(counts.relearning).toBe(1);
    expect(counts.solved).toBe(1);
    expect(counts.unpracticed + counts.relearning + counts.red + counts.yellow + counts.green).toBe(
      90,
    );
  });
  it('imports legacy backups and sanitizes malformed markers', () => {
    const state = fixture();
    delete state.relearns;
    expect(normalizeState(state).relearns).toEqual({});
    state.relearns = { 'lc-1': ['bad', '2026-02-01', '2026-02-01'], unknown: ['2026-02-01'] };
    expect(normalizeState(state).relearns).toEqual({ 'lc-1': ['2026-02-01'] });
  });
});
