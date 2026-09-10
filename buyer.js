document.addEventListener('DOMContentLoaded', () => {
  const session = P09.requireRole('buyer', 'tenant');
  if (!session) return;
  const ratingModal = new bootstrap.Modal(document.querySelector('#rating-modal'));
  let favouritePage = 1;
  let enquiryPage = 1;

  async function loadAccount() {
    try {
      const { data } = await P09.api('/auth/me');
      document.querySelector('#account-name').textContent = data.user.name;
      document.querySelector('#account-summary').textContent = `${data.user.role} account · ${data.user.email}`;
    } catch (error) {
      P09.showError(error);
    }
  }

  async function loadFavourites(page = 1) {
    favouritePage = page;
    const host = document.querySelector('#favourite-list');
    host.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border"><span class="visually-hidden">Loading</span></div></div>';
    document.querySelector('#favourite-alert').innerHTML = '';
    try {
      const { data } = await P09.api(`/favourites?page=${page}&limit=9`);
      host.innerHTML = data.items.length ? data.items.map(item => {
        if (!item.propertyId) return `<div class="col-md-6 col-xl-4"><article class="card dashboard-card h-100"><div class="card-body d-flex flex-column"><span class="badge bg-secondary align-self-start mb-3">No longer public</span><h2 class="h5">Unavailable saved listing</h2><p class="text-secondary">The saved relationship remains, but the property is deleted, flagged or awaiting review.</p><button class="btn btn-outline-danger btn-sm mt-auto remove-favourite" data-id="${item._id}">Remove saved record</button></div></article></div>`;
        return `<div class="col-md-6 col-xl-4">${P09.propertyCard(item.propertyId, `<button class="btn btn-outline-danger btn-sm remove-favourite" data-id="${item._id}">Remove</button>`)}</div>`;
      }).join('') : '<div class="col-12"><div class="empty-state"><h2 class="h5">No saved properties</h2><p class="mb-2">Properties you save will appear here.</p><a href="/index.html" class="btn btn-dark btn-sm">Browse listings</a></div></div>';
      host.querySelectorAll('.remove-favourite').forEach(button => button.addEventListener('click', removeFavourite));
      P09.pagination('#favourite-pagination', data.pagination, loadFavourites);
    } catch (error) {
      host.innerHTML = '';
      P09.showError(error, '#favourite-alert');
    }
  }

  async function removeFavourite(event) {
    const button = event.currentTarget;
    if (!confirm('Remove this property from your favourites?')) return;
    P09.setBusy(button, true, 'Removing…');
    try {
      const { message } = await P09.api(`/favourites/${button.dataset.id}`, { method: 'DELETE' });
      P09.showAlert('#favourite-alert', message, 'success');
      await loadFavourites(favouritePage);
    } catch (error) {
      P09.showError(error, '#favourite-alert');
      P09.setBusy(button, false);
    }
  }

  function historyMarkup(history = []) {
    return history.map(entry => `<div class="mb-2"><div>${P09.badge(entry.status)} <span class="small text-secondary">${P09.date(entry.changedAt)}</span></div>${entry.remarks ? `<div class="small mt-1">${P09.escape(entry.remarks)}</div>` : ''}</div>`).join('');
  }

  async function loadEnquiries(page = 1) {
    enquiryPage = page;
    const body = document.querySelector('#enquiry-list');
    body.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border"><span class="visually-hidden">Loading</span></div></td></tr>';
    document.querySelector('#enquiry-alert').innerHTML = '';
    const query = new URLSearchParams({ page, limit: 10 });
    const status = document.querySelector('#enquiry-status-filter').value;
    if (status) query.set('status', status);
    try {
      const { data } = await P09.api(`/enquiries/mine?${query}`);
      document.querySelector('#enquiry-empty').classList.toggle('d-none', data.items.length !== 0);
      body.innerHTML = data.items.map(enquiry => {
        const property = enquiry.propertyId;
        const propertyName = property?.title || 'Unavailable property';
        const propertyLink = property && !property.isDeleted ? `<a href="/property.html?id=${property._id}">${P09.escape(propertyName)}</a>` : P09.escape(propertyName);
        const rate = enquiry.status === 'Closed' && property?.agentId ? `<button class="btn btn-outline-dark btn-sm rate-agent" data-agent="${property.agentId}" data-enquiry="${enquiry._id}">Rate agent</button>` : '';
        return `<tr><td>${propertyLink}<div class="small text-secondary">${property ? P09.badge(property.status) : ''}</div></td><td class="message-cell"><div>${P09.escape(enquiry.message)}</div><details class="mt-2"><summary class="small link-secondary">Status history</summary><div class="status-history mt-2">${historyMarkup(enquiry.statusHistory)}</div></details></td><td>${P09.badge(enquiry.status)}${enquiry.remarks ? `<div class="small mt-2">${P09.escape(enquiry.remarks)}</div>` : ''}</td><td class="small">${P09.date(enquiry.updatedAt)}</td><td>${rate || '<span class="small text-secondary">No action</span>'}</td></tr>`;
      }).join('');
      body.querySelectorAll('.rate-agent').forEach(button => button.addEventListener('click', () => {
        document.querySelector('#rating-agent-id').value = button.dataset.agent;
        document.querySelector('#rating-enquiry-id').value = button.dataset.enquiry;
        document.querySelector('#rating-alert').innerHTML = '';
        ratingModal.show();
      }));
      P09.pagination('#enquiry-pagination', data.pagination, loadEnquiries);
    } catch (error) {
      body.innerHTML = '';
      P09.showError(error, '#enquiry-alert');
    }
  }

  document.querySelector('#enquiry-filter').addEventListener('submit', event => {
    event.preventDefault();
    loadEnquiries(1);
  });

  document.querySelector('#rating-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#rating-submit');
    P09.setBusy(button, true, 'Submitting…');
    try {
      const agentId = document.querySelector('#rating-agent-id').value;
      const body = {
        enquiryId: document.querySelector('#rating-enquiry-id').value,
        score: Number(document.querySelector('#rating-score').value),
        comment: document.querySelector('#rating-comment').value
      };
      const { message } = await P09.api(`/agents/${agentId}/ratings`, { method: 'POST', body });
      ratingModal.hide();
      event.currentTarget.reset();
      P09.showAlert('#enquiry-alert', message, 'success');
    } catch (error) {
      P09.showError(error, '#rating-alert');
    } finally {
      P09.setBusy(button, false);
    }
  });

  loadAccount();
  loadFavourites();
  loadEnquiries();
});

