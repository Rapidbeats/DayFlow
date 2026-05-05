import { useEffect, useMemo, useState } from 'react';
import { getProfile, getTasks, openTaskModal, saveTasks, TASKS_UPDATED_EVENT, todayStr } from '../lib/storage';
import { Task } from '../lib/supabase';
import { getTaskFocusMode } from '../lib/focusMode';
import { getSleepHours, getSleepWindow, getTaskHours } from '../lib/planner';
import { useAuth } from '../contexts/AuthContext';
import { requestConfirm } from '../components/ConfirmSheet';
import { toggleTaskCompletion } from '../lib/taskActions';
import { useNavigate } from 'react-router';

const CAT_COLORS = {
  work: '#7eaedc',
  health: '#63c38e',
  study: '#8f81d7',
  personal: '#de896f',
} as const;

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
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

  const weekDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index - 3);
      return date;
    });
  }, []);

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
      openTaskModal({
        date: selectedDate,
        time: `${hour.toString().padStart(2, '0')}:00`,
      });
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
    <div className="max-w-5xl mx-auto p-5 space-y-5">
      <div>
        <p className="dayflow-kicker">Timeline</p>
        <h1 className="dayflow-h1">Schedule</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {weekDates.map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr();

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-[18px] transition-all ${
                isSelected
                  ? 'bg-[rgba(var(--accent-rgb),0.18)] text-[var(--text)] border border-[rgba(var(--accent-rgb),0.28)]'
                  : 'bg-[rgba(255,255,255,0.04)] text-[var(--muted2)] border border-[var(--border)]'
              }`}
            >
              <div className="text-[11px] font-medium uppercase">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-[18px] font-bold">{date.getDate()}</div>
              {isToday && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
            </button>
          );
        })}
      </div>

      <div className="dayflow-surface-card p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <p className="dayflow-kicker">24 hour view</p>
            <h2 className="dayflow-h2">Plan the day</h2>
          </div>
          <div className="text-[12px] text-[var(--muted2)] text-right">
            <span style={{ color: 'var(--accent)' }}>{tasks.length}</span> planned - <span>{awakeHours}h</span> awake -
            <span> {freeHours}h</span> free
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
                  onClick={() => handleSlotClick(hour)}
                >
                  <div className="dayflow-timeline-hour">{hour.toString().padStart(2, '0')}</div>
                  {isSleep && <div className="dayflow-timeline-sleep">Sleep</div>}
                  {!isSleep && hourTasks.length === 0 && (
                    <div className="dayflow-timeline-add" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                  )}
                  {!isSleep && hourTasks.length === 1 && (
                    <div
                      className={`dayflow-timeline-task ${hourTasks[0].done ? 'is-done' : ''}`}
                      style={{ background: CAT_COLORS[hourTasks[0].cat] }}
                      title={hourTasks[0].name}
                    >
                      {hourTasks[0].done ? 'Done ' : ''}
                      {hourTasks[0].name.length > 8 ? `${hourTasks[0].name.slice(0, 8)}...` : hourTasks[0].name}
                    </div>
                  )}
                  {!isSleep && hourTasks.length > 1 && (
                    <div
                      className="dayflow-timeline-task"
                      style={{ background: CAT_COLORS[hourTasks[0].cat] }}
                      title={hourTasks.map((task) => task.name).join(', ')}
                    >
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
              <li key={task.id} className="dayflow-task-card dayflow-surface-card">
                <button
                  onClick={() => void toggleTask(task.id)}
                  className={`dayflow-task-check ${task.done ? 'is-done' : ''}`}
                  aria-label={task.done ? `Mark ${task.name} as incomplete` : `Mark ${task.name} as complete`}
                >
                  <span />
                </button>
                <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[task.cat] }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`dayflow-task-title ${task.done ? 'is-done' : ''}`}>{task.name}</div>
                    <div className="dayflow-category-pill">{task.cat}</div>
                  </div>
                  <div className="dayflow-caption">
                    {task.time || 'No time set'} - {task.dur} min
                  </div>
                  {task.notes && <div className="dayflow-body mt-2">{task.notes}</div>}
                </div>
                <button
                  onClick={() => navigate(`/focus?taskId=${encodeURIComponent(task.id)}`)}
                  className={`text-[var(--accent)] p-2 hover:bg-[var(--surface3)] rounded-[12px] transition-colors ${!getTaskFocusMode(task.id) || task.done ? 'hidden' : ''}`}
                  aria-label={`Start focus mode for ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                </button>
                <button
                  onClick={() => openTaskModal({ taskId: task.id })}
                  className="text-[var(--muted2)] p-2 hover:bg-[var(--surface3)] rounded-[12px] transition-colors"
                  aria-label={`Edit ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => void deleteTask(task.id)}
                  className="text-[var(--danger)] p-2 hover:bg-[var(--surface3)] rounded-[12px] transition-colors"
                  aria-label={`Delete ${task.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {slotPickerHour !== null && (
        <div className="fixed inset-0 z-[220] bg-black/55 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setSlotPickerHour(null)}>
          <div
            className="w-full max-w-md rounded-[var(--r-lg)] border border-[var(--border2)] p-5 dayflow-confirm-sheet"
            style={{ background: 'var(--elevated)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dayflow-h2">{slotPickerHour.toString().padStart(2, '0')}:00 slot</div>
            <div className="dayflow-body mt-2 mb-4">Choose a task to update, or add a new one at this hour.</div>

            <div className="space-y-2 mb-4">
              {slotTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setSlotPickerHour(null);
                    openTaskModal({ taskId: task.id });
                  }}
                  className="w-full text-left p-3 rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-[600]">{task.name}</div>
                      <div className="dayflow-caption mt-1">
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
                className="flex-1 py-3 px-4 rounded-[16px] border border-[var(--border2)] bg-[rgba(255,255,255,0.04)] text-[var(--text)] text-[14px] font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const time = `${slotPickerHour.toString().padStart(2, '0')}:00`;
                  setSlotPickerHour(null);
                  openTaskModal({ date: selectedDate, time });
                }}
                className="flex-1 py-3 px-4 rounded-[16px] bg-[var(--accent)] text-[var(--bg)] text-[14px] font-medium"
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
