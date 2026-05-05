import { getProfile, getTasks, todayStr } from './storage';
import { minutesFromTime } from './planner';

export const REFLECTIONS_UPDATED_EVENT = 'dayflow:reflections-updated';
export const TASK_FEELING_CAPTURED_EVENT = 'dayflow:task-feeling-captured';

const STORAGE_KEYS = {
  REFLECTIONS: 'df_reflections',
  TASK_FEELINGS: 'df_task_feelings',
  PROMPTS: 'df_reflection_prompts',
} as const;

export type ReflectionMood = 'Great' | 'Good' | 'Okay' | 'Stressed' | 'Drained';

export interface ReflectionSummary {
  completedCount: number;
  skippedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface DailyReflectionEntry {
  date: string;
  mood: ReflectionMood;
  energyLevel: number;
  reasons: string[];
  improvementNote: string;
  insight: string;
  summary: ReflectionSummary;
  savedAt: number;
}

export interface TaskFeelingEntry {
  taskId: string;
  taskName: string;
  date: string;
  feeling: 'Easy' | 'Good' | 'Tiring' | 'Distracted';
  createdAt: number;
}

interface PromptState {
  date: string;
  promptCount: number;
  snoozeUntil?: number;
  skipped?: boolean;
  completed?: boolean;
}

interface ReflectionPromptDecision {
  date: string;
  mode: 'evening' | 'morning';
}

export function getReflectionByDate(date: string) {
  return getReflections().find((entry) => entry.date === date) || null;
}

export function getReflections() {
  return readJson<DailyReflectionEntry[]>(STORAGE_KEYS.REFLECTIONS, []);
}

export function saveDailyReflection(entry: DailyReflectionEntry) {
  const existing = getReflections().filter((item) => item.date !== entry.date);
  const next = [entry, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_KEYS.REFLECTIONS, JSON.stringify(next));
  markReflectionPromptCompleted(entry.date);
  window.dispatchEvent(new CustomEvent(REFLECTIONS_UPDATED_EVENT, { detail: next }));
}

export function getTaskFeelingsForDate(date: string) {
  return readJson<TaskFeelingEntry[]>(STORAGE_KEYS.TASK_FEELINGS, []).filter((entry) => entry.date === date);
}

export function addTaskFeeling(entry: TaskFeelingEntry) {
  const feelings = readJson<TaskFeelingEntry[]>(STORAGE_KEYS.TASK_FEELINGS, []);
  const next = [entry, ...feelings.filter((item) => !(item.taskId === entry.taskId && item.date === entry.date))];
  localStorage.setItem(STORAGE_KEYS.TASK_FEELINGS, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(TASK_FEELING_CAPTURED_EVENT, { detail: entry }));
}

export function getSuggestedMood(date: string): ReflectionMood {
  const feelings = getTaskFeelingsForDate(date);
  if (!feelings.length) return 'Good';

  const score = feelings.reduce((total, item) => total + getFeelingScore(item.feeling), 0) / feelings.length;
  if (score >= 1.5) return 'Great';
  if (score >= 0.5) return 'Good';
  if (score >= -0.5) return 'Okay';
  if (score >= -1.25) return 'Stressed';
  return 'Drained';
}

export function getReflectionPromptDecision(now = new Date()): ReflectionPromptDecision | null {
  const profile = getProfile();
  const today = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const bedtimeToday = getBedtimeMinutes(today, profile);

  if (bedtimeToday != null) {
    const startWindow = Math.max(bedtimeToday - 120, 0);
    if (currentMinutes >= startWindow && currentMinutes < bedtimeToday && canPromptForDate(today, now.getTime())) {
      return { date: today, mode: 'evening' };
    }
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (currentMinutes < 11 * 60 && !getReflectionByDate(yesterdayStr) && canPromptForDate(yesterdayStr, now.getTime())) {
    return { date: yesterdayStr, mode: 'morning' };
  }

  return null;
}

export function markReflectionPromptShown(date: string) {
  const prompts = getPromptStateMap();
  const current = prompts[date] || { date, promptCount: 0 };
  prompts[date] = {
    ...current,
    promptCount: current.promptCount + 1,
  };
  savePromptStateMap(prompts);
}

export function snoozeReflectionPrompt(date: string, delayMinutes = 90) {
  const prompts = getPromptStateMap();
  const current = prompts[date] || { date, promptCount: 0 };
  prompts[date] = {
    ...current,
    snoozeUntil: Date.now() + delayMinutes * 60_000,
  };
  savePromptStateMap(prompts);
}

export function skipReflectionPrompt(date: string) {
  const prompts = getPromptStateMap();
  const current = prompts[date] || { date, promptCount: 0 };
  prompts[date] = {
    ...current,
    skipped: true,
  };
  savePromptStateMap(prompts);
}

export function markReflectionPromptCompleted(date: string) {
  const prompts = getPromptStateMap();
  const current = prompts[date] || { date, promptCount: 0 };
  prompts[date] = {
    ...current,
    completed: true,
  };
  savePromptStateMap(prompts);
}

export function getDailyReflectionSummary(date: string): ReflectionSummary {
  const tasks = getTasks().filter((task) => task.date === date && !task._sleep);
  const completed = tasks.filter((task) => task.done);
  const skipped = tasks.filter((task) => !task.done);

  return {
    completedCount: completed.length,
    skippedCount: skipped.length,
    plannedMinutes: tasks.reduce((total, task) => total + (task.dur || 0), 0),
    actualMinutes: completed.reduce((total, task) => total + (task.dur || 0), 0),
  };
}

export function getReflectionInsight(date: string, energyLevel: number, reasons: string[]) {
  const summary = getDailyReflectionSummary(date);

  if (energyLevel <= 35) {
    return 'Your energy was low today. Try protecting your most important task for the first half of tomorrow.';
  }

  if (reasons.includes('Phone')) {
    return 'Phone interruptions showed up today. A short focus block with notifications muted could help tomorrow.';
  }

  if (reasons.includes('Poor Planning')) {
    return 'Planning friction stood out today. Try giving tomorrow one clear must-do before adding the rest.';
  }

  if (summary.skippedCount > summary.completedCount) {
    return 'Your plan may have been too ambitious. A lighter schedule tomorrow could make completion feel easier.';
  }

  if (summary.actualMinutes >= summary.plannedMinutes && summary.completedCount > 0) {
    return 'You followed through well today. Keep the same momentum by starting tomorrow with your highest-value task.';
  }

  return 'You tend to lose focus later in the day. Try scheduling important work a little earlier tomorrow.';
}

export function getReflectionRoute(date = todayStr()) {
  return `/reflection?date=${encodeURIComponent(date)}`;
}

function getFeelingScore(feeling: TaskFeelingEntry['feeling']) {
  switch (feeling) {
    case 'Easy':
      return 2;
    case 'Good':
      return 1;
    case 'Tiring':
      return -1;
    case 'Distracted':
      return -2;
    default:
      return 0;
  }
}

function canPromptForDate(date: string, nowMs: number) {
  if (getReflectionByDate(date)) return false;
  const current = getPromptStateMap()[date];
  if (!current) return true;
  if (current.completed || current.skipped) return false;
  if (current.snoozeUntil && current.snoozeUntil > nowMs) return false;
  return current.promptCount < 2;
}

function getBedtimeMinutes(date: string, profile: ReturnType<typeof getProfile>) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const weekend = day === 0 || day === 6;
  return minutesFromTime(weekend ? profile.weBed || '00:00' : profile.wdBed || '23:00');
}

function getPromptStateMap() {
  return readJson<Record<string, PromptState>>(STORAGE_KEYS.PROMPTS, {});
}

function savePromptStateMap(map: Record<string, PromptState>) {
  localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(map));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
