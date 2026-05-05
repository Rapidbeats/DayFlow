import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getEligibleFocusDuration, getTaskFocusMode } from '../lib/focusMode';
import { getRepeatDates, minutesFromTime } from '../lib/planner';
import { getTasks, saveTasks, todayStr, uid } from '../lib/storage';
import { Task } from '../lib/supabase';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  initialTask?: Partial<Task> | null;
  onSave?: () => void;
}

const DAY_OPTIONS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getEndTimeFromDuration(startTime: string, duration: number) {
  const startMinute = minutesFromTime(startTime);
  if (startMinute == null) return '';

  const totalMinutes = (startMinute + duration) % 1440;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDurationFromRange(startTime: string, endTime: string) {
  const startMinute = minutesFromTime(startTime);
  const endMinute = minutesFromTime(endTime);

  if (startMinute == null || endMinute == null) return null;
  if (startMinute === endMinute) return 24 * 60;

  return endMinute > startMinute ? endMinute - startMinute : endMinute + 1440 - startMinute;
}

export default function TaskModal({ isOpen, onClose, taskToEdit, initialTask, onSave }: TaskModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [cat, setCat] = useState<'personal' | 'work' | 'health' | 'study'>('personal');
  const [dur, setDur] = useState(60);
  const [notes, setNotes] = useState('');
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [repeatPreset, setRepeatPreset] = useState<'none' | 'daily' | 'weekdays' | 'weekends' | 'custom'>('none');
  const [repeatEnd, setRepeatEnd] = useState('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { syncTasks } = useAuth();

  const previewDates = useMemo(() => getRepeatDates(date, repeatDays, repeatEnd), [date, repeatDays, repeatEnd]);
  const selectedDuration = time && endTime ? getDurationFromRange(time, endTime) || dur : dur;
  const focusModeEligible = getEligibleFocusDuration(selectedDuration);

  const resetForm = (seed?: Partial<Task> | null) => {
    const seededTime = seed?.time || '';
    const seededDuration = seed?.dur || 60;

    setName(seed?.name || '');
    setDate(seed?.date || todayStr());
    setTime(seededTime);
    setEndTime(seededTime ? getEndTimeFromDuration(seededTime, seededDuration) : '');
    setCat(seed?.cat || 'personal');
    setDur(seededDuration);
    setNotes(seed?.notes || '');
    setFocusModeEnabled(seed?.id ? getTaskFocusMode(seed.id) : false);
    setRepeatPreset('none');
    setRepeatEnd('');
    setRepeatDays([]);
    setIsSaving(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setName(taskToEdit.name);
      setDate(taskToEdit.date);
      setTime(taskToEdit.time || '');
      setEndTime(taskToEdit.time ? getEndTimeFromDuration(taskToEdit.time, taskToEdit.dur) : '');
      setCat(taskToEdit.cat);
      setDur(taskToEdit.dur);
      setNotes(taskToEdit.notes || '');
      setFocusModeEnabled(getTaskFocusMode(taskToEdit.id));
      setRepeatPreset('none');
      setRepeatEnd('');
      setRepeatDays([]);
      setIsSaving(false);
      return;
    }

    resetForm(initialTask);
  }, [taskToEdit, initialTask, isOpen]);

  const applyPreset = (preset: 'none' | 'daily' | 'weekdays' | 'weekends' | 'custom') => {
    setRepeatPreset(preset);

    if (preset === 'none') {
      setRepeatDays([]);
    } else if (preset === 'daily') {
      setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
    } else if (preset === 'weekdays') {
      setRepeatDays([1, 2, 3, 4, 5]);
    } else if (preset === 'weekends') {
      setRepeatDays([0, 6]);
    } else {
      setRepeatDays([]);
    }
  };

  const toggleDay = (day: number) => {
    setRepeatPreset('custom');
    setRepeatDays((current) => (current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day].sort()));
  };

  const handleSave = async () => {
    if (!name.trim() || isSaving) return;

    const resolvedDuration = time && endTime ? getDurationFromRange(time, endTime) || dur : dur;
    setIsSaving(true);

    try {
      const baseTask: Omit<Task, 'id'> = {
        name: name.trim(),
        date,
        time: time || undefined,
        cat,
        dur: resolvedDuration,
        notes: notes.trim() || undefined,
        done: taskToEdit?.done || false,
        created: taskToEdit?.created || Date.now(),
        repeat: repeatPreset === 'none' ? undefined : repeatPreset,
        repeat_days: repeatDays.length ? repeatDays : undefined,
        repeat_end: repeatEnd || undefined,
        focus_enabled: focusModeEligible && focusModeEnabled,
        focus_pattern: focusModeEligible && focusModeEnabled ? '50-8' : undefined,
        focus_session_active: taskToEdit?.focus_session_active || false,
        focus_segment_type: taskToEdit?.focus_segment_type,
        focus_segment_index: taskToEdit?.focus_segment_index,
        focus_segment_started_at: taskToEdit?.focus_segment_started_at,
        focus_segment_ends_at: taskToEdit?.focus_segment_ends_at,
        focus_midpoint_played: taskToEdit?.focus_midpoint_played || false,
        focus_paused: taskToEdit?.focus_paused || false,
        focus_paused_remaining_sec: taskToEdit?.focus_paused_remaining_sec,
        focus_snoozed_until: taskToEdit?.focus_snoozed_until,
        focus_completed: taskToEdit?.focus_completed || false,
        focus_updated_at: taskToEdit?.focus_updated_at,
      };

      const allTasks = getTasks();
      let updated: Task[];

      if (taskToEdit) {
        const updatedTask: Task = {
          ...taskToEdit,
          ...baseTask,
          id: taskToEdit.id,
        };
        updated = allTasks.map((task) => (task.id === taskToEdit.id ? updatedTask : task));
      } else {
        const createdAt = Date.now();
        const primaryTask: Task = { ...baseTask, id: uid(), created: createdAt, done: false };
        const repeatedTasks = previewDates.map<Task>((repeatDate, index) => ({
          ...baseTask,
          id: uid(),
          date: repeatDate,
          done: false,
          created: createdAt + index + 1,
        }));
        updated = [...allTasks, primaryTask, ...repeatedTasks];
      }

      saveTasks(updated);
      await syncTasks();

      resetForm(null);
      onClose();
      onSave?.();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(event) => {
        if (!isSaving && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[24px] border border-[var(--border2)] p-6"
        style={{ background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: '18px', fontWeight: 700 }}>{taskToEdit ? 'Edit task' : 'Add task'}</div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-2xl leading-none text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Task name *</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Morning run, Team meeting..."
              className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Start date *</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Start time</label>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  const nextTime = event.target.value;
                  setTime(nextTime);

                  if (!nextTime) {
                    setEndTime('');
                    return;
                  }

                  if (endTime) {
                    const nextDuration = getDurationFromRange(nextTime, endTime);
                    if (nextDuration) {
                      setDur(nextDuration);
                      return;
                    }
                  }

                  setEndTime(getEndTimeFromDuration(nextTime, dur));
                }}
                className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Category</label>
              <select
                value={cat}
                onChange={(event) => setCat(event.target.value as typeof cat)}
                className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              >
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="health">Health</option>
                <option value="study">Study</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(event) => {
                  const nextEndTime = event.target.value;
                  setEndTime(nextEndTime);

                  if (time && nextEndTime) {
                    const nextDuration = getDurationFromRange(time, nextEndTime);
                    if (nextDuration) setDur(nextDuration);
                  }
                }}
                className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Duration</label>
            <select
              value={dur}
              onChange={(event) => {
                const nextDuration = Number(event.target.value);
                setDur(nextDuration);
                if (time) {
                  setEndTime(getEndTimeFromDuration(time, nextDuration));
                }
              }}
              className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
              <option value="240">4 hours</option>
            </select>
            <div className="mt-2 text-[12px] text-[var(--muted2)]">Pick an end time for flexibility, or use duration to fill it automatically.</div>
          </div>

          {!taskToEdit && (
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Repeat</label>
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  ['none', 'No repeat'],
                  ['daily', 'Every day'],
                  ['weekdays', 'Weekdays'],
                  ['weekends', 'Weekends'],
                  ['custom', 'Custom'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyPreset(value as typeof repeatPreset)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      repeatPreset === value
                        ? 'border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.15)] text-[var(--accent)]'
                        : 'border-[var(--border2)] bg-[var(--surface2)] text-[var(--muted2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-3 flex gap-2">
                {DAY_OPTIONS.map((label, day) => (
                  <button
                    key={`${label}-${day}`}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`h-9 w-9 rounded-full border text-[12px] font-semibold transition-colors ${
                      repeatDays.includes(day)
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                        : 'border-[var(--border2)] bg-[var(--surface2)] text-[var(--muted2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {repeatPreset !== 'none' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Repeat until</label>
                  <input
                    type="date"
                    value={repeatEnd}
                    onChange={(event) => setRepeatEnd(event.target.value)}
                    className="w-full rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                  {previewDates.length > 0 && (
                    <div className="text-[12px] text-[var(--muted2)]">
                      This will create <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{previewDates.length + 1}</span> tasks total.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted2)]">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Any extra details..."
              className="w-full resize-none rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          {focusModeEligible && (
            <div className="rounded-[20px] border border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.08)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-[650] text-[var(--text)]">Enable Focus Mode</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--muted2)]">
                    Long tasks can run in guided 50/8 focus cycles with midpoint cues, break breathing, and recovery after refresh.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusModeEnabled((current) => !current)}
                  className={`dayflow-toggle ${focusModeEnabled ? 'is-on' : ''}`}
                  aria-pressed={focusModeEnabled}
                  aria-label={focusModeEnabled ? 'Disable focus mode' : 'Enable focus mode'}
                >
                  <span className="dayflow-toggle-thumb" />
                </button>
              </div>
            </div>
          )}

          {!focusModeEligible && focusModeEnabled && (
            <div className="text-[12px] text-[var(--muted2)]">
              Focus Mode turns on automatically once the task duration goes above 55 minutes.
            </div>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={!name.trim() || isSaving}
            className="mt-4 w-full rounded-[var(--r)] bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? (taskToEdit ? 'Updating...' : 'Saving...') : taskToEdit ? 'Update task' : 'Save task'}
          </button>
        </div>
      </div>
    </div>
  );
}
