import { describe, expect, it } from 'vitest';
import { applyGrade, bulkAdd, saveProblem, deleteProblem, restoreProblem } from './actions';
import { createModel, defaultState, normalizeState } from './training';
import { parseBackup } from '../storage/backup';
import FIXED from '../data/problems.json';

function fixture() {
  const state = applyGrade(
    { ...defaultState(), startDate: '2026-01-01' },
    'lc-1',
    '2026-01-01',
    'red',
    '2026-12-31',
  );
  state.notes['lc-1'] = '原有笔记';
  state.materials['lc-1'] = { memory: '个人速记', sourceUrl: '' };
  state.dueOverrides['lc-1'] = {
    date: '2026-01-10',
    basedOn: '2026-01-01:red',
    setOn: '2026-01-01',
  };
  state.custom.push({
    key: 'custom-58',
    num: 58,
    title: '最后一个单词的长度',
    topic: '字符串',
    diff: '简单',
    url: 'https://leetcode.cn/problems/length-of-last-word/',
    origin: 'extra',
    plannedDate: '2026-01-01',
    day: null,
    addedAt: '2026-01-01',
  });
  return state;
}

describe('all-problem deletion and recovery', () => {
  it.each(FIXED.map((p) => [p.key]))('supports deletion of built-in %s', (id) => {
    const before = fixture(),
      after = deleteProblem(before, id);
    expect(createModel(after).getProblem(id)).toBeUndefined();
    expect(createModel(after).allProblems()).toHaveLength(90);
    expect(before.deleted).toEqual([]);
  });
  it('removes a custom problem and restores it with its records intact', () => {
    let state = fixture();
    state.logs['custom-58'] = [{ date: '2026-01-01', rating: 'green', kind: 'new' }];
    state.notes['custom-58'] = '自定义题的笔记';
    const deleted = deleteProblem(state, 'custom-58');
    expect(createModel(deleted).getProblem('custom-58')).toBeUndefined();
    expect(restoreProblem(deleted, 'custom-58')).toEqual(state);
  });
  it('excludes deleted questions from plans, completed lists, counts and due queues', () => {
    const deleted = deleteProblem(fixture(), 'lc-1'),
      model = createModel(deleted, '2026-01-10');
    expect(model.planned('2026-01-01').some((p) => p.key === 'lc-1')).toBe(false);
    expect(model.doneOn('2026-01-01').some((p) => p.key === 'lc-1')).toBe(false);
    expect(model.dueList().some((x) => x.p.key === 'lc-1')).toBe(false);
    expect(model.counts().solved).toBe(0);
  });
  it('restores notes, material overrides, logs and manual review dates exactly', () => {
    const state = fixture();
    expect(restoreProblem(deleteProblem(state, 'lc-1'), 'lc-1')).toEqual(state);
  });
  it('persists deletion and archived learning records through export/import', () => {
    const deleted = deleteProblem(deleteProblem(fixture(), 'lc-1'), 'custom-58');
    const loaded = parseBackup(
      JSON.stringify({ app: 'leetcode-hot100-lab', version: 3, data: deleted }),
    );
    expect(loaded).toEqual(deleted);
    expect(createModel(loaded).getProblem('lc-1')).toBeUndefined();
    expect(restoreProblem(loaded, 'lc-1').logs['lc-1']).toEqual(deleted.logs['lc-1']);
  });
  it('accepts old backups without deleted state', () => {
    const state = fixture();
    delete state.deleted;
    expect(normalizeState(state).deleted).toEqual([]);
  });
  it('filters invalid, unknown and duplicate deletion ids', () => {
    const state = fixture();
    state.deleted = ['lc-1', 'lc-1', 'lc-999999', 'custom-58', '__proto__', null];
    expect(normalizeState(state).deleted).toEqual(['lc-1', 'custom-58']);
  });
  it('blocks grading or editing deleted questions', () => {
    const state = deleteProblem(fixture(), 'lc-1');
    expect(() => applyGrade(state, 'lc-1', '2026-01-02', 'red', '2026-12-31')).toThrow();
    expect(() => saveProblem(state, {}, { id: 'lc-1' })).toThrow(/回收站/);
  });
  it('blocks duplicate additions of archived custom questions', () => {
    const state = deleteProblem(fixture(), 'custom-58');
    const result = bulkAdd(
      state,
      '58 | 最后一个单词的长度 | 字符串 | 简单 | https://leetcode.cn/problems/length-of-last-word/',
      '2026-01-01',
    );
    expect(result.count).toBe(0);
    expect(result.errors[0]).toMatch(/回收站/);
    expect(result.state.custom).toHaveLength(1);
  });
  it('handles deleting the entire question library and restores individual questions', () => {
    let state = fixture();
    for (const p of createModel(state).allProblems()) state = deleteProblem(state, p.key);
    const model = createModel(normalizeState(state), '2026-01-10');
    expect(model.allProblems()).toEqual([]);
    expect(model.dueList()).toEqual([]);
    expect(model.counts().solved).toBe(0);
    expect(createModel(restoreProblem(state, 'lc-1')).allProblems()).toHaveLength(1);
  });
});
