const IO = (() => {

  async function openImageFile(file){
    let blob = file;
    const name = (file.name||'').toLowerCase();
    if(name.endsWith('.heic') || name.endsWith('.heif') || file.type==='image/heic' || file.type==='image/heif'){
      try{
        UI.toast('Conversion HEIC...');
        blob = await heic2any({blob:file, toType:'image/png'});
      }catch(e){ UI.toast('HEIC non supporté : '+e.message); return; }
    }
    try{
      const bm = await createImageBitmap(blob);
      if(Layers.all().length === 0){
        Render.setSize(bm.width, bm.height);
      }
      Layers.addImageLayer(bm, file.name||'Image');
      Render.fitToView();
    }catch(e){
      UI.toast('Format non supporté : '+(file.name||''));
    }
  }

  function exportPNG(){
    const c = Render.flatten(true);
    c.toBlob(b=>{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'dessnotes-'+Date.now()+'.png';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    },'image/png');
    UI.toast('Export PNG lancé');
  }

  async function saveProject(){
    const data = await Layers.serialize();
    data._meta = {app:'DessNotes',version:1,t:Date.now()};
    const json = JSON.stringify(data);
    const blob = new Blob([json],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'projet-'+Date.now()+'.dnotes';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    UI.toast('Projet sauvegardé');
  }

  async function loadProject(file){
    try{
      const txt = await file.text();
      const data = JSON.parse(txt);
      Layers.clear();
      await Layers.deserialize(data);
      Render.requestRender();
      UI.refreshLayers();
      Render.fitToView();
      History.clear();
      await History.push('load');
      UI.toast('Projet chargé');
    }catch(e){ UI.toast('Erreur chargement : '+e.message); }
  }

  function printIt(){
    const c = Render.flatten(true);
    const url = c.toDataURL('image/png');
    const w = window.open('','_blank');
    if(!w){ UI.toast('Popup bloqué'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Impression DessNotes</title>
      <style>
        @page{margin:1cm}
        html,body{margin:0;padding:0;background:#fff;text-align:center}
        img{max-width:100%;max-height:100vh;object-fit:contain}
        @media print{img{max-height:none}}
      </style></head><body>
      <img src="${url}" onload="setTimeout(()=>{window.print();},300)">
      </body></html>`);
    w.document.close();
  }

  return {openImageFile, exportPNG, saveProject, loadProject, printIt};
})();
