import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar, MobileSidebarDrawer } from './components/sidebar/Sidebar';
import ChatCanvas from './components/chat/ChatCanvas';
import AllConversationsPage from './pages/AllConversationsPage';
import AboutModal from './pages/AboutModal';
import SettingsModal from './components/settings/SettingsModal';
import AuthModal from './components/auth/AuthModal';
import { useStore } from './store/useStore';

/**
 * Healix — two-pane layout: fixed-width sidebar + centered chat canvas.
 * Integrated with real authentication, SQLite sessions, and patient profile management.
 */
export default function App() {
  const { loadUserProfile, loadUserSessions, loadAllUsers, fontSize, theme } = useStore();

  // Load real authenticated user profile and conversations from SQLite
  useEffect(() => {
    loadUserProfile();
    loadUserSessions();
    loadAllUsers();
  }, [loadUserProfile, loadUserSessions, loadAllUsers]);

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
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Mobile sidebar drawer overlay */}
        <MobileSidebarDrawer />

        {/* Auth modal (Sign In / Register / Demo login) */}
        <AuthModal />

        {/* About modal */}
        <AboutModal />

        {/* Settings / Clinical profile modal */}
        <SettingsModal />

        {/* Main content */}
        <Routes>
          <Route path="/" element={<ChatCanvas />} />
          <Route path="/conversations" element={<AllConversationsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
