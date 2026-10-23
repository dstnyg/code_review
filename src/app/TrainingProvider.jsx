import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TrainingContext } from './TrainingContext';
import {
  applyGrade,
  startRelearning,
  cancelRelearning,
  ratingName,
  deleteProblem as removeProblem,
  restoreProblem as recoverProblem,
} from '../domain/actions';
import { createModel, TODAY, validDate } from '../domain/training';
import { exportBackup, loadState, STORAGE_KEY } from '../storage/backup';

export function TrainingProvider({ children }) {
  const [initial] = useState(loadState);
  const [state, dispatch] = useReducer((_, next) => next, initial.data);
  const current = useRef(state),
    locked = useRef(initial.locked);
  const [storageError, setStorageError] = useState(initial.error);
  const [viewDate, changeDate] = useState(TODAY);
  const [editor, setEditor] = useState(null),
    [message, setMessage] = useState('');
  const [undoAction, setUndoAction] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function toast(text) {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 4500);
  }
  function commit(next, recover = false) {
    current.current = next;
    dispatch(next);
    if (recover) locked.current = false;
    if (locked.current) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError('');
      return true;
    } catch {
      setStorageError('浏览器保存不可用。请导出当前数据，保留学习记录。');
      return false;
    }
  }
  function deleteProblem(id) {
    const before = current.current,
      problem = createModel(before).getProblem(id);
    if (!problem) return;
    if (
      !confirm(
        '删除 ' +
          problem.num +
          '. ' +
          problem.title +
          '？\n题目将从题库、训练安排、复习队列和统计中移除。练习记录与笔记保留在回收站，可随时恢复。',
      )
    )
      return;
    const saved = commit(removeProblem(before, id));
    setLastDeleted({ id, title: problem.title });
    setUndoAction(null);
    toast(
      saved ? '题目已删除，可撤销或到设置中的回收站恢复' : '本次已删除，但尚未保存，请导出备份',
    );
  }
  function restoreProblem(id) {
    const saved = commit(recoverProblem(current.current, id));
    setLastDeleted(null);
    toast(saved ? '题目已恢复，练习记录和笔记已还原' : '本次已恢复，但尚未保存，请导出备份');
  }
  function relearn(id) {
    try {
      const before = current.current,
        problem = createModel(before).getProblem(id);
      const date = TODAY();
      const next = startRelearning(before, id, date);
      if (next === before) {
        setViewDate(date);
        return true;
      }
      if (
        !confirm(
          '将「' +
            problem.title +
            '」转为 ' +
            date +
            ' 的重新复习？\n将重新计算连续绿色次数，完成并评级后再安排复习。历史记录、答案和笔记保留。',
        )
      )
        return false;
      const saved = commit(next);
      setViewDate(date);
      setUndoAction(null);
      toast(saved ? '已转入当天做题，请重新复习后评级' : '已转入重新复习，但尚未保存，请导出备份');
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  }
  function cancelRelearn(id) {
    try {
      const saved = commit(cancelRelearning(current.current, id, viewDate));
      setUndoAction(null);
      toast(saved ? '已取消重新复习，恢复原复习安排' : '已取消，但尚未保存，请导出备份');
    } catch (error) {
      toast(error.message);
    }
  }
  function setViewDate(date) {
    if (validDate(date)) changeDate(date);
  }
  function grade(id, rating, date = viewDate) {
    try {
      const before = current.current,
        next = applyGrade(before, id, date, rating);
      setUndoAction({
        id,
        logs: before.logs[id] || [],
        override: before.dueOverrides[id],
        pending: before.relearnPending?.[id],
      });
      const saved = commit(next);
      toast(`已记录${ratingName(rating)}${saved ? '' : '，尚未保存，请导出备份'}`);
    } catch (error) {
      toast(error.message);
    }
  }
  function undo() {
    if (!undoAction) return;
    const next = structuredClone(current.current),
      { id, logs, override, pending } = undoAction;
    next.logs[id] = logs;
    next.relearnPending = { ...next.relearnPending };
    if (pending) next.relearnPending[id] = pending;
    else delete next.relearnPending[id];
    if (override) next.dueOverrides[id] = override;
    else delete next.dueOverrides[id];
    commit(next);
    setUndoAction(null);
    toast('已撤销最近一次评级');
  }
  function rememberUndo(id, before) {
    setUndoAction({
      id,
      logs: before.logs[id] || [],
      override: before.dueOverrides[id],
      pending: before.relearnPending?.[id],
    });
  }
  const model = useMemo(() => createModel(state, viewDate), [state, viewDate]);
  return (
    <TrainingContext.Provider
      value={{
        state,
        model,
        viewDate,
        setViewDate,
        commit,
        toast,
        grade,
        undo,
        undoAction,
        rememberUndo,
        clearUndo: () => {
          setUndoAction(null);
          setLastDeleted(null);
        },
        deleteProblem,
        restoreProblem,
        relearn,
        cancelRelearn,
        lastDeleted,
        editor,
        openEditor: (id = null, practice = false) => setEditor({ id, practice }),
        closeEditor: () => setEditor(null),
        storageError,
        exportData: () => exportBackup(current.current),
      }}
    >
      {children}
      <div className={`toast ${message ? 'show' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </TrainingContext.Provider>
  );
}
