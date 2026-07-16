let activeModal = null;

function closeModal() {
  if (!activeModal) return;
  document.removeEventListener('keydown', handleModalKeydown);
  activeModal.overlay.remove();
  activeModal = null;
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') closeModal();
}

function openModal({ title, content, footer, onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', showFooter = true }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h3></h3>
    <button class="modal-close" aria-label="Fechar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;
  header.querySelector('h3').textContent = title || '';
  header.querySelector('.modal-close').addEventListener('click', closeModal);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  if (footer instanceof HTMLElement) {
    modal.appendChild(footer);
  } else if (showFooter) {
    const footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';
    footerEl.innerHTML = `
      <button class="btn btn-ghost" data-action="cancel">${cancelLabel}</button>
      <button class="btn btn-primary" data-action="confirm">${confirmLabel}</button>
    `;
    footerEl.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    footerEl.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      if (onConfirm) onConfirm();
    });
    modal.appendChild(footerEl);
  }

  overlay.appendChild(modal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
  document.addEventListener('keydown', handleModalKeydown);

  activeModal = { overlay, modal };
  return modal;
}
