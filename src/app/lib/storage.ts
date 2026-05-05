import { Task, UserProfile, Settings } from './supabase';

const STORAGE_KEYS = {
  TASKS: 'df_tasks',
  PROFILE: 'df_profile',
  SETTINGS: 'df_settings',
} as const;

export const TASKS_UPDATED_EVENT = 'dayflow:tasks-updated';
export const OPEN_TASK_MODAL_EVENT = 'dayflow:open-task-modal';
export const SETTINGS_UPDATED_EVENT = 'dayflow:settings-updated';

// Local storage helpers
export function getTasks(): Task[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent(TASKS_UPDATED_EVENT, { detail: tasks }));
}

export function getProfile(): UserProfile {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export function getSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { theme: 'emerald', notifications: false, reminderMin: 10 };
  } catch {
    return { theme: 'emerald', notifications: false, reminderMin: 10 };
  }
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
}

export function openTaskModal(detail?: { taskId?: string; date?: string; time?: string }) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_MODAL_EVENT, { detail }));
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function fmtDate(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
