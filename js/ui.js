const UI = (() => {
  let toastTimer = null;
  let deferredInstallPrompt = null;

  function init(){
    // Toolbar : sélection d'outil
    document.querySelectorAll('.tool').forEach(b=>{
      b.addEventListener('click', ()=> Tools.set(b.dataset.tool));
    });

    // Top bar
    document.getElementById('btnNew').addEventListener('click', newDoc);
    document.getElementById('btnOpen').addEventListener('click', ()=> document.getElementById('fileInput').click());
    document.getElementById('btnSaveProject').addEventListener('click', IO.saveProject);
    document.getElementById('btnLoadProject').addEventListener('click', ()=> document.getElementById('projectInput').click());
    document.getElementById('btnExport').addEventListener('click', IO.exportPNG);
    document.getElementById('btnPrint').addEventListener('click', IO.printIt);
    document.getElementById('btnUndo').addEventListener('click', History.undo);
    document.getElementById('btnRedo').addEventListener('click', History.redo);

    // Aide
    const btnHelp = document.getElementById('btnHelp');
    if(btnHelp) btnHelp.addEventListener('click', showHelp);
    const btnHelpClose = document.getElementById('btnHelpClose');
    if(btnHelpClose) btnHelpClose.addEventListener('click', hideHelp);
    const helpModal = document.getElementById('helpModal');
    if(helpModal){
      helpModal.addEventListener('click', e=>{
        if(e.target.id === 'helpModal') hideHelp();
      });
    }

    // PWA install
    window.addEventListener('beforeinstallprompt', e=>{
      e.preventDefault();
      deferredInstallPrompt = e;
      const b = document.getElementById('btnInstall');
      if(b) b.hidden = false;
    });
    const btnInstall = document.getElementById('btnInstall');
    if(btnInstall){
      btnInstall.addEventListener('click', async ()=>{
        if(!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        toast(outcome === 'accepted' ? 'Installation lancée' : 'Installation annulée');
        deferredInstallPrompt = null;
        btnInstall.hidden = true;
      });
    }
    window.addEventListener('appinstalled', ()=>{
      toast('DessNotes installé ✓');
      if(btnInstall) btnInstall.hidden = true;
    });

    // Inputs fichier
    document.getElementById('fileInput').addEventListener('change', async e=>{
      for(const f of e.target.files){ await IO.openImageFile(f); }
      e.target.value='';
      History.push('open image');
    });
    document.getElementById('projectInput').addEventListener('change', async e=>{
      if(e.target.files[0]) await IO.loadProject(e.target.files[0]);
      e.target.value='';
    });

    // Calques
    document.getElementById('btnAddLayer').addEventListener('click', ()=> Layers.addDrawLayer());
    document.getElementById('btnAddImage').addEventListener('click', ()=> document.getElementById('fileInput').click());
    document.getElementById('btnLayerUp').addEventListener('click', ()=>{
      const L = Layers.selected(); if(L) Layers.move(L.id, +1);
    });
    document.getElementById('btnLayerDown').addEventListener('click', ()=>{
      const L = Layers.selected(); if(L) Layers.move(L.id, -1);
    });
    document.getElementById('btnLayerDup').addEventListener('click', ()=>{
      const L = Layers.selected(); if(L) Layers.duplicate(L.id);
    });
    document.getElementById('btnLayerDel').addEventListener('click', ()=>{
      const L = Layers.selected();
      if(L && confirm('Supprimer le calque "'+L.name+'" ?')) Layers.remove(L.id);
    });
    document.getElementById('layerOpacity').addEventListener('input', e=>{
      const L = Layers.selected(); if(L){ L.opacity = e.target.value/100; Render.requestRender(); }
    });
    document.getElementById('layerOpacity').addEventListener('change', ()=> History.push('opacity'));

    // Transformations
    document.getElementById('btnRotateL').addEventListener('click', ()=> rotateSel(-90));
    document.getElementById('btnRotateR').addEventListener('click', ()=> rotateSel(+90));
    document.getElementById('btnFlipH').addEventListener('click', ()=>{
      const L = Layers.selected(); if(L){ L.flipH = !L.flipH; Render.requestRender(); History.push('flip'); }
    });
    document.getElementById('btnFlipV').addEventListener('click', ()=>{
      const L = Layers.selected(); if(L){ L.flipV = !L.flipV; Render.requestRender(); History.push('flip'); }
    });

    // Zoom (boutons)
    document.getElementById('btnZoomIn').addEventListener('click', ()=> Render.setZoom(Render.getZoom()*1.25));
    document.getElementById('btnZoomOut').addEventListener('click', ()=> Render.setZoom(Render.getZoom()/1.25));
    document.getElementById('btnZoomFit').addEventListener('click', ()=> Render.fitToView());

    // Sliders
    const bs = document.getElementById('brushSize'), bsv = document.getElementById('brushSizeVal');
    bs.addEventListener('input', ()=> bsv.textContent = bs.value);
    const bo = document.getElementById('brushOpacity'), bov = document.getElementById('brushOpacityVal');
    bo.addEventListener('input', ()=> bov.textContent = bo.value);

    // Couleurs presets
    document.querySelectorAll('#colorPresets span').forEach(s=>{
      s.addEventListener('click', ()=> document.getElementById('brushColor').value = s.dataset.c);
    });

    // Crop boutons
    document.getElementById('btnCropApply').addEventListener('click', Tools.applyCrop);
    document.getElementById('btnCropCancel').addEventListener('click', Tools.cropCancel || Tools.cancelCrop);

    // Mobile : panneau droit
    document.getElementById('mobileToggleRight').addEventListener('click', ()=>{
      document.getElementById('rightPanel').classList.toggle('open');
    });

    // Drag & drop fichiers
    const wrap = document.getElementById('canvasWrap');
    wrap.addEventListener('dragover', e=>{ e.preventDefault(); });
    wrap.addEventListener('drop', async e=>{
      e.preventDefault();
      for(const f of e.dataTransfer.files){
        if(f.name.toLowerCase().endsWith('.dnotes')||f.name.toLowerCase().endsWith('.json')){
          await IO.loadProject(f);
        } else {
          await IO.openImageFile(f);
        }
      }
      History.push('drop');
    });

    // Zoom molette : molette seule OU Ctrl+molette, centré sur le curseur
    wrap.addEventListener('wheel', e=>{
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 1/1.1;
      zoomAtPoint(e.clientX, e.clientY, f);
    }, {passive:false});

    // Raccourcis
    window.addEventListener('keydown', e=>{
      if(e.target.isContentEditable || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;

      // F1 = aide
      if(e.key === 'F1'){ e.preventDefault(); showHelp(); return; }

      if(e.ctrlKey || e.metaKey){
        if(e.key==='z'){ e.preventDefault(); History.undo(); }
        else if(e.key==='y' || (e.key==='Z' && e.shiftKey)){ e.preventDefault(); History.redo(); }
        else if(e.key==='s'){ e.preventDefault(); IO.saveProject(); }
        else if(e.key==='o'){ e.preventDefault(); document.getElementById('fileInput').click(); }
        else if(e.key==='p'){ e.preventDefault(); IO.printIt(); }
        else if(e.key==='e'){ e.preventDefault(); IO.exportPNG(); }
      } else {
        const map = {v:'move', b:'brush', l:'line', e:'eraser', t:'text', i:'picker', c:'crop'};
        const k = e.key.toLowerCase();
        if(map[k]) Tools.set(map[k]);
        else if(e.key==='Delete'){
          const L = Layers.selected();
          if(L) Layers.remove(L.id);
        }
      }
    });

    // Resize fenêtre
    window.addEventListener('resize', updateOverlay);
    document.getElementById('canvasWrap').addEventListener('scroll', updateOverlay);

    // Aide à la 1ère visite
    if(!localStorage.getItem('dessnotes_helpSeen')){
      setTimeout(showHelp, 700);
      localStorage.setItem('dessnotes_helpSeen', '1');
    }

    updateUndoButtons();
  }

  // Zoom centré sur un point écran
  function zoomAtPoint(clientX, clientY, factor){
    const wrap = document.getElementById('canvasWrap');
    const canvas = document.getElementById('mainCanvas');
    const z0 = Render.getZoom();
    const z1 = Math.max(0.05, Math.min(32, z0 * factor));
    if(z1 === z0) return;

    // Position dans le doc avant zoom (sous le curseur)
    const r0 = canvas.getBoundingClientRect();
    const docX = (clientX - r0.left) / z0;
    const docY = (clientY - r0.top)  / z0;

    Render.setZoom(z1);

    // Après zoom : on ajuste le scroll pour que (docX,docY) reste sous le curseur
    const r1 = canvas.getBoundingClientRect();
    const newScreenX = r1.left + docX * z1;
    const newScreenY = r1.top  + docY * z1;
    wrap.scrollLeft += (newScreenX - clientX);
    wrap.scrollTop  += (newScreenY - clientY);

    updateOverlay();
  }

  function rotateSel(deg){
    const L = Layers.selected(); if(!L) return;
    L.rotation = (L.rotation + deg) % 360;
    Render.requestRender();
    updateOverlay();
    History.push('rotate');
  }

  function newDoc(){
    if(!confirm('Créer un nouveau document ? Le travail non sauvegardé sera perdu.')) return;
    Layers.clear();
    Render.setSize(1280, 800);
    History.clear();
    History.push('new');
    refreshLayers();
    updateOverlay();
    Render.fitToView();
  }

  // Aide
  function showHelp(){
    const m = document.getElementById('helpModal');
    if(m) m.classList.remove('hidden');
  }
  function hideHelp(){
    const m = document.getElementById('helpModal');
    if(m) m.classList.add('hidden');
  }

  // Panneau calques
  function refreshLayers(){
    const ul = document.getElementById('layersList');
    ul.innerHTML = '';
    const layers = Layers.all();
    for(let i=layers.length-1; i>=0; i--){
      const L = layers[i];
      const li = document.createElement('li');
      if(L.id === (Layers.selected()&&Layers.selected().id)) li.classList.add('selected');
      li.innerHTML = `
        <span class="vis" data-act="vis">${L.visible?'👁️':'🚫'}</span>
        <canvas class="thumb" width="24" height="24"></canvas>
        <span class="name" data-act="name">${escapeHtml(L.name)}</span>
        <span class="type" title="${L.type}">${L.type==='image'?'🖼️':L.type==='text'?'🅣':'✏️'}</span>
      `;
      const tc = li.querySelector('.thumb');
      drawThumb(tc, L);

      li.addEventListener('click', e=>{
        const act = e.target.dataset.act;
        if(act==='vis'){
          Layers.setVisible(L.id, !L.visible);
          History.push('visibility');
        } else {
          Layers.select(L.id);
        }
      });
      li.querySelector('.name').addEventListener('dblclick', e=>{
        const sp = e.target;
        sp.contentEditable = true;
        sp.focus();
        document.execCommand('selectAll',false,null);
        const finish = ()=>{
          sp.contentEditable = false;
          Layers.rename(L.id, sp.textContent.trim()||L.name);
          History.push('rename');
        };
        sp.addEventListener('blur', finish, {once:true});
        sp.addEventListener('keydown', ev=>{
          if(ev.key==='Enter'){ ev.preventDefault(); sp.blur(); }
        });
      });
      ul.appendChild(li);
    }

    const sel = Layers.selected();
    if(sel) document.getElementById('layerOpacity').value = Math.round(sel.opacity*100);
  }

  function drawThumb(c, L){
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,24,24);
    ctx.fillStyle = '#444'; ctx.fillRect(0,0,24,24);
    try{
      if(L.type==='image' && L.bitmap){
        ctx.drawImage(L.bitmap,0,0,24,24);
      } else if(L.type==='draw' && L.canvas){
        ctx.drawImage(L.canvas,0,0,24,24);
      } else if(L.type==='text'){
        ctx.fillStyle = L.text.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('T',12,12);
      }
    }catch(e){}
  }

  // Overlay (bbox + poignées)
  function updateOverlay(){
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    const L = Layers.selected();
    if(!L || !L.visible) return;
    const t = Tools.get();
    if(t==='brush' || t==='eraser' || t==='line') return;

    const z = Render.getZoom();
    const canvas = document.getElementById('mainCanvas');
    const wrap = document.getElementById('canvasWrap');
    const r = canvas.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const ox = r.left - wr.left + wrap.scrollLeft;
    const oy = r.top  - wr.top  + wrap.scrollTop;

    ov.style.left = '0'; ov.style.top = '0';
    ov.style.width = wrap.scrollWidth+'px';
    ov.style.height = wrap.scrollHeight+'px';

    const bbox = document.createElement('div');
    bbox.className = 'bbox';
    bbox.style.left = (ox + L.x*z)+'px';
    bbox.style.top  = (oy + L.y*z)+'px';
    bbox.style.width  = (L.w*z)+'px';
    bbox.style.height = (L.h*z)+'px';
    bbox.style.transformOrigin = 'center center';
    bbox.style.transform = `rotate(${L.rotation}deg)`;
    ov.appendChild(bbox);

    const handles = [
      ['nw',0,0,'nwse-resize'], ['n',0.5,0,'ns-resize'], ['ne',1,0,'nesw-resize'],
      ['e',1,0.5,'ew-resize'],  ['se',1,1,'nwse-resize'],
      ['s',0.5,1,'ns-resize'],  ['sw',0,1,'nesw-resize'], ['w',0,0.5,'ew-resize']
    ];
    for(const [k,fx,fy,cur] of handles){
      const h = document.createElement('div');
      h.className = 'handle';
      h.dataset.handle = k;
      h.style.cursor = cur;
      h.style.left = (ox + (L.x + L.w*fx)*z - 6)+'px';
      h.style.top  = (oy + (L.y + L.h*fy)*z - 6)+'px';
      ov.appendChild(h);
    }
    const hr = document.createElement('div');
    hr.className = 'handle rot';
    hr.dataset.handle = 'rot';
    hr.style.left = (ox + (L.x + L.w/2)*z - 6)+'px';
    hr.style.top  = (oy + (L.y - 24/z)*z - 6)+'px';
    ov.appendChild(hr);

    ov.style.pointerEvents = 'none';
    [...ov.querySelectorAll('.handle')].forEach(h=> h.style.pointerEvents='auto');
  }

  function updateUndoButtons(){
    document.getElementById('btnUndo').disabled = !History.canUndo();
    document.getElementById('btnRedo').disabled = !History.canRedo();
  }

  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  return {init, refreshLayers, updateOverlay, updateUndoButtons, toast, showHelp, hideHelp};
})();
