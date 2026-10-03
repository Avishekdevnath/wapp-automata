/**
 * Webhook Simulator Module: Developer Testing Pipeline
 */
function openSimulateModal() {
  document.getElementById('simulate-modal')?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSimulateModal() {
  document.getElementById('simulate-modal')?.classList.add('hidden');
}

async function handleSimulateSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-sim');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Dispatching...</span>';
  }

  const payload = {
    sender_name: document.getElementById('sim-sender-name')?.value || 'Test Sender',
    sender_phone: document.getElementById('sim-sender-phone')?.value || '+880 1711-223344',
    chat_type: document.getElementById('sim-chat-type')?.value || 'group',
    chat_name: document.getElementById('sim-chat-name')?.value || 'Test Chat',
    text: document.getElementById('sim-text')?.value || 'Simulated message payload'
  };

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      showToast('Simulated WhatsApp webhook dispatched!', 'success');
      closeSimulateModal();
      fetchMessages();
    } else {
      showToast(data.error || 'Failed to dispatch simulation', 'error');
    }
  } catch (err) {
    showToast('Network error dispatching simulation', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Dispatch Payload</span>';
      if (window.lucide) lucide.createIcons();
    }
  }
}
