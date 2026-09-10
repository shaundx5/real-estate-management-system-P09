document.addEventListener('DOMContentLoaded', () => {
  const session = P09.requireRole('admin');
  if (!session) return;
  const rejectModal = new bootstrap.Modal(document.querySelector('#reject-modal'));
  let moderationPage = 1;
  let topPage = 1;
  let agentPage = 1;

  async function loadAccount() {
    try {
      const { data } = await P09.api('/auth/me');
      document.querySelector('#admin-summary').textContent = `${data.user.name} · ${data.user.email}`;
    } catch (error) { P09.showError(error); }
  }

  function countCards(counts) {
    const entries = [
      ['Pending listings', counts.pending, 'warning'],
      ['Flagged listings', counts.flagged, 'danger'],
      ['Rejected listings', counts.rejected, 'secondary'],
      ['Verified listings', counts.verified, 'success'],
      ['Pending agents', counts.pendingAgents, 'primary']
    ];
    return entries.map(([label, value, colour]) => `<div class="col-6 col-lg"><div class="card dashboard-card h-100"><div class="card-body"><div class="metric-value text-${colour}">${value}</div><div class="small text-secondary mt-2">${label}</div></div></div></div>`).join('');
  }

  function listingActions(property) {
    const actions = [];
    if (property.reviewStatus === 'Pending' && !property.isFlagged) actions.push(`<button class="btn btn-success btn-sm verify-listing" data-id="${property._id}">Verify</button>`);
    if (property.reviewStatus !== 'Rejected') actions.push(`<button class="btn btn-outline-danger btn-sm reject-listing" data-id="${property._id}">Reject</button>`);
    if (property.isFlagged) actions.push(`<button class="btn btn-outline-dark btn-sm unflag-listing" data-id="${property._id}">Unflag</button>`);
    return actions.length ? `<div class="d-flex gap-2 flex-wrap">${actions.join('')}</div>` : '<span class="small text-secondary">No action</span>';
  }

  async function loadModeration(page = 1) {
    moderationPage = page;
    const host = document.querySelector('#moderation-list');
    host.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border"><span class="visually-hidden">Loading</span></div></td></tr>';
    document.querySelector('#moderation-alert').innerHTML = '';
    const view = document.querySelector('#moderation-view').value;
    try {
      const { data } = await P09.api(`/admin/moderation?view=${encodeURIComponent(view)}&page=${page}&limit=10`);
      document.querySelector('#moderation-counts').innerHTML = countCards(data.counts);
      document.querySelector('#moderation-empty').classList.toggle('d-none', data.listings.items.length !== 0);
      host.innerHTML = data.listings.items.map(property => `<tr><td><strong>${P09.escape(property.title)}</strong><div class="small text-secondary">${P09.escape(property.locality)}, ${P09.escape(property.city)} · ${P09.escape(property.listingFor)} · ${P09.money(property.price)}</div><div class="small text-secondary">Agent ID: ${P09.escape(property.agentId)}</div></td><td>${P09.verificationBadge(property)}<div class="mt-1">${P09.badge(property.status)}</div>${property.rejectionReason ? `<div class="small text-danger mt-1">${P09.escape(property.rejectionReason)}</div>` : ''}</td><td>${property.isFlagged ? `<span class="badge bg-danger mb-1">Flagged</span><div class="small">${P09.escape(property.flagReason)}</div>` : '<span class="small text-secondary">Not flagged</span>'}</td><td>${listingActions(property)}</td></tr>`).join('');
      host.querySelectorAll('.verify-listing').forEach(button => button.addEventListener('click', verifyListing));
      host.querySelectorAll('.reject-listing').forEach(button => button.addEventListener('click', () => {
        document.querySelector('#reject-property-id').value = button.dataset.id;
        document.querySelector('#reject-reason').value = '';
        document.querySelector('#reject-alert').innerHTML = '';
        rejectModal.show();
      }));
      host.querySelectorAll('.unflag-listing').forEach(button => button.addEventListener('click', unflagListing));
      P09.pagination('#moderation-pagination', data.listings.pagination, loadModeration);
      document.querySelector('#pending-agents').innerHTML = data.pendingAgents.items.length ? data.pendingAgents.items.map(agent => `<article class="card dashboard-card"><div class="card-body"><h3 class="h6 mb-1">${P09.escape(agent.name)}</h3><p class="small text-secondary mb-3">${P09.escape(agent.email)}<br>Registered ${P09.date(agent.createdAt)}</p><button class="btn btn-primary btn-sm verify-agent" data-id="${agent._id}">Verify agent</button></div></article>`).join('') : '<div class="empty-state py-4">No agents are awaiting verification.</div>';
      document.querySelectorAll('.verify-agent').forEach(button => button.addEventListener('click', verifyAgent));
    } catch (error) {
      host.innerHTML = '';
      P09.showError(error, '#moderation-alert');
    }
  }

  async function verifyListing(event) {
    const button = event.currentTarget;
    P09.setBusy(button, true, 'Verifying…');
    try {
      const { message } = await P09.api(`/properties/${button.dataset.id}/verify`, { method: 'PUT' });
      P09.showAlert('#moderation-alert', message, 'success');
      await loadModeration(moderationPage);
    } catch (error) {
      P09.showError(error, '#moderation-alert');
      P09.setBusy(button, false);
    }
  }

  async function unflagListing(event) {
    const button = event.currentTarget;
    P09.setBusy(button, true, 'Clearing…');
    try {
      const { message } = await P09.api(`/admin/moderation/${button.dataset.id}`, { method: 'PUT', body: { action: 'unflag' } });
      P09.showAlert('#moderation-alert', message, 'success');
      await loadModeration(moderationPage);
    } catch (error) {
      P09.showError(error, '#moderation-alert');
      P09.setBusy(button, false);
    }
  }

  async function verifyAgent(event) {
    const button = event.currentTarget;
    P09.setBusy(button, true, 'Verifying…');
    try {
      const { message } = await P09.api(`/admin/agents/${button.dataset.id}/verify`, { method: 'PUT' });
      P09.showAlert('#moderation-alert', message, 'success');
      await loadModeration(moderationPage);
    } catch (error) {
      P09.showError(error, '#moderation-alert');
      P09.setBusy(button, false);
    }
  }

  document.querySelector('#moderation-filter').addEventListener('submit', event => { event.preventDefault(); loadModeration(1); });
  document.querySelector('#reject-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#reject-submit');
    P09.setBusy(button, true, 'Rejecting…');
    try {
      const id = document.querySelector('#reject-property-id').value;
      const { message } = await P09.api(`/admin/moderation/${id}`, { method: 'PUT', body: { action: 'reject', reason: document.querySelector('#reject-reason').value } });
      rejectModal.hide();
      P09.showAlert('#moderation-alert', message, 'success');
      await loadModeration(moderationPage);
    } catch (error) {
      P09.showError(error, '#reject-alert');
    } finally {
      P09.setBusy(button, false);
    }
  });

  async function loadTopReport(page = 1) {
    topPage = page;
    const host = document.querySelector('#top-property-report');
    host.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></td></tr>';
    try {
      const { data } = await P09.api(`/admin/reports/top-properties?page=${page}&limit=10`);
      host.innerHTML = data.items.length ? data.items.map(item => `<tr><td><strong>${P09.escape(item.property.title)}</strong><div class="small text-secondary">${P09.escape(item.property.city)} · ${P09.escape(item.property.agentId)}</div></td><td>${item.enquiriesCount}</td><td>${item.approvedCount}</td><td>${item.closedCount}</td><td>${P09.badge(item.property.status)} ${item.property.isDeleted ? '<span class="badge bg-dark">Archived</span>' : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-secondary py-4">No enquiries have been recorded.</td></tr>';
      P09.pagination('#top-report-pagination', data.pagination, loadTopReport);
    } catch (error) { host.innerHTML = ''; P09.showError(error, '#report-alert'); }
  }

  async function loadAgentReport(page = 1) {
    agentPage = page;
    const host = document.querySelector('#agent-report');
    host.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></td></tr>';
    try {
      const { data } = await P09.api(`/admin/reports/agent-performance?page=${page}&limit=10`);
      host.innerHTML = data.items.length ? data.items.map(item => `<tr><td><a href="/agent-profile.html?id=${item.agentId}">${P09.escape(item.name)}</a><div>${item.isAgentVerified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning text-dark">Pending</span>'}</div></td><td>${item.listingsCount}</td><td>${item.activeListingsCount}</td><td>${item.enquiriesReceived}</td><td>${item.closedEnquiries}</td><td>${item.soldCount} / ${item.rentedCount}</td><td><strong>${Number(item.conversionRatePercent).toFixed(2)}%</strong></td></tr>`).join('') : '<tr><td colspan="7" class="text-center text-secondary py-4">No agent accounts are available.</td></tr>';
      P09.pagination('#agent-report-pagination', data.pagination, loadAgentReport);
    } catch (error) { host.innerHTML = ''; P09.showError(error, '#report-alert'); }
  }

  loadAccount();
  loadModeration();
  loadTopReport();
  loadAgentReport();
});

