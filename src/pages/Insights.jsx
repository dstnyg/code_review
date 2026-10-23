import { useTraining } from '../app/TrainingContext';
import { Empty, Panel, Stats } from '../components/Common';
import { ratingName } from '../domain/actions';
import { fmt, RATINGS } from '../domain/training';

export default function Insights() {
  const { state, model, viewDate } = useTraining(),
    all = model.allProblems(),
    c = model.counts();
  const topics = [...new Set(all.map((p) => p.topic))];
  const records = all.flatMap((p) => state.logs[p.key] || []).filter((h) => h.date <= viewDate),
    days = [...new Set(records.map((h) => h.date))].sort().reverse().slice(0, 12);
  return (
    <>
      <Stats />
      <div className="cols">
        <Panel title="各专项完成进度" subtitle="按截至所选日期是否有过首次练习统计。">
          {topics.map((topic) => {
            const ps = all.filter((p) => p.topic === topic),
              done = ps.filter((p) => model.last(p.key)).length;
            return (
              <div className="chartrow" key={topic}>
                <span>{topic}</span>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={topic}
                  aria-valuenow={done}
                  aria-valuemin={0}
                  aria-valuemax={ps.length}
                >
                  <span style={{ width: `${(done / ps.length) * 100}%` }} />
                </div>
                <b>
                  {done}/{ps.length}
                </b>
              </div>
            );
          })}
        </Panel>
        <div>
          <Panel title="掌握程度分布" subtitle="所选日期的最新评级">
            <div className="rule">
              {RATINGS.map((rating) => (
                <div className="ruleitem" key={rating}>
                  <span className={`pill ${rating}`}>{ratingName(rating)}</span>
                  <b>{c[rating]} 道</b>
                </div>
              ))}
              <div className="ruleitem">
                <span className="pill purple">重新复习中</span>
                <b>{c.relearning} 道</b>
              </div>
              <div className="ruleitem">
                <span>未练习</span>
                <b>{c.unpracticed} 道</b>
              </div>
            </div>
          </Panel>
          <Panel title="最近训练记录" subtitle="同一天同一道题只计一次">
            {days.length ? (
              days.map((day) => {
                const rs = records.filter((h) => h.date === day);
                return (
                  <div className="forecastline" key={day}>
                    <b>{fmt(day)}</b>
                    <span className="muted">
                      首做 {rs.filter((h) => h.kind === 'new').length} / 复习{' '}
                      {rs.filter((h) => h.kind === 'review').length}
                    </span>
                    <span className="pill green">
                      绿色 {rs.filter((h) => h.rating === 'green').length}
                    </span>
                  </div>
                );
              })
            ) : (
              <Empty>完成题目后进行评级。</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
