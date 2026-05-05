import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hhfcgbmpgjgmnxhlvwua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZmNnYm1wZ2pnbW54aGx2d3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzUzOTUsImV4cCI6MjA5MDU1MTM5NX0.t-7boVDE9WkYDoq5nnMB_lmT_Mw6bwSgKesq-Dc-Ew4';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Task {
  id: string;
  user_id?: string;
  name: string;
  date: string;
  time?: string;
  cat: 'personal' | 'work' | 'health' | 'study';
  dur: number;
  notes?: string;
  done: boolean;
  created: number;
  repeat?: string;
  repeat_days?: number[];
  repeat_end?: string;
  _sleep?: boolean;
  focus_enabled?: boolean;
  focus_pattern?: string;
  focus_session_active?: boolean;
  focus_segment_type?: 'focus' | 'break';
  focus_segment_index?: number;
  focus_segment_started_at?: string;
  focus_segment_ends_at?: string;
  focus_midpoint_played?: boolean;
  focus_paused?: boolean;
  focus_paused_remaining_sec?: number;
  focus_snoozed_until?: string;
  focus_completed?: boolean;
  focus_updated_at?: string;
}

export interface UserProfile {
  name?: string;
  wdBed?: string;
  wdWake?: string;
  weBed?: string;
  weWake?: string;
  morningMins?: number;
  eveningMins?: number;
  workStart?: string;
  workEnd?: string;
  setupDone?: boolean;
}

export interface Settings {
  theme?: string;
  notifications?: boolean;
  reminderMin?: number;
}
