(() => {
  'use strict';

  const APP_STORAGE_KEY = 'a3pilot.maquette.v4';
  const PREVIEW_STORAGE_KEY = 'a3pilot.terrainPreview.v1';
  const PREVIEW_VERSION = '1.0';
  const app = document.getElementById('app');
  if (!app) return;

  let scheduled = false;
  let rendering = false;

  const defaultPrefs = {
    userId: '',
    view: 'missions',
    filter: 'todo',
    selectedId: '',
    search: '',
    notice: ''
  };

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(app, { childList: true, subtree: true });
  document.addEventListener('click', handleClick, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('input', handleInput, true);
  window.addEventListener('resize', scheduleEnhance, { passive: true });
  scheduleEnhance();

  function scheduleEnhance() {
    if (scheduled || rendering) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhancePreview();
    });
  }

  function enhancePreview() {
    const host = app.querySelector('.phone-preview');
    if (!host) return;

    const state = readJSON(APP_STORAGE_KEY, null);
    if (!state?.interventions || !state?.users) return;

    const poseurs = state.users.filter(user => normalize(user.role) === 'poseur');
    if (!poseurs.length) return;

    const prefs = { ...defaultPrefs, ...readJSON(PREVIEW_STORAGE_KEY, {}) };
    if (!poseurs.some(user => user.id === prefs.userId)) prefs.userId = poseurs[0].id;

    const assigned = state.interventions
      .filter(item => (item.teamIds || []).includes(prefs.userId))
      .sort(sortInterventions);

    if (prefs.selectedId && !assigned.some(item => item.id === prefs.selectedId)) {
      prefs.selectedId = '';
      if (prefs.view === 'detail') prefs.view = 'missions';
    }

    const signature = createSignature(state, prefs, assigned);
    if (host.dataset.terrainSignature === signature) return;

    rendering = true;
    host.dataset.terrainSignature = signature;
    host.dataset.terrainEnhanced = PREVIEW_VERSION;
    host.innerHTML = renderPreview(state, poseurs, assigned, prefs);
    savePrefs(prefs);
    rendering = false;
  }

  function renderPreview(state, poseurs, assigned, prefs) {
    const poseur = poseurs.find(user => user.id === prefs.userId) || poseurs[0];
    const selected = assigned.find(item => item.id === prefs.selectedId) || null;
    const today = isoToday();
    const todayCount = assigned.filter(item => item.date === today && item.status !== 'completed').length;
    const pendingCount = assigned.filter(item => item.status !== 'completed').length;

    return `<div class="terrain-preview__heading">
      <div><span class="eyebrow">Simulation interactive</span><h2>Vue PWA poseur</h2><p>Sélectionnez un poseur et utilisez son espace terrain comme sur mobile.</p></div>
      <span class="terrain-preview__live"><span></span>Données locales</span>
    </div>
    <div class="terrain-phone" role="application" aria-label="Aperçu interactif de la PWA terrain">
      <div class="terrain-phone__status"><span>${currentTime()}</span><span class="terrain-phone__status-icons"><i></i><i></i><i></i></span></div>
      <header class="terrain-appbar">
        <div class="terrain-appbar__brand"><span class="brand__mark brand__mark--small">A3</span><span><strong>Terrain</strong><small>${pendingCount} mission${pendingCount > 1 ? 's' : ''} à traiter</small></span></div>
        <label class="terrain-user-select" aria-label="Poseur simulé">
          <span class="avatar avatar--small">${escapeHTML(poseur.initials || initials(poseur.name))}</span>
          <select data-terrain-action="select-user">${poseurs.map(user => `<option value="${escapeHTML(user.id)}" ${user.id === poseur.id ? 'selected' : ''}>${escapeHTML(user.name)}</option>`).join('')}</select>
          ${svg('chevron-down')}
        </label>
      </header>
      <main class="terrain-screen">
        ${prefs.notice ? `<button class="terrain-notice" type="button" data-terrain-action="dismiss-notice">${svg('check')}<span>${escapeHTML(prefs.notice)}</span>${svg('close')}</button>` : ''}
        ${prefs.view === 'detail' && selected ? renderDetail(state, selected, prefs) : prefs.view === 'agenda' ? renderAgenda(state, assigned, prefs, todayCount) : prefs.view === 'profile' ? renderProfile(poseur, assigned) : renderMissionList(state, assigned, prefs, todayCount)}
      </main>
      ${renderBottomNav(prefs.view)}
    </div>`;
  }

  function renderMissionList(state, assigned, prefs, todayCount) {
    const filtered = filterMissions(assigned, prefs);
    return `<section class="terrain-view terrain-view--missions">
      <div class="terrain-welcome"><div><span>${longDate(new Date())}</span><h3>Mes interventions</h3></div><span class="terrain-count-badge">${todayCount} aujourd’hui</span></div>
      <label class="terrain-search">${svg('search')}<input type="search" data-terrain-search value="${escapeHTML(prefs.search)}" placeholder="Rechercher une mission, un chantier…"><button type="button" data-terrain-action="clear-search" aria-label="Effacer" ${prefs.search ? '' : 'hidden'}>${svg('close')}</button></label>
      <div class="terrain-filters" role="tablist" aria-label="Filtrer les interventions">
        ${filterButton('todo', 'À faire', prefs.filter, assigned.filter(item => item.status !== 'completed').length)}
        ${filterButton('today', 'Aujourd’hui', prefs.filter, assigned.filter(item => item.date === isoToday()).length)}
        ${filterButton('completed', 'Terminées', prefs.filter, assigned.filter(item => item.status === 'completed').length)}
        ${filterButton('all', 'Toutes', prefs.filter, assigned.length)}
      </div>
      <div class="terrain-mission-list">${filtered.length ? filtered.map(item => missionCard(state, item)).join('') : terrainEmpty('calendar', 'Aucune intervention', prefs.search ? 'Aucun résultat ne correspond à la recherche.' : 'Aucune mission dans cette catégorie.')}</div>
    </section>`;
  }

  function missionCard(state, item) {
    const affaire = getAffaire(state, item.affairId);
    const checks = item.checklist || [];
    const done = checks.filter(check => check.done).length;
    const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
    const overdue = item.date && item.date < isoToday() && item.status !== 'completed';
    return `<button type="button" class="terrain-mission-card ${item.status === 'in_progress' ? 'is-current' : ''}" data-terrain-action="open-mission" data-id="${escapeHTML(item.id)}">
      <span class="terrain-date-tile ${overdue ? 'is-overdue' : ''}"><strong>${item.date ? formatDate(item.date, { day: '2-digit' }) : '—'}</strong><small>${item.date ? formatDate(item.date, { month: 'short' }) : 'Date'}</small></span>
      <span class="terrain-mission-card__copy"><span class="terrain-mission-card__top"><span class="terrain-status terrain-status--${statusTone(item.status)}">${statusLabel(item.status)}</span><small>${escapeHTML(item.start || '')}${item.end ? `–${escapeHTML(item.end)}` : ''}</small></span><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(affaire?.name || 'Affaire non renseignée')}</span><small>${svg('map-pin')}${escapeHTML(affaire?.city || item.address || 'Lieu à préciser')}</small><span class="terrain-card-progress"><i><b style="width:${progress}%"></b></i><em>${done}/${checks.length} contrôles</em></span></span>
      ${svg('chevron-right')}
    </button>`;
  }

  function renderDetail(state, item) {
    const affaire = getAffaire(state, item.affairId);
    const reperes = (item.repereIds || []).map(id => state.reperes?.find(repere => repere.id === id)).filter(Boolean);
    const checks = item.checklist || [];
    const done = checks.filter(check => check.done).length;
    const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
    const canStart = ['planned', 'confirmed'].includes(item.status);
    const canComplete = item.status === 'in_progress';

    return `<section class="terrain-view terrain-view--detail">
      <div class="terrain-detail-nav"><button type="button" data-terrain-action="back-to-missions">${svg('chevron-left')}<span>Mes interventions</span></button><span class="terrain-status terrain-status--${statusTone(item.status)}">${statusLabel(item.status)}</span></div>
      <div class="terrain-detail-hero"><span class="eyebrow">${item.date ? longDate(new Date(`${item.date}T12:00:00`)) : 'Date à planifier'}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(affaire?.name || '')}</p><div class="terrain-detail-time"><strong>${escapeHTML(item.start || '—')}–${escapeHTML(item.end || '—')}</strong><span>${escapeHTML(affaire?.city || '')}</span></div></div>
      <div class="terrain-quick-actions"><button type="button" data-terrain-action="route" data-id="${escapeHTML(item.id)}">${svg('map-pin')}<span><strong>Itinéraire</strong><small>${escapeHTML(item.address || affaire?.address || 'Adresse à préciser')}</small></span>${svg('chevron-right')}</button><button type="button" data-terrain-action="contact">${svg('user')}<span><strong>Contact chantier</strong><small>${escapeHTML(affaire?.name || 'Non renseigné')}</small></span>${svg('chevron-right')}</button></div>
      ${reperes.length ? `<div class="terrain-section"><div class="terrain-section__head"><div><strong>Ouvrages concernés</strong><small>${reperes.length} repère${reperes.length > 1 ? 's' : ''}</small></div></div><div class="terrain-repere-list">${reperes.map(repere => `<span><strong>${escapeHTML(repere.code)}</strong><small>${escapeHTML(repere.zone || '')}</small></span>`).join('')}</div></div>` : ''}
      <div class="terrain-section"><div class="terrain-section__head"><div><strong>Check-list terrain</strong><small>${done} élément${done > 1 ? 's' : ''} validé${done > 1 ? 's' : ''} sur ${checks.length}</small></div><span>${progress}%</span></div><div class="terrain-progress"><span style="width:${progress}%"></span></div><div class="terrain-checklist">${checks.length ? checks.map(check => `<button type="button" data-action="toggle-checklist" data-intervention="${escapeHTML(item.id)}" data-check="${escapeHTML(check.id)}" class="terrain-check ${check.done ? 'is-done' : ''}"><span>${check.done ? svg('check') : ''}</span><strong>${escapeHTML(check.label)}</strong></button>`).join('') : '<p class="terrain-muted">Aucun contrôle défini pour cette intervention.</p>'}</div></div>
      ${item.notes ? `<div class="terrain-section terrain-instructions"><strong>Consignes</strong><p>${escapeHTML(item.notes)}</p></div>` : ''}
      <div class="terrain-detail-actions">${canStart ? `<button class="primary-button primary-button--full" data-action="start-intervention" data-id="${escapeHTML(item.id)}">${svg('tools')}Démarrer l’intervention</button>` : ''}${canComplete ? `<button class="primary-button primary-button--full" data-action="complete-intervention" data-id="${escapeHTML(item.id)}">${svg('check')}Terminer l’intervention</button>` : ''}${item.status === 'completed' ? `<div class="terrain-complete-state">${svg('check')}<span><strong>Intervention terminée</strong><small>Les informations sont enregistrées localement.</small></span></div>` : ''}</div>
    </section>`;
  }

  function renderAgenda(state, assigned, prefs, todayCount) {
    const groups = groupByDate(assigned.filter(item => item.date));
    return `<section class="terrain-view terrain-view--agenda"><div class="terrain-welcome"><div><span>Planning personnel</span><h3>Mon agenda</h3></div><span class="terrain-count-badge">${todayCount} aujourd’hui</span></div><div class="terrain-agenda">${groups.length ? groups.map(group => `<section><header><strong>${group.label}</strong><span>${group.items.length}</span></header>${group.items.map(item => agendaRow(state, item)).join('')}</section>`).join('') : terrainEmpty('calendar', 'Agenda vide', 'Aucune intervention datée pour ce poseur.')}</div></section>`;
  }

  function agendaRow(state, item) {
    const affaire = getAffaire(state, item.affairId);
    return `<button type="button" data-terrain-action="open-mission" data-id="${escapeHTML(item.id)}"><time>${escapeHTML(item.start || '—')}</time><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(affaire?.name || '')} · ${escapeHTML(affaire?.city || '')}</small></span><span class="terrain-status terrain-status--${statusTone(item.status)}">${statusLabel(item.status)}</span></button>`;
  }

  function renderProfile(poseur, assigned) {
    const completed = assigned.filter(item => item.status === 'completed').length;
    const checks = assigned.flatMap(item => item.checklist || []);
    const checked = checks.filter(item => item.done).length;
    return `<section class="terrain-view terrain-view--profile"><div class="terrain-profile"><span class="terrain-profile__avatar">${escapeHTML(poseur.initials || initials(poseur.name))}</span><h3>${escapeHTML(poseur.name)}</h3><p>Poseur · Groupe A3</p><span class="terrain-sync-state"><i></i>Synchronisé avec les données locales</span></div><div class="terrain-profile-stats"><div><strong>${assigned.length}</strong><span>Interventions</span></div><div><strong>${completed}</strong><span>Terminées</span></div><div><strong>${checked}/${checks.length}</strong><span>Contrôles</span></div></div><div class="terrain-profile-menu"><button type="button" data-terrain-action="notice" data-notice="Les données terrain sont déjà synchronisées.">${svg('refresh')}<span><strong>Synchroniser maintenant</strong><small>Dernière synchronisation à l’instant</small></span>${svg('chevron-right')}</button><button type="button" data-terrain-action="notice" data-notice="Le mode hors connexion est actif dans cette simulation.">${svg('mobile')}<span><strong>Mode hors connexion</strong><small>Les saisies restent disponibles sans réseau</small></span>${svg('chevron-right')}</button></div></section>`;
  }

  function renderBottomNav(view) {
    const active = view === 'detail' ? 'missions' : view;
    return `<nav class="terrain-bottom-nav" aria-label="Navigation PWA terrain"><button type="button" class="${active === 'missions' ? 'is-active' : ''}" data-terrain-action="set-view" data-view="missions">${svg('tools')}<span>Missions</span></button><button type="button" class="${active === 'agenda' ? 'is-active' : ''}" data-terrain-action="set-view" data-view="agenda">${svg('calendar')}<span>Agenda</span></button><button type="button" class="${active === 'profile' ? 'is-active' : ''}" data-terrain-action="set-view" data-view="profile">${svg('user')}<span>Profil</span></button></nav>`;
  }

  function handleClick(event) {
    const target = event.target.closest('[data-terrain-action]');
    if (!target || !target.closest('.phone-preview')) return;

    event.preventDefault();
    event.stopPropagation();

    const prefs = { ...defaultPrefs, ...readJSON(PREVIEW_STORAGE_KEY, {}) };
    const action = target.dataset.terrainAction;

    if (action === 'open-mission') {
      prefs.selectedId = target.dataset.id || '';
      prefs.view = 'detail';
    } else if (action === 'back-to-missions') {
      prefs.view = 'missions';
    } else if (action === 'set-view') {
      prefs.view = target.dataset.view || 'missions';
      if (prefs.view !== 'detail') prefs.selectedId = prefs.selectedId || '';
    } else if (action === 'set-filter') {
      prefs.filter = target.dataset.filter || 'todo';
    } else if (action === 'clear-search') {
      prefs.search = '';
    } else if (action === 'route') {
      prefs.notice = 'Itinéraire préparé dans la simulation terrain.';
    } else if (action === 'contact') {
      prefs.notice = 'Fiche contact chantier ouverte dans la simulation.';
    } else if (action === 'notice') {
      prefs.notice = target.dataset.notice || 'Action simulée.';
    } else if (action === 'dismiss-notice') {
      prefs.notice = '';
    }

    savePrefs(prefs);
    forceEnhance();
  }

  function handleChange(event) {
    const select = event.target.closest('[data-terrain-action="select-user"]');
    if (!select || !select.closest('.phone-preview')) return;
    event.stopPropagation();
    const prefs = { ...defaultPrefs, ...readJSON(PREVIEW_STORAGE_KEY, {}) };
    prefs.userId = select.value;
    prefs.selectedId = '';
    prefs.view = 'missions';
    savePrefs(prefs);
    forceEnhance();
  }

  function handleInput(event) {
    const input = event.target.closest('[data-terrain-search]');
    if (!input || !input.closest('.phone-preview')) return;
    event.stopPropagation();
    const prefs = { ...defaultPrefs, ...readJSON(PREVIEW_STORAGE_KEY, {}) };
    prefs.search = input.value;
    savePrefs(prefs);
    forceEnhance({ preserveFocus: true });
  }

  function forceEnhance(options = {}) {
    const host = app.querySelector('.phone-preview');
    if (host) delete host.dataset.terrainSignature;
    enhancePreview();
    if (options.preserveFocus) {
      requestAnimationFrame(() => {
        const input = app.querySelector('[data-terrain-search]');
        if (input) {
          input.focus({ preventScroll: true });
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }
  }

  function filterMissions(items, prefs) {
    const query = normalize(prefs.search);
    return items.filter(item => {
      if (prefs.filter === 'todo' && item.status === 'completed') return false;
      if (prefs.filter === 'today' && item.date !== isoToday()) return false;
      if (prefs.filter === 'completed' && item.status !== 'completed') return false;
      if (!query) return true;
      const state = readJSON(APP_STORAGE_KEY, {});
      const affaire = getAffaire(state, item.affairId);
      return normalize([item.title, item.type, item.address, affaire?.name, affaire?.city].join(' ')).includes(query);
    });
  }

  function filterButton(value, label, active, count) {
    return `<button type="button" role="tab" aria-selected="${value === active}" class="${value === active ? 'is-active' : ''}" data-terrain-action="set-filter" data-filter="${value}"><span>${escapeHTML(label)}</span><small>${count}</small></button>`;
  }

  function groupByDate(items) {
    const map = new Map();
    items.forEach(item => {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, grouped]) => ({ date, label: date === isoToday() ? 'Aujourd’hui' : longDate(new Date(`${date}T12:00:00`)), items: grouped.sort(sortInterventions) }));
  }

  function terrainEmpty(icon, title, text) {
    return `<div class="terrain-empty">${svg(icon)}<strong>${escapeHTML(title)}</strong><p>${escapeHTML(text)}</p></div>`;
  }

  function createSignature(state, prefs, assigned) {
    return JSON.stringify({
      version: PREVIEW_VERSION,
      prefs,
      assigned: assigned.map(item => [item.id, item.status, item.date, item.start, item.end, item.title, item.teamIds, (item.checklist || []).map(check => [check.id, check.done])]),
      users: state.users.map(user => [user.id, user.name, user.initials, user.role]),
      affairs: state.affaires?.map(item => [item.id, item.name, item.city, item.address]),
      reperes: state.reperes?.map(item => [item.id, item.code, item.zone])
    });
  }

  function sortInterventions(a, b) {
    return `${a.date || '9999-12-31'} ${a.start || '99:99'}`.localeCompare(`${b.date || '9999-12-31'} ${b.start || '99:99'}`);
  }

  function getAffaire(state, id) {
    return state.affaires?.find(item => item.id === id) || null;
  }

  function statusLabel(status) {
    return ({ unassigned: 'À affecter', planned: 'Planifiée', confirmed: 'Confirmée', in_progress: 'En cours', completed: 'Terminée' })[status] || 'Planifiée';
  }

  function statusTone(status) {
    return ({ unassigned: 'neutral', planned: 'info', confirmed: 'success', in_progress: 'warning', completed: 'success' })[status] || 'neutral';
  }

  function formatDate(value, options) {
    if (!value) return '';
    return new Intl.DateTimeFormat('fr-FR', options).format(new Date(`${value}T12:00:00`));
  }

  function longDate(date) {
    const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function currentTime() {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  }

  function isoToday() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function initials(value) {
    return String(value || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function svg(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
  }

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(prefs));
  }
})();
