import { useTraining } from '../app/TrainingContext';
import { Empty, Forecast, Panel, Stats } from '../components/Common';
import ProblemCard, { Completed } from '../components/ProblemCard';

export default function Reviews() {
  const { model, state } = useTraining(),
    due = model.dueList();
  return (
    <>
      <Stats />
      <Panel
        title="动态复习队列"
        subtitle={`按红色、黄色、绿色及应复习日期排序，优先展示 ${state.maxReviews} 道。`}
      >
        {due.length ? (
          due
            .slice(0, state.maxReviews)
            .map((x) => <ProblemCard key={x.p.key} problem={x.p} variant="review" />)
        ) : (
          <Empty title="当前日期没有到期题">可在题库中主动练习，或查看已完成记录。</Empty>
        )}
        {due.length > state.maxReviews && (
          <details>
            <summary>展开其余 {due.length - state.maxReviews} 道到期题</summary>
            {due.slice(state.maxReviews).map((x) => (
              <ProblemCard key={x.p.key} problem={x.p} variant="review" />
            ))}
          </details>
        )}
      </Panel>
      <Completed />
      <Forecast />
    </>
  );
}
