document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#search-form');
  const results = document.querySelector('#property-results');
  let currentPage = 1;

  const allowed = ['city', 'locality', 'type', 'bedrooms', 'listingFor', 'minPrice', 'maxPrice', 'status', 'sort'];
  const urlParams = new URLSearchParams(location.search);
  allowed.forEach(key => {
    const field = form.elements[key];
    if (field && urlParams.has(key)) field.value = urlParams.get(key);
  });

  function searchQuery(page = 1) {
    const query = new URLSearchParams();
    allowed.forEach(key => {
      const value = form.elements[key]?.value.trim();
      if (value) query.set(key, value);
    });
    query.set('page', page);
    query.set('limit', 12);
    return query;
  }

  async function loadProperties(page = 1) {
    currentPage = page;
    results.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading</span></div></div>';
    document.querySelector('#page-alert').innerHTML = '';
    try {
      const query = searchQuery(page);
      const { data } = await P09.api(`/properties/search?${query}`, { auth: false });
      history.replaceState(null, '', `${location.pathname}?${new URLSearchParams([...query].filter(([key]) => key !== 'page' && key !== 'limit'))}`);
      document.querySelector('#results-count').textContent = `${data.pagination.total} listing${data.pagination.total === 1 ? '' : 's'}`;
      results.innerHTML = data.items.length
        ? data.items.map(property => `<div class="col-md-6 col-xl-4">${P09.propertyCard(property)}</div>`).join('')
        : '<div class="col-12"><div class="empty-state"><h3 class="h5">No verified listings matched</h3><p class="mb-0">Change one or more filters and search again.</p></div></div>';
      P09.pagination('#property-pagination', data.pagination, loadProperties);
    } catch (error) {
      results.innerHTML = '';
      document.querySelector('#results-count').textContent = '';
      document.querySelector('#property-pagination').innerHTML = '';
      P09.showError(error);
    }
  }

  async function loadLocations() {
    try {
      const { data } = await P09.api('/properties/locations?groupBy=city&page=1&limit=100', { auth: false });
      const host = document.querySelector('#location-groups');
      host.innerHTML = data.items.length ? data.items.map(item => `<button class="btn btn-sm btn-light border location-button" data-city="${P09.escape(item.city)}">
        ${P09.escape(item.city)} <span class="badge text-bg-dark ms-1">${item.listingsCount}</span>
      </button>`).join('') : '<span class="text-secondary small">No locations are available yet.</span>';
      host.querySelectorAll('.location-button').forEach(button => button.addEventListener('click', () => {
        form.elements.city.value = button.dataset.city;
        form.elements.locality.value = '';
        loadProperties(1);
        document.querySelector('#results-heading').scrollIntoView({ behavior: 'smooth' });
      }));
    } catch (error) {
      P09.showError(error, '#location-alert');
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    loadProperties(1);
  });
  document.querySelector('#clear-search').addEventListener('click', () => {
    form.reset();
    loadProperties(1);
  });

  loadLocations();
  loadProperties(currentPage);
});

