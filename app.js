(() => {
  'use strict';
  const jsParts = ['chunks/app-01.part', 'chunks/app-02.part', 'chunks/app-03.part', 'chunks/app-04.part', 'chunks/app-05.part', 'chunks/app-06.part', 'chunks/app-07.part'];
  const cssParts = ['chunks/styles-01.part', 'chunks/styles-02.part', 'chunks/styles-03.part', 'chunks/styles-04.part'];
  const loadText = async (paths) => {
    const responses = await Promise.all(paths.map(path => fetch(path, { cache: 'no-cache' })));
    const failed = responses.find(response => !response.ok);
    if (failed) throw new Error(`Chargement impossible : ${failed.url} (${failed.status})`);
    return (await Promise.all(responses.map(response => response.text()))).join('');
  };
  Promise.all([loadText(cssParts), loadText(jsParts)])
    .then(([css, js]) => {
      const style = document.createElement('style');
      style.dataset.a3Runtime = 'true';
      style.textContent = css;
      document.head.appendChild(style);
      new Function(`${js}\n//# sourceURL=a3-pilot-runtime.js`)();
    })
    .catch(error => {
      console.error(error);
      const app = document.getElementById('app');
      if (app) app.innerHTML = `<main class="boot-error"><strong>A3 Pilot ne peut pas démarrer.</strong><span>${String(error.message || error)}</span><button type="button" onclick="location.reload()">Réessayer</button></main>`;
    });
})();
