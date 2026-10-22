import { defaultState, normalizeState, TODAY } from '../domain/training';

export const STORAGE_KEY = 'lc_lab_hot100_v2';
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      data: raw ? normalizeState(JSON.parse(raw)) : defaultState(),
      error: '',
      locked: false,
    };
  } catch (error) {
    return {
      data: defaultState(),
      error: `旧数据无法读取，已停止覆盖原存储：${error.message}`,
      locked: true,
    };
  }
}
export function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function exportBackup(data) {
  download(
    JSON.stringify(
      { app: 'leetcode-hot100-lab', version: 3, exportedAt: new Date().toISOString(), data },
      null,
      2,
    ),
    `Hot100学习备份_${TODAY()}.json`,
  );
}
export function parseBackup(text) {
  const obj = JSON.parse(text);
  if (obj?.app && obj.app !== 'leetcode-hot100-lab') throw Error('这不是本训练台的备份。');
  return normalizeState(obj?.app ? obj.data : obj);
}
