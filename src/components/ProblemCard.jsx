import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { ratingName } from '../domain/actions';
import {
  canonicalUrl,
  dateAdd,
  dateDiff,
  fmt,
  referenceUrl,
  TODAY,
  validDate,
} from '../domain/training';
import { Empty, Panel } from './Common';

export function GradeButtons({ problem }) {
  const { model, grade, viewDate } = useTraining(),
    selected = model.history(problem.key).find((h) => h.date === viewDate)?.rating;
  return (
    <div className="ratinggroup" role="group" aria-label={`标记${problem.title}掌握程度`}>
      {[
        ['red', '不会'],
        ['yellow', '不熟'],
        ['green', '独立 AC'],
      ].map(([rating, label]) => (
        <button
          key={rating}
          className={`rate ${rating} ${selected === rating ? 'chosen' : ''}`}
          disabled={viewDate > TODAY()}
          aria-pressed={selected === rating}
          onClick={() => grade(problem.key, rating)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function ProblemLink({ problem }) {
  const { openEditor } = useTraining();
  return canonicalUrl(problem.url) ? (
    <a href={canonicalUrl(problem.url)} target="_blank" rel="noopener noreferrer">
      {problem.num}. {problem.title} <span className="external">↗</span>
    </a>
  ) : (
    <>
      <span>
        {problem.num}. {problem.title}
      </span>
      <button className="btn sm" onClick={() => openEditor(problem.key)}>
        补充链接
      </button>
    </>
  );
}
function History({ problem }) {
  const { model, state, commit, toast } = useTraining(),
    history = model.history(problem.key),
    next = model.timeToNext(problem.key);
  const [date, setDate] = useState(next?.date || '');
  function reschedule() {
    if (!validDate(date) || date <= next.last.date) return toast('复习日期必须晚于最近练习日期。');
    commit({
      ...state,
      dueOverrides: {
        ...state.dueOverrides,
        [problem.key]: { date, basedOn: `${next.last.date}:${next.last.rating}`, setOn: TODAY() },
      },
    });
    toast('复习日期已更新，下次评级后恢复自动排期');
  }
  return (
    <>
      {next ? (
        <>
          <p className="helper">
            首次练习 {fmt(history[0].date)} · 复习 {Math.max(0, history.length - 1)} 次<br />
            下次复习：<b>{fmt(next.date)}</b>
            {next.manual && '（手动改期）'}
          </p>
          <div className="dueform">
            <label>
              单次改期{' '}
              <input
                className="field"
                aria-label={`${problem.title}复习日期`}
                type="date"
                min={dateAdd(next.last.date, 1)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button className="btn sm" onClick={reschedule}>
              保存日期
            </button>
            {next.manual && (
              <button
                className="btn sm"
                onClick={() => {
                  const overrides = { ...state.dueOverrides };
                  delete overrides[problem.key];
                  commit({ ...state, dueOverrides: overrides });
                  toast('已恢复自动排期');
                }}
              >
                恢复自动排期
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="helper">
          {model.isRelearning(problem.key)
            ? '重新复习中，完成本次评级后生成新的复习日期。历史练习记录保留如下。'
            : '完成首次评级后生成复习日期。'}
        </p>
      )}
      {history
        .slice()
        .reverse()
        .slice(0, 20)
        .map((h) => (
          <div className="row between history-entry" key={h.date}>
            <span>
              {h.date} ·{' '}
              {model.cycleStart(problem.key, h.date) &&
              model.cycleHistory(problem.key, h.date)[0]?.date === h.date
                ? '重新复习'
                : h.kind === 'new'
                  ? '首次练习'
                  : '复习'}
            </span>
            <span className={`pill ${h.rating}`}>{ratingName(h.rating)}</span>
          </div>
        ))}
      {history.length > 20 && <p className="footnote">显示最近 20 条，完整记录保留在备份中。</p>}
    </>
  );
}
function Learning({ problem }) {
  const { model, state, commit, openEditor, toast, storageError } = useTraining(),
    m = model.material(problem);
  const sources =
    m.source === '个人维护'
      ? [{ label: '参考链接', url: m.sourceUrl }]
      : m.sources || [{ label: '参考链接', url: m.sourceUrl }];
  async function copy() {
    try {
      await navigator.clipboard.writeText(m.solution);
      toast('代码已复制');
    } catch {
      toast('自动复制未获允许，请选择代码后手动复制。');
    }
  }
  return (
    <div className="learning">
      <details>
        <summary>思路速记{!m.memory?.trim() && ' · 待补充'}</summary>
        <div className="detailbody">
          <p className="memorytext">
            {m.memory || '还没有速记，可补充核心方法、关键步骤和易错点。'}
          </p>
          <p className="footnote">{m.complexity}</p>
          <button className="btn sm" onClick={() => openEditor(problem.key)}>
            编辑资料
          </button>
        </div>
      </details>
      <details>
        <summary>参考答案{!m.solution?.trim() && ' · 待补充'}</summary>
        <div className="detailbody">
          <div className="row between">
            <span className="pill purple">
              {m.source || '个人维护'} · {m.language || 'Python 3'}
            </span>
            <div className="row">
              {m.solution && (
                <button className="btn sm" onClick={copy}>
                  复制代码
                </button>
              )}
              <button className="btn sm" onClick={() => openEditor(problem.key)}>
                编辑资料
              </button>
            </div>
          </div>
          {m.correction && <p className="callout warn">{m.correction}</p>}
          {m.solution ? (
            <pre>
              <code>{m.solution}</code>
            </pre>
          ) : (
            <p className="helper">参考答案可暂留空，题目仍可正常评级和复习。</p>
          )}
          <div className="sources">
            {sources
              .filter((s) => referenceUrl(s.url))
              .map((s, i) => (
                <a href={referenceUrl(s.url)} key={i} target="_blank" rel="noopener noreferrer">
                  {s.label || '参考链接'} ↗
                </a>
              ))}
          </div>
          {m.original && (
            <details>
              <summary>文档原始代码、注释与其他写法</summary>
              <pre>
                <code>{m.original}</code>
              </pre>
            </details>
          )}
        </div>
      </details>
      <details>
        <summary>个人错因笔记{state.notes[problem.key] && ' · 已记录'}</summary>
        <div className="detailbody">
          <textarea
            className="notes"
            aria-label={`${problem.title}个人笔记`}
            maxLength={20000}
            placeholder="自己的错因、边界条件、下次需要回忆的点……"
            value={state.notes[problem.key] || ''}
            onChange={(e) =>
              commit({ ...state, notes: { ...state.notes, [problem.key]: e.target.value } })
            }
          />
          <span className={`savedhint ${storageError ? 'error-text' : ''}`}>
            {storageError ? '尚未保存，请导出备份' : '输入后自动保存'}
          </span>
        </div>
      </details>
      <details>
        <summary>练习记录与复习日期</summary>
        <div className="detailbody">
          <History
            key={`${problem.key}:${model.timeToNext(problem.key)?.date}`}
            problem={problem}
          />
        </div>
      </details>
    </div>
  );
}
export default function ProblemCard({ problem, variant = 'daily' }) {
  const navigate = useNavigate();
  const { model, viewDate, openEditor, deleteProblem, relearn, cancelRelearn } = useTraining(),
    latest = model.last(problem.key),
    next = model.timeToNext(problem.key);
  const over = next ? Math.max(0, dateDiff(viewDate, next.date)) : 0;
  const relearning = model.isRelearning(problem.key);
  return (
    <article className={`problem ${variant}`} data-problem={problem.key}>
      <div className="problem-main">
        <div className="ptitle">
          <ProblemLink problem={problem} />
          {relearning && <span className="pill purple">重新复习中</span>}
          {latest && <span className={`pill ${latest.rating}`}>{ratingName(latest.rating)}</span>}
          {variant === 'review' && (
            <span className={`pill ${over ? 'red' : 'dark'}`}>
              {over ? `逾期 ${over} 天` : '今日到期'}
            </span>
          )}
        </div>
        <div className="meta">
          <span>{problem.topic}</span>
          <span>{problem.diff}</span>
          <span>{problem.origin === 'official' ? 'Hot 100' : '拓展题'}</span>
          <span>
            {relearning
              ? '完成重新复习并评级后重新安排复习'
              : next
                ? `下次 ${fmt(next.date)}`
                : '评级后加入复习'}
          </span>
        </div>
      </div>
      {variant === 'library' ? (
        <div className="row">
          <button className="btn sm" onClick={() => openEditor(problem.key, true)}>
            记录练习
          </button>
          <button className="btn sm" onClick={() => openEditor(problem.key)}>
            编辑资料
          </button>
        </div>
      ) : (
        <GradeButtons problem={problem} />
      )}
      {
        <button
          className="btn sm"
          onClick={() => {
            if (relearn(problem.key)) navigate('/daily');
          }}
        >
          重新复习
        </button>
      }
      {relearning && (
        <button className="btn sm" onClick={() => cancelRelearn(problem.key)}>
          取消重新复习
        </button>
      )}
      <button
        className="btn sm danger"
        aria-label={'删除 ' + problem.num + '. ' + problem.title}
        onClick={() => deleteProblem(problem.key)}
      >
        删除题目
      </button>
      <Learning problem={problem} />
    </article>
  );
}
export function Completed() {
  const { model, undoAction, undo } = useTraining(),
    items = model.doneOn();
  return (
    <Panel
      title="本日已完成"
      subtitle={`${items.length} 道 · 可修改当天评级`}
      action={
        undoAction && (
          <button className="btn sm" onClick={undo}>
            撤销最近一次评级
          </button>
        )
      }
    >
      <details>
        <summary>展开完成记录（{items.length}）</summary>
        {items.length ? (
          items.map((p) => <ProblemCard key={p.key} problem={p} />)
        ) : (
          <Empty>完成题目后进行评级。</Empty>
        )}
      </details>
    </Panel>
  );
}

