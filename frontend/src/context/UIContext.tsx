import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ViewType } from '../components/layout/AppSidebar';

export type ModalType =
  | 'device'
  | 'storage'
  | 'data-management'
  | 'route-detail'
  | 'post-route'
  | 'ai-settings'
  | 'shortcuts'
  | 'message-detail'
  | 'delete';

interface UIContextValue {
  // Navigation
  activeView: ViewType;
  switchView: (view: ViewType) => void;

  // Sidebar Layout
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  // Visual Theme & Audio
  isDarkMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  isSoundOn: boolean;
  toggleSound: () => void;

  // Sidebar Preferences
  sidebarMenuPrefs: Record<string, boolean>;
  toggleSidebarMenu: (menuId: string, visible: boolean) => void;
  enableAllSidebarMenus: () => void;
  resetSidebarMenus: () => void;

  // Route Matrix Page Size
  routePageSize: number;
  setRoutePageSize: (size: number) => void;

  // Feature Toggles (Trading & AI Controls)
  showPitchGenerator: boolean;
  setShowPitchGenerator: (val: boolean) => void;
  enableWhatsAppKnock: boolean;
  setEnableWhatsAppKnock: (val: boolean) => void;
  showArbitrageSignals: boolean;
  setShowArbitrageSignals: (val: boolean) => void;

  // Modal Manager
  activeModal: ModalType | null;
  modalPayload: unknown;
  openModal: (modal: ModalType, payload?: unknown) => void;
  closeModal: () => void;

  // Authentication Gate
  isAuthenticated: boolean;
  setAuthenticated: (val: boolean) => void;
  logout: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Navigation View State Derived from Current URL Path
  const activeView: ViewType = useMemo(() => {
    const segment = location.pathname.split('/')[1]?.toLowerCase();
    if (segment === 'stream' || segment === 'terminal') return 'terminal';
    const validViews: ViewType[] = [
      'routes',
      'trends',
      'insights',
      'news',
      'vendors',
      'terminal',
      'pipeline',
      'dev',
      'settings',
      'help',
    ];
    if (validViews.includes(segment as ViewType)) return segment as ViewType;
    return 'routes';
  }, [location.pathname]);

  const switchView = useCallback((view: ViewType) => {
    const targetPath = view === 'terminal' ? '/stream' : `/${view}`;
    localStorage.setItem('wapp_active_view', view);
    navigate(targetPath);
  }, [navigate]);

  // Backward-compatible redirect for legacy hash URLs (#/routes -> /routes)
  useEffect(() => {
    if (window.location.hash) {
      const clean = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (clean) {
        const target = clean === 'terminal' ? 'stream' : clean;
        navigate(`/${target}`, { replace: true });
      }
    }
  }, [navigate]);

