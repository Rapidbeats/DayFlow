import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { requestConfirm } from '../components/ConfirmSheet';
import { useAuth } from '../contexts/AuthContext';
import { getTaskFocusMode } from '../lib/focusMode';
import { getTasks, openTaskModal, saveTasks, TASKS_UPDATED_EVENT } from '../lib/storage';
import { toggleTaskCompletion } from '../lib/taskActions';
import { Task } from '../lib/supabase';

type SortKey = 'name' | 'date' | 'time' | 'dur' | 'cat' | 'done';
type SortDirection = 'asc' | 'desc';

const CATEGORY_LABELS: Record<Task['cat'], string> = {
  personal: 'Personal',
  work: 'Work',
  health: 'Health',
  study: 'Study',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'done'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { syncTasks, deleteTaskFromCloud } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = () => {
      setTasks([...getTasks()]);
    };

    loadTasks();
    window.addEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const matchesSearch =
          !search.trim() ||
          task.name.toLowerCase().includes(search.toLowerCase()) ||
          (task.notes || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !filterCat || task.cat === filterCat;
        const matchesStatus =
          filterStatus === 'all' || (filterStatus === 'done' ? task.done : !task.done);

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => compareTasks(a, b, sortKey, sortDirection));
  }, [tasks, search, filterCat, filterStatus, sortKey, sortDirection]);

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

  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' || key === 'cat' ? 'asc' : 'desc');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="dayflow-kicker">Library</p>
          <h1 className="dayflow-h1">Task table</h1>
          <p className="dayflow-body mt-2">Sort, filter, scan, and jump straight into edits or focus sessions.</p>
        </div>
        <button type="button" className="dayflow-primary-button" onClick={() => openTaskModal()}>
          Add task
        </button>
      </div>

      <div className="dayflow-surface-card p-5">
        <div className="dayflow-task-table-toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task name or notes"
            className="dayflow-task-search"
          />
          <select
            value={filterCat}
            onChange={(event) => setFilterCat(event.target.value)}
            className="dayflow-task-filter"
          >
            <option value="">All categories</option>
            <option value="work">Work</option>
            <option value="health">Health</option>
            <option value="study">Study</option>
            <option value="personal">Personal</option>
          </select>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
            className="dayflow-task-filter"
          >
            <option value="all">All status</option>
            <option value="open">Open only</option>
            <option value="done">Completed only</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-[var(--muted2)]">
          <span>{filteredTasks.length} visible</span>
          <span>-</span>
          <span>Sorted by {columnLabel(sortKey)} {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="dayflow-empty-card mt-5 dayflow-surface-card">
            <p className="dayflow-body">No tasks match the current filters.</p>
          </div>
        ) : (
          <div className="dayflow-task-table-wrap">
            <table className="dayflow-task-table">
              <thead>
                <tr>
                  <SortableHead label="Done" sortKey="done" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <SortableHead label="Task" sortKey="name" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <SortableHead label="Date" sortKey="date" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <SortableHead label="Time" sortKey="time" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <SortableHead label="Duration" sortKey="dur" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <SortableHead label="Category" sortKey="cat" currentKey={sortKey} direction={sortDirection} onSort={requestSort} />
                  <th>Focus</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <button
                        onClick={() => void toggleTask(task.id)}
                        className={`dayflow-task-check ${task.done ? 'is-done' : ''}`}
                        aria-label={task.done ? `Mark ${task.name} as incomplete` : `Mark ${task.name} as complete`}
                      >
                        <span />
                      </button>
                    </td>
                    <td>
                      <div className="dayflow-task-table-title-wrap">
                        <div className={`dayflow-task-title ${task.done ? 'is-done' : ''}`}>{task.name}</div>
                        {task.notes && <div className="dayflow-caption">{task.notes}</div>}
                      </div>
                    </td>
                    <td>{task.date}</td>
                    <td>{task.time || 'Any time'}</td>
                    <td>{task.dur} min</td>
                    <td>
                      <span className="dayflow-category-pill">{CATEGORY_LABELS[task.cat]}</span>
                    </td>
                    <td>
                      {!task.done && getTaskFocusMode(task.id) ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/focus?taskId=${encodeURIComponent(task.id)}`)}
                          className="dayflow-task-inline-button is-accent"
                        >
                          Focus
                        </button>
                      ) : (
                        <span className="dayflow-caption">-</span>
                      )}
                    </td>
                    <td>
                      <div className="dayflow-task-row-actions">
                        <button
                          type="button"
                          onClick={() => openTaskModal({ taskId: task.id })}
                          className="dayflow-task-inline-button"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTask(task.id)}
                          className="dayflow-task-inline-button is-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  const arrow = !active ? '' : direction === 'asc' ? '↑' : '↓';

  return (
    <th>
      <button type="button" onClick={() => onSort(sortKey)} className={`dayflow-task-sort ${active ? 'is-active' : ''}`}>
        {label}
        <span>{arrow}</span>
      </button>
    </th>
  );
}

function compareTasks(a: Task, b: Task, sortKey: SortKey, direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1;

  const normalizeTime = (time?: string) => time || '99:99';

  let result = 0;
  switch (sortKey) {
    case 'name':
      result = a.name.localeCompare(b.name);
      break;
    case 'date':
      result = a.date.localeCompare(b.date);
      break;
    case 'time':
      result = normalizeTime(a.time).localeCompare(normalizeTime(b.time));
      break;
    case 'dur':
      result = a.dur - b.dur;
      break;
    case 'cat':
      result = a.cat.localeCompare(b.cat);
      break;
    case 'done':
      result = Number(a.done) - Number(b.done);
      break;
  }

  if (result === 0) {
    result = a.created - b.created;
  }

  return result * factor;
}

function columnLabel(key: SortKey) {
  switch (key) {
    case 'name':
      return 'task';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'dur':
      return 'duration';
    case 'cat':
      return 'category';
    case 'done':
      return 'status';
  }
}
