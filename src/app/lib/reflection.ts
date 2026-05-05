import { getSleepWindow } from './planner';
import { UserProfile } from './supabase';

const REFLECTIONS_KEY = 'df_reflections';
const TASK_FEELINGS_KEY = 'df_task_feelings';
const PROMPT_STATE_KEY = 'df_reflection_prompt_state';

export type ReflectionMood = 'Great' | 'Good' | 'Okay' | 'Stressed' | 'Drained';
export type TaskFeeling = 'Focused' | 'Smooth' | 'Tiring' | 'Distracted';
export type ReflectionPromptMode = 'evening' | 'morning';

export interface ReflectionSummary {
  completedCount: number;
  skippedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface ReflectionEntry {
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
  feeling: TaskFeeling;
  savedAt: number;
}

interface ReflectionPromptState {
  lastPromptedAt?: number;
  lastPromptedDate?: string;
  snoozedUntil?: number;
  snoozedDate?: string;
  skippedDates?: string[];
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getReflectionEntries() {
  return readJson<ReflectionEntry[]>(REFLECTIONS_KEY, []);
}

export function getReflection(date: string) {
  return getReflectionEntries().find((entry) => entry.date === date) || null;
}

export function saveReflection(entry: ReflectionEntry) {
  const nextEntries = [entry, ...getReflectionEntries().filter((item) => item.date !== entry.date)];
  writeJson(REFLECTIONS_KEY, nextEntries);
  clearPromptStateForDate(entry.date);
}

export function getTaskFeelingEntries(date?: string) {
  const entries = readJson<TaskFeelingEntry[]>(TASK_FEELINGS_KEY, []);
  return date ? entries.filter((entry) => entry.date === date) : entries;
}

export function saveTaskFeeling(entry: TaskFeelingEntry) {
  const entries = getTaskFeelingEntries();
  const nextEntries = [entry, ...entries.filter((item) => !(item.taskId === entry.taskId && item.date === entry.date))];
  writeJson(TASK_FEELINGS_KEY, nextEntries.slice(0, 120));
}

function getPromptState() {
  return readJson<ReflectionPromptState>(PROMPT_STATE_KEY, {});
}

function savePromptState(state: ReflectionPromptState) {
  writeJson(PROMPT_STATE_KEY, state);
}

export function shouldShowReflectionPrompt(date: string, now = Date.now()) {
  if (getReflection(date)) return false;

  const state = getPromptState();
  if (state.skippedDates?.includes(date)) return false;
  if (state.snoozedDate === date && state.snoozedUntil && state.snoozedUntil > now) return false;
  if (state.lastPromptedDate === date && state.lastPromptedAt && now - state.lastPromptedAt < 2 * 60 * 60 * 1000) return false;

  return true;
}

export function markReflectionPromptShown(date: string, now = Date.now()) {
  const state = getPromptState();
  savePromptState({
    ...state,
    lastPromptedAt: now,
    lastPromptedDate: date,
  });
}

export function snoozeReflectionPrompt(date: string, minutes = 90) {
  const state = getPromptState();
  savePromptState({
    ...state,
    snoozedDate: date,
    snoozedUntil: Date.now() + minutes * 60 * 1000,
    lastPromptedAt: Date.now(),
    lastPromptedDate: date,
  });
}

export function skipReflectionPrompt(date: string) {
  const state = getPromptState();
  savePromptState({
    ...state,
    skippedDates: Array.from(new Set([...(state.skippedDates || []), date])),
    lastPromptedAt: Date.now(),
    lastPromptedDate: date,
  });
}

export function clearPromptStateForDate(date: string) {
  const state = getPromptState();
  savePromptState({
    ...state,
    skippedDates: (state.skippedDates || []).filter((entry) => entry !== date),
    snoozedDate: state.snoozedDate === date ? undefined : state.snoozedDate,
    snoozedUntil: state.snoozedDate === date ? undefined : state.snoozedUntil,
  });
}

function getBedtimeDate(dateKey: string, bedTime: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = bedTime.split(':').map(Number);
  const bedtime = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);

  // Bedtimes after midnight belong to the end of the same waking day.
  if ((hours || 0) < 6) {
    bedtime.setDate(bedtime.getDate() + 1);
  }

  return bedtime;
}

export function getDueReflectionPrompt(profile: UserProfile, now = new Date()): { targetDate: string; mode: ReflectionPromptMode } | null {
  const nowKey = formatDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  if (now.getHours() < 11 && !getReflection(yesterdayKey)) {
    return { targetDate: yesterdayKey, mode: 'morning' };
  }

  const { bed } = getSleepWindow(profile, nowKey);
  const bedtime = getBedtimeDate(nowKey, bed);
  const promptAt = new Date(bedtime.getTime() - 2 * 60 * 60 * 1000);
  const promptWindowEnds = new Date(bedtime.getTime() + 4 * 60 * 60 * 1000);

  if (now >= promptAt && now <= promptWindowEnds && !getReflection(nowKey)) {
    return { targetDate: nowKey, mode: 'evening' };
  }

  return null;
}
