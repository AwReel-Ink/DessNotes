const Layers = (() => {
  let list = [];
  let selectedId = null;
  let nextId = 1;

  function newLayer(opts={}){
    return Object.assign({
      id: nextId++,
      name: 'Calque '+nextId,
      type: 'draw',     // 'image' | 'draw' | 'text'
      visible: true,
      locked: false,
      x:0, y:0, w:Render.getDocSize().w, h:Render.getDocSize().h,
      rotation:0, flipH:false, flipV:false,
      opacity:1,
      bitmap:null,    // ImageBitmap ou Image
      canvas:null,    // OffscreenCanvas/canvas pour calque dessin
      text:null       // {value,font,size,color,bold,italic}
    }, opts);
  }

  function addDrawLayer(name){
    const {w,h} = Render.getDocSize();
    const L = newLayer({type:'draw', name:name||'Dessin', w, h});
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    L.canvas = c;
    list.push(L);
    select(L.id);
    Render.requestRender();
    UI.refreshLayers();
    History.push('add layer');
    return L;
  }

  function addImageLayer(bitmap, name){
    const L = newLayer({
      type:'image', name:name||'Image',
      w:bitmap.width, h:bitmap.height,
      bitmap
    });
    list.push(L);
    select(L.id);
    Render.requestRender();
    UI.refreshLayers();
    History.push('add image');
    return L;
  }

  function addTextLayer(x,y,opts){
    const L = newLayer({
      type:'text', name:'Texte',
      x,y, w:200, h:opts.size*1.2,
      text:Object.assign({value:'Texte',font:'Arial',size:32,color:'#ffffff',bold:false,italic:false},opts)
    });
    list.push(L);
    select(L.id);
    Render.requestRender();
    UI.refreshLayers();
    History.push('add text');
    return L;
  }

  function all(){ return list; }
  function get(id){ return list.find(l=>l.id===id); }
  function selected(){ return get(selectedId); }
  function select(id){ selectedId = id; UI.refreshLayers(); UI.updateOverlay(); }

  function remove(id){
    list = list.filter(l=>l.id!==id);
    if(selectedId===id) selectedId = list.length? list[list.length-1].id : null;
    Render.requestRender(); UI.refreshLayers();
    History.push('delete layer');
  }
  function move(id,dir){
    const i = list.findIndex(l=>l.id===id);
    if(i<0) return;
    const j = i+dir;
    if(j<0||j>=list.length) return;
    [list[i],list[j]] = [list[j],list[i]];
    Render.requestRender(); UI.refreshLayers();
    History.push('move layer');
  }
  function duplicate(id){
    const L = get(id); if(!L) return;
    const D = Object.assign({},L,{id:nextId++,name:L.name+' copie',x:L.x+20,y:L.y+20});
    if(L.type==='draw'){
      const c = document.createElement('canvas');
      c.width=L.canvas.width; c.height=L.canvas.height;
      c.getContext('2d').drawImage(L.canvas,0,0);
      D.canvas = c;
    }
    if(L.type==='text') D.text = Object.assign({},L.text);
    const i = list.findIndex(l=>l.id===id);
    list.splice(i+1,0,D);
    select(D.id);
    Render.requestRender(); UI.refreshLayers();
    History.push('duplicate layer');
  }
  function setVisible(id,v){
    const L = get(id); if(L){ L.visible=v; Render.requestRender(); UI.refreshLayers(); }
  }
  function rename(id,name){ const L=get(id); if(L){L.name=name;UI.refreshLayers();} }
  function clear(){ list = []; selectedId = null; nextId = 1; }

  // Sérialisation pour historique / sauvegarde
  async function serialize(){
    const out = [];
    for(const L of list){
      const e = {id:L.id,name:L.name,type:L.type,visible:L.visible,locked:L.locked,
        x:L.x,y:L.y,w:L.w,h:L.h,rotation:L.rotation,flipH:L.flipH,flipV:L.flipV,
        opacity:L.opacity};
      if(L.type==='image' && L.bitmap){
        e.dataURL = await bitmapToDataURL(L.bitmap);
      } else if(L.type==='draw' && L.canvas){
        e.dataURL = L.canvas.toDataURL('image/png');
      } else if(L.type==='text'){
        e.text = Object.assign({},L.text);
      }
      out.push(e);
    }
    return {layers:out, doc:Render.getDocSize(), nextId, selectedId};
  }

  async function deserialize(data){
    list = [];
    nextId = data.nextId || 1;
    for(const e of data.layers){
      const L = Object.assign({},e);
      L.bitmap = null; L.canvas = null;
      if(e.type==='image' && e.dataURL){
        L.bitmap = await loadImage(e.dataURL);
      } else if(e.type==='draw' && e.dataURL){
        const c = document.createElement('canvas');
        c.width = L.w; c.height = L.h;
        const img = await loadImage(e.dataURL);
        c.getContext('2d').drawImage(img,0,0);
        L.canvas = c;
      }
      delete L.dataURL;
      list.push(L);
    }
    selectedId = data.selectedId;
    if(data.doc) Render.setSize(data.doc.w,data.doc.h);
  }

  function bitmapToDataURL(bm){
    return new Promise(res=>{
      const c = document.createElement('canvas');
      c.width = bm.width; c.height = bm.height;
      c.getContext('2d').drawImage(bm,0,0);
      res(c.toDataURL('image/png'));
    });
  }
  function loadImage(src){
    return new Promise((res,rej)=>{
      const i = new Image();
      i.onload = ()=> res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  return {addDrawLayer,addImageLayer,addTextLayer,all,get,selected,select,
    remove,move,duplicate,setVisible,rename,clear,serialize,deserialize};
})();
