import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { requestConfirm } from '../components/ConfirmSheet';
import { useAuth } from '../contexts/AuthContext';
import { getTaskFocusMode } from '../lib/focusMode';
import { getSleepHours, getSleepWindow, getTaskHours } from '../lib/planner';
import { getProfile, getTasks, openTaskModal, saveTasks, TASKS_UPDATED_EVENT, todayStr } from '../lib/storage';
import { toggleTaskCompletion } from '../lib/taskActions';
import { Task } from '../lib/supabase';

const CAT_COLORS = {
  work: '#7eaedc',
  health: '#63c38e',
  study: '#8f81d7',
  personal: '#de896f',
} as const;

type ScheduleView = 'timeline' | 'calendar';

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [view, setView] = useState<ScheduleView>('timeline');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [slotPickerHour, setSlotPickerHour] = useState<number | null>(null);
  const profile = getProfile();
  const { syncTasks, deleteTaskFromCloud } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = () => {
      const allTasks = getTasks();
      const filtered = allTasks
        .filter((task) => task.date === selectedDate)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      setTasks(filtered);
    };

    loadTasks();
    window.addEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
  }, [selectedDate]);

  const allTasks = useMemo(() => getTasks(), [tasks]);
  const weekDates = useMemo(() => buildWeekDates(selectedDate), [selectedDate]);
  const selectedMonth = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${todayStr()}T00:00:00`));

  useEffect(() => {
    setCalendarMonth(new Date(`${selectedDate}T00:00:00`));
  }, [selectedDate]);

  const monthGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const taskDates = useMemo(() => new Set(allTasks.map((task) => task.date)), [allTasks]);
  const sleepHours = useMemo(() => getSleepHours(profile, selectedDate), [profile, selectedDate]);
  const taskHours = useMemo(() => getTaskHours(tasks.filter((task) => task.time)), [tasks]);
  const awakeHours = 24 - sleepHours.length;
  const busyAwakeHours = taskHours.filter((hour) => !sleepHours.includes(hour)).length;
  const freeHours = Math.max(awakeHours - busyAwakeHours, 0);
  const sleepWindow = getSleepWindow(profile, selectedDate);

  const tasksByHour = useMemo(() => {
    const map = new Map<number, Task[]>();
    tasks
      .filter((task) => task.time)
      .forEach((task) => {
        const hour = Number(task.time?.split(':')[0] || 0);
        map.set(hour, [...(map.get(hour) || []), task]);
      });
    return map;
  }, [tasks]);

  const slotTasks = slotPickerHour === null ? [] : tasksByHour.get(slotPickerHour) || [];

  const handleSlotClick = (hour: number) => {
    const hourTasks = tasksByHour.get(hour) || [];

    if (hourTasks.length === 0) {
      openTaskModal({ date: selectedDate, time: `${hour.toString().padStart(2, '0')}:00` });
      return;
    }

    if (hourTasks.length === 1) {
      openTaskModal({ taskId: hourTasks[0].id });
      return;
    }

    setSlotPickerHour(hour);
  };

  const toggleTask = async (taskId: string) => {
    await toggleTaskCompletion(taskId, syncTasks);
  };

  const deleteTask = async (taskId: string) => {
    const task = tasks.find((entry) => entry.id === taskId);
    const confirmed = await requestConfirm({
      title: 'Delete this task?',
      message: task ? `"${task.name}" will be removed from ${selectedDate}.` : 'This task will be removed from your plan.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!confirmed) return;

    const updated = getTasks().filter((entry) => entry.id !== taskId);
    saveTasks(updated);
    await deleteTaskFromCloud(taskId);
    setSlotPickerHour(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="dayflow-kicker">Timeline</p>
          <h1 className="dayflow-h1">Schedule</h1>
        </div>
        <div className="flex rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-1">
          {(['timeline', 'calendar'] as ScheduleView[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setView(entry)}
              className={`rounded-[14px] px-4 py-2 text-[13px] font-[600] transition ${
                view === entry ? 'bg-[rgba(var(--accent-rgb),0.18)] text-[var(--text)]' : 'text-[var(--muted2)]'
              }`}
            >
              {entry === 'timeline' ? 'Daily timeline' : 'Calendar view'}
            </button>
          ))}
        </div>
      </div>

      {view === 'timeline' ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {weekDates.map((date) => {
              const dateStr = toDateKey(date);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr();

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-[18px] border px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-[rgba(var(--accent-rgb),0.28)] bg-[rgba(var(--accent-rgb),0.18)] text-[var(--text)]'
                      : 'border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--muted2)]'
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-[18px] font-bold">{date.getDate()}</div>
                  {isToday && !isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </button>
              );
            })}
          </div>

          <TimelinePanel
            selectedDate={selectedDate}
            tasks={tasks}
            tasksByHour={tasksByHour}
            sleepHours={sleepHours}
            awakeHours={awakeHours}
            freeHours={freeHours}
            sleepWindow={sleepWindow}
            onSlotClick={handleSlotClick}
            onToggleTask={toggleTask}
            onEditTask={(taskId) => openTaskModal({ taskId })}
            onDeleteTask={deleteTask}
            onStartFocus={(taskId) => navigate(`/focus?taskId=${encodeURIComponent(taskId)}`)}
          />
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="dayflow-surface-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="dayflow-kicker">Monthly planner</p>
                <h2 className="dayflow-h2">{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                  className="rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--text)]"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                  className="rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--text)]"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-[700] uppercase tracking-[0.16em] text-[var(--muted)]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {monthGrid.map((day) => {
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const dateKey = toDateKey(day);
                const isSelected = dateKey === selectedDate;
                const hasTasks = taskDates.has(dateKey);
                const isToday = dateKey === todayStr();

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateKey);
                      setView('timeline');
                    }}
                    className="min-h-[84px] rounded-[18px] border p-3 text-left transition"
                    style={{
                      background: isSelected ? 'rgba(var(--accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                      borderColor: isSelected ? 'rgba(var(--accent-rgb),0.28)' : 'var(--border)',
                      opacity: isCurrentMonth ? 1 : 0.45,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-[700] text-[var(--text)]">{day.getDate()}</span>
                      {isToday && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: hasTasks ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }}
                      />
                      <span className="text-[11px] text-[var(--muted2)]">{countTasksForDate(allTasks, dateKey)} tasks</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="dayflow-surface-card p-5">
              <p className="dayflow-kicker">Selected date</p>
              <h2 className="dayflow-h2 mt-2">
                {selectedMonth.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <p className="dayflow-body mt-3">
                {tasks.length > 0
                  ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} scheduled. Open the timeline to place or adjust them by hour.`
                  : 'No tasks on this date yet. Open the timeline or use add task to shape the day.'}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" className="dayflow-primary-button" onClick={() => setView('timeline')}>
                  Open timeline
                </button>
                <button
                  type="button"
                  className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-medium text-[var(--text)]"
                  onClick={() => openTaskModal({ date: selectedDate })}
                >
                  Add task
                </button>
              </div>
            </div>

            <div className="dayflow-surface-card p-5">
              <p className="dayflow-kicker">What is planned</p>
              <div className="mt-4 space-y-3">
                {tasks.length === 0 ? (
                  <p className="dayflow-body">Nothing scheduled for this date yet.</p>
                ) : (
                  tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-[600] text-[var(--text)]">{task.name}</div>
                          <div className="mt-1 text-[12px] text-[var(--muted2)]">
                            {task.time || 'No time set'} · {task.dur} min
                          </div>
                        </div>
                        <span className="dayflow-category-pill">{task.cat}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {slotPickerHour !== null && (
        <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setSlotPickerHour(null)}>
          <div
            className="dayflow-confirm-sheet w-full max-w-md rounded-[24px] border border-[var(--border2)] p-5"
            style={{ background: 'var(--elevated)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dayflow-h2">{slotPickerHour.toString().padStart(2, '0')}:00 slot</div>
            <div className="mb-4 mt-2 dayflow-body">Choose a task to update, or add a new one at this hour.</div>

            <div className="mb-4 space-y-2">
              {slotTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setSlotPickerHour(null);
                    openTaskModal({ taskId: task.id });
                  }}
                  className="w-full rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-[600]">{task.name}</div>
                      <div className="mt-1 dayflow-caption">
                        {task.time || `${slotPickerHour.toString().padStart(2, '0')}:00`} - {task.dur} min
                      </div>
                    </div>
                    <span className="dayflow-category-pill">{task.cat}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSlotPickerHour(null)}
                className="flex-1 rounded-[16px] border border-[var(--border2)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-medium text-[var(--text)]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const time = `${slotPickerHour.toString().padStart(2, '0')}:00`;
                  setSlotPickerHour(null);
                  openTaskModal({ date: selectedDate, time });
                }}
                className="flex-1 rounded-[16px] bg-[var(--accent)] px-4 py-3 text-[14px] font-medium text-[var(--bg)]"
              >
                Add task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelinePanel({
  selectedDate,
  tasks,
  tasksByHour,
  sleepHours,
  awakeHours,
  freeHours,
  sleepWindow,
  onSlotClick,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onStartFocus,
}: {
  selectedDate: string;
  tasks: Task[];
  tasksByHour: Map<number, Task[]>;
  sleepHours: number[];
  awakeHours: number;
  freeHours: number;
  sleepWindow: { bed: string; wake: string };
  onSlotClick: (hour: number) => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onStartFocus: (taskId: string) => void;
}) {
  return (
    <div className="dayflow-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="dayflow-kicker">24 hour view</p>
          <h2 className="dayflow-h2">Plan the day</h2>
        </div>
        <div className="text-right text-[12px] text-[var(--muted2)]">
          <span style={{ color: 'var(--accent)' }}>{tasks.length}</span> planned · <span>{awakeHours}h</span> awake · <span>{freeHours}h</span> free
        </div>
      </div>

      <div className="mb-4 rounded-[18px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.07)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] text-[var(--muted2)]">Sleep allocation</div>
            <div className="text-[18px] font-[650] text-[var(--text)]">
              {sleepWindow.bed} to {sleepWindow.wake}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-[var(--muted2)]">Hours blocked</div>
            <div className="text-[18px] font-[700]" style={{ color: 'var(--accent)' }}>
              {sleepHours.length}h
            </div>
          </div>
        </div>
      </div>

      <div className="dayflow-timeline-wrap">
        <div className="dayflow-timeline-grid">
          {Array.from({ length: 24 }, (_, hour) => {
            const hourTasks = tasksByHour.get(hour) || [];
            const isSleep = sleepHours.includes(hour);
            const isCurrentHour = selectedDate === todayStr() && new Date().getHours() === hour;

            return (
              <button
                key={hour}
                type="button"
                className={`dayflow-timeline-slot ${isSleep ? 'is-sleep' : ''} ${isCurrentHour ? 'is-now' : ''}`}
                onClick={() => onSlotClick(hour)}
              >
                <div className="dayflow-timeline-hour">{hour.toString().padStart(2, '0')}</div>
                {isSleep && <div className="dayflow-timeline-sleep">Sleep</div>}
                {!isSleep && hourTasks.length === 0 && (
                  <div className="dayflow-timeline-add" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                )}
                {!isSleep && hourTasks.length === 1 && (
                  <div className={`dayflow-timeline-task ${hourTasks[0].done ? 'is-done' : ''}`} style={{ background: CAT_COLORS[hourTasks[0].cat] }} title={hourTasks[0].name}>
                    {hourTasks[0].done ? 'Done ' : ''}
                    {hourTasks[0].name.length > 8 ? `${hourTasks[0].name.slice(0, 8)}...` : hourTasks[0].name}
                  </div>
                )}
                {!isSleep && hourTasks.length > 1 && (
                  <div className="dayflow-timeline-task" style={{ background: CAT_COLORS[hourTasks[0].cat] }} title={hourTasks.map((task) => task.name).join(', ')}>
                    {hourTasks.length}x tasks
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="dayflow-empty-card dayflow-surface-card">
          <p className="dayflow-body">No tasks for this day. Tap the grid or the + button to add one.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => void onToggleTask(task.id)}
                  className={`dayflow-task-check mt-1 ${task.done ? 'is-done' : ''}`}
                  aria-label={task.done ? `Mark ${task.name} as incomplete` : `Mark ${task.name} as complete`}
                >
                  <span />
                </button>
                <div className="h-12 w-1 shrink-0 rounded-full" style={{ background: CAT_COLORS[task.cat] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`dayflow-task-title ${task.done ? 'is-done' : ''}`}>{task.name}</div>
                    <div className="dayflow-category-pill">{task.cat}</div>
                  </div>
                  <div className="dayflow-caption mt-1">
                    {task.time || 'No time set'} · {task.dur} min
                  </div>
                  {task.notes && <div className="dayflow-body mt-2">{task.notes}</div>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!task.done && getTaskFocusMode(task.id) && (
                  <button
                    onClick={() => onStartFocus(task.id)}
                    className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.1)] px-3 py-2 text-[13px] font-[600] text-[var(--accent)] transition hover:bg-[rgba(var(--accent-rgb),0.14)]"
                    aria-label={`Start focus mode for ${task.name}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
                      <path d="M12 8v4l3 2" />
                    </svg>
                    Focus
                  </button>
                )}
                <button
                  onClick={() => onEditTask(task.id)}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] font-[600] text-[var(--muted2)] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]"
                  aria-label={`Edit ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => void onDeleteTask(task.id)}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[13px] font-[600] text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.12)]"
                  aria-label={`Delete ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildWeekDates(selectedDate: string) {
  const center = new Date(`${selectedDate}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(center);
    date.setDate(center.getDate() + index - 3);
    return date;
  });
}

function buildMonthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().split('T')[0];
}

function countTasksForDate(tasks: Task[], dateKey: string) {
  return tasks.filter((task) => task.date === dateKey).length;
}
