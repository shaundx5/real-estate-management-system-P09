document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.authPage;
  const form = document.querySelector('#auth-form');
  const button = document.querySelector('#auth-submit');
  const current = P09.getSession();
  if (current) {
    P09.showAlert('#page-alert', `You are already logged in as ${current.user?.name || current.claims.role}.`, 'info');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    document.querySelector('#page-alert').innerHTML = '';
    P09.setBusy(button, true, page === 'login' ? 'Logging in…' : 'Creating account…');
    try {
      if (page === 'register') {
        const body = {
          name: form.elements.name.value,
          email: form.elements.email.value,
          password: form.elements.password.value,
          role: form.elements.role.value
        };
        const { message } = await P09.api('/auth/register', { method: 'POST', body });
        sessionStorage.setItem('p09-flash', message);
        location.assign(`/login.html?email=${encodeURIComponent(body.email)}`);
        return;
      }

      const { data, message } = await P09.api('/auth/login', {
        method: 'POST',
        body: { email: form.elements.email.value, password: form.elements.password.value }
      });
      const session = P09.saveSession(data.token, data.user);
      sessionStorage.setItem('p09-flash', message);
      const next = new URLSearchParams(location.search).get('next');
      const destination = next?.startsWith('/') && !next.startsWith('//') ? next : P09.dashboardPath(session.claims.role);
      location.assign(destination);
    } catch (error) {
      P09.showError(error);
      P09.setBusy(button, false);
    }
  });

  const params = new URLSearchParams(location.search);
  if (form.elements.email && params.get('email')) form.elements.email.value = params.get('email');
});

