/**
 * Storage Manager Module: Disk Monitoring, Warning Alerts & Media Purge Actions
 */
let lastStorageData = null;

async function pollStorageStatus() {
  try {
    const res = await fetch('/api/storage/status');
    if (!res.ok) return;
    const data = await res.json();
    lastStorageData = data;

    // Update Nav Header Pill
    const navText = document.getElementById('nav-storage-text');
    const navDot = document.getElementById('nav-storage-dot');
    if (navText && data.disk) {
      navText.innerText = `${data.disk.usedPercent}%`;
    }

    // Warning Banner & Dot
    const banner = document.getElementById('storage-alert-banner');
    const bannerText = document.getElementById('storage-alert-text');
    if (data.warning && data.warning.message) {
      if (banner) banner.classList.remove('hidden');
      if (bannerText) bannerText.innerText = data.warning.message;
      if (navDot) navDot.classList.remove('hidden');
    } else {
      if (banner) banner.classList.add('hidden');
      if (navDot) navDot.classList.add('hidden');
    }

    // If modal is open, refresh modal metrics
    updateStorageModalMetrics(data);
  } catch (err) {}
}

function updateStorageModalMetrics(data) {
  if (!data || !data.disk) return;

  const diskText = document.getElementById('modal-disk-usage-text');
  const diskBar = document.getElementById('modal-disk-progress');
  const mediaCount = document.getElementById('modal-media-count');
  const mediaSize = document.getElementById('modal-media-size');

  if (diskText) {
    diskText.innerText = `${data.disk.usedPercent}% (${data.disk.usedGb} GB / ${data.disk.totalGb} GB)`;
  }

  if (diskBar) {
    diskBar.style.width = `${Math.min(100, data.disk.usedPercent)}%`;
    if (data.disk.usedPercent >= 80) {
      diskBar.className = 'bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500';
    } else {
      diskBar.className = 'bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500';
    }
  }

  if (mediaCount && data.media) {
    mediaCount.innerText = data.media.totalFiles;
  }

  if (mediaSize && data.media) {
    mediaSize.innerText = `${data.media.totalMb} MB`;
  }

  if (window.lucide) lucide.createIcons();
}

function openStorageModal() {
  const modal = document.getElementById('storage-modal');
  if (modal) {
    if (window.initWindow) window.initWindow(modal);
    modal.classList.remove('hidden');
  }
  pollStorageStatus();
  if (window.lucide) lucide.createIcons();
}

function closeStorageModal() {
  const modal = document.getElementById('storage-modal');
  if (modal) modal.classList.add('hidden');
  if (window.removeDockPill) window.removeDockPill('storage-modal');
}

async function handlePurgeMedia(percentage) {
  const label = percentage >= 100 ? '100% of cached media files' : `the oldest ${percentage}% of media files`;
  if (!confirm(`Are you sure you want to permanently delete ${label}? (Chat messages and text history will remain safe).`)) {
    return;
  }

  const btn80 = document.getElementById('btn-purge-80');
  const btn100 = document.getElementById('btn-purge-100');
  if (btn80) btn80.disabled = true;
  if (btn100) btn100.disabled = true;

  try {
    const res = await fetch('/api/storage/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage })
    });
    const result = await res.json();

    if (res.ok && result.status === 'ok') {
      showToast(`Cleaned up ${result.deletedCount} files (${result.freedMb} MB freed)`, 'success');
      pollStorageStatus();
      if (typeof fetchMessages === 'function') fetchMessages();
    } else {
      showToast('Failed to purge media files', 'error');
    }
  } catch (err) {
    showToast('Network error during media cleanup', 'error');
  } finally {
    if (btn80) btn80.disabled = false;
    if (btn100) btn100.disabled = false;
  }
}

async function dismissStorageWarning() {
  try {
    await fetch('/api/storage/dismiss-warning', { method: 'POST' });
    const banner = document.getElementById('storage-alert-banner');
    const navDot = document.getElementById('nav-storage-dot');
    if (banner) banner.classList.add('hidden');
    if (navDot) navDot.classList.add('hidden');
  } catch (err) {}
}
