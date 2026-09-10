document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!P09.objectId(id)) {
    document.querySelector('#profile-loading').classList.add('d-none');
    P09.showAlert('#page-alert', 'A valid agent ID is required.', 'danger', 'VALIDATION_ERROR');
    return;
  }

  async function load(page = 1) {
    try {
      const { data } = await P09.api(`/agents/${id}/profile?page=${page}&limit=6`, { auth: false });
      document.title = `${data.agent.name} | P09 Estate`;
      document.querySelector('#agent-name').textContent = data.agent.name;
      document.querySelector('#agent-verification').innerHTML = data.agent.isAgentVerified ? '<span class="badge bg-success">Verified agent</span>' : '<span class="badge bg-warning text-dark">Agent pending verification</span>';
      document.querySelector('#rating-average').textContent = data.ratings.count ? `${Number(data.ratings.average).toFixed(1)} / 5` : 'No score';
      document.querySelector('#rating-count').textContent = `${data.ratings.count} rating${data.ratings.count === 1 ? '' : 's'}`;
      document.querySelector('#listing-count').textContent = data.listingsCount;
      document.querySelector('#agent-listings').innerHTML = data.listings.items.length ? data.listings.items.map(property => `<div class="col-md-6">${P09.propertyCard(property)}</div>`).join('') : '<div class="col-12"><div class="empty-state">This agent has no public listings.</div></div>';
      document.querySelector('#recent-ratings').innerHTML = data.ratings.recent.length ? data.ratings.recent.map(rating => `<article class="card border-0 shadow-sm"><div class="card-body"><div class="fw-bold mb-1">${'★'.repeat(rating.score)}${'☆'.repeat(5 - rating.score)}</div><p class="mb-1">${P09.escape(rating.comment || 'No written comment.')}</p><span class="small text-secondary">${P09.date(rating.createdAt)}</span></div></article>`).join('') : '<div class="empty-state py-4">No ratings have been submitted.</div>';
      P09.pagination('#agent-listing-pagination', data.listings.pagination, load);
      document.querySelector('#profile-loading').classList.add('d-none');
      document.querySelector('#profile-content').classList.remove('d-none');
    } catch (error) {
      document.querySelector('#profile-loading').classList.add('d-none');
      P09.showError(error);
    }
  }
  load();
});

