// Historique : 300 niveaux, stockage IndexedDB pour les gros snapshots
const History = (() => {
  const MAX = 300;
  let stack = [];   // chaque entrée: {type, payload}
  let pointer = -1; // index du dernier état appliqué
  let db = null;

  function openDB(){
    return new Promise(res => {
      const r = indexedDB.open('dessnotes',1);
      r.onupgradeneeded = e => {
        const d = e.target.result;
        if(!d.objectStoreNames.contains('history')) d.createObjectStore('history');
        if(!d.objectStoreNames.contains('autosave')) d.createObjectStore('autosave');
      };
      r.onsuccess = e => { db = e.target.result; res(db); };
      r.onerror = () => res(null);
    });
  }

  async function init(){ await openDB(); }

  // Sauvegarde un snapshot complet (état des calques sérialisés)
  async function push(label='action'){
    // si on a fait undo puis nouvelle action, on tronque
    if(pointer < stack.length-1) stack = stack.slice(0,pointer+1);
    const snap = await Layers.serialize();
    stack.push({label, snap});
    if(stack.length > MAX){ stack.shift(); }
    pointer = stack.length-1;
    UI.updateUndoButtons();
  }

  async function undo(){
    if(pointer <= 0) return;
    pointer--;
    await Layers.deserialize(stack[pointer].snap);
    Render.requestRender();
    UI.refreshLayers();
    UI.updateUndoButtons();
  }

  async function redo(){
    if(pointer >= stack.length-1) return;
    pointer++;
    await Layers.deserialize(stack[pointer].snap);
    Render.requestRender();
    UI.refreshLayers();
    UI.updateUndoButtons();
  }

  function canUndo(){ return pointer > 0; }
  function canRedo(){ return pointer < stack.length-1; }

  function clear(){ stack = []; pointer = -1; }

  // Auto-save
  async function autosave(){
    if(!db) return;
    try{
      const snap = await Layers.serialize();
      const tx = db.transaction('autosave','readwrite');
      tx.objectStore('autosave').put({snap, t:Date.now()},'current');
    }catch(e){}
  }
  async function loadAutosave(){
    if(!db) return null;
    return new Promise(res=>{
      const tx = db.transaction('autosave','readonly');
      const r = tx.objectStore('autosave').get('current');
      r.onsuccess = ()=> res(r.result);
      r.onerror = ()=> res(null);
    });
  }

  return {init,push,undo,redo,canUndo,canRedo,clear,autosave,loadAutosave};
})();
