import { Link } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { AddButton, DayPlan, Empty, Panel, Stats } from '../components/Common';
import ProblemCard, { Completed } from '../components/ProblemCard';
import { fmt, TODAY } from '../domain/training';

export default function Daily() {
  const { model, viewDate } = useTraining(),
    pending = model.planned().filter((p) => !model.last(p.key)),
    backlog = model.backlog();
  return (
    <>
      <Stats />
      <Panel
        title={`${fmt(viewDate)} · 当天做题`}
        subtitle="首轮题单与自行添加的新题统一记录。"
        action={<AddButton />}
      >
        {viewDate !== TODAY() && (
          <p className="callout warn">
            当前查看 {viewDate}，添加和评级将记录到所选日期。
            {viewDate > TODAY() && '未来日期只能保存为待做。'}
          </p>
        )}
        {pending.length ? (
          pending.map((p) => <ProblemCard key={p.key} problem={p} />)
        ) : (
          <Empty title="暂无待做题目">添加当天的新题，或处理之前未完成的安排。</Empty>
        )}
        <p className="footnote">
          当日安排 {model.planned().length} 道；已练题目可在“本日已完成”或题库中查看。
        </p>
      </Panel>
      <Completed />
      {backlog.length > 0 && (
        <Panel
          title={`之前未完成的安排（${backlog.length}）`}
          subtitle="完成后按所选日期记录首次练习。"
        >
          {backlog.slice(0, 15).map((p) => (
            <ProblemCard key={p.key} problem={p} />
          ))}
          {backlog.length > 15 && (
            <Link className="btn sm" to="/library?rating=none">
              查看全部未练习题 →
            </Link>
          )}
        </Panel>
      )}
      <DayPlan />
    </>
  );
}
