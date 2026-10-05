/**
 * WappAutomata • Route Matrix Actions Controller
 * Handles 1-Click WhatsApp Knocking, CSV Rate Sheet Export, and Benchmark Seeding.
 */
(function() {
  'use strict';

  /**
   * 1-Click WhatsApp Vendor Knock
   */
  function knockVendor(cleanPhone, vendorName, country, routeType, pulse) {
    if (!cleanPhone) {
      if (typeof showToast === 'function') showToast('Vendor phone number is not available', 'error');
      return;
    }

    const messageText = `Hi ${vendorName}, saw your offer for ${country} ${routeType} (${pulse || '1/1'}). We have active outbound wholesale CC traffic. Please share your latest rate sheet, terms, and test IP.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    
    window.open(url, '_blank');
    if (typeof showToast === 'function') showToast(`Knocking ${vendorName} on WhatsApp...`, 'success');
  }

  /**
   * Export Routes CSV Rate Sheet
   */
  function exportRoutesCSV() {
    window.open('/api/export/routes', '_blank');
  }

  /**
   * Trigger Force Benchmark Re-Seeding
   */
  async function triggerSeedBenchmark() {
    try {
      const res = await fetch('/api/routes/seed', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof showToast === 'function') showToast(`Loaded ${data.seeded || 21} authentic wholesale routes!`, 'success');
      if (typeof window.loadRouteMatrix === 'function') window.loadRouteMatrix();
    } catch (err) {
      if (typeof showToast === 'function') showToast(`Failed to seed routes: ${err.message}`, 'error');
    }
  }

  // Export to Global Scope
  window.knockVendor = knockVendor;
  window.exportRoutesCSV = exportRoutesCSV;
  window.triggerSeedBenchmark = triggerSeedBenchmark;
})();
