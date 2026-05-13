import { createBrowserRouter } from 'react-router';
import Root from './pages/Root';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import AuthPage from './pages/AuthPage';
import DailyReflection from './pages/DailyReflection';
import FocusMode from './pages/FocusMode';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: 'schedule', Component: Schedule },
      { path: 'tasks', Component: Tasks },
      { path: 'settings', Component: Settings },
      { path: 'reflection', Component: DailyReflection },
      { path: 'focus', Component: FocusMode },
    ],
  },
  {
    path: '/onboarding',
    Component: Onboarding,
  },
  {
    path: '/auth',
    Component: AuthPage,
  },
]);
