document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');
  const session = P09.getSession();
  const role = session?.claims.role;
  let property;

  function actionAllowed() {
    return role === 'buyer' || role === 'tenant';
  }

  function renderImages(item) {
    const images = item.images?.length ? item.images : [P09.placeholder(item.title)];
    if (images.length === 1) return `<img class="w-100 rounded shadow-sm detail-image" src="${P09.escape(images[0])}" alt="${P09.escape(item.title)}" onerror="this.onerror=null;this.src='${P09.placeholder(item.title)}'">`;
    return `<div id="imageCarousel" class="carousel slide shadow-sm rounded overflow-hidden"><div class="carousel-inner">${images.map((image, index) => `<div class="carousel-item ${index === 0 ? 'active' : ''}"><img class="d-block w-100 detail-image" src="${P09.escape(image)}" alt="${P09.escape(item.title)} image ${index + 1}" onerror="this.onerror=null;this.src='${P09.placeholder(item.title)}'"></div>`).join('')}</div><button class="carousel-control-prev" type="button" data-bs-target="#imageCarousel" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span><span class="visually-hidden">Previous</span></button><button class="carousel-control-next" type="button" data-bs-target="#imageCarousel" data-bs-slide="next"><span class="carousel-control-next-icon"></span><span class="visually-hidden">Next</span></button></div>`;
  }

  function render(item) {
    document.title = `${item.title} | P09 Estate`;
    document.querySelector('#property-images').innerHTML = renderImages(item);
    document.querySelector('#property-badges').innerHTML = `<span class="badge text-bg-light border">${P09.escape(item.type)}</span>${P09.badge(item.status)}`;
    document.querySelector('#property-title').textContent = item.title;
    document.querySelector('#property-location').textContent = `${item.locality}, ${item.city}`;
    document.querySelector('#property-price').textContent = P09.money(item.price);
    document.querySelector('#property-purpose').textContent = item.listingFor === 'Rent' ? 'Monthly rent' : 'Sale price';
    document.querySelector('#property-bedrooms').textContent = item.bedrooms;
    document.querySelector('#property-type').textContent = item.type;
    document.querySelector('#property-created').textContent = P09.date(item.createdAt).split(',')[0];
    document.querySelector('#property-updated').textContent = P09.date(item.updatedAt).split(',')[0];
    document.querySelector('#property-description').textContent = item.description || 'No description was supplied.';
    document.querySelector('#agent-profile-link').href = `/agent-profile.html?id=${encodeURIComponent(item.agentId)}`;

    const eligible = ['Available', 'Under Negotiation'].includes(item.status);
    if (!actionAllowed() && session) {
      document.querySelector('#save-button').classList.add('d-none');
      document.querySelector('#enquiry-form').classList.add('d-none');
      document.querySelector('#flag-card').classList.add('d-none');
      document.querySelector('#action-note').textContent = `These actions are available to buyer and tenant accounts. You are logged in as ${role}.`;
    } else if (!session) {
      document.querySelector('#action-note').textContent = 'You can submit the form to see the backend authentication check, or log in first.';
      document.querySelector('#flag-card').classList.add('d-none');
    }
    if (!eligible) {
      document.querySelector('#enquiry-message').disabled = true;
      document.querySelector('#enquiry-button').disabled = true;
      document.querySelector('#enquiry-button').textContent = 'Enquiries closed';
    }
    document.querySelector('#property-loading').classList.add('d-none');
    document.querySelector('#property-detail').classList.remove('d-none');
  }

  if (!P09.objectId(id)) {
    document.querySelector('#property-loading').classList.add('d-none');
    P09.showAlert('#page-alert', 'A valid property ID is required.', 'danger', 'VALIDATION_ERROR');
    return;
  }

  try {
    const response = await P09.api(`/properties/${id}`, { auth: false });
    property = response.data.property;
    render(property);
  } catch (error) {
    document.querySelector('#property-loading').classList.add('d-none');
    P09.showError(error);
    return;
  }

  document.querySelector('#save-button').addEventListener('click', async event => {
    P09.setBusy(event.currentTarget, true, 'Saving…');
    try {
      const { message } = await P09.api('/favourites', { method: 'POST', body: { propertyId: property._id } });
      P09.showAlert('#page-alert', message, 'success');
      event.currentTarget.textContent = 'Saved';
      event.currentTarget.disabled = true;
    } catch (error) {
      P09.showError(error);
      P09.setBusy(event.currentTarget, false);
    }
  });

  document.querySelector('#enquiry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#enquiry-button');
    P09.setBusy(button, true, 'Submitting…');
    try {
      const { message } = await P09.api('/enquiries', { method: 'POST', body: { propertyId: property._id, message: document.querySelector('#enquiry-message').value } });
      P09.showAlert('#page-alert', message, 'success');
      event.currentTarget.reset();
    } catch (error) {
      P09.showError(error);
    } finally {
      P09.setBusy(button, false);
    }
  });

  document.querySelector('#flag-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#flag-button');
    P09.setBusy(button, true, 'Submitting…');
    try {
      const { message } = await P09.api(`/properties/${property._id}/flag`, { method: 'POST', body: { reason: document.querySelector('#flag-reason').value } });
      P09.showAlert('#page-alert', message, 'success');
      document.querySelector('#property-detail').classList.add('d-none');
    } catch (error) {
      P09.showError(error);
    } finally {
      P09.setBusy(button, false);
    }
  });
});

