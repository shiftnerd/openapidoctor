/* Vector Doctor — app.js (advanced)
 * Client-side PNG/JPG/WebP → SVG with optional resize (ImageTracer.js)
 */

(function(){
  const els = {
    fileInput: document.getElementById('fileInput'),
    dropZone: document.getElementById('dropZone'),
    fileMeta: document.getElementById('fileMeta'),
    widthInput: document.getElementById('widthInput'),
    heightInput: document.getElementById('heightInput'),
    lockAspect: document.getElementById('lockAspect'),
    maxWidthInput: document.getElementById('maxWidthInput'),
    fitBtn: document.getElementById('fitBtn'),
    colorsInput: document.getElementById('colorsInput'),
    pathomitInput: document.getElementById('pathomitInput'),
    blurInput: document.getElementById('blurInput'),
    linefilterInput: document.getElementById('linefilterInput'),
    minareaInput: document.getElementById('minareaInput'),
    roundcoordsInput: document.getElementById('roundcoordsInput'),
    transparentBg: document.getElementById('transparentBg'),
    bgColorInput: document.getElementById('bgColorInput'),
    fallbackEmbed: document.getElementById('fallbackEmbed'),

    vectorizeBtn: document.getElementById('vectorizeBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    copyBtn: document.getElementById('copyBtn'),
    resetBtn: document.getElementById('resetBtn'),

    rasterInfo: document.getElementById('rasterInfo'),
    svgInfo: document.getElementById('svgInfo'),
    status: document.getElementById('status'),
    spinner: document.getElementById('spinner'),

    tabInput: document.getElementById('tabInput'),
    tabSVG: document.getElementById('tabSVG'),
    paneInput: document.getElementById('paneInput'),
    paneSVG: document.getElementById('paneSVG'),
    svgPreview: document.getElementById('svgPreview'),

    inputCanvas: document.getElementById('inputCanvas'),
    inputImg: document.getElementById('inputImg'),
  };

  const ctx = els.inputCanvas.getContext('2d');

  let state = {
    file: null,
    img: null,
    original: { w: 0, h: 0 },
    target: { w: 0, h: 0 },
    svgString: '',
    aspectLocked: true,
  };

  // Feature checks
  const hasImageTracer = typeof window.ImageTracer !== 'undefined';
  if(!hasImageTracer){
    toast('ImageTracer.js failed to load. Vectorization will be unavailable.', 'warn');
  }

  // Event wiring
  els.fileInput.addEventListener('change', handleFileInput);
  ['dragenter','dragover'].forEach(evt => els.dropZone.addEventListener(evt, dragEnter));
  ['dragleave','drop'].forEach(evt => els.dropZone.addEventListener(evt, dragLeave));
  els.dropZone.addEventListener('drop', handleDrop);
  els.dropZone.addEventListener('click', () => els.fileInput.click());

  els.widthInput.addEventListener('input', handleResizeInput);
  els.heightInput.addEventListener('input', handleResizeInput);
  els.lockAspect.addEventListener('change', () => state.aspectLocked = els.lockAspect.checked);
  els.fitBtn.addEventListener('click', fitToMaxWidth);

  els.transparentBg.addEventListener('change', () => {
    const on = els.transparentBg.checked;
    els.bgColorInput.disabled = on;
  });

  els.vectorizeBtn.addEventListener('click', onVectorize);
  els.downloadBtn.addEventListener('click', downloadSVG);
  els.copyBtn.addEventListener('click', copySVG);
  els.resetBtn.addEventListener('click', resetAll);

  els.tabInput.addEventListener('click', () => setTab('input'));
  els.tabSVG.addEventListener('click', () => setTab('svg'));

  function setTab(which){
    const inputActive = which === 'input';
    els.tabInput.classList.toggle('active', inputActive);
    els.tabSVG.classList.toggle('active', !inputActive);
    els.paneInput.classList.toggle('active', inputActive);
    els.paneSVG.classList.toggle('active', !inputActive);
  }

  function dragEnter(e){ e.preventDefault(); e.stopPropagation(); els.dropZone.classList.add('drag'); }
  function dragLeave(e){ e.preventDefault(); e.stopPropagation(); els.dropZone.classList.remove('drag'); }
  function handleDrop(e){
    e.preventDefault(); e.stopPropagation(); els.dropZone.classList.remove('drag');
    if(e.dataTransfer.files && e.dataTransfer.files[0]){
      els.fileInput.files = e.dataTransfer.files;
      handleFileInput({ target: { files: e.dataTransfer.files } });
    }
  }

  function handleFileInput(e){
    const file = e.target.files[0];
    if(!file){ return; }
    if(!/image\/(png|jpeg|webp)/i.test(file.type)){
      toast('Unsupported file type. Please use PNG, JPG, or WebP.', 'error');
      return;
    }
    state.file = file;
    state.svgString = '';
    els.downloadBtn.disabled = true;
    els.copyBtn.disabled = true;
    loadImageFile(file);
  }

  async function loadImageFile(file){
    // Read as object URL
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.onload = () => {
        state.img = img;
        state.original = { w: img.naturalWidth, h: img.naturalHeight };
        // Default target = original
        state.target = { ...state.original };
        els.widthInput.value = state.target.w;
        els.heightInput.value = state.target.h;
        drawInput(img, state.target.w, state.target.h);
        updateMeta();
        setTab('input');
      };
      img.onerror = () => toast('Failed to decode image.', 'error');
      img.src = url;
    } catch(err){
      console.error(err);
      toast('Could not load image.', 'error');
    }
  }

  function drawInput(img, w, h){
    els.inputCanvas.width = w;
    els.inputCanvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(img, 0, 0, w, h);
  }

  function updateMeta(){
    const f = state.file;
    if(f){
      const sizeKB = (f.size/1024).toFixed(1);
      els.fileMeta.textContent = `${f.name} — ${(sizeKB)} KB`;
      els.rasterInfo.textContent = `Input: ${state.original.w}×${state.original.h}px → ${state.target.w}×${state.target.h}px`;
    }else{
      els.fileMeta.textContent = '';
      els.rasterInfo.textContent = 'No image loaded';
    }
  }

  function handleResizeInput(e){
    if(!state.img) return;
    const id = e.target.id;
    const val = parseInt(e.target.value, 10);
    if(!Number.isFinite(val) || val <= 0) return;

    if(id === 'widthInput'){
      state.target.w = val;
      if(els.lockAspect.checked){
        state.target.h = Math.round(val * state.original.h / state.original.w);
        els.heightInput.value = state.target.h;
      }
    } else if(id === 'heightInput'){
      state.target.h = val;
      if(els.lockAspect.checked){
        state.target.w = Math.round(val * state.original.w / state.original.h);
        els.widthInput.value = state.target.w;
      }
    }
    drawInput(state.img, state.target.w, state.target.h);
    updateMeta();
  }

  function fitToMaxWidth(){
    if(!state.img) return;
    const maxw = parseInt(els.maxWidthInput.value, 10);
    if(!Number.isFinite(maxw) || maxw <= 0){
      toast('Enter a valid max width (px).', 'warn');
      return;
    }
    const ratio = state.original.h / state.original.w;
    const newW = Math.min(maxw, state.original.w);
    const newH = Math.round(newW * ratio);
    state.target = { w: newW, h: newH };
    els.widthInput.value = newW;
    els.heightInput.value = newH;
    drawInput(state.img, newW, newH);
    updateMeta();
  }

  function collectOptions(){
    const opts = {
      // ImageTracer options (commonly used subset)
      numberofcolors: clampInt(els.colorsInput.value, 2, 64, 8),
      pathomit: clampInt(els.pathomitInput.value, 0, 9999, 8),
      blurradius: clampInt(els.blurInput.value, 0, 50, 0),
      linefilter: !!els.linefilterInput.checked,
      minarea: clampInt(els.minareaInput.value, 0, 999999, 10),
      roundcoords: clampInt(els.roundcoordsInput.value, 0, 4, 1),
      ltres: 1,
      qtres: 1,
      scale: 1,
      viewbox: true
    };
    return opts;
  }

  function clampInt(v, min, max, def){
    const n = parseInt(v, 10);
    if(!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  async function onVectorize(){
    if(!state.img){
      toast('Load an image first.', 'warn');
      return;
    }
    setBusy(true, 'Processing…');

    // Draw current target to canvas
    drawInput(state.img, state.target.w, state.target.h);

    // Either vectorize or build raster-embed SVG
    const fallback = els.fallbackEmbed.checked;
    try {
      await tick(); // allow spinner to render
      let svg = '';
      if(fallback){
        svg = await buildRasterEmbedSVG();
      } else {
        if(!window.ImageTracer){
          throw new Error('ImageTracer.js is not available.');
        }
        const opts = collectOptions();
        // Get ImageData from canvas
        const imgdata = ImageTracer.getImgdata(els.inputCanvas);
        // Convert to SVG string
        svg = ImageTracer.imagedataToSVG(imgdata, opts);
      }
      state.svgString = prettySVG(svg);
      renderSVG(state.svgString);
      els.downloadBtn.disabled = false;
      els.copyBtn.disabled = false;
      const bytes = new Blob([state.svgString], {type:'image/svg+xml'}).size;
      els.svgInfo.textContent = `SVG: ${(bytes/1024).toFixed(1)} KB`;
      setTab('svg');
      toast('Done.');
    } catch(err){
      console.error(err);
      toast(err.message || 'Vectorization failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function prettySVG(svg){
    try {
      return svg
        .replace(/><(?!\/?svg)/g, '>\n<')
        .replace(/(>)(<svg)/, '$1\n$2');
    } catch{
      return svg;
    }
  }

  function renderSVG(svgstr){
    els.svgPreview.innerHTML = svgstr;
    const box = els.svgPreview.querySelector('svg');
    if(box){
      box.removeAttribute('width');
      box.removeAttribute('height');
      if(!box.getAttribute('viewBox')){
        box.setAttribute('viewBox', `0 0 ${state.target.w} ${state.target.h}`);
      }
      let title = box.querySelector('title');
      if(!title){
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = buildTitle();
        box.insertBefore(title, box.firstChild);
      }
    }
  }

  function buildTitle(){
    const fname = state.file ? state.file.name : 'image';
    return `Vectorized from ${fname} at ${state.target.w}×${state.target.h}px`;
  }

  async function buildRasterEmbedSVG(){
    const transparent = els.transparentBg.checked;
    let dataURL;
    if(transparent){
      dataURL = els.inputCanvas.toDataURL('image/png');
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = state.target.w; tmp.height = state.target.h;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = els.bgColorInput.value || '#000000';
      tctx.fillRect(0,0,tmp.width,tmp.height);
      tctx.drawImage(els.inputCanvas, 0, 0);
      dataURL = tmp.toDataURL('image/png');
    }
    const w = state.target.w, h = state.target.h;
    const bgRect = transparent ? '' :
      `<rect width="100%" height="100%" fill="${els.bgColorInput.value}"/>`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img">
  <title>${escapeXML(buildTitle())}</title>
  ${bgRect}
  <image href="${dataURL}" x="0" y="0" width="${w}" height="${h}" />
</svg>`;
    return svg;
  }

  function escapeXML(s){
    return String(s).replace(/[<>&'"]/g, c => ({
      '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'
    })[c]);
  }

  async function copySVG(){
    if(!state.svgString){ return; }
    try{
      await navigator.clipboard.writeText(state.svgString);
      toast('SVG copied to clipboard.');
    }catch{
      toast('Clipboard denied. You can still download the file.', 'warn');
    }
  }

  function downloadSVG(){
    if(!state.svgString){ return; }
    const fname = (state.file ? state.file.name.replace(/\.[^.]+$/, '') : 'vector') + '.svg';
    const blob = new Blob([state.svgString], { type:'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function setBusy(on, msg){
    els.vectorizeBtn.disabled = on;
    els.spinner.classList.toggle('hidden', !on);
    els.status.textContent = on ? (msg || 'Working…') : '';
  }

  function toast(message, level='info'){
    els.status.textContent = message;
    if(level === 'error'){
      els.status.style.color = 'var(--danger)';
    }else if(level === 'warn'){
      els.status.style.color = 'var(--accent)';
    }else{
      els.status.style.color = 'var(--muted)';
    }
  }

  function resetAll(){
    state = {
      file: null, img: null,
      original: { w:0, h:0 }, target: { w:0, h:0 },
      svgString: '', aspectLocked: true
    };
    els.fileInput.value = '';
    els.inputCanvas.width = 1; els.inputCanvas.height = 1;
    ctx.clearRect(0,0,1,1);
    els.svgPreview.innerHTML = '';
    els.downloadBtn.disabled = true;
    els.copyBtn.disabled = true;
    els.widthInput.value = '';
    els.heightInput.value = '';
    els.maxWidthInput.value = '';
    els.lockAspect.checked = true;
    els.transparentBg.checked = true;
    els.bgColorInput.disabled = true;
    setTab('input');
    els.rasterInfo.textContent = 'No image loaded';
    els.svgInfo.textContent = 'SVG: —';
    els.fileMeta.textContent = '';
    els.status.textContent = '';
  }

  function tick(){ return new Promise(r => setTimeout(r, 0)); }
})();