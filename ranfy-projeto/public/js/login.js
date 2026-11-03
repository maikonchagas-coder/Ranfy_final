(() => {
  const form = document.getElementById('login-form');
  const input = document.getElementById('participant-name');
  if (!form || !input) return;
  const saved = localStorage.getItem('ranfy_nome');
  if (saved) input.value = saved;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { input.setCustomValidity('Digite um nome com pelo menos 2 caracteres.'); input.reportValidity(); return; }
    input.setCustomValidity('');
    localStorage.setItem('ranfy_nome', name.slice(0, 80));
    location.href = 'index.html';
  });
})();
