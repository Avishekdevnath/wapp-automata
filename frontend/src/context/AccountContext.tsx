import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAccounts, fetchFleetStatus, restartDesk, type AccountItem, type FleetAccountStatus } from '../api/client';

interface AccountContextValue {
  accounts: AccountItem[];
  fleet: FleetAccountStatus[];
  activeAccountId: string;
  activeAccount: AccountItem | undefined;
  isSwitching: boolean;
  switchAccount: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  createDesk: (id: string) => Promise<boolean>;
  restartDesk: (id: string) => Promise<boolean>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = 'wapp_active_account';

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && saved !== 'default' ? saved : 'telcia-prod';
  });
  const [accounts, setAccounts] = useState<AccountItem[]>([
    { id: 'telcia-prod', label: 'Telcia Production', isDefault: true }
  ]);
  const [fleet, setFleet] = useState<FleetAccountStatus[]>([]);
  const isSwitching = false;

  const refreshAccounts = useCallback(async () => {
    try {
      const [accs, flt] = await Promise.all([
        fetchAccounts(),
        fetchFleetStatus().catch(() => [])
      ]);
      const currentActive = accs.find(a => (a as any).isActive)?.id || (accs.length > 0 ? accs[0].id : activeAccountId);
      if (currentActive && currentActive !== activeAccountId && (!localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) === 'default')) {
        setActiveAccountId(currentActive);
        localStorage.setItem(STORAGE_KEY, currentActive);
      }
      const effectiveId = currentActive || activeAccountId;
      const isolatedAccs = accs.filter(a => a.id === effectiveId);
      setAccounts(
        isolatedAccs.length > 0
          ? isolatedAccs
          : [{ id: effectiveId, label: effectiveId === 'default' ? 'Desk 1 (Primary)' : `Desk ${effectiveId.toUpperCase()}`, isDefault: true }]
      );
      setFleet(flt.filter(f => f.accountId === effectiveId));
    } catch (err) {
      console.warn('Failed to refresh accounts:', err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    refreshAccounts();
    const interval = setInterval(refreshAccounts, 15000);
    return () => clearInterval(interval);
  }, [refreshAccounts]);

  // Cross-desk switching is strictly locked in isolated operator sessions
  const switchAccount = useCallback((id: string) => {
    if (id !== activeAccountId) {
      console.warn('[Security] Cross-desk switching disabled for isolated operator sessions.');
    }
  }, [activeAccountId]);

  const createDesk = useCallback(async (_id: string) => {
    console.warn('[Security] Cross-desk provisioning disabled for isolated operator sessions.');
    return false;
  }, []);

  const restartDeskSocket = useCallback(async (id: string) => {
    if (id !== activeAccountId) return false;
    const ok = await restartDesk(id);
    if (ok) {
      await refreshAccounts();
    }
    return ok;
  }, [activeAccountId, refreshAccounts]);

  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === activeAccountId) || {
      id: activeAccountId,
      label: activeAccountId === 'default' ? 'Desk 1 (Primary)' : `Desk ${activeAccountId.toUpperCase()}`,
      isDefault: activeAccountId === 'default'
    };
  }, [accounts, activeAccountId]);

  const value = useMemo(() => ({
    accounts,
    fleet,
    activeAccountId,
    activeAccount,
    isSwitching,
    switchAccount,
    refreshAccounts,
    createDesk,
    restartDesk: restartDeskSocket
  }), [accounts, fleet, activeAccountId, activeAccount, isSwitching, switchAccount, refreshAccounts, createDesk, restartDeskSocket]);

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
