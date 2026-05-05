import { saveTasks, getTasks } from './storage';
import { Task } from './supabase';

export const TASK_COMPLETED_EVENT = 'dayflow:task-completed';

export async function toggleTaskCompletion(taskId: string, syncTasks: () => Promise<void>) {
  const allTasks = getTasks();
  const existing = allTasks.find((task) => task.id === taskId);
  if (!existing) return null;

  const nextDone = !existing.done;
  const updatedTask: Task = { ...existing, done: nextDone };
  const updated = allTasks.map((task) => (task.id === taskId ? updatedTask : task));

  saveTasks(updated);

  if (nextDone) {
    window.dispatchEvent(
      new CustomEvent(TASK_COMPLETED_EVENT, {
        detail: {
          taskId: updatedTask.id,
          taskName: updatedTask.name,
          date: updatedTask.date,
        },
      })
    );
  }

  await syncTasks();

  return { task: updatedTask, completed: nextDone };
}
