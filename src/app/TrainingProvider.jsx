import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TrainingContext } from './TrainingContext';
import { applyGrade, ratingName } from '../domain/actions';
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
  function setViewDate(date) {
    if (validDate(date)) changeDate(date);
  }
  function grade(id, rating, date = viewDate) {
    try {
      const before = current.current,
        next = applyGrade(before, id, date, rating);
      setUndoAction({ id, logs: before.logs[id] || [], override: before.dueOverrides[id] });
      const saved = commit(next);
      toast(`已记录${ratingName(rating)}${saved ? '' : '，尚未保存，请导出备份'}`);
    } catch (error) {
      toast(error.message);
    }
  }
  function undo() {
    if (!undoAction) return;
    const next = structuredClone(current.current),
      { id, logs, override } = undoAction;
    next.logs[id] = logs;
    if (override) next.dueOverrides[id] = override;
    else delete next.dueOverrides[id];
    commit(next);
    setUndoAction(null);
    toast('已撤销最近一次评级');
  }
  function rememberUndo(id, before) {
    setUndoAction({ id, logs: before.logs[id] || [], override: before.dueOverrides[id] });
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
        clearUndo: () => setUndoAction(null),
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
