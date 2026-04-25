const Tools = (() => {
  let current = 'move';
  let isDrawing = false, lastPt = null;
  let dragMode = null; // 'move' | 'resize-xx' | 'rotate' | 'crop'
  let dragStart = null, layerStart = null;
  let cropRect = null;

  // État dédié à l'outil ligne droite
  let lineState = null; // {x0, y0} après le 1er clic

  function init(){
    const canvas = document.getElementById('mainCanvas');
    const overlay = document.getElementById('overlay');
    const wrap = document.getElementById('canvasWrap');

    const down = e => onPointerDown(e);
    const move = e => onPointerMove(e);
    const up   = e => onPointerUp(e);

    canvas.addEventListener('pointerdown', down);
    overlay.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('dblclick', onDblClick);

    canvas.addEventListener('touchstart', e=>{ if(current!=='move') e.preventDefault(); }, {passive:false});

    // Échap = annule ligne en cours / crop
    window.addEventListener('keydown', e=>{
      if(e.target.isContentEditable || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
      if(e.key === 'Escape'){
        if(lineState){ cancelLine(); }
        else if(current === 'crop' && cropRect){ cancelCrop(); }
      }
    });

    // Clic droit = annule ligne en cours
    wrap.addEventListener('contextmenu', e=>{
      if(current === 'line' && lineState){
        e.preventDefault();
        cancelLine();
      }
    });
  }

  function set(t){
    // Annuler proprement une ligne en cours si on change d'outil
    if(lineState) cancelLine();

    current = t;
    document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===t));
    document.body.style.cursor =
      (t==='brush'||t==='eraser'||t==='line') ? 'crosshair' :
      (t==='picker') ? 'cell' :
      (t==='text')   ? 'text' : 'default';
    document.getElementById('textProps').style.display = (t==='text')?'block':'none';
    UI.updateOverlay();
  }
  function get(){ return current; }

  function onPointerDown(e){
    if(e.target.classList && e.target.classList.contains('handle')){
      startTransform(e);
      return;
    }
    const p = Render.clientToDoc(e.clientX, e.clientY);

    if(current==='brush' || current==='eraser'){
      const L = Layers.selected();
      if(!L || L.type!=='draw' || L.locked){
        UI.toast('Sélectionnez un calque de dessin (➕)');
        return;
      }
      isDrawing = true; lastPt = p;
      drawAt(L, p, p);
      e.preventDefault();
    }
    else if(current==='line'){
      lineOnPointerDown(p, e);
      e.preventDefault();
    }
    else if(current==='text'){
      Layers.addTextLayer(p.x, p.y, {
        font:document.getElementById('textFont').value,
        size:parseInt(document.getElementById('textSize').value),
        color:document.getElementById('brushColor').value,
        bold:document.getElementById('textBold').checked,
        italic:document.getElementById('textItalic').checked
      });
      editText(Layers.selected());
    }
    else if(current==='picker'){
      const c = Render.flatten(true);
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
      const hex = '#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
      document.getElementById('brushColor').value = hex;
      UI.toast('Couleur : '+hex);
    }
    else if(current==='move'){
      const layers = Layers.all();
      for(let i=layers.length-1;i>=0;i--){
        const L = layers[i];
        if(!L.visible) continue;
        if(p.x>=L.x && p.x<=L.x+L.w && p.y>=L.y && p.y<=L.y+L.h){
          Layers.select(L.id);
          dragMode = 'move';
          dragStart = p;
          layerStart = {x:L.x, y:L.y};
          return;
        }
      }
    }
    else if(current==='crop'){
      cropRect = {x:p.x, y:p.y, w:0, h:0};
      dragMode = 'crop';
      dragStart = p;
    }
  }

  function onPointerMove(e){
    const p = Render.clientToDoc(e.clientX, e.clientY);
    document.getElementById('statusInfo').textContent = `X:${Math.round(p.x)} Y:${Math.round(p.y)}`;

    if(isDrawing){
      const L = Layers.selected();
      if(L) drawAt(L, lastPt, p);
      lastPt = p;
    }
    else if(current === 'line' && lineState){
      lineOnPointerMove(p, e);
    }
    else if(dragMode==='move' && Layers.selected()){
      const L = Layers.selected();
      L.x = layerStart.x + (p.x-dragStart.x);
      L.y = layerStart.y + (p.y-dragStart.y);
      Render.requestRender();
      UI.updateOverlay();
    }
    else if(dragMode && dragMode.startsWith('resize')){
      doResize(p);
    }
    else if(dragMode==='rotate'){
      const L = Layers.selected();
      const cx = L.x+L.w/2, cy = L.y+L.h/2;
      const a = Math.atan2(p.y-cy, p.x-cx)*180/Math.PI + 90;
      L.rotation = a;
      Render.requestRender();
      UI.updateOverlay();
    }
    else if(dragMode==='crop'){
      cropRect.w = p.x - dragStart.x;
      cropRect.h = p.y - dragStart.y;
      drawCropOverlay();
    }
  }

  function onPointerUp(e){
    if(isDrawing){ isDrawing=false; lastPt=null; History.push('draw'); }
    if(dragMode==='move' || (dragMode && dragMode.startsWith('resize')) || dragMode==='rotate'){
      History.push('transform');
    }
    if(dragMode==='crop' && cropRect){
      finalizeCrop();
    }
    dragMode = null;
  }

  function drawAt(L, a, b){
    const ctx = L.canvas.getContext('2d');
    const ax = a.x - L.x, ay = a.y - L.y;
    const bx = b.x - L.x, by = b.y - L.y;
    ctx.save();
    if(current==='eraser'){
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = document.getElementById('brushColor').value;
      ctx.globalAlpha = parseInt(document.getElementById('brushOpacity').value)/100;
    }
    ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
    ctx.stroke();
    ctx.restore();
    Render.requestRender();
  }

  // ==== OUTIL LIGNE DROITE ====
  function lineOnPointerDown(p, e){
    const L = Layers.selected();
    if(!L || L.type !== 'draw' || L.locked){
      UI.toast('Sélectionnez un calque de dessin (➕)');
      return;
    }
    if(!lineState){
      // 1er clic : on pose le point de départ
      lineState = {x0:p.x, y0:p.y};
      showLineGuide(p.x, p.y, p.x, p.y);
    } else {
      // 2e clic : on valide la ligne
      const {x0, y0} = lineState;
      let x1 = p.x, y1 = p.y;
      if(e.shiftKey) [x1, y1] = constrainLine(x0, y0, x1, y1);
      drawLineOnLayer(L, x0, y0, x1, y1);
      lineState = null;
      hideLineGuide();
      Render.requestRender();
      History.push('line');
    }
  }

  function lineOnPointerMove(p, e){
    if(!lineState) return;
    const {x0, y0} = lineState;
    let x1 = p.x, y1 = p.y;
    if(e.shiftKey) [x1, y1] = constrainLine(x0, y0, x1, y1);
    showLineGuide(x0, y0, x1, y1);
  }

  function constrainLine(x0, y0, x1, y1){
    const dx = x1 - x0, dy = y1 - y0;
    const ang = Math.atan2(dy, dx);
    const step = Math.PI / 4; // 45°
    const snapped = Math.round(ang / step) * step;
    const len = Math.hypot(dx, dy);
    return [x0 + Math.cos(snapped)*len, y0 + Math.sin(snapped)*len];
  }

  function drawLineOnLayer(L, x0, y0, x1, y1){
    const ctx = L.canvas.getContext('2d');
    const size = parseInt(document.getElementById('brushSize').value);
    const color = document.getElementById('brushColor').value;
    const opacity = parseInt(document.getElementById('brushOpacity').value)/100;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 - L.x, y0 - L.y);
    ctx.lineTo(x1 - L.x, y1 - L.y);
    ctx.stroke();
    ctx.restore();
  }

  function showLineGuide(x0, y0, x1, y1){
    let g = document.getElementById('lineGuide');
    if(!g){
      g = document.createElement('div');
      g.id = 'lineGuide';
      document.getElementById('canvasWrap').appendChild(g);
    }
    const z = Render.getZoom();
    const canvas = document.getElementById('mainCanvas');
    const wrap = document.getElementById('canvasWrap');
    const r = canvas.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const ox = r.left - wr.left + wrap.scrollLeft;
    const oy = r.top  - wr.top  + wrap.scrollTop;
    const sx = ox + x0*z, sy = oy + y0*z;
    const ex = ox + x1*z, ey = oy + y1*z;
    const dx = ex - sx, dy = ey - sy;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    g.style.display = 'block';
    g.style.left = sx + 'px';
    g.style.top  = sy + 'px';
    g.style.width = len + 'px';
    g.style.transform = `rotate(${ang}deg)`;
  }

  function hideLineGuide(){
    const g = document.getElementById('lineGuide');
    if(g) g.style.display = 'none';
  }

  function cancelLine(){
    lineState = null;
    hideLineGuide();
  }

  // Transformation via poignées
  function startTransform(e){
    const handle = e.target.dataset.handle;
    const L = Layers.selected();
    if(!L) return;
    dragMode = handle==='rot' ? 'rotate' : 'resize-'+handle;
    dragStart = Render.clientToDoc(e.clientX, e.clientY);
    layerStart = {x:L.x,y:L.y,w:L.w,h:L.h,rotation:L.rotation};
    e.stopPropagation();
  }

  function doResize(p){
    const L = Layers.selected();
    if(!L) return;
    const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
    const h = dragMode.split('-')[1];
    let {x,y,w,h:hh} = layerStart;
    if(h.includes('e')) w = layerStart.w + dx;
    if(h.includes('w')){ w = layerStart.w - dx; x = layerStart.x + dx; }
    if(h.includes('s')) hh = layerStart.h + dy;
    if(h.includes('n')){ hh = layerStart.h - dy; y = layerStart.y + dy; }
    if(w<10) w=10; if(hh<10) hh=10;
    L.x=x; L.y=y; L.w=w; L.h=hh;
    Render.requestRender(); UI.updateOverlay();
  }

  function onDblClick(e){
    const p = Render.clientToDoc(e.clientX, e.clientY);
    const L = Layers.selected();
    if(L && L.type==='text' &&
       p.x>=L.x && p.x<=L.x+L.w && p.y>=L.y && p.y<=L.y+L.h){
      editText(L);
    }
  }

  function editText(L){
    const wrap = document.getElementById('canvasWrap');
    const z = Render.getZoom();
    const r = document.getElementById('mainCanvas').getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const div = document.createElement('div');
    div.className = 'textEdit';
    div.contentEditable = true;
    div.style.left = (r.left - wr.left + L.x*z + wrap.scrollLeft)+'px';
    div.style.top  = (r.top  - wr.top  + L.y*z + wrap.scrollTop )+'px';
    div.style.fontFamily = L.text.font;
    div.style.fontSize = (L.text.size*z)+'px';
    div.style.color = L.text.color;
    div.style.fontWeight = L.text.bold?'bold':'normal';
    div.style.fontStyle = L.text.italic?'italic':'normal';
    div.textContent = L.text.value;
    wrap.appendChild(div);
    div.focus();
    document.execCommand('selectAll',false,null);

    function finish(){
      L.text.value = div.innerText || ' ';
      div.remove();
      Render.requestRender();
      UI.updateOverlay();
      History.push('edit text');
    }
    div.addEventListener('blur', finish);
    div.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ div.blur(); }
    });
  }

  // CROP
  function drawCropOverlay(){
    const ov = document.getElementById('cropOverlay');
    const box = document.getElementById('cropBox');
    ov.classList.remove('hidden');
    const z = Render.getZoom();
    const r = document.getElementById('mainCanvas').getBoundingClientRect();
    const wr = document.getElementById('canvasWrap').getBoundingClientRect();
    let x = cropRect.x, y = cropRect.y, w = cropRect.w, h = cropRect.h;
    if(w<0){ x+=w; w=-w; }
    if(h<0){ y+=h; h=-h; }
    box.style.left = (r.left - wr.left + x*z)+'px';
    box.style.top  = (r.top  - wr.top  + y*z)+'px';
    box.style.width = (w*z)+'px';
    box.style.height = (h*z)+'px';
    cropRect._abs = {x,y,w,h};
  }

  function finalizeCrop(){
    // attente du clic sur "Appliquer"
  }

  function applyCrop(){
    if(!cropRect || !cropRect._abs){ cancelCrop(); return; }
    const {x,y,w,h} = cropRect._abs;
    if(w<5||h<5){ cancelCrop(); return; }
    for(const L of Layers.all()){
      L.x -= x; L.y -= y;
    }
    Render.setSize(Math.round(w), Math.round(h));
    cancelCrop();
    History.push('crop');
  }
  function cancelCrop(){
    cropRect = null;
    document.getElementById('cropOverlay').classList.add('hidden');
    set('move');
  }

  return {init, set, get, applyCrop, cancelCrop};
})();
