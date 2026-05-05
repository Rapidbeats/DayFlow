import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Task } from '../lib/supabase';
import { saveTasks } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncTasks: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  deleteTaskFromCloud: (taskId: string) => Promise<void>;
  deleteAllTasksFromCloud: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void refreshTasksFromCloud(session.user.id);
      } else {
        clearLocalTaskCache();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void refreshTasksFromCloud(session.user.id);
      } else {
        clearLocalTaskCache();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshTasksFromCloud(user.id);
      }
    };

    const handleFocus = () => {
      void refreshTasksFromCloud(user.id);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    clearLocalTaskCache();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshTasksFromCloud = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created', { ascending: true });

      if (error) {
        console.error('Failed to load tasks from cloud:', error);
        const cached = getScopedCachedTasks(userId);
        saveTasks(cached);
        return;
      }

      const cloudTasks = (data || []).map(mapRowToTask);
      setScopedCachedTasks(userId, cloudTasks);
      saveTasks(cloudTasks);
    } catch (err) {
      console.error('Sync error:', err);
      const cached = getScopedCachedTasks(userId);
      saveTasks(cached);
    }
  };

  const refreshTasks = async () => {
    if (!user) return;
    await refreshTasksFromCloud(user.id);
  };

  const syncTasks = async () => {
    if (!user) return;

    const localTasks = getCurrentTaskList();

    for (const task of localTasks) {
      await upsertTask(user.id, task);
    }

    setScopedCachedTasks(user.id, localTasks);
    await refreshTasksFromCloud(user.id);
  };

  const upsertTask = async (userId: string, task: Task) => {
    const row = {
      id: task.id,
      user_id: userId,
      name: task.name,
      date: task.date,
      time: task.time || null,
      cat: task.cat,
      dur: task.dur,
      notes: task.notes || null,
      done: task.done,
      created: task.created,
      repeat: task.repeat || null,
      repeat_days: task.repeat_days || null,
      repeat_end: task.repeat_end || null,
      _sleep: task._sleep || false,
      focus_enabled: task.focus_enabled || false,
      focus_pattern: task.focus_pattern || '50-8',
      focus_session_active: task.focus_session_active || false,
      focus_segment_type: task.focus_segment_type || null,
      focus_segment_index: task.focus_segment_index ?? 0,
      focus_segment_started_at: task.focus_segment_started_at || null,
      focus_segment_ends_at: task.focus_segment_ends_at || null,
      focus_midpoint_played: task.focus_midpoint_played || false,
      focus_paused: task.focus_paused || false,
      focus_paused_remaining_sec: task.focus_paused_remaining_sec ?? null,
      focus_snoozed_until: task.focus_snoozed_until || null,
      focus_completed: task.focus_completed || false,
      focus_updated_at: task.focus_updated_at || new Date().toISOString(),
    };

    const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
    if (error) console.error('Upsert task error:', error);
  };

  const deleteTaskFromCloud = async (taskId: string) => {
    if (!user) return;

    const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', user.id);
    if (error) {
      console.error('Delete task error:', error);
      return;
    }

    const remaining = getCurrentTaskList().filter((task) => task.id !== taskId);
    setScopedCachedTasks(user.id, remaining);
    await refreshTasksFromCloud(user.id);
  };

  const deleteAllTasksFromCloud = async () => {
    if (!user) return;

    const { error } = await supabase.from('tasks').delete().eq('user_id', user.id);
    if (error) {
      console.error('Delete all tasks error:', error);
      return;
    }

    setScopedCachedTasks(user.id, []);
    saveTasks([]);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signOut, syncTasks, refreshTasks, deleteTaskFromCloud, deleteAllTasksFromCloud }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    date: row.date,
    time: row.time || undefined,
    cat: row.cat,
    dur: row.dur,
    notes: row.notes || undefined,
    done: row.done,
    created: row.created,
    repeat: row.repeat || undefined,
    repeat_days: row.repeat_days || undefined,
    repeat_end: row.repeat_end || undefined,
    _sleep: row._sleep || false,
    focus_enabled: row.focus_enabled || false,
    focus_pattern: row.focus_pattern || '50-8',
    focus_session_active: row.focus_session_active || false,
    focus_segment_type: row.focus_segment_type || undefined,
    focus_segment_index: row.focus_segment_index ?? 0,
    focus_segment_started_at: row.focus_segment_started_at || undefined,
    focus_segment_ends_at: row.focus_segment_ends_at || undefined,
    focus_midpoint_played: row.focus_midpoint_played || false,
    focus_paused: row.focus_paused || false,
    focus_paused_remaining_sec: row.focus_paused_remaining_sec ?? undefined,
    focus_snoozed_until: row.focus_snoozed_until || undefined,
    focus_completed: row.focus_completed || false,
    focus_updated_at: row.focus_updated_at || undefined,
  };
}

function getCurrentTaskList(): Task[] {
  try {
    const raw = localStorage.getItem('df_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getScopedCachedTasks(userId: string): Task[] {
  try {
    const raw = localStorage.getItem(getScopedCacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setScopedCachedTasks(userId: string, tasks: Task[]) {
  localStorage.setItem(getScopedCacheKey(userId), JSON.stringify(tasks));
}

function clearLocalTaskCache() {
  localStorage.removeItem('df_tasks');
}

function getScopedCacheKey(userId: string) {
  return `df_tasks_cache_${userId}`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
