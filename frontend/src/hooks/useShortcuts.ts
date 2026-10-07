import { useEffect } from 'react';
import { useUI } from '../context/UIContext';

export function useShortcuts() {
  const { switchView, toggleSidebar, openModal, closeModal, activeModal } = useUI();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isInput) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (activeModal) {
          e.preventDefault();
          closeModal();
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        openModal('shortcuts');
        return;
      }

      if (e.key === '\\' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Direct view switching (1–9)
      if (e.key === '1') switchView('routes');
      if (e.key === '2') switchView('trends');
      if (e.key === '3') switchView('insights');
      if (e.key === '4') switchView('news');
      if (e.key === '5') switchView('vendors');
      if (e.key === '6') switchView('terminal');
      if (e.key === '7') switchView('pipeline');
      if (e.key === '8') switchView('dev');
      if (e.key === '9') switchView('settings');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchView, toggleSidebar, openModal, closeModal, activeModal]);
}
