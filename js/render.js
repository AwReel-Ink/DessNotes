const Render = (() => {
  let canvas, ctx;
  let docW = 1280, docH = 800;
  let zoom = 1;
  let needsRender = false;

  function init(){
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    setSize(docW, docH);
    loop();
  }

  function setSize(w,h){
    docW = w; docH = h;
    canvas.width = w;
    canvas.height = h;
    applyZoom();
    requestRender();
  }

  function setZoom(z){
    zoom = Math.max(0.05, Math.min(8, z));
    applyZoom();
    document.getElementById('zoomInfo').textContent = Math.round(zoom*100)+'%';
  }
  function getZoom(){ return zoom; }

  function applyZoom(){
    canvas.style.width = (docW*zoom)+'px';
    canvas.style.height = (docH*zoom)+'px';
    UI.updateOverlay();
  }

  function fitToView(){
    const wrap = document.getElementById('canvasWrap');
    const pad = 40;
    const zx = (wrap.clientWidth-pad)/docW;
    const zy = (wrap.clientHeight-pad)/docH;
    setZoom(Math.min(zx,zy,1));
  }

  function getDocSize(){ return {w:docW,h:docH}; }

  function requestRender(){ needsRender = true; }

  function loop(){
    if(needsRender){ needsRender = false; render(); }
    requestAnimationFrame(loop);
  }

  function render(){
    ctx.clearRect(0,0,docW,docH);
    const layers = Layers.all();
    for(const L of layers){
      if(!L.visible) continue;
      drawLayer(L);
    }
  }

  function drawLayer(L){
    ctx.save();
    ctx.globalAlpha = L.opacity;
    const cx = L.x + L.w/2;
    const cy = L.y + L.h/2;
    ctx.translate(cx,cy);
    ctx.rotate(L.rotation*Math.PI/180);
    ctx.scale(L.flipH?-1:1, L.flipV?-1:1);
    ctx.translate(-L.w/2, -L.h/2);
    if(L.type === 'image' && L.bitmap){
      ctx.drawImage(L.bitmap, 0, 0, L.w, L.h);
    } else if(L.type === 'draw' && L.canvas){
      ctx.drawImage(L.canvas, 0, 0, L.w, L.h);
    } else if(L.type === 'text'){
      drawText(L);
    }
    ctx.restore();
  }

  function drawText(L){
    const t = L.text;
    let style = '';
    if(t.italic) style += 'italic ';
    if(t.bold) style += 'bold ';
    ctx.font = `${style}${t.size}px ${t.font}`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = 'top';
    const lines = t.value.split('\n');
    let maxW = 0;
    for(const line of lines){ maxW = Math.max(maxW, ctx.measureText(line).width); }
    const h = lines.length * t.size * 1.2;
    // mise à jour taille (utile pour bbox)
    L.w = Math.max(maxW, 20);
    L.h = Math.max(h, t.size);
    let y = 0;
    for(const line of lines){
      ctx.fillText(line, 0, y);
      y += t.size*1.2;
    }
  }

  // Conversion coordonnées (event souris) -> coordonnées document
  function clientToDoc(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left)/zoom,
      y: (clientY - r.top)/zoom
    };
  }

  // Aplatit tout en un canvas (export/print)
  function flatten(visibleOnly=true){
    const c = document.createElement('canvas');
    c.width = docW; c.height = docH;
    const cx = c.getContext('2d');
    for(const L of Layers.all()){
      if(visibleOnly && !L.visible) continue;
      cx.save();
      cx.globalAlpha = L.opacity;
      const ccx = L.x + L.w/2, ccy = L.y + L.h/2;
      cx.translate(ccx,ccy);
      cx.rotate(L.rotation*Math.PI/180);
      cx.scale(L.flipH?-1:1, L.flipV?-1:1);
      cx.translate(-L.w/2, -L.h/2);
      if(L.type==='image' && L.bitmap) cx.drawImage(L.bitmap,0,0,L.w,L.h);
      else if(L.type==='draw' && L.canvas) cx.drawImage(L.canvas,0,0,L.w,L.h);
      else if(L.type==='text'){
        const t=L.text; let s=''; if(t.italic)s+='italic ';if(t.bold)s+='bold ';
        cx.font=`${s}${t.size}px ${t.font}`; cx.fillStyle=t.color; cx.textBaseline='top';
        let y=0; for(const ln of t.value.split('\n')){ cx.fillText(ln,0,y); y+=t.size*1.2; }
      }
      cx.restore();
    }
    return c;
  }

  return {init,setSize,setZoom,getZoom,fitToView,getDocSize,requestRender,clientToDoc,flatten};
})();
