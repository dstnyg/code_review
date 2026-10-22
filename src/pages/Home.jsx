import { Link } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { AddButton, Empty, Forecast, Panel, Rules, Stats } from '../components/Common';
import ProblemCard, { Completed } from '../components/ProblemCard';

export default function Home() {
  const { model, state } = useTraining(),
    pending = model.planned().filter((p) => !model.last(p.key)),
    due = model.dueList();
  return (
    <>
      <Stats />
      <div className="cols">
        <div>
          <Panel
            title="当天做题"
            subtitle="保持自己的节奏，从今天这一题开始。"
            action={<AddButton />}
          >
            {pending.length ? (
              pending.slice(0, 5).map((p) => <ProblemCard key={p.key} problem={p} />)
            ) : (
              <Empty title="当日安排已完成或暂无安排">可以添加新题，或继续处理到期复习。</Empty>
            )}
            <Link className="btn sm" to="/daily">
              进入当天做题 →
            </Link>
          </Panel>
          <Forecast />
        </div>
        <div>
          <Panel
            title="优先复习"
            subtitle={`${due.length} 道到期 · 红色、黄色优先`}
            action={
              <Link className="btn sm" to="/reviews">
                完整队列 →
              </Link>
            }
          >
            {due.length ? (
              due
                .slice(0, Math.min(5, state.maxReviews))
                .map((x) => <ProblemCard key={x.p.key} problem={x.p} variant="review" />)
            ) : (
              <Empty title="暂无到期复习">新题评级后将自动进入复习计划。</Empty>
            )}
          </Panel>
          <Rules />
        </div>
      </div>
      <Completed />
    </>
  );
}
