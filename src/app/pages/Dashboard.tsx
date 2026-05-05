import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { fmtDate, getProfile, getTasks, openTaskModal, TASKS_UPDATED_EVENT, todayStr } from '../lib/storage';
import { Task } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FOCUS_SESSION_UPDATED_EVENT, formatClock, getActiveFocusSession, getFocusProgress, getTaskFocusMode } from '../lib/focusMode';
import { toggleTaskCompletion } from '../lib/taskActions';

const MOTIVATION = [
  "Let's get started.",
  'You already made the plan. Now trust it.',
  'Keep the day gentle and intentional.',
  'Small progress still counts.',
];

const CATEGORY_LABELS: Record<Task['cat'], string> = {
  personal: 'Personal',
  work: 'Work',
  health: 'Health',
  study: 'Study',
};

const CATEGORY_NOTES: Record<Task['cat'], string> = {
  personal: 'personal tasks',
  work: 'work blocks',
  health: 'health tasks',
  study: 'study sessions',
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [greeting, setGreeting] = useState('');
  const [activeFocusSession, setActiveFocusSession] = useState(() => getActiveFocusSession());
  const profile = getProfile();
  const { syncTasks } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();

  useEffect(() => {
    const loadTasks = () => {
      const allTasks = getTasks();
      const todayTasks = allTasks
        .filter((task) => task.date === today)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      setTasks(todayTasks);
    };

    loadTasks();
    updateGreeting();
    setActiveFocusSession(getActiveFocusSession());

    window.addEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
    window.addEventListener(FOCUS_SESSION_UPDATED_EVENT, loadFocusSession as EventListener);
    return () => {
      window.removeEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
      window.removeEventListener(FOCUS_SESSION_UPDATED_EVENT, loadFocusSession as EventListener);
    };

    function loadFocusSession() {
      setActiveFocusSession(getActiveFocusSession());
    }
  }, [today]);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
    const name = profile.name || 'there';
    setGreeting(`${timeGreeting}, ${name}`);
  };

  const toggleTask = async (taskId: string) => {
    await toggleTaskCompletion(taskId, syncTasks);
  };

  const completedTasks = tasks.filter((task) => task.done).length;
  const totalTasks = tasks.length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const nextTask = tasks.find((task) => !task.done) || null;
  const nextTaskHasFocusMode = nextTask ? getTaskFocusMode(nextTask.id) : false;
  const upcomingTasks = tasks.filter((task) => !task.done).slice(0, 4);
  const topCategories = useMemo(() => {
    const counts = (['personal', 'work', 'health', 'study'] as Task['cat'][])
      .map((category) => ({
        category,
        count: tasks.filter((task) => task.cat === category).length,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]));

    const fallback = (['personal', 'study'] as Task['cat'][])
      .filter((category) => !counts.some((entry) => entry.category === category))
      .map((category) => ({ category, count: 0 }));

    return [...counts, ...fallback].slice(0, 2);
  }, [tasks]);
  const statCards = useMemo(
    () => [
      ...topCategories.map(({ category, count }) => ({
        label: CATEGORY_LABELS[category],
        value: `${count}`,
        note: CATEGORY_NOTES[category],
      })),
      { label: 'Planned', value: `${tasks.length}`, note: 'items today' },
      { label: 'Done', value: `${completedTasks}`, note: 'completed' },
    ],
    [topCategories, tasks.length, completedTasks]
  );

  const rightRailDays = useMemo(() => {
    const allTasks = getTasks();
    return Array.from({ length: 21 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (20 - index));
      const dateKey = date.toISOString().split('T')[0];
      const count = allTasks.filter((task) => task.date === dateKey).length;
      return { dateKey, count };
    });
  }, [tasks]);

  const message = MOTIVATION[completedTasks % MOTIVATION.length];
  const activeFocusProgress = activeFocusSession ? getFocusProgress(activeFocusSession) : null;
  const activeFocusPhase = activeFocusSession?.segments[activeFocusSession.currentSegmentIndex]?.type === 'break' ? 'Break' : 'Focus';

  return (
    <div className="dayflow-dashboard-grid">
      <section className="dayflow-dashboard-main">
        <div className="dayflow-header-block">
          <p className="dayflow-kicker">Today</p>
          <h1 className="dayflow-h1">{greeting}</h1>
          <p className="dayflow-caption">{fmtDate(today)}</p>
        </div>

        <div className="dayflow-hero-card dayflow-surface-card">
          <div className="dayflow-hero-copy">
            <p className="dayflow-kicker">Focus</p>
            <h2 className="dayflow-h2">{nextTask ? nextTask.name : 'A calm day starts here'}</h2>
            <p className="dayflow-body">
              {nextTask
                ? `${nextTask.time || 'Any time today'} - ${nextTask.dur} min`
                : 'No urgent task is queued yet. Add one when you are ready.'}
            </p>
          </div>
          <div className="dayflow-hero-actions">
            <button
              type="button"
              className="dayflow-time-pill"
              onClick={() => navigate('/schedule')}
            >
              {nextTask ? timeRemainingLabel(nextTask) : 'Open plan'}
            </button>
            <button
              type="button"
              className="dayflow-primary-button"
              onClick={() => {
                if (nextTask) {
                  navigate(nextTaskHasFocusMode ? `/focus?taskId=${encodeURIComponent(nextTask.id)}` : '/schedule');
                  return;
                }
                openTaskModal({ date: today });
              }}
            >
              {nextTask ? (nextTaskHasFocusMode ? 'Focus now' : 'Start') : 'Plan now'}
            </button>
          </div>
        </div>

        {activeFocusSession && !activeFocusSession.completed && (
          <div className="dayflow-resume-card dayflow-surface-card">
            <div className="dayflow-resume-copy">
              <p className="dayflow-kicker">Resume focus session</p>
              <h2 className="dayflow-h2">{activeFocusSession.taskName}</h2>
              <p className="dayflow-body">
                {activeFocusPhase} running {activeFocusProgress ? `- ${formatClock(activeFocusProgress.remainingSec)} left` : ''}
              </p>
            </div>
            <button type="button" className="dayflow-primary-button" onClick={() => navigate(`/focus?taskId=${encodeURIComponent(activeFocusSession.taskId)}`)}>
              Resume focus
            </button>
          </div>
        )}

        <div className="dayflow-mobile-progress dayflow-surface-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="dayflow-kicker">Progress</p>
              <h2 className="dayflow-h2">{message}</h2>
              <p className="dayflow-body">
                {completedTasks} of {totalTasks} tasks complete
              </p>
            </div>
            <ProgressRing value={completionPct} />
          </div>
        </div>

        <div className="dayflow-section">
          <div className="dayflow-section-head">
            <div>
              <p className="dayflow-kicker">Today&apos;s list</p>
              <h2 className="dayflow-h2">Task flow</h2>
            </div>
            <span className="dayflow-caption">{tasks.length} items</span>
          </div>

          {tasks.length === 0 ? (
            <div className="dayflow-empty-card dayflow-surface-card">
              <div className="dayflow-empty-visual" aria-hidden="true">
                <div className="dayflow-empty-orbit dayflow-empty-orbit-1" />
                <div className="dayflow-empty-orbit dayflow-empty-orbit-2" />
                <div className="dayflow-empty-core">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                  </svg>
                </div>
              </div>
              <p className="dayflow-body">No tasks for today yet. Use the + button to shape the day.</p>
              <div className="mt-4">
                <button
                  type="button"
                  className="dayflow-primary-button"
                  onClick={() => openTaskModal({ date: today })}
                >
                  Plan now
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <article key={task.id} className="dayflow-task-card dayflow-surface-card">
                  <button
                    onClick={() => void toggleTask(task.id)}
                    className={`dayflow-task-check ${task.done ? 'is-done' : ''}`}
                    aria-label={task.done ? `Mark ${task.name} as incomplete` : `Mark ${task.name} as complete`}
                  >
                    <span />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={`dayflow-task-title ${task.done ? 'is-done' : ''}`}>{task.name}</h3>
                        <p className="dayflow-caption mt-1">
                          {task.time ? `${task.time} - ` : ''}
                          {task.dur} min
                        </p>
                      </div>
                      <span className="dayflow-category-pill">{CATEGORY_LABELS[task.cat]}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="dayflow-section">
          <div className="dayflow-section-head">
            <div>
              <p className="dayflow-kicker">Quick stats</p>
              <h2 className="dayflow-h2">Daily balance</h2>
            </div>
          </div>

          <div className="dayflow-stats-grid">
            {statCards.map((stat) => (
              <div key={stat.label} className="dayflow-stat-card dayflow-surface-card">
                <p className="dayflow-caption">{stat.label}</p>
                <div className="dayflow-stat-value">{stat.value}</div>
                <p className="dayflow-body">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="dayflow-dashboard-rail">
        <div className="dayflow-surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dayflow-kicker">Progress</p>
              <h2 className="dayflow-h2">Steady pace</h2>
            </div>
            <ProgressRing value={completionPct} />
          </div>
          <p className="dayflow-body mt-4">{message}</p>
        </div>

        <div className="dayflow-surface-card p-6">
          <div className="dayflow-section-head">
            <div>
              <p className="dayflow-kicker">Consistency</p>
              <h2 className="dayflow-h2">Calendar heatmap</h2>
            </div>
          </div>
          <div className="dayflow-heatmap">
            {rightRailDays.map((day) => (
              <div
                key={day.dateKey}
                className="dayflow-heat-cell"
                style={{
                  background: `rgba(var(--accent-rgb), ${Math.min(0.08 + day.count * 0.07, 0.32)})`,
                }}
                title={`${day.dateKey}: ${day.count} tasks`}
              />
            ))}
          </div>
        </div>

        <div className="dayflow-surface-card p-6">
          <div className="dayflow-section-head">
            <div>
              <p className="dayflow-kicker">Upcoming</p>
              <h2 className="dayflow-h2">Next actions</h2>
            </div>
          </div>
          <div className="space-y-3">
            {upcomingTasks.length === 0 ? (
              <p className="dayflow-body">All clear for now. You can slow down a little.</p>
            ) : (
              upcomingTasks.map((task) => (
                <div key={task.id} className="dayflow-rail-task">
                  <div>
                    <div className="dayflow-rail-task-title">{task.name}</div>
                    <div className="dayflow-caption mt-1">
                      {task.time ? `${task.time} - ` : ''}
                      {task.dur} min
                    </div>
                  </div>
                  <div className="dayflow-rail-task-dot" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dayflow-surface-card p-6">
          <p className="dayflow-kicker">Analytics</p>
          <h2 className="dayflow-h2">Completion rhythm</h2>
          <div className="dayflow-mini-bars mt-4">
            {statCards.slice(0, 4).map((stat, index) => (
              <div key={stat.label} className="dayflow-mini-bar-col">
                <div className="dayflow-mini-bar" style={{ height: `${36 + index * 18 + Number(stat.value) * 4}px` }} />
                <span className="dayflow-caption">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const circumference = 238.76;

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="dayflow-progress-ring">
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[18px] font-[700] text-[var(--text)]">{value}%</div>
    </div>
  );
}

function timeRemainingLabel(task: Task) {
  if (!task.time) return 'Open task';

  const now = new Date();
  const target = new Date(`${task.date}T${task.time}:00`);
  const diffMs = target.getTime() - now.getTime();

  if (Number.isNaN(diffMs)) return task.time;
  if (diffMs <= 0) return 'Ready now';

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m left`;
  if (minutes === 0) return `${hours}h left`;
  return `${hours}h ${minutes}m left`;
}