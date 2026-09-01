import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, MobileSidebarDrawer } from './components/sidebar/Sidebar';
import ChatCanvas from './components/chat/ChatCanvas';
import AllConversationsPage from './pages/AllConversationsPage';
import AboutModal from './pages/AboutModal';
import SettingsModal from './components/settings/SettingsModal';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import { useStore } from './store/useStore';

/**
 * Healix — two-pane layout: fixed-width sidebar + centered chat canvas.
 * Auth is now route-based: /login and /signup are full-page views.
 * Authenticated users land on / (chat canvas).
 */

/* ── Protected layout: sidebar + chat canvas ── */
function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MobileSidebarDrawer />
      <AboutModal />
      <SettingsModal />
      {children}
    </div>
  );
}

export default function App() {
  const { loadUserProfile, loadUserSessions, loadAllUsers, fontSize, theme, isAuthenticated } = useStore();

  // Load real authenticated user profile and conversations from SQLite
  useEffect(() => {
    if (isAuthenticated) {
      loadUserProfile();
      loadUserSessions();
      loadAllUsers();
    }
  }, [isAuthenticated, loadUserProfile, loadUserSessions, loadAllUsers]);

  // Apply persisted font size
  useEffect(() => {
    document.documentElement.style.setProperty('--healix-font-size', `${fontSize}px`);
  }, [fontSize]);

  // Apply theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth routes (full-page, no sidebar) ── */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />}
        />

        {/* ── Protected app routes ── */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? <AppShell><ChatCanvas /></AppShell>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/conversations"
          element={
            isAuthenticated
              ? <AppShell><AllConversationsPage /></AppShell>
              : <Navigate to="/login" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

