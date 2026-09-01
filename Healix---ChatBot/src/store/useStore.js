import { create } from 'zustand';
import {
  fetchCurrentUser,
  fetchAuthMe,
  loginUser,
  registerUser,
  logoutUser,
  fetchAllUsers,
  updateUserProfile as apiUpdateUserProfile,
  fetchUserSessions,
  createBackendSession,
  fetchSessionDetails,
  updateBackendSession,
  deleteBackendSession,
} from '../services/api';

const getStoredFontSize = () => {
  try {
    return parseInt(localStorage.getItem('healix-font-size') || '16', 10);
  } catch {
    return 16;
  }
};

const getStoredToken = () => {
  try {
    return localStorage.getItem('healix_auth_token') || '';
  } catch {
    return '';
  }
};

const getStoredUserId = () => {
  try {
    return localStorage.getItem('healix_user_id') || null;
  } catch {
    return null;
  }
};

const getStoredTheme = () => {
  try {
    return localStorage.getItem('healix-theme') || 'light';
  } catch {
    return 'light';
  }
};

export const useStore = create((set, get) => ({
  // --- Backend Connection & Generation State ---
  backendConnected: true,
  setBackendConnected: (connected) => set({ backendConnected: connected }),
  isTyping: false,
  setIsTyping: (typing) => set({ isTyping: typing }),

  // --- Theme ---
  theme: getStoredTheme(),
  setTheme: (theme) => {
    localStorage.setItem('healix-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    set({ theme });
  },

  // --- Sidebar state ---
  isSidebarOpen: true,
  isMobileSidebarOpen: false,
  isSearchOpen: false,
  isOptionsOpen: false,
  chatsExpanded: true,

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  toggleSearch: () => set((s) => ({ isSearchOpen: !s.isSearchOpen, isOptionsOpen: false })),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  toggleOptions: () => set((s) => ({ isOptionsOpen: !s.isOptionsOpen, isSearchOpen: false })),
  setOptionsOpen: (open) => set({ isOptionsOpen: open }),
  toggleChatsExpanded: () => set((s) => ({ chatsExpanded: !s.chatsExpanded })),

  // --- Text size & Window ---
  fontSize: getStoredFontSize(),
  setFontSize: (size) => {
    const clamped = Math.max(12, Math.min(24, size));
    localStorage.setItem('healix-font-size', String(clamped));
    document.documentElement.style.setProperty('--healix-font-size', `${clamped}px`);
    set({ fontSize: clamped });
  },
  increaseFontSize: () => {
    const current = get().fontSize;
    get().setFontSize(current + 2);
  },
  decreaseFontSize: () => {
    const current = get().fontSize;
    get().setFontSize(current - 2);
  },
  resetFontSize: () => {
    get().setFontSize(16);
  },
  toggleFullScreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },

  // --- Authentication & User Accounts ---
  authToken: getStoredToken(),
  activeUserId: getStoredUserId() || 'user_default',
  isAuthenticated: Boolean(getStoredToken()),
  isAuthModalOpen: false,
  setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  allUsers: [],

  userProfile: {
    id: 'user_default',
    fullName: 'Jane Doe, MD',
    preferredName: 'Dr. Jane',
    email: 'jane.doe@healix.ai',
    age: 34,
    gender: 'Female',
    bloodGroup: 'O+',
    allergies: ['Penicillin'],
    chronicConditions: ['Mild Asthma'],
    currentMedications: ['Albuterol inhaler as needed'],
    emergencyContact: {
      name: 'John Doe',
      phone: '+1 (555) 234-5678',
      relation: 'Spouse',
    },
    preferences: {
      theme: 'light',
      fontSize: 16,
    },
  },

  loadAllUsers: async () => {
    try {
      const users = await fetchAllUsers();
      if (Array.isArray(users)) {
        set({ allUsers: users });
      }
    } catch (err) {
      console.warn('Failed to load all users list:', err);
    }
  },

  loadUserProfile: async () => {
    const token = get().authToken;
    const userId = get().activeUserId || 'user_default';
    try {
      const profile = await fetchAuthMe(token, userId);
      if (profile) {
        set({
          activeUserId: profile.id || 'user_default',
          isAuthenticated: true,
          userProfile: {
            id: profile.id || 'user_default',
            fullName: profile.full_name || 'Jane Doe',
            preferredName: profile.preferred_name || profile.full_name || 'Jane',
            email: profile.email || '',
            age: profile.age ?? null,
            gender: profile.gender || '',
            bloodGroup: profile.blood_group || '',
            allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
            chronicConditions: Array.isArray(profile.chronic_conditions) ? profile.chronic_conditions : [],
            currentMedications: Array.isArray(profile.current_medications) ? profile.current_medications : [],
            emergencyContact: profile.emergency_contact || {},
            preferences: profile.preferences || {},
          },
        });
      }
    } catch (err) {
      console.warn('Could not load user profile from backend, using local fallback:', err);
    }
  },

  login: async (email, password) => {
    const res = await loginUser(email, password);
    if (res && res.user) {
      const user = res.user;
      const token = res.token || user.token || '';
      localStorage.setItem('healix_auth_token', token);
      localStorage.setItem('healix_user_id', user.id);

      set({
        authToken: token,
        activeUserId: user.id,
        isAuthenticated: true,
        isAuthModalOpen: false,
        activeConversationId: null,
        userProfile: {
          id: user.id,
          fullName: user.full_name,
          preferredName: user.preferred_name || user.full_name,
          email: user.email,
          age: user.age,
          gender: user.gender,
          bloodGroup: user.blood_group,
          allergies: user.allergies || [],
          chronicConditions: user.chronic_conditions || [],
          currentMedications: user.current_medications || [],
          emergencyContact: user.emergency_contact || {},
          preferences: user.preferences || {},
        },
      });

      // Reload conversations and user accounts
      await get().loadUserSessions();
      await get().loadAllUsers();
      return user;
    }
    throw new Error('Authentication failed');
  },

  register: async (payload) => {
    const res = await registerUser(payload);
    if (res && res.user) {
      const user = res.user;
      const token = user.token || '';
      localStorage.setItem('healix_auth_token', token);
      localStorage.setItem('healix_user_id', user.id);

      set({
        authToken: token,
        activeUserId: user.id,
        isAuthenticated: true,
        isAuthModalOpen: false,
        activeConversationId: null,
        userProfile: {
          id: user.id,
          fullName: user.full_name,
          preferredName: user.preferred_name || user.full_name,
          email: user.email,
          age: user.age,
          gender: user.gender,
          bloodGroup: user.blood_group,
          allergies: user.allergies || [],
          chronicConditions: user.chronic_conditions || [],
          currentMedications: user.current_medications || [],
          emergencyContact: user.emergency_contact || {},
          preferences: user.preferences || {},
        },
      });

      await get().loadUserSessions();
      await get().loadAllUsers();
      return user;
    }
    throw new Error('Registration failed');
  },

  logout: async () => {
    const token = get().authToken;
    const userId = get().activeUserId;
    await logoutUser(token, userId);

    localStorage.removeItem('healix_auth_token');
    localStorage.removeItem('healix_user_id');

    set({
      authToken: '',
      activeUserId: 'user_default',
      isAuthenticated: false,
      activeConversationId: null,
      conversations: [],
      messages: {},
      isAuthModalOpen: false,
      userProfile: {
        id: 'user_default',
        fullName: 'Jane Doe, MD',
        preferredName: 'Dr. Jane',
        email: 'jane.doe@healix.ai',
        age: 34,
        gender: 'Female',
        bloodGroup: 'O+',
        allergies: ['Penicillin'],
        chronicConditions: ['Mild Asthma'],
        currentMedications: ['Albuterol inhaler as needed'],
        emergencyContact: {},
        preferences: {},
      },
    });

    // Navigate to login page (route-based auth)
    window.location.href = '/login';
  },

  switchUser: async (userId) => {
    localStorage.setItem('healix_user_id', userId);
    set({
      activeUserId: userId,
      activeConversationId: null,
    });
    await get().loadUserProfile();
    await get().loadUserSessions();
  },

  setUserProfile: (updates) => {
    set((s) => ({ userProfile: { ...s.userProfile, ...updates } }));
  },

  saveUserProfile: async (updates) => {
    const activeUserId = get().activeUserId || 'user_default';
    const current = get().userProfile;
    const merged = { ...current, ...updates };

    const payload = {
      full_name: merged.fullName,
      preferred_name: merged.preferredName,
      email: merged.email,
      age: merged.age ? parseInt(merged.age, 10) : null,
      gender: merged.gender,
      blood_group: merged.bloodGroup,
      allergies: merged.allergies,
      chronic_conditions: merged.chronicConditions,
      current_medications: merged.currentMedications,
      emergency_contact: merged.emergencyContact,
      preferences: merged.preferences,
    };

    set({ userProfile: merged });

    try {
      await apiUpdateUserProfile(activeUserId, payload);
    } catch (err) {
      console.error('Failed to save profile to backend:', err);
    }
  },

  // --- Active conversation ---
  activeConversationId: null,
  setActiveConversation: async (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().loadSessionMessages(id);
    }
  },

  // --- Conversations list ---
  conversations: [],
  setConversations: (convs) => set({ conversations: convs }),

  loadUserSessions: async () => {
    const userId = get().activeUserId || 'user_default';
    if (!userId) {
      set({ conversations: [] });
      return;
    }
    try {
      const sessions = await fetchUserSessions(userId);
      if (Array.isArray(sessions)) {
        const mapped = sessions.map((s) => ({
          id: s.id,
          title: s.title,
          model: s.model,
          pinned: Boolean(s.pinned),
          createdAt: s.created_at ? s.created_at * 1000 : Date.now(),
          updatedAt: s.updated_at ? s.updated_at * 1000 : Date.now(),
          messageCount: s.message_count || 0,
        }));
        set({ conversations: mapped });
      }
    } catch (err) {
      console.warn('Failed to load user sessions from backend:', err);
    }
  },

  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),

  createSessionOnBackend: async (title = 'New Consultation', customSessionId = null) => {
    const userId = get().activeUserId || 'user_default';
    const model = get().selectedModel;
    try {
      const res = await createBackendSession(userId, {
        title,
        model,
        sessionId: customSessionId,
      });
      if (res) {
        const newConv = {
          id: res.id,
          title: res.title,
          model: res.model,
          pinned: false,
          createdAt: res.created_at * 1000,
          updatedAt: res.updated_at * 1000,
          messageCount: 0,
        };
        set((s) => ({
          conversations: [newConv, ...s.conversations.filter((c) => c.id !== newConv.id)],
          activeConversationId: newConv.id,
        }));
        return newConv;
      }
    } catch (err) {
      console.error('Failed to create session on backend:', err);
    }
    return null;
  },

  deleteConversation: async (id) => {
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    }));
    try {
      await deleteBackendSession(id);
    } catch (err) {
      console.warn(`Failed to delete session ${id} on backend:`, err);
    }
  },

  renameConversation: async (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
    try {
      await updateBackendSession(id, { title });
    } catch (err) {
      console.warn(`Failed to update title for session ${id}:`, err);
    }
  },

  // --- Messages for active conversation ---
  messages: {},
  setMessages: (convId, msgs) => set((s) => ({
    messages: { ...s.messages, [convId]: msgs },
  })),

  loadSessionMessages: async (sessionId) => {
    if (!sessionId) return;
    try {
      const details = await fetchSessionDetails(sessionId);
      if (details && Array.isArray(details.messages)) {
        const mapped = details.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model,
          sources: m.sources || [],
          isEmergency: Boolean(m.is_emergency),
          chunksUsed: m.chunks_used || 0,
          timestamp: m.timestamp ? m.timestamp * 1000 : Date.now(),
        }));
        set((s) => ({
          messages: { ...s.messages, [sessionId]: mapped },
        }));
      }
    } catch (err) {
      console.warn(`Failed to load messages for session ${sessionId}:`, err);
    }
  },

  addMessage: (convId, msg) => {
    set((s) => {
      const list = s.messages[convId] || [];
      return {
        messages: { ...s.messages, [convId]: [...list, msg] },
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? { ...c, messageCount: list.length + 1, updatedAt: Date.now() }
            : c
        ),
      };
    });
  },

  updateMessage: (convId, msgId, updates) => {
    set((s) => {
      const list = s.messages[convId] || [];
      const updatedList = list.map((m) =>
        m.id === msgId ? { ...m, ...updates } : m
      );
      return {
        messages: { ...s.messages, [convId]: updatedList },
      };
    });
  },

  // Indexed document references per conversation
  indexedDocs: {},
  addIndexedDoc: (convId, doc) => {
    set((s) => {
      const list = s.indexedDocs[convId] || [];
      return {
        indexedDocs: { ...s.indexedDocs, [convId]: [...list, doc] },
      };
    });
  },

  // Active Model selection
  selectedModel: 'MiniMax M3',
  setSelectedModel: (model) => set({ selectedModel: model }),

  // Web search toggle
  useWebSearch: false,
  toggleWebSearch: () => set((s) => ({ useWebSearch: !s.useWebSearch })),

  // Profile / Settings Modal
  isSettingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  isProfileOpen: false,
  setProfileOpen: (open) => set({ isSettingsModalOpen: open, isProfileOpen: open }),

  // About modal
  isAboutOpen: false,
  setAboutOpen: (open) => set({ isAboutOpen: open }),

  // Profile menu (bottom of sidebar)
  isProfileMenuOpen: false,
  toggleProfileMenu: () => set((s) => ({ isProfileMenuOpen: !s.isProfileMenuOpen })),
  setProfileMenuOpen: (open) => set({ isProfileMenuOpen: open }),
}));