  // 2. Responsive Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarOpen((prev) => !prev);
    }
  }, []);

  const openMobileSidebar = useCallback(() => setIsMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), []);

  // 3. Theme & Sound
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('wapp_theme') !== 'light';
  });
  const [isSoundOn, setIsSoundOn] = useState<boolean>(() => {
    return localStorage.getItem('wapp_sound') !== 'false';
  });

  // Synchronize document classList with isDarkMode on initial mount and updates
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('wapp_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('wapp_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const setThemeMode = useCallback((mode: 'dark' | 'light') => {
    setIsDarkMode(mode === 'dark');
  }, []);

  const toggleSound = useCallback(() => {
    setIsSoundOn((prev) => {
      const next = !prev;
      localStorage.setItem('wapp_sound', String(next));
      return next;
    });
  }, []);

  // 4. Sidebar Visibility Preferences
  const [sidebarMenuPrefs, setSidebarMenuPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('telco_sidebar_menus');
      if (saved) return JSON.parse(saved);
    } catch (_) { }
    return {
      routes: true,
      trends: true,
      insights: true,
      news: true,
      vendors: true,
      terminal: true,
      chat: true,
      pipeline: true,
      dev: true,
      help: true,
    };
  });

  const toggleSidebarMenu = useCallback((menuId: string, visible: boolean) => {
    setSidebarMenuPrefs((prev) => {
      const updated = { ...prev, [menuId]: visible };
      localStorage.setItem('telco_sidebar_menus', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const enableAllSidebarMenus = useCallback(() => {
    const updated = {
      routes: true,
      trends: true,
      insights: true,
      news: true,
      vendors: true,
      terminal: true,
      chat: true,
      pipeline: true,
      dev: true,
      help: true,
    };
    localStorage.setItem('telco_sidebar_menus', JSON.stringify(updated));
    setSidebarMenuPrefs(updated);
  }, []);

  const resetSidebarMenus = useCallback(() => {
    enableAllSidebarMenus();
  }, [enableAllSidebarMenus]);

  // 5. Route Matrix Page Size Preference
  const [routePageSize, setRoutePageSizeState] = useState<number>(() => {
    const saved = localStorage.getItem('wapp_route_pagesize');
    return saved ? Number(saved) : 25;
  });

  const setRoutePageSize = useCallback((size: number) => {
    localStorage.setItem('wapp_route_pagesize', String(size));
    setRoutePageSizeState(size);
  }, []);

  // 6. Feature Toggles (AI & Trading Controls)
  const [showPitchGenerator, setShowPitchGeneratorState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('telcia_show_pitch_generator') ?? localStorage.getItem('wapp_show_pitch_generator');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return true;
  });

  const setShowPitchGenerator = useCallback((val: boolean) => {
    localStorage.setItem('telcia_show_pitch_generator', String(val));
    localStorage.setItem('wapp_show_pitch_generator', String(val));
    setShowPitchGeneratorState(val);
  }, []);

  const [enableWhatsAppKnock, setEnableWhatsAppKnockState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('telcia_enable_wa_knock');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return true;
  });

  const setEnableWhatsAppKnock = useCallback((val: boolean) => {
    localStorage.setItem('telcia_enable_wa_knock', String(val));
    setEnableWhatsAppKnockState(val);
  }, []);

  const [showArbitrageSignals, setShowArbitrageSignalsState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('telcia_show_arbitrage_signals');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return true;
  });

  const setShowArbitrageSignals = useCallback((val: boolean) => {
    localStorage.setItem('telcia_show_arbitrage_signals', String(val));
    setShowArbitrageSignalsState(val);
  }, []);

  // 7. Modal Window Manager
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalPayload, setModalPayload] = useState<unknown>(null);

  const openModal = useCallback((modal: ModalType, payload?: unknown) => {
    setActiveModal(modal);
    setModalPayload(payload ?? null);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalPayload(null);
    const path = window.location.pathname;
    if (path.startsWith('/routes/') && path !== '/routes') {
      navigate('/routes');
    } else if (path.startsWith('/stream/') && path !== '/stream') {
      navigate('/stream');
    }
  }, [navigate]);

  // 7. Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const hasAuth =
      localStorage.getItem('wapp_authenticated') === 'true' ||
      sessionStorage.getItem('wapp_authenticated') === 'true';
    const hasToken = Boolean(localStorage.getItem('wapp_token'));
    return hasAuth && hasToken;
  });

  const setAuthenticated = useCallback((val: boolean) => {
    setIsAuthenticated(val);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wapp_authenticated');
    sessionStorage.removeItem('wapp_authenticated');
    localStorage.removeItem('wapp_token');
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('wapp:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('wapp:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <UIContext.Provider
      value={{
        activeView,
        switchView,
        isSidebarOpen,
        toggleSidebar,
        isMobileSidebarOpen,
        openMobileSidebar,
        closeMobileSidebar,
        isDarkMode,
        toggleTheme,
        setThemeMode,
        isSoundOn,
        toggleSound,
        sidebarMenuPrefs,
        toggleSidebarMenu,
        enableAllSidebarMenus,
        resetSidebarMenus,
        routePageSize,
        setRoutePageSize,
        showPitchGenerator,
        setShowPitchGenerator,
        enableWhatsAppKnock,
        setEnableWhatsAppKnock,
        showArbitrageSignals,
        setShowArbitrageSignals,
        activeModal,
        modalPayload,
        openModal,
        closeModal,
        isAuthenticated,
        setAuthenticated,
        logout,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
