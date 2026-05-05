import { useEffect, useState } from 'react';
import { getTasks, saveTasks, TASKS_UPDATED_EVENT } from '../lib/storage';
import { Task } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { requestConfirm } from '../components/ConfirmSheet';
import { getTaskFocusMode } from '../lib/focusMode';
import { toggleTaskCompletion } from '../lib/taskActions';
import { useNavigate } from 'react-router';

const CATEGORY_LABELS: Record<Task['cat'], string> = {
  personal: 'Personal',
  work: 'Work',
  health: 'Health',
  study: 'Study',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterCat, setFilterCat] = useState<string>('');
  const { syncTasks, deleteTaskFromCloud } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = () => {
      const allTasks = getTasks();
      const sorted = [...allTasks].sort((a, b) => b.created - a.created);
      setTasks(sorted);
    };

    loadTasks();
    window.addEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
  }, []);

  const toggleTask = async (taskId: string) => {
    await toggleTaskCompletion(taskId, syncTasks);
  };

  const deleteTask = async (taskId: string) => {
    const task = tasks.find((entry) => entry.id === taskId);
    const confirmed = await requestConfirm({
      title: 'Delete this task?',
      message: task ? `"${task.name}" will be removed from your plan.` : 'This task will be removed from your plan.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!confirmed) return;

    const updated = getTasks().filter((entry) => entry.id !== taskId);
    saveTasks(updated);
    await deleteTaskFromCloud(taskId);
  };

  const filteredTasks = filterCat ? tasks.filter((task) => task.cat === filterCat) : tasks;

  return (
    <div className="max-w-5xl mx-auto p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="dayflow-kicker">Library</p>
          <h1 className="dayflow-h1">All tasks</h1>
        </div>
        <select
          value={filterCat}
          onChange={(event) => setFilterCat(event.target.value)}
          className="px-3 py-3 rounded-[16px] bg-[rgba(255,255,255,0.05)] border border-[var(--border)] text-[13px] text-[var(--text)] outline-none"
        >
          <option value="">All categories</option>
          <option value="work">Work</option>
          <option value="health">Health</option>
          <option value="study">Study</option>
          <option value="personal">Personal</option>
        </select>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="dayflow-empty-card dayflow-surface-card">
          <p className="dayflow-body">No tasks found. Add one from the floating action button.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <article key={task.id} className="dayflow-task-card dayflow-surface-card">
              <button
                onClick={() => void toggleTask(task.id)}
                className={`dayflow-task-check ${task.done ? 'is-done' : ''}`}
                aria-label={task.done ? `Mark ${task.name} as incomplete` : `Mark ${task.name} as complete`}
              >
                <span />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`dayflow-task-title ${task.done ? 'is-done' : ''}`}>{task.name}</div>
                    <div className="dayflow-caption mt-1">
                      {task.date}
                      {task.time ? ` - ${task.time}` : ''}
                      {' - '}
                      {task.dur} min
                    </div>
                    {task.notes && <div className="dayflow-body mt-2">{task.notes}</div>}
                  </div>
                  <span className="dayflow-category-pill">{CATEGORY_LABELS[task.cat]}</span>
                </div>
              </div>
              {!task.done && getTaskFocusMode(task.id) && (
                <button
                  onClick={() => navigate(`/focus?taskId=${encodeURIComponent(task.id)}`)}
                  className="text-[var(--accent)] p-2 hover:bg-[var(--surface3)] rounded-[12px] transition-colors"
                  aria-label={`Start focus mode for ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => void deleteTask(task.id)}
                className="text-[var(--danger)] p-2 hover:bg-[var(--surface3)] rounded-[12px] transition-colors"
                aria-label={`Delete ${task.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
