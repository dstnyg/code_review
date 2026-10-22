import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTraining } from '../app/TrainingContext';
import { AddButton, Empty, Panel } from '../components/Common';
import ProblemCard from '../components/ProblemCard';
import { canonicalUrl } from '../domain/training';

export default function Library() {
  const { model } = useTraining(),
    [params] = useSearchParams();
  const [filter, setFilter] = useState({
    search: '',
    rating: params.get('rating') || 'all',
    topic: 'all',
    source: 'all',
    missing: false,
  });
  function change(key, value) {
    setFilter((previous) => ({ ...previous, [key]: value }));
  }
  const all = model.allProblems(),
    topics = [...new Set(all.map((p) => p.topic))].sort();
  const visible = all.filter((p) => {
    const m = model.material(p),
      rating = model.last(p.key)?.rating || 'none';
    return (
      `${p.num} ${p.title} ${p.topic}`.toLowerCase().includes(filter.search.trim().toLowerCase()) &&
      (filter.rating === 'all' || rating === filter.rating) &&
      (filter.topic === 'all' || p.topic === filter.topic) &&
      (filter.source === 'all' ||
        (p.origin === 'official' ? 'official' : 'extra') === filter.source) &&
      (!filter.missing || !m.solution?.trim() || !m.memory?.trim() || !canonicalUrl(p.url))
    );
  });
  return (
    <Panel
      title="题库与学习资料"
      subtitle={`共 ${all.length} 道题 · 当前显示 ${visible.length} 道 · 答案默认收起`}
      action={<AddButton />}
    >
      <div className="toolbar">
        <input
          className="field search"
          aria-label="搜索题目"
          placeholder="搜索题号、题名或考点…"
          value={filter.search}
          onChange={(e) => change('search', e.target.value)}
        />
        <select
          className="field"
          aria-label="掌握程度"
          value={filter.rating}
          onChange={(e) => change('rating', e.target.value)}
        >
          {[
            ['all', '全部评级'],
            ['none', '未练习'],
            ['red', '未掌握'],
            ['yellow', '待巩固'],
            ['green', '已掌握'],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="field"
          aria-label="考点"
          value={filter.topic}
          onChange={(e) => change('topic', e.target.value)}
        >
          <option value="all">全部考点</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          className="field"
          aria-label="题目来源"
          value={filter.source}
          onChange={(e) => change('source', e.target.value)}
        >
          <option value="all">全部题目</option>
          <option value="official">Hot 100</option>
          <option value="extra">拓展题</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={filter.missing}
            onChange={(e) => change('missing', e.target.checked)}
          />{' '}
          资料待补充
        </label>
      </div>
      {visible.length ? (
        visible.map((p) => <ProblemCard key={p.key} problem={p} variant="library" />)
      ) : (
        <Empty title="没有符合条件的题目">修改搜索词或筛选条件后重试。</Empty>
      )}
    </Panel>
  );
}
