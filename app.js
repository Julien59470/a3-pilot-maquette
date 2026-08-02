(() => {
  'use strict';
  const jsParts = ['chunks/app-01.part', 'chunks/app-02.part', 'chunks/app-03.part', 'chunks/app-04.part', 'chunks/app-05.part', 'chunks/app-06.part', 'chunks/app-07.part', 'terrain-preview.js'];
  const cssParts = ['css/p01.css', 'css/p02.css', 'css/p03.css', 'css/p04.css', 'css/p05.css', 'css/p06.css', 'css/p07.css', 'css/p08.css', 'css/p09.css', 'css/terrain-preview.css'];
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