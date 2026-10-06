/**
 * Telco Man • Intelligence Data Management & Purge Controller
 * Enables safe, selective deletion of Route Matrix offers, AI Analysis telemetry,
 * and Telecom Outages with high-contrast safety safeguards and instant view refreshment.
 */
(function() {
  'use strict';

  function openDataManagementModal(target) {
    const modal = document.getElementById('data-management-modal');
    if (!modal) return;

    if (window.initWindow) window.initWindow(modal);
    modal.classList.remove('hidden');

    // Highlight target section if specified
    const cardRoutes = document.getElementById('purge-card-routes');
    const cardAnalysis = document.getElementById('purge-card-analysis');
    const cardNews = document.getElementById('purge-card-news');

    [cardRoutes, cardAnalysis, cardNews].forEach(el => {
      if (el) {
        el.classList.remove('ring-2', 'ring-rose-500/50', 'ring-purple-500/50');
      }
    });

    if (target === 'routes' && cardRoutes) {
      cardRoutes.classList.add('ring-2', 'ring-rose-500/50');
      cardRoutes.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (target === 'analysis' && cardAnalysis) {
      cardAnalysis.classList.add('ring-2', 'ring-purple-500/50');
      cardAnalysis.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (target === 'news' && cardNews) {
      cardNews.classList.add('ring-2', 'ring-rose-500/50');
      cardNews.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (window.lucide) lucide.createIcons();
  }

  function closeDataManagementModal() {
    const modal = document.getElementById('data-management-modal');
    if (modal) modal.classList.add('hidden');
    if (window.removeDockPill) window.removeDockPill('data-management-modal');
  }

  async function executeDataClear(target, reseed = false) {
    let confirmPrompt = 'Are you sure you want to permanently delete this data?';
    if (target === 'routes') {
      confirmPrompt = reseed 
        ? 'Are you sure you want to clear current routes and reload authentic wholesale benchmark routes?' 
        : 'Are you sure you want to delete ALL Route Matrix data? (Raw WhatsApp chats and session will remain safe).';
    } else if (target === 'analysis') {
      confirmPrompt = 'Are you sure you want to delete ALL AI analysis task history and clear pipeline traces?';
    } else if (target === 'news') {
      confirmPrompt = 'Are you sure you want to delete all market news and outage notices?';
    } else if (target === 'all') {
      confirmPrompt = 'CAUTION: This will delete all Route Matrix data, AI analysis tasks, and outage notices. Raw incoming chat history is preserved. Proceed?';
    }

    if (!confirm(confirmPrompt)) {
      return;
    }

    try {
      if (typeof showToast === 'function') showToast('Clearing intelligence data...', 'info');

      const res = await fetch('/api/data/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (reseed && target === 'routes') {
        const seedRes = await fetch('/api/routes/seed', { method: 'POST' });
        const seedData = await seedRes.json();
        if (typeof showToast === 'function') {
          showToast(`Routes cleared and reseeded with ${seedData.seeded || 21} authentic wholesale benchmarks!`, 'success');
        }
      } else {
        let msg = 'Intelligence data successfully cleared!';
        if (target === 'routes') msg = 'All Route Matrix data successfully deleted.';
        else if (target === 'analysis') msg = 'All AI analysis history & pipeline telemetry cleared.';
        else if (target === 'news') msg = 'All outage notices & news cleared.';
        else if (target === 'all') msg = 'All intelligence data permanently cleared.';

        if (typeof showToast === 'function') showToast(msg, 'success');
      }

      closeDataManagementModal();

      // Refresh corresponding UI views
      if (target === 'routes' || target === 'all') {
        if (typeof window.loadRouteMatrix === 'function') window.loadRouteMatrix();
      }
      if (target === 'analysis' || target === 'all') {
        if (typeof window.loadPipelineStatus === 'function') window.loadPipelineStatus();
      }
      if (target === 'news' || target === 'all') {
        if (typeof window.loadTelcoNews === 'function') window.loadTelcoNews();
      }
      if (typeof window.loadMarketTrends === 'function') window.loadMarketTrends();
      if (typeof window.loadAiInsights === 'function') window.loadAiInsights();

    } catch (err) {
      if (typeof showToast === 'function') showToast(`Failed to clear data: ${err.message}`, 'error');
    }
  }

  // Export to Global Scope
  window.openDataManagementModal = openDataManagementModal;
  window.closeDataManagementModal = closeDataManagementModal;
  window.executeDataClear = executeDataClear;
})();
