import { useRef, useState } from 'react';
import FIXED from '../data/problems.json';
import { useTraining } from '../app/TrainingContext';
import { AddButton, Panel } from '../components/Common';
import { bulkAdd } from '../domain/actions';
import { defaultState, TODAY, validDate } from '../domain/training';
import { download, parseBackup, STORAGE_KEY } from '../storage/backup';

export default function Settings() {
  const {
    state,
    viewDate,
    commit,
    toast,
    exportData,
    setViewDate,
    clearUndo,
    storageError,
    restoreProblem,
  } = useTraining();
  const [bulk, setBulk] = useState(''),
    [date, setDate] = useState(viewDate),
    [result, setResult] = useState('');
  const fileInput = useRef(null);
  const deletedProblems = [...FIXED, ...state.custom].filter((p) =>
    (state.deleted || []).includes(p.key),
  );
  async function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw Error('备份超过 12MB，请检查文件。');
      const incoming = parseBackup(await file.text()),
        records = Object.values(incoming.logs).reduce((n, list) => n + list.length, 0);
      if (
        !confirm(
          `备份包含 ${incoming.custom.length} 道自定义题、${records} 条练习记录。\n将替换当前个人数据，并先下载当前数据备份。确定恢复？`,
        )
      )
        return;
      // Export in-memory data too, including any edits that storage could not save.
      exportData();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) download(raw, `Hot100恢复前原始存储_${TODAY()}.json`);
      } catch {
        /* Storage may be disabled; the in-memory backup above is still available. */
      }
      const saved = commit(incoming, true);
      clearUndo();
      setViewDate(TODAY());
      toast(
        saved ? '备份已恢复，资料与复习安排已同步' : '备份已加载，但浏览器无法保存，请导出数据',
      );
    } catch (error) {
      toast(`导入失败：${error.message}`);
    } finally {
      event.target.value = '';
    }
  }
  function addBulk() {
    try {
      if (!bulk.trim()) return toast('请先输入题目。');
      const response = bulkAdd(state, bulk, date);
      commit(response.state);
      setBulk(response.remaining);
      setResult(`成功加入 ${response.count} 道，安排在 ${date}。\n${response.errors.join('\n')}`);
      toast(`已加入 ${response.count} 道待做题`);
    } catch (error) {
      toast(error.message);
    }
  }
  function reset() {
    if (
      !confirm('清空全部个人记录、笔记、新题与资料编辑？内置参考资料会保留，当前数据将先导出备份。')
    )
      return;
    exportData();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) download(raw, `Hot100清空前原始存储_${TODAY()}.json`);
    } catch {
      /* Export above preserves the current session. */
    }
    commit(defaultState(), true);
    clearUndo();
    setViewDate(TODAY());
    toast('个人数据已清空，原数据已导出备份');
  }
  return (
    <>
      <Panel title="训练设置" subtitle="首轮计划与新题日期分别管理。">
        <div className="settingsgrid">
          <label className="setting">
            首轮 D1 日期<p>调整首轮 9 天题单。手动安排的新题和历史评级日期保留。</p>
            <input
              className="field"
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              value={state.startDate}
              onChange={(e) => {
                if (validDate(e.target.value)) commit({ ...state, startDate: e.target.value });
              }}
            />
          </label>
          <label className="setting">
            每日优先展示复习数<p>其余到期题可展开查看，记录始终保留。</p>
            <select
              className="field"
              value={state.maxReviews}
              onChange={(e) => commit({ ...state, maxReviews: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n} 道
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="callout">
          红色＋1天，黄色＋3天。不同日期连续绿色依次＋7、21、45天，红黄会重置连续绿色。
        </p>
      </Panel>
      <Panel
        title="添加与批量录入"
        subtitle="当天做过的题可使用单题表单，一起填写答案与速记。"
        action={<AddButton />}
      >
        <details>
          <summary>批量加入待做题</summary>
          <p className="helper">
            每行：题号 | 题名 | 考点 | 难度 | 完整 LeetCode 题目链接
            <br />
            格式错误和重复题会逐行说明，未成功的行会保留。
          </p>
          <label>
            待做日期
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <textarea
            className="notes bulkinput"
            aria-label="批量题目"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="58 | 最后一个单词的长度 | 字符串 | 简单 | https://leetcode.cn/problems/length-of-last-word/"
          />
          <button className="btn" onClick={addBulk}>
            加入待做
          </button>
          <p className="helper prewrap" role="status">
            {result}
          </p>
        </details>
      </Panel>
      <Panel
        title="数据备份与恢复"
        subtitle="包含新题、参考答案、速记、笔记、复习日期及全部练习记录。"
      >
        <div className="row">
          <button className="btn primary" onClick={exportData}>
            ↓ 导出 JSON 备份
          </button>
          <button className="btn" onClick={() => fileInput.current.click()}>
            ↑ 导入备份
          </button>
          <button className="btn danger" onClick={reset}>
            清空个人数据
          </button>
          {storageError && (
            <button
              className="btn"
              onClick={() => {
                try {
                  download(
                    localStorage.getItem(STORAGE_KEY) || 'null',
                    `Hot100原始存储_${TODAY()}.json`,
                  );
                } catch {
                  toast('浏览器未允许读取原始存储。');
                }
              }}
            >
              下载原始存储
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importFile}
        />
        <p className="callout">
          从旧 HTML 迁移：在旧页面导出 JSON，再到这里导入。不同地址、端口或浏览器的数据相互独立。
        </p>
        <p className="footnote">
          数据保存在当前浏览器。换设备、清理浏览器或更改访问地址前，请先导出备份。页面可通过本地服务离线使用，访问题目链接需要网络。
        </p>
      </Panel>
      <Panel
        title="题目回收站"
        subtitle={'已删除 ' + deletedProblems.length + ' 道，内置题和自定义题均可恢复。'}
      >
        <p className="helper">
          删除的题目不再出现在训练安排、复习队列或统计中。练习记录、笔记和资料保留，恢复后重新显示；回收站随
          JSON 备份保存。
        </p>
        {deletedProblems.length ? (
          deletedProblems.map((problem) => (
            <div className="row between history-entry" key={problem.key}>
              <span>
                {problem.num}. {problem.title} · {(state.logs[problem.key] || []).length} 条练习记录
              </span>
              <button
                className="btn sm"
                aria-label={'恢复 ' + problem.num + '. ' + problem.title}
                onClick={() => restoreProblem(problem.key)}
              >
                恢复题目
              </button>
            </div>
          ))
        ) : (
          <p className="helper">回收站为空。</p>
        )}
      </Panel>
      <Panel title="题库与答案说明" subtitle="保留原有 90 道题和 9 天训练顺序。">
        <p className="helper">
          88 道 Hot 100 简单／中等题，加上 209、647 两道拓展题。61 道答案依据 hot100.docx 整理，29
          道补充；原始注释、其他写法、参考来源与校正说明均已保留。
        </p>
        <p className="helper">
          思路速记和参考答案默认收起，你可以编辑全部题目的学习资料。
          <a
            className="textlink"
            href="https://leetcode.cn/studyplan/top-100-liked/"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看官方 Hot 100 ↗
          </a>
        </p>
      </Panel>
    </>
  );
}
