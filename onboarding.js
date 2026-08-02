(() => {
  'use strict';

  const TYPE_CONFIG = {
    affaire: {
      description: 'Créez l’opération étape par étape, sans surcharge d’informations.',
      steps: [
        step('Identifier l’affaire', 'Commencez par les informations qui permettent de reconnaître immédiatement l’opération.', ['ref', 'name', 'clientId', 'companyId'], 'Identité et client'),
        step('Localiser le chantier', 'Renseignez le lieu d’intervention. L’adresse détaillée peut rester facultative.', ['city', 'address'], 'Lieu du chantier'),
        step('Organiser le pilotage', 'Définissez le responsable, l’échéance et l’état actuel de l’affaire.', ['managerId', 'dueDate', 'status'], 'Responsable et délai'),
        step('Compléter les données de gestion', 'Ajoutez les informations financières et la référence ERP si elles sont déjà connues.', ['budget', 'dolibarrRef'], 'Budget et ERP')
      ]
    },
    repere: {
      description: 'Définissez l’ouvrage progressivement. Son workflow sera généré automatiquement.',
      steps: [
        step('Choisir le contexte', 'Rattachez le repère à une affaire et sélectionnez sa typologie métier.', ['affairId', 'workflowId', 'code'], 'Affaire et typologie'),
        step('Décrire l’implantation', 'Indiquez où se trouve l’ouvrage et, si elles sont disponibles, ses dimensions.', ['zone', 'dimensions'], 'Emplacement'),
        step('Définir le suivi', 'Positionnez le repère dans son état actuel et attribuez sa priorité.', ['status', 'priority'], 'Statut et priorité'),
        step('Affecter les personnes', 'Sélectionnez uniquement les personnes qui doivent suivre ou réaliser cet ouvrage.', ['assigneeIds'], 'Responsables', 1)
      ]
    },
    intervention: {
      description: 'Préparez l’intervention en cinq étapes courtes et opérationnelles.',
      steps: [
        step('Définir la mission', 'Donnez un titre clair, choisissez l’affaire et le type d’intervention.', ['title', 'affairId', 'type'], 'Mission et affaire'),
        step('Choisir le créneau', 'Planifiez la date, les horaires et le lieu. Une date vide laisse l’intervention à affecter.', ['date', 'start', 'end', 'status', 'address'], 'Date et horaires'),
        step('Sélectionner les ouvrages', 'Choisissez uniquement les repères qui seront traités pendant cette intervention.', ['repereIds'], 'Périmètre technique', 1),
        step('Composer l’équipe', 'Affectez les collaborateurs qui verront l’intervention dans leur espace.', ['teamIds'], 'Intervenants', 1),
        step('Préparer le terrain', 'Ajoutez les consignes et la check-list qui guideront l’équipe sur place.', ['notes', 'checklist'], 'Consignes et contrôles', 1)
      ]
    },
    workflow: {
      description: 'Construisez la typologie sans afficher tous les paramètres en même temps.',
      steps: [
        step('Identifier la typologie', 'Définissez le code, le nom et la société propriétaire du workflow.', ['code', 'name', 'companyId'], 'Nom et société'),
        step('Gérer la version', 'Indiquez la version et choisissez si ce modèle peut être utilisé pour de nouveaux repères.', ['version', 'active'], 'Version et activation'),
        step('Définir les phases', 'Saisissez une phase par ligne avec sa pondération. Le calcul sera normalisé automatiquement.', ['phases'], 'Cycle produit', 1, true)
      ]
    },
    document: {
      description: 'Classez le document en trois étapes rapides.',
      steps: [
        step('Identifier le document', 'Donnez un nom explicite et choisissez sa catégorie.', ['name', 'category'], 'Nom et catégorie'),
        step('Rattacher le document', 'Associez-le à l’affaire et, si nécessaire, à un repère précis.', ['affairId', 'repereId'], 'Classement'),
        step('Compléter les métadonnées', 'La taille simulée reste facultative dans cette maquette.', ['size'], 'Informations fichier', 1)
      ]
    },
    blockage: {
      description: 'Déclarez le problème progressivement pour faciliter son traitement.',
      steps: [
        step('Identifier le problème', 'Choisissez le repère concerné et expliquez clairement ce qui bloque.', ['repereId', 'title', 'description'], 'Cause du blocage', 1),
        step('Attribuer la résolution', 'Indiquez qui doit agir et la date attendue de résolution.', ['owner', 'dueDate'], 'Responsable et délai'),
        step('Évaluer la criticité', 'Classez le blocage pour qu’il remonte correctement dans le pilotage.', ['priority'], 'Priorité', 1)
      ]
    }
  };

  const modal = document.getElementById('entityModal');
  if (!modal) return;

  const observer = new MutationObserver(() => enhanceCurrentForm());
  observer.observe(modal, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
  enhanceCurrentForm();

  function step(title, description, names, short, columns = 2, includeHint = false) {
    return { title, description, names, short, columns, includeHint };
  }

  function enhanceCurrentForm() {
    const form = modal.querySelector('#entityForm[data-form="entity"]');
    if (!form || form.dataset.onboardingEnhanced === 'true') return;
    const type = form.dataset.type;
    const config = TYPE_CONFIG[type];
    if (!config) return;

    form.dataset.onboardingEnhanced = 'true';
    form.noValidate = true;
    modal.classList.add('modal--onboarding', 'modal--wide');

    const headerDescription = form.querySelector('.modal__header p');
    if (headerDescription) headerDescription.textContent = config.description;

    const body = form.querySelector('.modal__body');
    const footer = form.querySelector('.modal__footer');
    const originalSubmit = footer?.querySelector('button[type="submit"]');
    if (!body || !footer || !originalSubmit) return;

    const fieldNodes = new Map();
    config.steps.flatMap(item => item.names).forEach(name => {
      const control = form.querySelector(`[name="${name}"]`);
      if (!control) return;
      const field = control.closest('.field') || control.parentElement;
      if (field && !fieldNodes.has(name)) fieldNodes.set(name, field);
    });
    const hints = [...body.querySelectorAll('.form-hint')];

    body.classList.add('modal__body--onboarding');
    body.innerHTML = onboardingSkeleton(config);
    const panels = [...body.querySelectorAll('[data-wizard-step]')];
    const usedNodes = new Set();

    config.steps.forEach((item, index) => {
      const fields = panels[index].querySelector('.onboarding-panel__fields');
      item.names.forEach(name => {
        const node = fieldNodes.get(name);
        if (!node || usedNodes.has(node)) return;
        usedNodes.add(node);
        fields.appendChild(node);
      });
      if (item.includeHint) hints.forEach(hint => fields.appendChild(hint));
    });

    footer.classList.add('onboarding-footer');
    const cancel = footer.querySelector('[data-action="close-modal"]');
    footer.innerHTML = '';
    if (cancel) footer.appendChild(cancel);

    const actions = document.createElement('div');
    actions.className = 'onboarding-footer__actions';
    const previous = button('secondary-button', 'wizard-prev', `${svg('chevron-left')}Retour`);
    const next = button('primary-button', 'wizard-next', `Continuer${svg('chevron-right')}`);
    originalSubmit.dataset.wizardSubmit = '';
    actions.append(previous, next, originalSubmit);
    footer.appendChild(actions);

    bindWizard(form, panels, previous, next, originalSubmit);
  }

  function onboardingSkeleton(config) {
    const total = config.steps.length;
    return `<div class="onboarding-layout" data-onboarding>
      <aside class="onboarding-steps" aria-label="Étapes du formulaire">
        <div class="onboarding-steps__intro"><strong>${total} étapes</strong><small>Sélectionnez une étape déjà parcourue ou continuez dans l’ordre.</small></div>
        <div class="onboarding-stepper">${config.steps.map((item, index) => `<button type="button" class="onboarding-stepper__item ${index === 0 ? 'is-active' : ''}" data-wizard-goto="${index}" aria-current="${index === 0 ? 'step' : 'false'}"><span>${index + 1}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.short)}</small></span></button>`).join('')}</div>
      </aside>
      <main class="onboarding-content">
        <div class="onboarding-progress"><div><span>Étape <strong data-wizard-current>1</strong> sur ${total}</span><span data-wizard-percent>${Math.round(100 / total)} %</span></div><div class="progress-track progress-track--light"><span data-wizard-progress style="width:${100 / total}%"></span></div></div>
        ${config.steps.map((item, index) => `<section class="onboarding-panel ${index === 0 ? 'is-active' : ''}" data-wizard-step="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}"><header><span class="onboarding-panel__number">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div></header><div class="onboarding-panel__fields form-grid ${item.columns === 2 ? 'form-grid--2' : ''}"></div></section>`).join('')}
      </main>
    </div>`;
  }

  function bindWizard(form, panels, previous, next, submit) {
    const stepButtons = [...form.querySelectorAll('[data-wizard-goto]')];
    let current = 0;
    let furthest = 0;

    const showStep = (target, focus = true) => {
      current = Math.max(0, Math.min(Number(target), panels.length - 1));
      furthest = Math.max(furthest, current);

      panels.forEach((panel, index) => {
        const active = index === current;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', String(!active));
      });

      stepButtons.forEach((item, index) => {
        item.classList.toggle('is-active', index === current);
        item.classList.toggle('is-complete', index < furthest && index !== current);
        item.classList.toggle('is-upcoming', index > furthest);
        item.setAttribute('aria-current', index === current ? 'step' : 'false');
        item.firstElementChild.innerHTML = index < furthest && index !== current ? svg('check') : String(index + 1);
      });

      previous.hidden = current === 0;
      next.hidden = current === panels.length - 1;
      submit.hidden = current !== panels.length - 1;

      const progress = ((current + 1) / panels.length) * 100;
      form.querySelector('[data-wizard-current]').textContent = String(current + 1);
      form.querySelector('[data-wizard-percent]').textContent = `${Math.round(progress)} %`;
      form.querySelector('[data-wizard-progress]').style.width = `${progress}%`;

      const activeButton = stepButtons[current];
      if (activeButton && window.matchMedia('(max-width: 960px)').matches) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      if (focus) {
        const heading = panels[current].querySelector('h3');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        bodyScroll(form);
      }
    };

    const validateStep = index => {
      const controls = [...panels[index].querySelectorAll('input,select,textarea')].filter(control => !control.disabled && control.type !== 'hidden');
      const invalid = controls.find(control => !control.checkValidity());
      if (!invalid) return true;
      showStep(index, false);
      invalid.reportValidity();
      invalid.focus();
      return false;
    };

    const moveForward = target => {
      const boundedTarget = Math.min(Number(target), panels.length - 1);
      for (let index = current; index < boundedTarget; index += 1) {
        if (!validateStep(index)) return;
      }
      showStep(boundedTarget);
    };

    previous.addEventListener('click', () => showStep(current - 1));
    next.addEventListener('click', () => moveForward(current + 1));
    stepButtons.forEach(item => item.addEventListener('click', () => {
      const target = Number(item.dataset.wizardGoto);
      if (target <= furthest) showStep(target);
      else moveForward(target);
    }));

    form.addEventListener('submit', event => {
      for (let index = 0; index < panels.length; index += 1) {
        if (validateStep(index)) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }, true);

    showStep(0, false);
  }

  function button(className, attribute, html) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.dataset[attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = '';
    element.innerHTML = html;
    return element;
  }

  function bodyScroll(form) {
    const body = form.querySelector('.modal__body');
    if (body) body.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function svg(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
  }
})();
