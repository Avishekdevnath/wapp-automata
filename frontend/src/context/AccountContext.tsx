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
  createDesk: (id: string, name?: string) => Promise<boolean>;
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
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

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
      setAccounts(accs.length > 0 ? accs : [{ id: 'telcia-prod', label: 'Telcia Production', isDefault: true }]);
      setFleet(flt);
    } catch (err) {
      console.warn('Failed to refresh accounts:', err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    refreshAccounts();
    const interval = setInterval(refreshAccounts, 15000);
    return () => clearInterval(interval);
  }, [refreshAccounts]);

  const switchAccount = useCallback(async (id: string) => {
    if (!id || id === activeAccountId) return;
    setIsSwitching(true);
    try {
      const token = localStorage.getItem('wapp_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/accounts/switch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId: id })
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, id);
        setActiveAccountId(id);
        window.dispatchEvent(new CustomEvent('wapp:account-changed', { detail: { accountId: id } }));
        await refreshAccounts();
      }
    } catch (err) {
      console.error('Failed to switch desk:', err);
    } finally {
      setIsSwitching(false);
    }
  }, [activeAccountId, refreshAccounts]);

  const createDesk = useCallback(async (id: string, name?: string) => {
    try {
      const token = localStorage.getItem('wapp_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/accounts/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId: id, name: name || id })
      });

      if (res.ok) {
        await refreshAccounts();
        await switchAccount(id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refreshAccounts, switchAccount]);

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
      label: activeAccountId === 'telcia-prod' ? 'Telcia Production' : `Desk ${activeAccountId.toUpperCase()}`,
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
