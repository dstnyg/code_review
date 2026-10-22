import { Link } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { dateAdd, fmt, TODAY } from '../domain/training';
import FIXED from '../data/problems.json';

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panelhead">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({ title = '暂无记录', children }) {
  return (
    <div className="empty">
      <span className="empty-mark">◎</span>
      <b>{title}</b>
      <span>{children}</span>
    </div>
  );
}
export function AddButton() {
  const { openEditor } = useTraining();
  return (
    <button className="btn primary" onClick={() => openEditor()}>
      ＋ 添加新题
    </button>
  );
}
export function Stats() {
  const { model, viewDate } = useTraining(),
    c = model.counts(),
    all = model.allProblems();
  const official = all.filter((p) => p.origin === 'official').length;
  const finished = model.doneOn().filter((p) => model.history(p.key)[0]?.date === viewDate).length;
  const stats = [
    [
      '本日首做',
      finished,
      `当日安排 ${model.planned().length} 道`,
      model.planned().length ? finished / model.planned().length : 0,
    ],
    [
      'Hot 100 本轮',
      `${c.official}/${official}`,
      `拓展题已练 ${c.extra}/${all.length - official}`,
      c.official / official,
    ],
    [
      '到期复习',
      model.dueList().length,
      '按掌握程度与逾期时间排序',
      model.dueList().length / all.length,
    ],
    ['稳定掌握', c.qualified, '两次绿色间隔至少 7 天', c.qualified / all.length],
  ];
  return (
    <div className="stats">
      {stats.map(([name, count, description, ratio], i) => (
        <div className={`stat stat-${i}`} key={name}>
          <div className="eyebrow">{name}</div>
          <strong>{count}</strong>
          <small>{description}</small>
          <div className="tinybar">
            <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Forecast() {
  const { model, viewDate } = useTraining();
  return (
    <Panel title="未来 7 天安排" subtitle="依据当前评级预测，后续练习后自动更新">
      {Array.from({ length: 7 }, (_, i) => {
        const date = dateAdd(viewDate, i + 1),
          due = model.allProblems().filter((p) => model.timeToNext(p.key)?.date === date).length;
        return (
          <div className="forecastline" key={date}>
            <b>{fmt(date)}</b>
            <span className="muted">新题 {model.planned(date).length} 道</span>
            <span className={`pill ${due ? 'purple' : 'dark'}`}>复习 {due} 道</span>
          </div>
        );
      })}
    </Panel>
  );
}
export function Rules() {
  return (
    <Panel title="把回忆变成习惯" subtitle="先独立回忆，再按需展开资料">
      <div className="rule">
        <div className="ruleitem">
          <span className="pill red">不会</span>
          <b>1 天后</b>
        </div>
        <div className="ruleitem">
          <span className="pill yellow">不熟</span>
          <b>3 天后</b>
        </div>
        <div className="ruleitem">
          <span className="pill green">连续独立 AC</span>
          <b>7 / 21 / 45 天后</b>
        </div>
      </div>
      <p className="helper">同一天修改评级只更新当天结果，红色或黄色会重置连续绿色次数。</p>
    </Panel>
  );
}
export function DayPlan() {
  const { model, state, viewDate, setViewDate } = useTraining();
  return (
    <Panel title="首轮 9 天题单" subtitle="88 道 Hot 100 简单／中等题与 2 道拓展题">
      <div className="daygrid">
        {Array.from({ length: 9 }, (_, i) => {
          const date = dateAdd(state.startDate, i),
            ps = FIXED.filter((p) => p.day === i + 1),
            done = ps.filter((p) => model.last(p.key)).length;
          return (
            <button
              className={`daybox ${date === viewDate ? 'on' : ''}`}
              key={date}
              onClick={() => setViewDate(date)}
            >
              D{i + 1}
              <span>{fmt(date)}</span>
              <small>
                {done}/{ps.length} 完成
              </small>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
export function StorageNotice() {
  const { storageError, exportData } = useTraining();
  return (
    storageError && (
      <div className="notice" role="alert">
        {storageError}
        <button className="btn sm" onClick={exportData}>
          导出当前数据
        </button>
        <Link className="btn sm" to="/settings">
          前往备份与恢复
        </Link>
      </div>
    )
  );
}
export function DatePicker() {
  const { viewDate, setViewDate } = useTraining();
  return (
    <div className="dayselect">
      <button aria-label="前一天" onClick={() => setViewDate(dateAdd(viewDate, -1))}>
        ‹
      </button>
      <input
        type="date"
        aria-label="查看日期"
        min="2000-01-01"
        max="2199-12-31"
        value={viewDate}
        onChange={(e) => setViewDate(e.target.value)}
      />
      <button aria-label="后一天" onClick={() => setViewDate(dateAdd(viewDate, 1))}>
        ›
      </button>
      <button onClick={() => setViewDate(TODAY())}>今天</button>
    </div>
  );
}
