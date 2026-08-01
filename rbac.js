(() => {
  'use strict';

  const STORAGE_KEY = 'a3pilot.maquette.v4';
  const ROLE_RULES = {
    direction: { userId: 'usr_remy', defaultPage: 'dashboard', pages: ['dashboard','affaires','reperes','planning','interventions','workflows','documents','settings'] },
    conducteur: { userId: 'usr_marc', defaultPage: 'affaires', pages: ['affaires','reperes','planning','interventions','documents','settings'] },
    planification: { userId: 'usr_sarah', defaultPage: 'planning', pages: ['planning','interventions','reperes','settings'] },
    poseur: { userId: 'usr_nico', defaultPage: 'interventions', pages: ['interventions','reperes','settings'] },
    etudes: { userId: 'usr_lucas', defaultPage: 'reperes', pages: ['affaires','reperes','documents','settings'] }
  };

  let applying = false;
  let scheduled = false;
  let roleSwitching = false;

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  };

  const writeState = state => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* Maquette locale uniquement. */ }
  };

  const roleOf = state => ROLE_RULES[state?.settings?.role] ? state.settings.role : 'direction';
  const ruleOf = state => ROLE_RULES[roleOf(state)];
  const currentCompanyId = state => state?.settings?.companyId || state?.companies?.[0]?.id || '';
  const companyAffaires = (state, companyId = currentCompanyId(state)) => (state.affaires || []).filter(item => item.companyId === companyId);

  function migrateName(state) {
    if (!state) return false;
    let changed = false;
    const remy = (state.users || []).find(user => user.id === 'usr_remy');
    if (remy && (remy.name !== 'Remy P' || remy.initials !== 'RP')) {
      remy.name = 'Remy P';
      remy.initials = 'RP';
      changed = true;
    }
    const replace = value => typeof value === 'string'
      ? value.replaceAll('Rémy F.', 'Remy P').replaceAll('Rémy F', 'Remy P').replaceAll('Remy F.', 'Remy P').replaceAll('Remy F', 'Remy P')
      : value;
    for (const item of state.activity || []) {
      const text = replace(item.text); const meta = replace(item.meta);
      if (text !== item.text || meta !== item.meta) changed = true;
      item.text = text; item.meta = meta;
    }
    for (const item of state.notifications || []) {
      const text = replace(item.text); const title = replace(item.title);
      if (text !== item.text || title !== item.title) changed = true;
      item.text = text; item.title = title;
    }
    return changed;
  }

  function scopedAffairIds(state, companyId = currentCompanyId(state)) {
    const role = roleOf(state);
    const userId = ruleOf(state).userId;
    const affairs = companyAffaires(state, companyId);
    if (role === 'direction' || role === 'planification') return new Set(affairs.map(item => item.id));
    if (role === 'conducteur') return new Set(affairs.filter(item => item.managerId === userId).map(item => item.id));
    const repereAffairs = new Set((state.reperes || []).filter(item => (item.assigneeIds || []).includes(userId)).map(item => item.affairId));
    const interventionAffairs = new Set((state.interventions || []).filter(item => (item.teamIds || []).includes(userId)).map(item => item.affairId));
    if (role === 'poseur') return new Set(affairs.filter(item => repereAffairs.has(item.id) || interventionAffairs.has(item.id)).map(item => item.id));
    if (role === 'etudes') return new Set(affairs.filter(item => item.managerId === userId || repereAffairs.has(item.id)).map(item => item.id));
    return new Set();
  }

  function scope(state) {
    const companyId = currentCompanyId(state);
    const role = roleOf(state);
    const userId = ruleOf(state).userId;
    const affairIds = scopedAffairIds(state, companyId);
    const affaires = new Set((state.affaires || []).filter(item => item.companyId === companyId && affairIds.has(item.id)).map(item => item.id));
    let interventions = (state.interventions || []).filter(item => affaires.has(item.affairId));
    if (role === 'poseur') interventions = interventions.filter(item => (item.teamIds || []).includes(userId));
    if (role === 'etudes') interventions = [];
    const interventionIds = new Set(interventions.map(item => item.id));
    const interventionRepereIds = new Set(interventions.flatMap(item => item.repereIds || []));
    let reperes = (state.reperes || []).filter(item => affaires.has(item.affairId));
    if (role === 'poseur') reperes = reperes.filter(item => (item.assigneeIds || []).includes(userId) || interventionRepereIds.has(item.id));
    if (role === 'etudes') reperes = reperes.filter(item => (item.assigneeIds || []).includes(userId) || (state.affaires || []).find(affaire => affaire.id === item.affairId)?.managerId === userId);
    const repereIds = new Set(reperes.map(item => item.id));
    let documents = (state.documents || []).filter(item => affaires.has(item.affairId) && (!item.repereId || repereIds.has(item.repereId)));
    if (!['direction','conducteur','etudes'].includes(role)) documents = [];
    return {
      role,
      affairIds: affaires,
      repereIds,
      interventionIds,
      documentIds: new Set(documents.map(item => item.id)),
      workflowIds: new Set(role === 'direction' ? (state.workflows || []).filter(item => item.companyId === companyId).map(item => item.id) : reperes.map(item => item.workflowId))
    };
  }

  function allowedCompanies(state) {
    if (roleOf(state) === 'direction') return state.companies || [];
    return (state.companies || []).filter(company => scopedAffairIds(state, company.id).size > 0);
  }

  function canUseForm(role, type) {
    if (role === 'direction') return true;
    return ({
      conducteur: ['affaire','repere','intervention','blockage','document'],
      planification: ['intervention'],
      poseur: [],
      etudes: ['repere','blockage','document']
    }[role] || []).includes(type);
  }

  function canDelete(role, type) {
    if (role === 'direction') return true;
    return ({ conducteur: ['affaire','repere','intervention','document'], planification: ['intervention'], poseur: [], etudes: ['document'] }[role] || []).includes(type);
  }

  function entityAllowed(action, id, dataScope) {
    if (!id) return true;
    if (action === 'open-affaire' || action === 'duplicate-affaire') return dataScope.affairIds.has(id);
    if (['open-repere','advance-repere','set-phase'].includes(action)) return dataScope.repereIds.has(id);
    if (['open-intervention','start-intervention','complete-intervention'].includes(action)) return dataScope.interventionIds.has(id);
    if (action === 'download-document') return dataScope.documentIds.has(id);
    return true;
  }

  function actionAllowed(element, state, dataScope) {
    const action = element.dataset.action || '';
    const type = element.dataset.type || '';
    const id = element.dataset.id || element.dataset.intervention || element.dataset.repere || '';
    const role = dataScope.role;
    const page = element.dataset.page;
    if (action === 'navigate') return !page || ruleOf(state).pages.includes(page);
    if (!entityAllowed(action, id, dataScope)) return false;
    if (action === 'open-form') return canUseForm(role, type);
    if (action === 'confirm-delete') return canDelete(role, type);
    if (action === 'toggle-company' || action === 'select-company') return allowedCompanies(state).length > 1;
    if (action === 'toggle-quick-create') return ['affaire','repere','intervention','blockage','document'].some(item => canUseForm(role, item));
    if (action === 'duplicate-affaire') return ['direction','conducteur'].includes(role) && dataScope.affairIds.has(id);
    if (action === 'duplicate-workflow') return role === 'direction';
    if (['advance-repere','set-phase','resolve-blockage','delete-note'].includes(action)) return ['direction','conducteur','etudes'].includes(role);
    if (['start-intervention','complete-intervention','toggle-checklist'].includes(action)) return ['direction','poseur'].includes(role) && dataScope.interventionIds.has(id);
    if (action === 'trigger-file-upload') return ['direction','conducteur','etudes'].includes(role);
    if (action === 'export-csv') return role !== 'poseur';
    if (['export-json','trigger-import-json','confirm-reset','dolibarr-info','clear-activity'].includes(action)) return role === 'direction';
    return true;
  }

  const hide = element => {
    if (!element) return;
    element.hidden = true;
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('aria-hidden', 'true');
  };

  function hideEntity(element, allowed, selector) {
    if (allowed) return;
    hide(element.closest(selector) || element);
  }

  function replaceVisibleName() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue) continue;
      node.nodeValue = node.nodeValue
        .replaceAll('Rémy F.', 'Remy P')
        .replaceAll('Rémy F', 'Remy P')
        .replaceAll('Remy F.', 'Remy P')
        .replaceAll('Remy F', 'Remy P');
    }
    document.querySelectorAll('.user-card .avatar, .role-preview .avatar').forEach(node => { if (node.textContent.trim() === 'RF') node.textContent = 'RP'; });
  }

  function filterSelectOptions(dataScope) {
    document.querySelectorAll('select').forEach(select => {
      const name = select.name || '';
      for (const option of [...select.options]) {
        const value = option.value;
        let allowed = true;
        if (['affairId'].includes(name) || select.dataset.filter === 'repereAffair') allowed = !value || value === 'all' || dataScope.affairIds.has(value);
        if (['repereId'].includes(name)) allowed = !value || dataScope.repereIds.has(value);
        if (name === 'workflowId' && dataScope.role !== 'direction' && dataScope.role !== 'conducteur' && dataScope.role !== 'etudes') allowed = dataScope.workflowIds.has(value);
        if (!allowed) option.remove();
      }
    });
  }

  function addRoleChip(state) {
    const topbar = document.querySelector('.topbar__actions');
    if (!topbar || topbar.querySelector('.rbac-role-chip')) return;
    const labels = { direction:'Direction', conducteur:'Conducteur', planification:'Planification', poseur:'Poseur', etudes:'Études' };
    const chip = document.createElement('span');
    chip.className = 'rbac-role-chip';
    chip.textContent = `Vue ${labels[roleOf(state)]}`;
    topbar.prepend(chip);
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      replaceVisibleName();
      const state = readState();
      if (!state?.settings) return;
      if (migrateName(state)) writeState(state);
      const dataScope = scope(state);
      document.documentElement.dataset.activeRole = dataScope.role;
      addRoleChip(state);

      document.querySelectorAll('[data-action]').forEach(element => {
        if (!actionAllowed(element, state, dataScope)) hide(element);
      });

      document.querySelectorAll('[data-action="open-affaire"][data-id]').forEach(element => hideEntity(element, dataScope.affairIds.has(element.dataset.id), '.affaire-card, .search-result, tr, .compact-row'));
      document.querySelectorAll('[data-action="open-repere"][data-id], [data-drag-repere]').forEach(element => {
        const id = element.dataset.id || element.dataset.dragRepere;
        hideEntity(element, dataScope.repereIds.has(id), '.repere-card, .blockage-row, .search-result, tr, .compact-row');
      });
      document.querySelectorAll('[data-action="open-intervention"][data-id], [data-drag-intervention]').forEach(element => {
        const id = element.dataset.id || element.dataset.dragIntervention;
        hideEntity(element, dataScope.interventionIds.has(id), '.intervention-card, .planning-card, .search-result, .compact-row');
      });
      document.querySelectorAll('.document-card').forEach(card => {
        const id = card.querySelector('[data-id]')?.dataset.id;
        if (id && !dataScope.documentIds.has(id)) hide(card);
      });
      document.querySelectorAll('.search-result[data-kind]').forEach(result => {
        const id = result.dataset.id; const kind = result.dataset.kind;
        const allowed = kind === 'affaire' ? dataScope.affairIds.has(id) : kind === 'repere' ? dataScope.repereIds.has(id) : kind === 'intervention' ? dataScope.interventionIds.has(id) : kind === 'document' ? dataScope.documentIds.has(id) : kind === 'workflow' ? dataScope.role === 'direction' : true;
        if (!allowed) hide(result);
      });

      if (!['direction','conducteur'].includes(dataScope.role)) document.querySelectorAll('[data-drag-repere]').forEach(node => node.draggable = false);
      if (!['direction','conducteur','planification'].includes(dataScope.role)) document.querySelectorAll('[data-drag-intervention]').forEach(node => node.draggable = false);

      document.querySelectorAll('.settings-card').forEach(card => {
        const title = card.querySelector('h2')?.textContent.trim();
        if (dataScope.role !== 'direction' && ['Données locales','Intégration Dolibarr'].includes(title)) hide(card);
      });
      filterSelectOptions(dataScope);

      const counts = { affaires:dataScope.affairIds.size, reperes:dataScope.repereIds.size, interventions:dataScope.interventionIds.size, documents:dataScope.documentIds.size };
      for (const [page, count] of Object.entries(counts)) {
        document.querySelectorAll(`[data-page="${page}"] .nav-count`).forEach(node => { node.textContent = String(count); if (!count) hide(node); });
      }
      document.querySelectorAll('.nav-section-label').forEach(label => {
        let next = label.nextElementSibling; let visible = false;
        while (next && !next.classList.contains('nav-section-label')) { if (!next.hidden && getComputedStyle(next).display !== 'none') visible = true; next = next.nextElementSibling; }
        if (!visible) hide(label);
      });
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function switchContextForRole(role) {
    if (roleSwitching) return;
    roleSwitching = true;
    setTimeout(() => {
      const state = readState();
      if (!state) { roleSwitching = false; return; }
      const companies = allowedCompanies(state);
      const desiredCompany = companies[0]?.id;
      const desiredPage = ROLE_RULES[role]?.defaultPage || 'dashboard';
      const finish = () => {
        const nav = document.querySelector(`[data-action="navigate"][data-page="${desiredPage}"]`);
        if (nav && !nav.hidden) nav.click();
        roleSwitching = false;
        scheduleApply();
      };
      if (desiredCompany && desiredCompany !== state.settings.companyId) {
        const toggle = document.querySelector('[data-action="toggle-company"]');
        if (toggle) {
          toggle.hidden = false; toggle.style.removeProperty('display'); toggle.disabled = false; toggle.click();
          setTimeout(() => {
            const option = document.querySelector(`[data-action="select-company"][data-id="${desiredCompany}"]`);
            if (option) { option.hidden = false; option.style.removeProperty('display'); option.click(); setTimeout(finish, 30); }
            else finish();
          }, 30);
        } else finish();
      } else finish();
    }, 30);
  }

  document.addEventListener('change', event => {
    const select = event.target.closest('[data-setting-select="role"]');
    if (!select) return;
    const state = readState();
    if (state?.settings) {
      state.settings.role = select.value;
      migrateName(state);
      writeState(state);
    }
    switchContextForRole(select.value);
  }, true);

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const state = readState();
    if (!state) return;
    const dataScope = scope(state);
    if (roleSwitching && ['toggle-company','select-company'].includes(target.dataset.action || '')) return;
    if (!actionAllowed(target, state, dataScope)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const region = document.getElementById('toastRegion');
      if (region) {
        const toast = document.createElement('div');
        toast.className = 'toast toast--warning is-visible';
        toast.innerHTML = '<strong>Cette action n’est pas autorisée pour le rôle actif.</strong>';
        region.appendChild(toast);
        setTimeout(() => toast.remove(), 2800);
      }
    }
  }, true);

  new MutationObserver(scheduleApply).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('storage', scheduleApply);
  scheduleApply();
})();
