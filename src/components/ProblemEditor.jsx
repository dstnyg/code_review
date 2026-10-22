import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { saveProblem } from '../domain/actions';
import { canonicalUrl } from '../domain/training';

export default function ProblemEditor() {
  const { editor, closeEditor, state, model, viewDate, commit, toast, setViewDate, rememberUndo } =
    useTraining();
  const { id, practice } = editor,
    problem = id ? model.getProblem(id) : null;
  const material = problem ? model.material(problem) : {},
    locked = problem && !id.startsWith('custom-');
  const initial = useRef({
    url: problem?.url || '',
    num: problem?.num || '',
    title: problem?.title || '',
    topic: problem?.topic || '综合',
    diff: problem?.diff || '中等',
    date: practice || !problem ? viewDate : model.plannedDate(problem),
    rating: '',
    memory: material.memory || '',
    complexity: material.complexity || '',
    language: material.language || 'Python 3',
    sourceUrl: material.sourceUrl || '',
    solution: material.solution || '',
    notes: problem ? state.notes[id] || '' : '',
  });
  const [fields, setFields] = useState(() => ({
    ...initial.current,
    rating: (state.logs[id] || []).find((h) => h.date === initial.current.date)?.rating || '',
  }));
  const baseline = useRef(JSON.stringify(fields)),
    [error, setError] = useState(''),
    dialog = useRef(null),
    navigate = useNavigate();
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  function close() {
    if (JSON.stringify(fields) !== baseline.current && !confirm('有尚未保存的资料，确定关闭？'))
      return;
    closeEditor();
  }
  function update(name, value) {
    setFields((previous) => ({ ...previous, [name]: value }));
  }
  function input(name, label, options = {}) {
    const { wide, ...props } = options;
    return (
      <label className={wide ? 'wide' : ''}>
        {label}
        <input
          className="field"
          aria-label={label}
          name={name}
          value={fields[name]}
          onChange={(e) => update(name, e.target.value)}
          {...props}
        />
      </label>
    );
  }
  function textarea(name, label, maxLength) {
    return (
      <label className="wide">
        {label}
        <textarea
          className={`notes ${name === 'solution' ? 'codeinput' : ''}`}
          aria-label={label}
          name={name}
          value={fields[name]}
          maxLength={maxLength}
          spellCheck={name === 'solution' ? false : undefined}
          onChange={(e) => update(name, e.target.value)}
        />
      </label>
    );
  }
  function submit(event) {
    event.preventDefault();
    const mode = event.nativeEvent.submitter?.value || (problem && !practice ? 'edit' : 'pending');
    try {
      const result = saveProblem(state, fields, { id, practice, mode });
      if (mode === 'solved') rememberUndo(result.key, state);
      const saved = commit(result.state);
      closeEditor();
      if (!problem || mode === 'solved') {
        setViewDate(fields.date);
        navigate('/daily');
      }
      toast(
        `${mode === 'solved' ? '练习已记录，复习日期已更新' : '资料已保存'}${saved ? '' : '，浏览器保存失败，请导出备份'}`,
      );
    } catch (err) {
      setError(err.message);
    }
  }
  const preview = canonicalUrl(fields.url);
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit}>
        <div className="editorhead">
          <div>
            <div className="eyebrow">LEARNING ENTRY</div>
            <h2 id="editor-title">
              {practice ? '记录练习' : problem ? '编辑题目与学习资料' : '添加新题'}
            </h2>
          </div>
          <button type="button" className="btn sm" aria-label="关闭编辑" onClick={close}>
            关闭
          </button>
        </div>
        <div className="editorbody">
          {error && (
            <div className="notice" role="alert">
              {error}
            </div>
          )}
          <p className="helper">
            {practice
              ? '评级记录到所选日期，同一天再次提交会更新当天结果。'
              : '填写真实题目链接，答案与速记可稍后补充。'}
          </p>
          <div className="editorgrid">
            {input('url', 'LeetCode 题目链接', {
              type: 'url',
              required: true,
              maxLength: 2000,
              wide: true,
              placeholder: 'https://leetcode.cn/problems/…/',
            })}
            <div className="wide linkpreview">
              {preview ? (
                <a href={preview} target="_blank" rel="noopener noreferrer">
                  打开并核对题目 ↗
                </a>
              ) : (
                '请填写 leetcode.cn 或 leetcode.com 的完整题目链接。'
              )}
            </div>
            {input('num', '题号', {
              type: 'number',
              min: 1,
              max: 99999999,
              required: true,
              readOnly: !!problem,
            })}
            {input('title', '题名', { required: true, maxLength: 100, readOnly: !!locked })}
            {input('topic', '考点', {
              required: true,
              maxLength: 40,
              readOnly: !!locked,
              list: 'topic-options',
            })}
            <datalist id="topic-options">
              {[...new Set(model.allProblems().map((p) => p.topic))].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <label>
              难度
              <select
                className="field"
                aria-label="难度"
                name="diff"
                value={fields.diff}
                disabled={!!locked}
                onChange={(e) => update('diff', e.target.value)}
              >
                {['简单', '中等', '困难'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            {input('date', practice || !problem ? '做题／待做日期' : '待做安排日期', {
              type: 'date',
              min: '2000-01-01',
              max: '2199-12-31',
              required: true,
              readOnly: !!locked && !practice,
            })}
            <label>
              本次评级
              <select
                className="field"
                aria-label="本次评级"
                name="rating"
                value={fields.rating}
                disabled={!!problem && !practice}
                onChange={(e) => update('rating', e.target.value)}
              >
                <option value="">请选择，或仅保存待做</option>
                <option value="red">不会 · 1 天后</option>
                <option value="yellow">不熟 · 3 天后</option>
                <option value="green">独立 AC · 自动排期</option>
              </select>
            </label>
            {textarea('memory', '思路速记', 5000)}
            {input('complexity', '复杂度', {
              maxLength: 500,
              wide: true,
              placeholder: '如：时间 O(n)，空间 O(n)',
            })}
            {input('language', '代码语言', { maxLength: 30 })}
            {input('sourceUrl', '参考来源链接（选填）', { type: 'url', maxLength: 2000 })}
            {textarea('solution', '参考答案', 100000)}
            {textarea('notes', '个人错因笔记', 20000)}
          </div>
          <p className="footnote">
            仅保存待做不会生成练习记录。题目链接会校验格式，题号与题名请通过预览核对。
          </p>
        </div>
        <div className="editorfooter">
          <button className="btn" type="button" onClick={close}>
            取消
          </button>
          {problem && !practice ? (
            <button className="btn primary" type="submit" value="edit">
              保存资料
            </button>
          ) : (
            <>
              <button className="btn" type="submit" value="pending">
                {practice ? '仅保存资料' : '仅加入待做'}
              </button>
              <button className="btn primary" type="submit" value="solved">
                保存并记录本次练习
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}
