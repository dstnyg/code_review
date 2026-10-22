import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTraining } from './TrainingContext';
import { DatePicker, StorageNotice } from '../components/Common';
import ProblemEditor from '../components/ProblemEditor';
import Home from '../pages/Home';
import Daily from '../pages/Daily';
import Reviews from '../pages/Reviews';
import Library from '../pages/Library';
import Insights from '../pages/Insights';
import Settings from '../pages/Settings';
import styles from './App.module.css';

const pages = [
  ['/', '总览', '我的算法训练台', '记录新题，回忆旧题，按掌握程度持续复习。', '◈', Home],
  ['/daily', '当天做题', '当天做题', '把每一次独立思考，变成可积累的进步。', '▦', Daily],
  ['/reviews', '动态复习', '动态复习', '先回忆，再验证。让知识在合适的时间回来。', '↻', Reviews],
  [
    '/library',
    '题库与笔记',
    '题库与学习资料',
    '整理思路、留下错因，建立自己的算法资料库。',
    '☷',
    Library,
  ],
  ['/insights', '数据分析', '学习进度', '从练习记录中，看到自己的节奏与积累。', '▥', Insights],
  ['/settings', '设置与备份', '设置与备份', '调整训练节奏，完整保存学习资料。', '⚙', Settings],
];
export default function App() {
  const { pathname } = useLocation(),
    page = pages.find((p) => p[0] === pathname) || pages[0];
  const { editor, model, viewDate } = useTraining();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${page[1]} · Hot 100 复习台`;
  }, [pathname, page]);
  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skiplink">
        跳到主要内容
      </a>
      <aside className={styles.side}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.logo}>
            L<span>·</span>
          </span>
          <span>
            <b>LeetCode Lab</b>
            <small>智能刷题 · 间隔复习</small>
          </span>
        </NavLink>
        <div className={styles.caption}>WORKSPACE / 工作台</div>
        <nav className={styles.nav} aria-label="主导航">
          {pages.map(([path, label, , , icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => (isActive ? styles.active : '')}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidenote}>
          <span>SMALL STEPS, EVERY DAY</span>
          <strong>按自己的节奏练习</strong>
          <p>
            先回忆，再按需展开资料。
            <br />
            今天的练习，会成为明天的底气。
          </p>
          <div className={styles.sidecount}>
            <b>{model.counts().solved}</b>
            <span>/ {model.allProblems().length} 道已练习</span>
          </div>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <div className="kicker">
              HOT 100 <span>／</span> ACTIVE RECALL
            </div>
            <h1>{page[2]}</h1>
            <p>{page[3]}</p>
          </div>
          <DatePicker />
        </header>
        <main id="main-content" className={styles.main}>
          <StorageNotice />
          <div key={`${pathname}:${viewDate}`}>
            <Routes>
              {pages.map(([path, , , , , Component]) => (
                <Route path={path} key={path} element={<Component />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <footer className={styles.footer}>
          LeetCode Lab <span>·</span> 本地保存学习记录 <span>·</span> 记得定期导出备份
        </footer>
      </div>
      {editor && <ProblemEditor key={`${editor.id}:${editor.practice}`} />}
    </div>
  );
}
