// Point d'entrée : initialisation et orchestration générale
(async function(){

  // 1. Historique (ouvre IndexedDB)
  await History.init();

  // 2. Rendu (canvas)
  Render.init();

  // 3. Outils (events souris/touch)
  Tools.init();

  // 4. UI (boutons, panneaux, raccourcis)
  UI.init();

  // 5. Document de départ : un calque de dessin vide
  Layers.addDrawLayer('Fond');
  await History.push('init');
  UI.refreshLayers();
  UI.updateOverlay();
  Render.fitToView();

  // 6. Tentative de récupération auto-save
  try{
    const saved = await History.loadAutosave();
    if(saved && saved.snap && saved.snap.layers && saved.snap.layers.length > 1){
      const ageMin = Math.round((Date.now()-saved.t)/60000);
      if(confirm(`Une session précédente a été trouvée (il y a ${ageMin} min). Restaurer ?`)){
        Layers.clear();
        await Layers.deserialize(saved.snap);
        Render.requestRender();
        UI.refreshLayers();
        UI.updateOverlay();
        Render.fitToView();
        History.clear();
        await History.push('restore');
        UI.toast('Session restaurée');
      }
    }
  }catch(e){ console.warn('autosave check failed',e); }

  // 7. Auto-save toutes les 30s
  setInterval(()=> History.autosave(), 30000);

  // 8. Avertissement avant fermeture si modifications
  window.addEventListener('beforeunload', e=>{
    if(History.canUndo()){
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 9. Enregistrer le Service Worker (PWA)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW enregistré:', reg.scope))
      .catch(err => console.warn('SW erreur:', err));
  });
}

  UI.toast('DessNotes prêt — V/B/E/T/I/C — Ctrl+Z/Y');
  console.log('%c🎨 DessNotes','color:#00d9ff;font-size:18px;font-weight:bold','— Éditeur d\'annotation chargé.');

})();
