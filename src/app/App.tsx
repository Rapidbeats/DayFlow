import { RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { router } from './routes';
import { getSettings } from './lib/storage';
import { applyThemeToDOM, getTheme } from './lib/themes';
import SplashScreen from './components/SplashScreen';
import { initializePwaInstallTracking } from './lib/pwa';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const settings = getSettings();
    const theme = getTheme(settings.theme || 'emerald');
    applyThemeToDOM(theme);
    initializePwaInstallTracking();

    const timeout = window.setTimeout(() => setShowSplash(false), 2800);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <AuthProvider>
      <SplashScreen visible={showSplash} />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
