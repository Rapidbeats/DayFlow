import { Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, getTasks, OPEN_TASK_MODAL_EVENT } from '../lib/storage';
import { Task } from '../lib/supabase';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import TaskModal from '../components/TaskModal';
import Toast from '../components/Toast';
import ConfirmSheet from '../components/ConfirmSheet';
import CelebrationLayer from '../components/CelebrationLayer';
import ReminderManager from '../components/ReminderManager';
import ReflectionManager from '../components/ReflectionManager';
import { DesktopSidebar } from '../components/AppNav';

type TaskPrefill = Partial<Task> | null;

export default function Root() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [prefill, setPrefill] = useState<TaskPrefill>(null);
  const isFocusRoute = location.pathname.startsWith('/focus');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
        return;
      }

      const profile = getProfile();
      if (!profile.setupDone) {
        navigate('/onboarding');
      }
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleOpenTask = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId?: string; date?: string; time?: string }>;
      const detail = customEvent.detail || {};

      if (detail.taskId) {
        const task = getTasks().find((entry) => entry.id === detail.taskId) || null;
        setTaskToEdit(task);
        setPrefill(null);
      } else {
        setTaskToEdit(null);
        setPrefill({
          date: detail.date,
          time: detail.time,
        });
      }

      setIsModalOpen(true);
    };

    window.addEventListener(OPEN_TASK_MODAL_EVENT, handleOpenTask as EventListener);
    return () => window.removeEventListener(OPEN_TASK_MODAL_EVENT, handleOpenTask as EventListener);
  }, []);

  const openNewTask = () => {
    setTaskToEdit(null);
    setPrefill(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTaskToEdit(null);
    setPrefill(null);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {!isFocusRoute && <Header />}

      <div className={isFocusRoute ? 'relative w-full max-w-[1480px] mx-auto px-4 py-4 md:px-6 md:py-6' : 'dayflow-app-shell'}>
        {!isFocusRoute && <DesktopSidebar />}

        <main key={location.pathname} className="dayflow-main-shell dayflow-page-shell">
          <Outlet />
        </main>
      </div>

      {!isFocusRoute && <BottomNav />}

      {!isFocusRoute && (
        <button
          onClick={openNewTask}
          className="dayflow-fab fixed right-5 bottom-24 lg:right-10 lg:bottom-10 w-14 h-14 rounded-full flex items-center justify-center text-[var(--bg)] text-3xl font-light shadow-lg z-40 transition-transform hover:scale-110 active:scale-95"
          style={{ background: 'var(--accent)' }}
        >
          +
        </button>
      )}

      <TaskModal isOpen={isModalOpen} onClose={closeModal} taskToEdit={taskToEdit} initialTask={prefill} />
      {!isFocusRoute && <ReminderManager />}
      {!isFocusRoute && <ReflectionManager />}
      <ConfirmSheet />
      <CelebrationLayer />
      <Toast />
    </div>
  );
}
