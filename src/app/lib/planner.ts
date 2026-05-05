import { Task, UserProfile } from './supabase';

export function getRepeatDates(startDate: string, repeatDays: number[], endDate: string): string[] {
  if (!repeatDays.length || !endDate) return [];

  const dates: string[] = [];
  const end = new Date(`${endDate}T12:00:00`);
  const cursor = new Date(`${startDate}T12:00:00`);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (repeatDays.includes(cursor.getDay()) && dateStr !== startDate) {
      dates.push(dateStr);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function minutesFromTime(time?: string): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function getSleepWindow(profile: UserProfile, date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const weekend = day === 0 || day === 6;
  const bed = weekend ? profile.weBed || '00:00' : profile.wdBed || '23:00';
  const wake = weekend ? profile.weWake || '08:00' : profile.wdWake || '07:00';

  return { bed, wake };
}

export function getHoursCovered(startMinute: number, durationMinutes: number): number[] {
  const covered = new Set<number>();
  const endMinute = startMinute + durationMinutes;

  for (let minute = startMinute; minute < endMinute; minute += 30) {
    covered.add(Math.floor((minute % 1440) / 60));
  }

  return Array.from(covered);
}

export function getSleepHours(profile: UserProfile, date: string): number[] {
  const { bed, wake } = getSleepWindow(profile, date);
  const bedMinute = minutesFromTime(bed);
  const wakeMinute = minutesFromTime(wake);

  if (bedMinute == null || wakeMinute == null) return [];

  const covered = new Set<number>();
  const endMinute = wakeMinute <= bedMinute ? wakeMinute + 1440 : wakeMinute;

  for (let minute = bedMinute; minute < endMinute; minute += 30) {
    covered.add(Math.floor((minute % 1440) / 60));
  }

  return Array.from(covered);
}

export function getTaskHours(tasks: Task[]): number[] {
  const covered = new Set<number>();

  tasks.forEach((task) => {
    const start = minutesFromTime(task.time);
    if (start == null) return;
    getHoursCovered(start, Math.max(task.dur || 0, 30)).forEach((hour) => covered.add(hour));
  });

  return Array.from(covered);
}
