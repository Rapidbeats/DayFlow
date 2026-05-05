import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Clock3, Flame, Sparkles, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { fmtDate, getTasks, TASKS_UPDATED_EVENT, todayStr } from '../lib/storage';
import { Task } from '../lib/supabase';

const REFLECTION_STORAGE_KEY = 'df_reflections_prototype';

const MOODS = [
  { emoji: '😊', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😤', label: 'Stressed' },
  { emoji: '😴', label: 'Drained' },
] as const;

const DISTRACTION_OPTIONS = ['Phone', 'Low Energy', 'Poor Planning', 'Work', 'Other'] as const;

type MoodLabel = (typeof MOODS)[number]['label'];

export default function DailyReflectionPrototype() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMood, setSelectedMood] = useState<MoodLabel>('Good');
  const [energyLevel, setEnergyLevel] = useState(68);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [improvementNote, setImprovementNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const today = todayStr();

  useEffect(() => {
    const loadTasks = () => {
      const todayTasks = getTasks()
        .filter((task) => task.date === today)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      setTasks(todayTasks);
    };

    loadTasks();
    window.addEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, loadTasks as EventListener);
  }, [today]);

  const summary = useMemo(() => {
    const completed = tasks.filter((task) => task.done);
    const skipped = tasks.filter((task) => !task.done);
    const plannedMinutes = tasks.reduce((total, task) => total + (task.dur || 0), 0);
    const actualMinutes = completed.reduce((total, task) => total + (task.dur || 0), 0);

    return {
      completedCount: completed.length,
      skippedCount: skipped.length,
      plannedMinutes,
      actualMinutes,
    };
  }, [tasks]);

  const generatedInsight = useMemo(() => {
    if (energyLevel <= 35) {
      return 'Your energy dipped hard today. Protect your highest-focus task for the first half of the day.';
    }

    if (selectedReasons.includes('Phone')) {
      return 'Phone interruptions pulled attention away. Try a 30-minute focus block with notifications muted.';
    }

    if (selectedReasons.includes('Poor Planning')) {
      return 'The day may have needed tighter priorities. Keep tomorrow to one must-do task before noon.';
    }

    if (summary.skippedCount > summary.completedCount) {
      return 'Too many tasks competed for attention. A lighter plan tomorrow will likely feel easier to finish.';
    }

    if (summary.actualMinutes >= summary.plannedMinutes && summary.completedCount > 0) {
      return 'You followed through well today. Keep your momentum by front-loading the next important task.';
    }

    return 'You tend to lose focus later in the day. Try scheduling your most important work earlier tomorrow.';
  }, [energyLevel, selectedReasons, summary.actualMinutes, summary.completedCount, summary.plannedMinutes, summary.skippedCount]);

  const energyLabel = useMemo(() => {
    if (energyLevel >= 80) return 'High';
    if (energyLevel >= 55) return 'Steady';
    if (energyLevel >= 35) return 'Low';
    return 'Very low';
  }, [energyLevel]);

  const toggleReason = (reason: string) => {
    setSelectedReasons((current) => (current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]));
  };

  const handleSave = () => {
    const entry = {
      date: today,
      mood: selectedMood,
      energyLevel,
      reasons: selectedReasons,
      improvementNote: improvementNote.trim(),
      insight: generatedInsight,
      summary,
      savedAt: Date.now(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(REFLECTION_STORAGE_KEY) || '[]') as unknown[];
      const nextEntries = [entry, ...existing.filter((item) => typeof item === 'object' && item !== null && (item as { date?: string }).date !== today)];
      localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify([entry]));
    }

    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 2200);
  };

  return (
    <div className="min-h-full bg-[#0B0F14] px-4 py-6 text-[#E6EDF3]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:gap-6">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs text-[#9FB0C0]">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 transition duration-200 hover:scale-105 hover:bg-white/[0.05] active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <span className="truncate">{fmtDate(today)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#E6EDF3] md:text-[28px]">Daily Reflection</h1>
            <p className="mt-1 text-sm text-[#9FB0C0]">Takes less than 30 seconds</p>
          </div>
          <div className="hidden rounded-2xl border border-white/5 bg-[#1A2230] px-4 py-3 text-right md:block">
            <div className="text-xs uppercase tracking-[0.24em] text-[#9FB0C0]">Today</div>
            <div className="mt-1 text-base font-medium text-[#E6EDF3]">{tasks.length} tasks tracked</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-6">
          <section className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-[#1A2230] p-3 text-[#3B82F6]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#E6EDF3]">How did today feel?</h2>
                  <p className="text-sm text-[#9FB0C0]">Tap the mood that feels closest.</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 md:gap-3">
                {MOODS.map((mood) => {
                  const active = selectedMood === mood.label;
                  return (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => setSelectedMood(mood.label)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center transition duration-200 hover:scale-105 active:scale-95 ${
                        active
                          ? 'border-[#3B82F6]/60 bg-[#3B82F6]/15 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]'
                          : 'border-white/5 bg-[#1A2230] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-2xl md:text-3xl">{mood.emoji}</span>
                      <span className={`text-xs font-medium ${active ? 'text-[#E6EDF3]' : 'text-[#9FB0C0]'}`}>{mood.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#E6EDF3]">Energy Level</h2>
                  <p className="text-sm text-[#9FB0C0]">How much fuel did you have today?</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#1A2230] px-3 py-2 text-sm font-medium text-[#E6EDF3]">{energyLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#1A2230] px-4 py-4">
                <input
                  id="energy-level"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={energyLevel}
                  onChange={(event) => setEnergyLevel(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:ring-offset-0"
                />
                <div className="mt-3 flex items-center justify-between text-xs text-[#9FB0C0]">
                  <span>Exhausted</span>
                  <span className="text-sm font-semibold text-[#E6EDF3]">{energyLevel}%</span>
                  <span>Charged</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-[#1A2230] p-3 text-[#F59E0B]">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#E6EDF3]">What got in the way?</h2>
                  <p className="text-sm text-[#9FB0C0]">Pick the main friction points, if any.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DISTRACTION_OPTIONS.map((reason) => {
                  const active = selectedReasons.includes(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleReason(reason)}
                      aria-pressed={active}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition duration-200 hover:scale-105 active:scale-95 ${
                        active
                          ? 'border-[#3B82F6]/50 bg-[#3B82F6]/15 text-[#E6EDF3]'
                          : 'border-white/5 bg-[#1A2230] text-[#9FB0C0] hover:bg-white/[0.05]'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <label htmlFor="improvement-note" className="mb-3 block text-base font-semibold text-[#E6EDF3]">
                One thing to improve tomorrow
              </label>
              <input
                id="improvement-note"
                type="text"
                value={improvementNote}
                onChange={(event) => setImprovementNote(event.target.value)}
                placeholder="One thing to improve tomorrow"
                className="w-full rounded-2xl border border-white/5 bg-[#1A2230] px-4 py-3 text-sm text-[#E6EDF3] placeholder:text-[#9FB0C0] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
              />
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#E6EDF3]">Day Summary</h2>
                  <p className="text-sm text-[#9FB0C0]">Auto-generated from today&apos;s plan.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#1A2230] px-3 py-2 text-xs text-[#9FB0C0]">{fmtDate(today)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  label="Tasks completed"
                  value={summary.completedCount}
                  tone="text-[#22C55E]"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Tasks skipped"
                  value={summary.skippedCount}
                  tone="text-[#EF4444]"
                  icon={<XCircle className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Planned time"
                  value={formatMinutes(summary.plannedMinutes)}
                  tone="text-[#F59E0B]"
                  icon={<Clock3 className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Actual time"
                  value={formatMinutes(summary.actualMinutes)}
                  tone="text-[#3B82F6]"
                  icon={<Flame className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#3B82F6]/20 bg-[#1A2230] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-3 flex items-center gap-2 text-[#3B82F6]">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Insight</span>
              </div>
              <p className="text-sm leading-6 text-[#E6EDF3]">{generatedInsight}</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#121821] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <div className="mb-3 text-base font-semibold text-[#E6EDF3]">Reflection preview</div>
              <div className="space-y-3 text-sm text-[#9FB0C0]">
                <div className="flex items-center justify-between gap-3">
                  <span>Mood</span>
                  <span className="font-medium text-[#E6EDF3]">{selectedMood}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Energy</span>
                  <span className="font-medium text-[#E6EDF3]">{energyLabel}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span>Friction</span>
                  <span className="max-w-[60%] text-right font-medium text-[#E6EDF3]">{selectedReasons.length ? selectedReasons.join(', ') : 'None picked'}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span>Tomorrow</span>
                  <span className="max-w-[60%] text-right font-medium text-[#E6EDF3]">{improvementNote.trim() || 'No note yet'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="mb-4 w-full rounded-xl bg-[#3B82F6] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(59,130,246,0.28)] transition duration-200 hover:scale-[1.01] hover:bg-[#2563EB] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/60"
            >
              {isSaved ? 'Reflection Saved' : 'Save Reflection'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#1A2230] p-4">
      <div className={`mb-3 inline-flex items-center gap-2 rounded-xl bg-black/10 px-2.5 py-2 text-xs ${tone}`}>{icon}{label}</div>
      <div className="text-xl font-semibold text-[#E6EDF3]">{value}</div>
    </div>
  );
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
