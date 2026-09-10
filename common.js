window.P09 = (() => {
  const storageKey = 'p09-session';

  class ApiError extends Error {
    constructor(message, errorCode = 'REQUEST_FAILED', status = 0) {
      super(message);
      this.name = 'ApiError';
      this.errorCode = errorCode;
      this.status = status;
    }
  }

  function decodeToken(token) {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return JSON.parse(decodeURIComponent(atob(padded).split('').map(char =>
        `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
    } catch {
      return null;
    }
  }

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(storageKey));
      const claims = session?.token ? decodeToken(session.token) : null;
      if (!claims?.role || !claims?.exp || claims.exp * 1000 <= Date.now()) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return { ...session, claims };
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  function saveSession(token, user) {
    const claims = decodeToken(token);
    if (!claims?.role) throw new ApiError('The server returned an unreadable token.', 'INVALID_TOKEN');
    localStorage.setItem(storageKey, JSON.stringify({ token, user }));
    return { token, user, claims };
  }

  function clearSession() {
    localStorage.removeItem(storageKey);
  }

  function dashboardPath(role = getSession()?.claims.role) {
    if (role === 'agent') return '/agent-dashboard.html';
    if (role === 'admin') return '/admin-dashboard.html';
    if (role === 'buyer' || role === 'tenant') return '/buyer-dashboard.html';
    return '/index.html';
  }

  async function api(pathname, options = {}) {
    const { method = 'GET', body, signal, auth = true } = options;
    const session = getSession();
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;

    let response;
    try {
      response = await fetch(`/api${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal
      });
    } catch {
      throw new ApiError('Could not contact the application server.', 'NETWORK_ERROR');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('The server returned an invalid response.', 'INVALID_RESPONSE', response.status);
    }

    if (!response.ok || payload.success !== true) {
      if (response.status === 401 && session) clearSession();
      throw new ApiError(payload.message || 'Request failed.', payload.errorCode || 'REQUEST_FAILED', response.status);
    }
    return { data: payload.data, message: payload.message, status: response.status };
  }

  function escape(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function showAlert(target, message, type = 'danger', errorCode = '') {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;
    const code = errorCode ? `<span class="alert-code">${escape(errorCode)}</span>` : '';
    container.innerHTML = `<div class="alert alert-${escape(type)} alert-dismissible fade show" role="alert">
      <div>${escape(message)} ${code}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showError(error, target = '#page-alert') {
    showAlert(target, error?.message || 'Request failed.', 'danger', error?.errorCode || 'REQUEST_FAILED');
  }

  function setBusy(button, busy, busyText = 'Working…') {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escape(busyText)}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
    }
  }

  function statusClass(status) {
    return ({
      Available: 'success',
      'Under Negotiation': 'warning text-dark',
      Sold: 'secondary',
      Rented: 'secondary',
      New: 'primary',
      'In Progress': 'warning text-dark',
      Approved: 'success',
      Rejected: 'danger',
      Closed: 'secondary',
      Pending: 'warning text-dark',
      Verified: 'success'
    })[status] || 'secondary';
  }

  function badge(status) {
    return `<span class="badge bg-${statusClass(status)}">${escape(status)}</span>`;
  }

  function verificationBadge(property) {
    if (property.isFlagged) return '<span class="badge bg-danger">Flagged</span>';
    return badge(property.reviewStatus || (property.isVerified ? 'Verified' : 'Pending'));
  }

  function money(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function date(value) {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date(value));
  }

  function pagination(container, paginationData, onPage) {
    const element = typeof container === 'string' ? document.querySelector(container) : container;
    if (!element) return;
    const { page = 1, pages = 0, total = 0 } = paginationData || {};
    if (!pages) {
      element.innerHTML = '';
      return;
    }
    element.innerHTML = `<div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <span class="small text-secondary">Page ${page} of ${pages} · ${total} records</span>
      <div class="btn-group" role="group" aria-label="Pagination">
        <button class="btn btn-outline-secondary btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <button class="btn btn-outline-secondary btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
      </div>
    </div>`;
    element.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => onPage(Number(button.dataset.page))));
  }

  function placeholder(title = 'Property') {
    const safeTitle = escape(title).slice(0, 40);
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><rect width="900" height="560" fill="#e9ecef"/><path d="M250 305 450 145l200 160v150H510V335H390v120H250Z" fill="#adb5bd"/><text x="450" y="510" text-anchor="middle" font-family="Arial" font-size="30" fill="#495057">${safeTitle}</text></svg>`)}`;
  }

  function propertyCard(property, extra = '') {
    const image = property.images?.[0] || placeholder(property.title);
    return `<article class="card property-card h-100 shadow-sm">
      <img src="${escape(image)}" class="card-img-top property-image" alt="${escape(property.title)}" onerror="this.onerror=null;this.src='${placeholder(property.title)}'">
      <div class="card-body d-flex flex-column">
        <div class="d-flex justify-content-between gap-2 align-items-start mb-2">
          <span class="badge text-bg-light border">${escape(property.type)}</span>
          ${badge(property.status)}
        </div>
        <h2 class="h5 card-title">${escape(property.title)}</h2>
        <p class="text-secondary small mb-2">${escape(property.locality)}, ${escape(property.city)}</p>
        <p class="h5 mb-2">${money(property.price)} <span class="fs-6 fw-normal text-secondary">${property.listingFor === 'Rent' ? '/ month' : ''}</span></p>
        <p class="small text-secondary mb-3">${escape(property.listingFor)} · ${escape(property.bedrooms)} bedroom${Number(property.bedrooms) === 1 ? '' : 's'}</p>
        <div class="mt-auto d-flex gap-2 flex-wrap">
          <a class="btn btn-dark btn-sm" href="/property.html?id=${encodeURIComponent(property._id)}">View details</a>
          ${extra}
        </div>
      </div>
    </article>`;
  }

  function initNavbar() {
    const host = document.querySelector('#app-navbar');
    if (!host) return;
    const session = getSession();
    const role = session?.claims.role;
    const dashboard = dashboardPath(role);
    host.innerHTML = `<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top" aria-label="Main navigation">
      <div class="container">
        <a class="navbar-brand fw-bold" href="/index.html">P09 Estate</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="mainNav">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item"><a class="nav-link" href="/index.html">Properties</a></li>
            ${session ? `<li class="nav-item"><a class="nav-link" href="${dashboard}">Dashboard</a></li>` : ''}
          </ul>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            ${session ? `<span class="small text-secondary me-1">${escape(session.user?.name || 'Signed in')} · ${escape(role)}</span><button id="logout-button" class="btn btn-outline-dark btn-sm">Log out</button>` : '<a class="btn btn-outline-dark btn-sm" href="/login.html">Log in</a><a class="btn btn-dark btn-sm" href="/register.html">Register</a>'}
          </div>
        </div>
      </div>
    </nav>`;
    host.querySelector('#logout-button')?.addEventListener('click', () => {
      clearSession();
      location.assign('/index.html');
    });
  }

  function requireRole(...roles) {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      location.replace(`/login.html?next=${next}`);
      return null;
    }
    if (!roles.includes(session.claims.role)) {
      sessionStorage.setItem('p09-flash', 'That dashboard is not available for your account role.');
      location.replace(dashboardPath(session.claims.role));
      return null;
    }
    return session;
  }

  function consumeFlash(target = '#page-alert') {
    const message = sessionStorage.getItem('p09-flash');
    if (message) {
      sessionStorage.removeItem('p09-flash');
      showAlert(target, message, 'warning');
    }
  }

  function objectId(value) {
    return /^[a-f\d]{24}$/i.test(value || '');
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    consumeFlash();
  });

  return {
    ApiError, api, getSession, saveSession, clearSession, dashboardPath,
    escape, showAlert, showError, setBusy, badge, verificationBadge,
    money, date, pagination, placeholder, propertyCard, initNavbar,
    requireRole, objectId
  };
})();
