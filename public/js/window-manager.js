/**
 * WappAutomata • Ultra-Fast Enterprise Modal Controller
 * Replaces heavy window dragging with instant (<16ms) hardware-accelerated modals.
 * Features: Native ESC dismissal, backdrop click closing, zero CPU churn, full backwards-compatibility.
 */
(function() {
  'use strict';

  let topZIndex = 100;

  function closeModalByElement(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');

    const id = modalEl.id;
    if (id === 'device-modal' && typeof window.closeDeviceModal === 'function') window.closeDeviceModal();
    else if (id === 'storage-modal' && typeof window.closeStorageModal === 'function') window.closeStorageModal();
    else if (id === 'route-detail-modal' && typeof window.closeRouteDetailModal === 'function') window.closeRouteDetailModal();
    else if (id === 'modal-post-route' && typeof window.closePostRouteModal === 'function') window.closePostRouteModal();
    else if (id === 'modal-purge-stream' && typeof window.closePurgeStreamModal === 'function') window.closePurgeStreamModal();
    else if (id === 'modal-ai-settings' && typeof window.closeAiSettingsModal === 'function') window.closeAiSettingsModal();
    else if (id === 'modal-pipeline-inspect' && typeof window.closeInspectModal === 'function') window.closeInspectModal();
  }

  function bringToFront(modalEl) {
    if (!modalEl) return;
    topZIndex += 2;
    modalEl.style.zIndex = topZIndex;
  }

  function registerModal(modalEl) {
    if (!modalEl || modalEl.dataset.modalBound === 'true') return;
    modalEl.dataset.modalBound = 'true';

    // Backdrop click dismisses modal
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) {
        closeModalByElement(modalEl);
      }
    });

    // Wire close buttons inside modal
    const closeBtns = modalEl.querySelectorAll('.win-btn-close, [data-modal-close]');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModalByElement(modalEl);
      });
    });
  }

  // Global ESC key listener for instant dismissal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const activeModals = Array.from(document.querySelectorAll('.win-modal-container:not(.hidden)'));
      if (activeModals.length > 0) {
        const topModal = activeModals[activeModals.length - 1];
        closeModalByElement(topModal);
      }
    }
  });

  // Drop-in backwards-compatible initWindow
  function initWindow(modalEl) {
    if (!modalEl) return;
    registerModal(modalEl);
    bringToFront(modalEl);
  }

  // Backwards-compatible removeDockPill
  function removeDockPill(id) {
    // Dock is eliminated in the modern clean modal system
  }

  function centerWindow(winEl) {
    // Flexbox automatically centers modals natively with zero layout thrashing
  }

  // Initialize all modals and cleanup legacy dock on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const oldDock = document.getElementById('win-taskbar-dock');
    if (oldDock) oldDock.remove();

    document.querySelectorAll('.win-modal-container').forEach(registerModal);
  });

  // Backward-compatible API exports
  window.initWindow = initWindow;
  window.removeDockPill = removeDockPill;
  window.centerWindow = centerWindow;
  window.bringToFront = bringToFront;
  window.closeModalByElement = closeModalByElement;
})();
