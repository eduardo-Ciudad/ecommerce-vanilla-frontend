const BLING_SYNC_POLL_INTERVAL_MS = 10000;

const BLING_SYNC_STATUS = {
  RUNNING: { label: 'Em andamento', badgeClass: 'badge-pending' },
  SUCCESS: { label: 'Concluída', badgeClass: 'badge-paid' },
  FAILED: { label: 'Falhou', badgeClass: 'badge-cancelled' },
};

const BLING_SYNC_STEPS = {
  CATEGORIES: 'Sincronizando categorias',
  PRODUCTS: 'Sincronizando produtos',
  RECONCILE: 'Conferindo produtos removidos',
  DONE: 'Finalizada',
};

const BLING_EVENT_KINDS = {
  VARIANT: 'Variação',
  STANDALONE: 'Produto simples',
};

const BLING_EVENT_OUTCOMES = {
  SYNCED: { label: 'Sincronizado', badgeClass: 'badge-paid' },
  SKIPPED: { label: 'Pulado', badgeClass: 'badge-pending' },
  FAILED: { label: 'Erro', badgeClass: 'badge-cancelled' },
};

let blingSyncStatus = null;
let blingSyncPollTimer = null;
let blingSyncPollInFlight = false;
let blingSyncPostInFlight = false;
let blingSyncElapsedTimer = null;

function parseBlingLocalDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBlingDateTime(value) {
  const date = parseBlingLocalDate(value);
  if (!date) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBlingEventTime(value) {
  const date = parseBlingLocalDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatElapsedTime(startedAt) {
  const start = parseBlingLocalDate(startedAt);
  if (!start) return '—';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function renderBlingCounter(label, value) {
  return `<div class="bling-sync-counter"><strong>${safeCount(value).toLocaleString('pt-BR')}</strong><span>${label}</span></div>`;
}

function renderBlingEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return '<li class="bling-sync-events-empty">Nenhum item processado até o momento.</li>';
  }

  return events.map((event) => {
    const outcome = BLING_EVENT_OUTCOMES[event.outcome] || BLING_EVENT_OUTCOMES.FAILED;
    return `
      <li class="bling-sync-event">
        <time datetime="${escapeAttr(event.at || '')}">${formatBlingEventTime(event.at)}</time>
        <span class="bling-sync-event-name" title="${escapeAttr(event.name || '')}">${escapeHtml(event.name || 'Item sem nome')}</span>
        <span class="bling-sync-event-kind">${BLING_EVENT_KINDS[event.kind] || 'Item'}</span>
        <span class="badge ${outcome.badgeClass}">${outcome.label}</span>
      </li>
    `;
  }).join('');
}

function updateBlingSyncButton() {
  const button = document.querySelector('[data-bling-sync-button]');
  const running = blingSyncStatus?.status === 'RUNNING';
  button.disabled = running || blingSyncPostInFlight;
  button.textContent = running || blingSyncPostInFlight ? 'Sincronizando...' : 'Sincronizar com Bling';
}

function updateElapsedTime() {
  const elapsed = document.querySelector('[data-bling-elapsed]');
  if (elapsed && blingSyncStatus?.status === 'RUNNING') {
    elapsed.textContent = formatElapsedTime(blingSyncStatus.startedAt);
  }
}

function syncElapsedTimer() {
  clearInterval(blingSyncElapsedTimer);
  blingSyncElapsedTimer = null;
  if (blingSyncStatus?.status === 'RUNNING') {
    blingSyncElapsedTimer = setInterval(updateElapsedTime, 1000);
  }
}

function renderBlingEmptyState() {
  const content = document.querySelector('[data-bling-sync-content]');
  content.setAttribute('aria-busy', 'false');
  content.innerHTML = `
    <div class="bling-sync-card bling-sync-empty">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7h-7V2"/><path d="M20 7l-4-4a9 9 0 10-1 15.5"/><path d="M16 14h5v5"/><path d="M21 14l-3.5 3.5"/></svg>
      <h2>Nenhuma sincronização realizada ainda</h2>
      <p>Inicie a primeira sincronização completa para importar os dados do Bling.</p>
    </div>
  `;
  document.querySelector('[data-bling-running-note]').hidden = true;
  updateBlingSyncButton();
  syncElapsedTimer();
}

function renderBlingStatus(status) {
  blingSyncStatus = status;
  const content = document.querySelector('[data-bling-sync-content]');
  const statusDetails = BLING_SYNC_STATUS[status.status] || BLING_SYNC_STATUS.FAILED;
  const totalItems = safeCount(status.totalItems);
  const processedItems = safeCount(status.processedItems);
  const percentage = totalItems ? Math.min(100, Math.round((processedItems / totalItems) * 100)) : 0;
  const running = status.status === 'RUNNING';
  const progressMarkup = totalItems
    ? `<div class="bling-sync-progress-track"><span style="width:${percentage}%"></span></div><div class="bling-sync-progress-label"><span>${processedItems.toLocaleString('pt-BR')} de ${totalItems.toLocaleString('pt-BR')} itens</span><strong>${percentage}%</strong></div>`
    : '<div class="bling-sync-progress-track is-indeterminate"><span></span></div><div class="bling-sync-progress-label"><span>Preparando...</span></div>';

  content.setAttribute('aria-busy', 'false');
  content.innerHTML = `
    <section class="bling-sync-card" aria-labelledby="bling-sync-status-title">
      <div class="bling-sync-card-header">
        <div><span class="bling-sync-eyebrow">Status atual</span><h2 id="bling-sync-status-title">${BLING_SYNC_STEPS[status.step] || 'Sincronização Bling'}</h2></div>
        <span class="badge ${statusDetails.badgeClass}">${statusDetails.label}</span>
      </div>
      <div class="bling-sync-dates">
        <div><span>Início</span><strong>${formatBlingDateTime(status.startedAt)}</strong></div>
        <div><span>${running ? 'Tempo decorrido' : 'Fim'}</span><strong${running ? ' data-bling-elapsed' : ''}>${running ? formatElapsedTime(status.startedAt) : formatBlingDateTime(status.finishedAt)}</strong></div>
      </div>
      <div class="bling-sync-progress">${progressMarkup}</div>
      <div class="bling-sync-counters">
        ${renderBlingCounter('Categorias', status.categoriesSynced)}
        ${renderBlingCounter('Variações sincronizadas', status.variantsSynced)}
        ${renderBlingCounter('Variações puladas', status.variantsSkipped)}
        ${renderBlingCounter('Produtos simples sincronizados', status.standaloneSynced)}
        ${renderBlingCounter('Produtos simples pulados', status.standaloneSkipped)}
        ${renderBlingCounter('Produtos desativados', status.deactivated)}
      </div>
      <p class="bling-sync-counter-note">Pulados inclui itens com erro.</p>
      ${status.status === 'FAILED' ? `<div class="bling-sync-error" role="alert"><strong>Falha em ${BLING_SYNC_STEPS[status.step] || 'etapa desconhecida'}</strong><p>${escapeHtml(status.errorMessage || 'A sincronização foi interrompida por um erro não informado.')}</p></div>` : ''}
    </section>
    <section class="bling-sync-card" aria-labelledby="bling-sync-events-title">
      <div class="bling-sync-card-header"><div><span class="bling-sync-eyebrow">Atividade</span><h2 id="bling-sync-events-title">Últimos itens processados</h2></div></div>
      <ul class="bling-sync-events">${renderBlingEvents(status.recentEvents)}</ul>
    </section>
  `;

  document.querySelector('[data-bling-running-note]').hidden = !running;
  updateBlingSyncButton();
  syncElapsedTimer();
}

function clearBlingPollTimer() {
  clearTimeout(blingSyncPollTimer);
  blingSyncPollTimer = null;
}

function scheduleBlingPoll() {
  clearBlingPollTimer();
  if (blingSyncStatus?.status !== 'RUNNING' || document.hidden) return;
  blingSyncPollTimer = setTimeout(pollBlingStatus, BLING_SYNC_POLL_INTERVAL_MS);
}

async function pollBlingStatus() {
  if (blingSyncPollInFlight || document.hidden || blingSyncStatus?.status !== 'RUNNING') return;
  blingSyncPollInFlight = true;
  try {
    const status = await apiGet('/bling/sync/status');
    document.querySelector('[data-bling-poll-warning]').hidden = true;
    if (status) renderBlingStatus(status);
  } catch (error) {
    document.querySelector('[data-bling-poll-warning]').hidden = false;
    logAppError('admin.bling_sync.poll', error);
  } finally {
    blingSyncPollInFlight = false;
    scheduleBlingPoll();
  }
}

async function startBlingSync() {
  blingSyncPostInFlight = true;
  updateBlingSyncButton();
  try {
    const status = await apiPost('/bling/sync/full', {});
    if (status) renderBlingStatus(status);
    document.querySelector('[data-bling-poll-warning]').hidden = true;
    scheduleBlingPoll();
  } catch (error) {
    showToast(error.message || 'Não foi possível iniciar a sincronização', 'error');
    if (error.status === 409) {
      await loadBlingStatus();
    }
  } finally {
    blingSyncPostInFlight = false;
    updateBlingSyncButton();
  }
}

function confirmBlingSync() {
  openModal({
    title: 'Sincronizar com Bling',
    content: '<p>A sincronização completa leva entre 1h30 e 2h. Deseja iniciar?</p>',
    confirmLabel: 'Iniciar sincronização',
    onConfirm: () => {
      closeModal();
      startBlingSync();
    },
  });
}

async function loadBlingStatus() {
  try {
    const status = await apiGet('/bling/sync/status');
    document.querySelector('[data-bling-poll-warning]').hidden = true;
    if (status) {
      renderBlingStatus(status);
      scheduleBlingPoll();
    } else {
      blingSyncStatus = null;
      renderBlingEmptyState();
    }
  } catch (error) {
    document.querySelector('[data-bling-sync-content]').innerHTML = '<div class="bling-sync-card"><div class="empty-state">Não foi possível carregar o status da sincronização.</div></div>';
    document.querySelector('[data-bling-sync-content]').setAttribute('aria-busy', 'false');
    showToast(error.message || 'Erro ao carregar a sincronização', 'error');
    updateBlingSyncButton();
  }
}

function handleBlingVisibilityChange() {
  if (document.hidden) {
    clearBlingPollTimer();
    return;
  }
  if (blingSyncStatus?.status === 'RUNNING') pollBlingStatus();
}

async function initBlingSyncPage() {
  if (!requireAdmin()) return;
  document.querySelector('[data-bling-sync-button]').addEventListener('click', confirmBlingSync);
  document.addEventListener('visibilitychange', handleBlingVisibilityChange);
  await loadBlingStatus();
}

document.addEventListener('DOMContentLoaded', initBlingSyncPage);
