/**
 * Windows 11 Desktop Window Manager for Modals
 * Supports: Dragging, Resizing, Maximizing, Minimizing to Taskbar Dock, and Depth Styling
 */
(function() {
  const windowStates = new Map();

  // Ensure taskbar dock container exists
  function getOrCreateDock() {
    let dock = document.getElementById('win-taskbar-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'win-taskbar-dock';
      document.body.appendChild(dock);
    }
    return dock;
  }

  /**
   * Initializes a modal element with Windows 11 window capabilities
   */
  function initWindow(modalEl) {
    if (!modalEl || modalEl.dataset.winInitialized === 'true') return;
    modalEl.dataset.winInitialized = 'true';

    const winEl = modalEl.querySelector('.win-window, .glass-modal');
    if (!winEl) return;

    const id = modalEl.id;
    const titlebar = winEl.querySelector('.win-titlebar') || winEl.querySelector('.border-b');
    if (!titlebar) return;

    titlebar.classList.add('win-titlebar');

    // Add resizer grip if not present
    let resizer = winEl.querySelector('.win-resizer');
    if (!resizer) {
      resizer = document.createElement('div');
      resizer.className = 'win-resizer';
      resizer.title = 'Drag to resize window';
      winEl.appendChild(resizer);
    }

    // State tracking
    const state = {
      isMaximized: false,
      isMinimized: false,
      restoreRect: null,
      customPosition: false
    };
    windowStates.set(id, state);

    // Initial position centering when modal becomes visible
    const observer = new MutationObserver(() => {
      if (modalEl.classList.contains('hidden')) {
        modalEl.classList.remove('win-floating-mode');
        state.customPosition = false;
      } else if (!state.customPosition && !state.isMaximized) {
        centerWindow(winEl);
      }
    });
    observer.observe(modalEl, { attributes: true, attributeFilter: ['class'] });

    // 1. DRAG FUNCTIONALITY
    let isDragging = false;
    let startX = 0, startY = 0;
    let initLeft = 0, initTop = 0;

    titlebar.addEventListener('mousedown', (e) => {
      // Don't drag if clicking buttons, inputs, or controls
      if (e.target.closest('.win-controls') || e.target.closest('button') || e.target.closest('input')) return;
      if (state.isMaximized) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = winEl.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      // Switch to floating mode (non-blocking) and bring to front
      modalEl.classList.add('win-floating-mode');
      bringToFront(modalEl);

      document.body.classList.add('select-none');
      titlebar.classList.add('cursor-grabbing');

      function onMouseMove(ev) {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newLeft = initLeft + dx;
        let newTop = initTop + dy;

        // Viewport bounds clamping
        const w = winEl.offsetWidth;
        const maxLeft = window.innerWidth - 80;
        const minLeft = 20 - w;
        newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
        newTop = Math.max(8, Math.min(window.innerHeight - 50, newTop));

        winEl.style.left = `${newLeft}px`;
        winEl.style.top = `${newTop}px`;
        winEl.style.margin = '0';
        winEl.style.transform = 'none';
        state.customPosition = true;
      }

      function onMouseUp() {
        if (isDragging) {
          isDragging = false;
          document.body.classList.remove('select-none');
          titlebar.classList.remove('cursor-grabbing');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Touch support for drag
    titlebar.addEventListener('touchstart', (e) => {
      if (e.target.closest('.win-controls') || e.target.closest('button')) return;
      if (state.isMaximized) return;

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = winEl.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      modalEl.classList.add('win-floating-mode');
      bringToFront(modalEl);

      function onTouchMove(ev) {
        const t = ev.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        winEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 80, initLeft + dx))}px`;
        winEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 50, initTop + dy))}px`;
        winEl.style.margin = '0';
        winEl.style.transform = 'none';
        state.customPosition = true;
      }

      function onTouchEnd() {
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
      }

      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('touchend', onTouchEnd);
    }, { passive: true });

    // 2. RESIZE FUNCTIONALITY
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startW = winEl.offsetWidth;
      const startH = winEl.offsetHeight;
      const sX = e.clientX;
      const sY = e.clientY;

      document.body.classList.add('select-none');

      function onResizeMove(ev) {
        const newW = Math.max(360, Math.min(window.innerWidth - 20, startW + (ev.clientX - sX)));
        const newH = Math.max(240, Math.min(window.innerHeight - 20, startH + (ev.clientY - sY)));
        winEl.style.width = `${newW}px`;
        winEl.style.height = `${newH}px`;
        winEl.style.maxWidth = 'none';
        winEl.style.maxHeight = 'none';
      }

      function onResizeUp() {
        document.body.classList.remove('select-none');
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeUp);
      }

      document.addEventListener('mousemove', onResizeMove);
      document.addEventListener('mouseup', onResizeUp);
    });

    // 3. MAXIMIZE / RESTORE FUNCTIONALITY
    function toggleMaximize() {
      const maxBtn = winEl.querySelector('.win-btn-max');
      if (!state.isMaximized) {
        // Save current position and dimensions
        const rect = winEl.getBoundingClientRect();
        state.restoreRect = {
          left: winEl.style.left || `${rect.left}px`,
          top: winEl.style.top || `${rect.top}px`,
          width: winEl.style.width || `${rect.width}px`,
          height: winEl.style.height || `${rect.height}px`
        };

        winEl.classList.add('win-maximized');
        state.isMaximized = true;

        if (maxBtn) {
          maxBtn.title = 'Restore Window';
          maxBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i>';
        }
      } else {
        winEl.classList.remove('win-maximized');
        if (state.restoreRect) {
          winEl.style.left = state.restoreRect.left;
          winEl.style.top = state.restoreRect.top;
          winEl.style.width = state.restoreRect.width;
          winEl.style.height = state.restoreRect.height;
        }
        state.isMaximized = false;

        if (maxBtn) {
          maxBtn.title = 'Maximize Window';
          maxBtn.innerHTML = '<i data-lucide="square" class="w-3.5 h-3.5"></i>';
        }
      }
      if (window.lucide) lucide.createIcons();
    }

    // Double-click titlebar to toggle maximize
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.win-controls') || e.target.closest('button')) return;
      toggleMaximize();
    });

    // Wire up Maximize button
    const maxBtn = winEl.querySelector('.win-btn-max');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMaximize();
      });
    }

    // 4. MINIMIZE FUNCTIONALITY
    const minBtn = winEl.querySelector('.win-btn-min');
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        minimizeWindow(modalEl, winEl);
      });
    }

    // Clicking anywhere on window brings it to front
    winEl.addEventListener('mousedown', () => bringToFront(modalEl));
  }

  function centerWindow(winEl) {
    const w = winEl.offsetWidth || 560;
    const h = winEl.offsetHeight || 480;
    const left = Math.max(16, (window.innerWidth - w) / 2);
    const top = Math.max(24, (window.innerHeight - h) / 2);

    winEl.style.position = 'fixed';
    winEl.style.left = `${left}px`;
    winEl.style.top = `${top}px`;
    winEl.style.margin = '0';
  }

  let topZIndex = 60;
  function bringToFront(modalEl) {
    topZIndex += 2;
    modalEl.style.zIndex = topZIndex;
  }

  function minimizeWindow(modalEl, winEl) {
    const id = modalEl.id;
    const state = windowStates.get(id) || {};
    state.isMinimized = true;

    modalEl.classList.add('hidden');

    const dock = getOrCreateDock();
    // Remove any existing dock pill for this id
    const oldPill = dock.querySelector(`[data-win-id="${id}"]`);
    if (oldPill) oldPill.remove();

    // Get title and icon from window
    const titleText = winEl.querySelector('h3')?.innerText || 'Active Window';
    const iconText = winEl.querySelector('#modal-route-flag')?.innerText || '🗔';

    const pill = document.createElement('div');
    pill.className = 'win-dock-pill';
    pill.dataset.winId = id;
    pill.innerHTML = `
      <span class="select-none text-sm">${iconText}</span>
      <span class="truncate max-w-[150px]">${titleText}</span>
      <button class="win-dock-close p-0.5 rounded hover:bg-white/20 text-slate-400 hover:text-white" title="Close">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
    `;

    // Click pill to restore
    pill.addEventListener('click', (e) => {
      if (e.target.closest('.win-dock-close')) {
        pill.remove();
        state.isMinimized = false;
        return;
      }
      modalEl.classList.remove('hidden');
      state.isMinimized = false;
      pill.remove();
      bringToFront(modalEl);
    });

    const closeBtn = pill.querySelector('.win-dock-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      pill.remove();
      state.isMinimized = false;
    });

    dock.appendChild(pill);
    if (window.lucide) lucide.createIcons();
  }

  // Remove dock pill when modal is closed
  function removeDockPill(id) {
    const dock = document.getElementById('win-taskbar-dock');
    if (dock) {
      const pill = dock.querySelector(`[data-win-id="${id}"]`);
      if (pill) pill.remove();
    }
  }

  // Auto-init all modals on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const modals = [
      'route-detail-modal',
      'modal-post-route',
      'storage-modal',
      'modal-ai-settings',
      'modal-purge-stream',
      'modal-pipeline-inspect',
      'device-modal'
    ];

    modals.forEach(id => {
      const el = document.getElementById(id);
      if (el) initWindow(el);
    });
  });

  // Global window manager exports
  window.initWindow = initWindow;
  window.removeDockPill = removeDockPill;
})();
