document.addEventListener('DOMContentLoaded', () => {
  const session = P09.requireRole('agent');
  if (!session) return;
  const propertyModal = new bootstrap.Modal(document.querySelector('#property-modal'));
  const leadModal = new bootstrap.Modal(document.querySelector('#lead-modal'));
  const propertiesById = new Map();
  let propertyPage = 1;
  let leadPage = 1;

  const propertyTransitions = {
    Available: ['Under Negotiation'],
    'Under Negotiation': [],
    Sold: [],
    Rented: []
  };
  const enquiryTransitions = {
    New: ['In Progress', 'Rejected'],
    'In Progress': ['Approved', 'Rejected'],
    Approved: ['Closed'],
    Rejected: ['Closed'],
    Closed: []
  };

  function nextPropertyStates(property) {
    if (property.status === 'Under Negotiation') return [property.listingFor === 'Sale' ? 'Sold' : 'Rented'];
    return propertyTransitions[property.status] || [];
  }

  async function loadAccount() {
    try {
      const { data } = await P09.api('/auth/me');
      document.querySelector('#agent-summary').innerHTML = `${P09.escape(data.user.name)} · ${P09.escape(data.user.email)} · ${data.user.isAgentVerified ? '<span class="badge bg-success">Verified agent</span>' : '<span class="badge bg-warning text-dark">Pending agent verification</span>'}`;
    } catch (error) { P09.showError(error); }
  }

  async function loadProperties(page = 1) {
    propertyPage = page;
    const host = document.querySelector('#property-list');
    host.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border"><span class="visually-hidden">Loading</span></div></td></tr>';
    document.querySelector('#property-alert').innerHTML = '';
    try {
      const { data } = await P09.api(`/properties/mine?page=${page}&limit=10`);
      data.items.forEach(item => propertiesById.set(item._id, item));
      document.querySelector('#property-empty').classList.toggle('d-none', data.items.length !== 0);
      host.innerHTML = data.items.map(property => {
        const next = nextPropertyStates(property);
        const statusControl = next.length ? `<div class="input-group input-group-sm"><select class="form-select property-status-select" aria-label="Next status">${next.map(value => `<option>${value}</option>`).join('')}</select><button class="btn btn-outline-dark update-property-status" data-id="${property._id}" ${!property.isVerified || property.isFlagged ? 'disabled' : ''}>Apply</button></div>${!property.isVerified || property.isFlagged ? '<div class="small text-secondary mt-1">Verification and a clear flag are required.</div>' : ''}` : '<span class="small text-secondary">No further transition</span>';
        return `<tr><td><div class="d-flex gap-3 align-items-center"><img class="list-image" src="${P09.escape(property.images?.[0] || P09.placeholder(property.title))}" alt=""><div><strong>${P09.escape(property.title)}</strong><div class="small text-secondary">${P09.escape(property.locality)}, ${P09.escape(property.city)} · ${P09.money(property.price)}</div></div></div></td><td>${P09.verificationBadge(property)}${property.rejectionReason ? `<div class="small text-danger mt-1">${P09.escape(property.rejectionReason)}</div>` : ''}</td><td><div class="mb-2">${P09.badge(property.status)}</div>${statusControl}</td><td><div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-dark btn-sm edit-property" data-id="${property._id}" ${['Sold', 'Rented'].includes(property.status) ? 'disabled' : ''}>Edit</button><button class="btn btn-outline-danger btn-sm delete-property" data-id="${property._id}" ${['Sold', 'Rented'].includes(property.status) ? 'disabled' : ''}>Delete</button></div></td></tr>`;
      }).join('');
      host.querySelectorAll('.edit-property').forEach(button => button.addEventListener('click', openEditProperty));
      host.querySelectorAll('.delete-property').forEach(button => button.addEventListener('click', deleteProperty));
      host.querySelectorAll('.update-property-status').forEach(button => button.addEventListener('click', updatePropertyStatus));
      P09.pagination('#property-pagination', data.pagination, loadProperties);
    } catch (error) {
      host.innerHTML = '';
      P09.showError(error, '#property-alert');
    }
  }

  function resetPropertyForm() {
    const form = document.querySelector('#property-form');
    form.reset();
    document.querySelector('#property-id').value = '';
    document.querySelector('#property-modal-title').textContent = 'Create listing';
    document.querySelector('#property-form-alert').innerHTML = '';
  }

  function openEditProperty(event) {
    const property = propertiesById.get(event.currentTarget.dataset.id);
    if (!property) return;
    document.querySelector('#property-id').value = property._id;
    document.querySelector('#property-title').value = property.title;
    document.querySelector('#property-type').value = property.type;
    document.querySelector('#property-purpose').value = property.listingFor;
    document.querySelector('#property-price').value = property.price;
    document.querySelector('#property-bedrooms').value = property.bedrooms;
    document.querySelector('#property-city').value = property.city;
    document.querySelector('#property-locality').value = property.locality;
    document.querySelector('#property-description').value = property.description || '';
    document.querySelector('#property-images').value = (property.images || []).join('\n');
    document.querySelector('#property-modal-title').textContent = 'Edit listing';
    document.querySelector('#property-form-alert').innerHTML = '';
    propertyModal.show();
  }

  async function deleteProperty(event) {
    const button = event.currentTarget;
    if (!confirm('Delete this listing? The backend will retain historical references.')) return;
    P09.setBusy(button, true, 'Deleting…');
    try {
      const { message } = await P09.api(`/properties/${button.dataset.id}`, { method: 'DELETE' });
      P09.showAlert('#property-alert', message, 'success');
      await loadProperties(propertyPage);
    } catch (error) {
      P09.showError(error, '#property-alert');
      P09.setBusy(button, false);
    }
  }

  async function updatePropertyStatus(event) {
    const button = event.currentTarget;
    const select = button.closest('.input-group').querySelector('select');
    P09.setBusy(button, true, 'Updating…');
    try {
      const { message } = await P09.api(`/properties/${button.dataset.id}/status`, { method: 'PUT', body: { status: select.value } });
      P09.showAlert('#property-alert', message, 'success');
      await loadProperties(propertyPage);
    } catch (error) {
      P09.showError(error, '#property-alert');
      P09.setBusy(button, false);
    }
  }

  document.querySelector('#new-property-button').addEventListener('click', resetPropertyForm);
  document.querySelector('#property-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#property-submit');
    const id = document.querySelector('#property-id').value;
    const images = document.querySelector('#property-images').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const body = {
      title: document.querySelector('#property-title').value,
      type: document.querySelector('#property-type').value,
      listingFor: document.querySelector('#property-purpose').value,
      price: Number(document.querySelector('#property-price').value),
      city: document.querySelector('#property-city').value,
      locality: document.querySelector('#property-locality').value,
      bedrooms: Number(document.querySelector('#property-bedrooms').value),
      description: document.querySelector('#property-description').value,
      images
    };
    P09.setBusy(button, true, 'Saving…');
    try {
      const response = await P09.api(id ? `/properties/${id}` : '/properties', { method: id ? 'PUT' : 'POST', body });
      propertyModal.hide();
      resetPropertyForm();
      P09.showAlert('#property-alert', response.message, 'success');
      await loadProperties(id ? propertyPage : 1);
    } catch (error) {
      P09.showError(error, '#property-form-alert');
    } finally {
      P09.setBusy(button, false);
    }
  });

  async function loadLeads(page = 1) {
    leadPage = page;
    const host = document.querySelector('#lead-list');
    host.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border"><span class="visually-hidden">Loading</span></div></td></tr>';
    document.querySelector('#lead-alert').innerHTML = '';
    const query = new URLSearchParams({ page, limit: 10 });
    const status = document.querySelector('#lead-status-filter').value;
    if (status) query.set('status', status);
    try {
      const { data } = await P09.api(`/enquiries?${query}`);
      document.querySelector('#lead-empty').classList.toggle('d-none', data.items.length !== 0);
      host.innerHTML = data.items.map(enquiry => {
        const next = enquiryTransitions[enquiry.status] || [];
        const action = next.length ? `<button class="btn btn-outline-dark btn-sm manage-lead" data-id="${enquiry._id}" data-status="${P09.escape(enquiry.status)}">Update</button>` : '<span class="small text-secondary">Complete</span>';
        return `<tr><td>${P09.escape(enquiry.propertyId?.title || 'Unavailable property')}<div class="small text-secondary">${enquiry.propertyId ? P09.badge(enquiry.propertyId.status) : ''}</div></td><td><strong>${P09.escape(enquiry.buyerId?.name || 'Unknown user')}</strong><div class="small text-secondary">${P09.escape(enquiry.buyerId?.email || '')}</div></td><td class="message-cell">${P09.escape(enquiry.message)}${enquiry.remarks ? `<div class="small text-secondary mt-2">Latest remark: ${P09.escape(enquiry.remarks)}</div>` : ''}</td><td>${P09.badge(enquiry.status)}</td><td>${action}</td></tr>`;
      }).join('');
      host.querySelectorAll('.manage-lead').forEach(button => button.addEventListener('click', () => {
        const options = enquiryTransitions[button.dataset.status] || [];
        document.querySelector('#lead-id').value = button.dataset.id;
        document.querySelector('#lead-next-status').innerHTML = options.map(value => `<option>${value}</option>`).join('');
        document.querySelector('#lead-remarks').value = '';
        document.querySelector('#lead-form-alert').innerHTML = '';
        leadModal.show();
      }));
      P09.pagination('#lead-pagination', data.pagination, loadLeads);
    } catch (error) {
      host.innerHTML = '';
      P09.showError(error, '#lead-alert');
    }
  }

  document.querySelector('#lead-filter').addEventListener('submit', event => { event.preventDefault(); loadLeads(1); });
  document.querySelector('#lead-status-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#lead-status-submit');
    const status = document.querySelector('#lead-next-status').value;
    const remarks = document.querySelector('#lead-remarks').value;
    const body = { status };
    if (remarks) body.remarks = remarks;
    P09.setBusy(button, true, 'Updating…');
    try {
      const { message } = await P09.api(`/enquiries/${document.querySelector('#lead-id').value}/status`, { method: 'PUT', body });
      leadModal.hide();
      P09.showAlert('#lead-alert', message, 'success');
      await loadLeads(leadPage);
    } catch (error) {
      P09.showError(error, '#lead-form-alert');
    } finally {
      P09.setBusy(button, false);
    }
  });

  loadAccount();
  loadProperties();
  loadLeads();
});

