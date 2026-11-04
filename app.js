(function () {
  const OUTPUT = 1080;        // square output, the size of the shop's sample images
  const FONT = '"SF Thonburi", "Thonburi", -apple-system, system-ui, sans-serif';
  const COLORS = { red: '#e01b12', black: '#000000', yellow: '#ffd400', white: '#ffffff' };
  const SCALES = { s: 0.8, m: 1, l: 1.25 };
  const PREFS_KEY = 'tag-prefs-v3';
  const TABLE_ONE_COLUMN_MAX = 5;   // more sizes than this split into two columns
  const PHOTO_EDGE = 1440;          // short edge of a stored photo; keeps the phone's storage from filling up
  const SAVE_DELAY = 300;
  const SESSION_KEY = 'tag-session-v1';
  const SWIPE_PX = 60;              // finger travel that counts as a swipe
  const AXIS_PX = 10;               // travel needed to tell a swipe from a drag
  const SCREENS = ['screenBrand', 'screenPhoto', 'screenCategory', 'screenForm'];

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const offCanvas = document.createElement('canvas');
  offCanvas.width = OUTPUT;
  offCanvas.height = OUTPUT;
  const offCtx = offCanvas.getContext('2d');
  const priceInput = $('price');
  const codeInput = $('code');
  const fullInput = $('fullPrice');
  const statusEl = $('status');
  const sendBtn = $('sendBtn');

  const emptyMoved = () => ({ price: null, code: null, sizes: null });

  const newItem = (id, brandId, category) => ({
    id,
    brandId,
    img: null,              // HTMLImageElement, loaded only while needed
    url: null,
    photo: null,            // photo not yet written to the phone's storage
    loading: null,
    category,
    sizes: new Set(),
    pan: { x: 0.5, y: 0.5 },   // which part of the photo the square crop shows
    moved: emptyMoved(),    // top-left of a dragged block, as a fraction of the image
    price: '',
    full: '',
    code: '',
    file: null,             // finished JPEG, built in the background
    rev: 0,                 // bumped on every change so a slow build can tell it is out of date
  });

  const state = {
    screen: 'screenBrand',
    brand: null,
    lastCategory: null,     // used for the next item
    items: [],              // everything kept on this phone, oldest first
    index: -1,
    adding: true,           // the next photo starts a new item instead of replacing this one
    prefs: { size: 'm', box: 'red', text: 'white', subText: 'white' },
    blocks: {},             // where each block is drawn, in canvas pixels
    drag: null,
  };

  const item = () => state.items[state.index] || null;

  // Preferences are a convenience only; the app works the same without storage.
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (saved) Object.assign(state.prefs, saved);
    } catch (e) { /* use defaults */ }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch (e) { /* ignore */ }
  }

  function setStatus(text, warn) {
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
    statusEl.classList.toggle('warn', !!warn);
  }

  // --- Keeping items on the phone ---

  const toRecord = (it) => ({
    id: it.id,
    brandId: it.brandId,
    categoryId: it.category ? it.category.id : null,
    sizes: [...it.sizes],
    pan: it.pan,
    moved: it.moved,
    price: it.price,
    full: it.full,
    code: it.code,
  });

  function fromRecord(record) {
    const brand = Catalog.BRANDS.find((b) => b.id === record.brandId);
    const category = brand && brand.categories
      ? brand.categories.find((c) => c.id === record.categoryId) || null
      : null;
    const it = newItem(record.id, record.brandId, category);
    const { sizes, pan, moved, price, full, code } = record;
    return Object.assign(it, { sizes: new Set(sizes), pan, moved, price, full, code });
  }

  function saveFailed() {
    setStatus('บันทึกลงเครื่องไม่สำเร็จ พื้นที่อาจเต็ม ส่งงานที่ค้างเข้า LINE เพื่อคืนพื้นที่', true);
  }

  const unsaved = new Set();
  let saveTimer = null;

  function queueSave(it) {
    unsaved.add(it);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSaves, SAVE_DELAY);
  }

  function flushSaves() {
    clearTimeout(saveTimer);
    if (!unsaved.size) return;
    const records = [...unsaved].map(toRecord);
    unsaved.clear();
    Store.saveItems(records).catch(saveFailed);
  }

  async function keepPhoto(it, blob) {
    it.photo = blob;
    try {
      await Store.savePhoto(it.id, blob);
      if (it.photo === blob) it.photo = null;
    } catch (e) {
      saveFailed();
    }
  }

  function saveSession() {
    try { localStorage.setItem(SESSION_KEY, String(item().id)); } catch (e) { /* ignore */ }
  }

  function savedSession() {
    try { return Number(localStorage.getItem(SESSION_KEY)); } catch (e) { return 0; }
  }

  function dropItem(it) {
    unsaved.delete(it);
    if (it.url) URL.revokeObjectURL(it.url);
    Store.removeItem(it.id).catch(saveFailed);
  }

  let lastId = 0;
  function nextId() {
    lastId = Math.max(Date.now(), lastId + 1);
    return lastId;
  }

  // Photos are read from storage only when needed, so a long list stays light.
  function ensureImage(it) {
    if (it.img) return Promise.resolve();
    if (!it.loading) {
      it.loading = (async () => {
        const blob = it.photo || await Store.loadPhoto(it.id);
        const { img, url } = await loadImage(blob);
        Object.assign(it, { img, url });
      })().finally(() => { it.loading = null; });
    }
    return it.loading;
  }

  function releaseImage(it) {
    if (!it.url) return;
    URL.revokeObjectURL(it.url);
    Object.assign(it, { img: null, url: null });
  }

  function releaseOthers() {
    state.items.forEach((it) => { if (it !== item() && it !== building) releaseImage(it); });
  }

  // --- Screens ---

  function show(screen) {
    state.screen = screen;
    SCREENS.forEach((id) => { $(id).hidden = id !== screen; });
    const onForm = screen === 'screenForm';
    $('backBtn').hidden = screen === 'screenBrand';
    $('nextBtn').hidden = !onForm;
    $('sendBar').hidden = !onForm;
    $('title').textContent = state.brand && screen !== 'screenBrand' ? state.brand.name : 'ติดราคา';
    setStatus('');
    scrollTo(0, 0);
  }

  function goBack() {
    if (state.screen === 'screenPhoto' && state.adding && item()) {
      openForm();
      return;
    }
    const i = SCREENS.indexOf(state.screen);
    if (i > 0) show(SCREENS[i - 1]);
  }

  function buildBrands() {
    Catalog.BRANDS.forEach((brand) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `brand brand-${brand.id}`;
      btn.disabled = !brand.categories;
      btn.innerHTML = '<b></b><small></small>';
      btn.querySelector('b').textContent = brand.name;
      btn.querySelector('small').textContent = brand.categories ? '' : 'เร็ว ๆ นี้';
      btn.addEventListener('click', () => chooseBrand(brand));
      $('brandGrid').appendChild(btn);
    });
  }

  function chooseBrand(brand) {
    state.brand = brand;
    state.lastCategory = null;
    state.adding = true;
    // A photo that never got a category has nothing worth keeping.
    state.items.filter((it) => !it.category).forEach(dropItem);
    state.items = state.items.filter((it) => it.category);
    state.index = state.items.length - 1;
    buildCategories(brand);
    show('screenPhoto');
  }

  function buildCategories(brand) {
    $('categoryGrid').textContent = '';
    brand.categories.forEach((category) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = category.name;
      btn.addEventListener('click', () => chooseCategory(category));
      $('categoryGrid').appendChild(btn);
    });
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  // Stored photos are cut down to what the 1080px output can use.
  async function shrinkPhoto(file) {
    const loaded = await loadImage(file);
    const { img, url } = loaded;
    const scale = PHOTO_EDGE / Math.min(img.naturalWidth, img.naturalHeight);
    if (scale >= 1) return { ...loaded, blob: file };
    const small = document.createElement('canvas');
    small.width = Math.round(img.naturalWidth * scale);
    small.height = Math.round(img.naturalHeight * scale);
    small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((resolve) => { small.toBlob(resolve, 'image/jpeg', 0.9); });
    if (!blob) throw new Error('encode failed');
    return { ...await loadImage(blob), blob };
  }

  function addItem({ img, url, blob }) {
    const it = newItem(nextId(), state.brand.id, state.lastCategory);
    Object.assign(it, { img, url });
    state.items.push(it);
    state.index = state.items.length - 1;
    keepPhoto(it, blob);
    queueSave(it);
  }

  function replacePhoto({ img, url, blob }) {
    const it = item();
    releaseImage(it);
    Object.assign(it, { img, url, pan: { x: 0.5, y: 0.5 } });
    keepPhoto(it, blob);
    changed();
  }

  async function onProduct(file) {
    if (!file) return;
    try {
      const photo = await shrinkPhoto(file);
      if (state.adding || !item()) addItem(photo);
      else replacePhoto(photo);
      state.adding = false;
      $('categoryThumb').src = photo.url;
      // The next item in a run of the same category skips the category screen.
      if (item().category) openForm();
      else show('screenCategory');
    } catch (e) {
      setStatus('เปิดรูปสินค้าไม่ได้ ลองถ่ายใหม่อีกครั้ง', true);
    }
  }

  // A new photo for this item. Its price, code and sizes stay as they are.
  async function onRetake(file) {
    if (!file) return;
    try {
      replacePhoto(await shrinkPhoto(file));
      openForm();
    } catch (e) {
      setStatus('เปิดรูปสินค้าไม่ได้ ลองถ่ายใหม่อีกครั้ง', true);
    }
  }

  function chooseCategory(category) {
    const it = item();
    if (category !== it.category) {
      it.category = category;
      it.sizes.clear();
      it.moved.sizes = null;
      it.brandId = state.brand.id;
      changed();
    }
    state.lastCategory = category;
    openForm();
  }

  function openForm() {
    const it = item();
    priceInput.value = it.price;
    fullInput.value = it.full;
    codeInput.value = it.code;
    state.drag = null;
    buildSizes();
    show('screenForm');
    renderNav();
    saveSession();
    updateSendBar();
    scheduleBuild();
    paintWhenReady(it);
  }

  async function paintWhenReady(it) {
    if (!it.img) ctx.clearRect(0, 0, OUTPUT, OUTPUT);
    render();
    try {
      await ensureImage(it);
    } catch (e) {
      if (it === item()) setStatus('เปิดรูปชิ้นนี้ไม่ได้ แตะ “ถ่ายรูปใหม่” เพื่อใส่รูปอีกครั้ง', true);
      return;
    }
    if (it !== item()) return;
    $('categoryThumb').src = it.url;
    render();
    releaseOthers();
  }

  function deleteAll() {
    state.items.forEach(dropItem);
    state.items = [];
    state.index = -1;
    state.adding = true;
    show('screenPhoto');
  }

  function goToItem(step) {
    const target = state.index + step;
    if (target < 0 || target >= state.items.length) return;
    state.index = target;
    openForm();
  }

  function renderNav() {
    const count = state.items.length;
    $('itemNav').hidden = count < 2;
    $('earlierBtn').disabled = state.index === 0;
    $('laterBtn').disabled = state.index === count - 1;
    $('itemLabel').textContent = `ชิ้นที่ ${state.index + 1}/${count}`;
  }

  function invalidate(it) {
    it.file = null;
    it.rev += 1;
  }

  function changed() {
    const it = item();
    invalidate(it);
    queueSave(it);
    renderNav();
    updateSendBar();
    scheduleBuild();
  }

  function buildSizes() {
    const { sizes } = item().category;
    $('sizePanel').hidden = !sizes.length;
    $('sizeGrid').textContent = '';
    sizes.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const chosen = item().sizes;
        if (chosen.has(label)) chosen.delete(label);
        else chosen.add(label);
        sizesChanged();
      });
      $('sizeGrid').appendChild(btn);
    });
    paintSizes();
  }

  function paintSizes() {
    $('sizeGrid').querySelectorAll('button').forEach((btn) => {
      const on = item().sizes.has(btn.textContent);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on);
    });
  }

  function sizesChanged() {
    changed();
    paintSizes();
    render();
  }

  // --- Drawing ---

  function formatPrice(raw) {
    const text = String(raw).trim().replace(/,/g, '');
    if (!text) return '';
    if (/^\d+$/.test(text)) return `${text.replace(/^0+(?=\d)/, '')}.-`;
    return text;
  }

  let pen = ctx;           // surface being drawn on
  let subject = null;      // item being drawn
  let blocksOut = {};      // where its blocks landed

  function textWidth(text, weight, px) {
    pen.font = `${weight} ${px}px ${FONT}`;
    return pen.measureText(text).width;
  }

  function fitFont(text, weight, size, maxWidth) {
    const width = textWidth(text, weight, size);
    pen.font = `${weight} ${width > maxWidth ? Math.floor((size * maxWidth) / width) : size}px ${FONT}`;
  }

  function placeBlock(name, w, h, defaultX, defaultY) {
    const at = subject.moved[name];
    const x = Math.max(0, Math.min(OUTPUT - w, at ? at.x * OUTPUT : defaultX));
    const y = Math.max(0, Math.min(OUTPUT - h, at ? at.y * OUTPUT : defaultY));
    blocksOut[name] = { x, y, w, h };
    return { x, y };
  }

  function boxedText(text, weight, px, x, y, w, h, fill, ink) {
    pen.fillStyle = fill;
    pen.fillRect(x, y, w, h);
    pen.fillStyle = ink;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    fitFont(text, weight, px, w * 0.92);
    pen.fillText(text, x + w / 2, y + h / 2);
  }

  // All measurements come from the shop's 1080px sample images; u is the size option.
  function drawPriceBlock(u, priceText, fullText) {
    const mainH = 102 * u;
    const subH = 58 * u;
    const mainPx = Math.round(62 * u);
    const subPx = Math.round(30 * u);
    const widest = Math.max(
      280 * u,
      priceText ? textWidth(priceText, 800, mainPx) + 48 * u : 0,
      fullText ? textWidth(fullText, 700, subPx) + 48 * u : 0
    );
    const w = Math.min(widest, OUTPUT * 0.9);
    const h = (priceText ? mainH : 0) + (fullText ? subH : 0);
    const { x, y } = placeBlock('price', w, h, 60 * u, 108 * u);
    if (priceText) boxedText(priceText, 800, mainPx, x, y, w, mainH, COLORS[state.prefs.box], COLORS[state.prefs.text]);
    if (fullText) boxedText(fullText, 700, subPx, x, y + (priceText ? mainH : 0), w, subH, '#000000', COLORS[state.prefs.subText]);
  }

  function drawCodeBlock(u, code) {
    const px = Math.round(24 * u);
    const h = 50 * u;
    const w = Math.min(Math.max(147 * u, textWidth(code, 700, px) + 32 * u), OUTPUT * 0.9);
    const { x, y } = placeBlock('code', w, h, OUTPUT - w - 53 * u, OUTPUT - h - 48 * u);
    boxedText(code, 700, px, x, y, w, h, '#000000', COLORS[state.prefs.subText]);
  }

  // Large centred rows: clothes and socks.
  function drawSizeList(u, labels, bottom) {
    const px = Math.round(35 * u);
    const row = 55 * u;
    const w = Math.max(...labels.map((t) => textWidth(t, 700, px))) + 40 * u;
    const h = labels.length * row + u;
    const { x, y } = placeBlock('sizes', w, h, 60 * u, OUTPUT - (OUTPUT - bottom) * u - h);
    pen.fillStyle = '#000000';
    pen.fillRect(x, y, w, h);
    pen.fillStyle = COLORS[state.prefs.subText];
    pen.font = `700 ${px}px ${FONT}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    labels.forEach((t, i) => pen.fillText(t, x + w / 2, y + u / 2 + row * (i + 0.5)));
  }

  // Small left-aligned rows: shoes. The first column takes the extra row.
  function drawSizeTable(u, labels, bottom) {
    const px = Math.round(24 * u);
    const row = 33 * u;
    const padY = 6.5 * u;
    const padX = 4 * u;
    const split = labels.length > TABLE_ONE_COLUMN_MAX ? Math.ceil(labels.length / 2) : labels.length;
    const columns = [labels.slice(0, split), labels.slice(split)].filter((c) => c.length);
    const widest = (c) => Math.max(...c.map((t) => textWidth(t, 700, px)));
    const widths = columns.map((c, i) => widest(c) + padX + (i === 0 && columns.length > 1 ? 32 * u : 20 * u));
    const w = widths.reduce((a, b) => a + b, 0);
    const h = columns[0].length * row + padY * 2;
    const { x, y } = placeBlock('sizes', w, h, 75 * u, OUTPUT - (OUTPUT - bottom) * u - h);
    pen.fillStyle = '#000000';
    pen.fillRect(x, y, w, h);
    if (columns.length > 1) {
      pen.fillStyle = '#333333';
      pen.fillRect(x + widths[0], y, Math.max(1, u), h);
    }
    pen.fillStyle = COLORS[state.prefs.subText];
    pen.font = `700 ${px}px ${FONT}`;
    pen.textAlign = 'left';
    pen.textBaseline = 'middle';
    columns.forEach((column, c) => {
      const left = x + (c ? widths[0] : 0) + padX;
      const top = y + padY + ((columns[0].length - column.length) * row) / 2;
      column.forEach((t, i) => pen.fillText(t, left, top + row * (i + 0.5)));
    });
  }

  // How far the crop can slide, in photo pixels.
  function cropSlack(it = item()) {
    const { naturalWidth: w, naturalHeight: h } = it.img;
    const side = Math.min(w, h);
    return { side, x: w - side, y: h - side };
  }

  function drawPhoto(it) {
    const { side, x, y } = cropSlack(it);
    pen.drawImage(it.img, x * it.pan.x, y * it.pan.y, side, side, 0, 0, OUTPUT, OUTPUT);
  }

  function compose(it, surface, blocks) {
    pen = surface;
    subject = it;
    blocksOut = blocks;
    drawPhoto(it);
    const priceText = formatPrice(it.price);
    const full = it.full.trim().replace(/,/g, '');
    const fullText = full ? `ราคาปกติ ${full}` : '';
    const code = it.code.trim().toUpperCase();
    const labels = it.category.sizes.filter((label) => it.sizes.has(label));
    const u = SCALES[state.prefs.size];

    if (priceText || fullText) drawPriceBlock(u, priceText, fullText);
    if (labels.length) {
      const draw = it.category.layout === 'list' ? drawSizeList : drawSizeTable;
      draw(u, labels, it.category.bottom);
    }
    if (code) drawCodeBlock(u, code);
  }

  function render() {
    const it = item();
    state.blocks = {};
    if (!it || !it.category || !it.img) return;
    compose(it, ctx, state.blocks);
  }

  // JPEGs are built ahead of the tap: Safari only allows the share sheet straight
  // from a tap, with no slow work in between.
  const sendable = (it) => !!(it.category && formatPrice(it.price));
  let buildTimer = null;
  let building = null;     // item being built

  function scheduleBuild() {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(buildNext, 120);
  }

  async function buildNext() {
    if (building) return;
    const it = state.items.find((one) => !one.file && sendable(one));
    if (!it) return;
    building = it;
    try {
      await ensureImage(it);
    } catch (e) {
      building = null;
      if (state.items.includes(it)) setStatus('เปิดรูปบางชิ้นไม่ได้ เลื่อนไปชิ้นนั้นแล้วถ่ายรูปใหม่', true);
      else buildNext();
      return;
    }
    const { rev } = it;
    compose(it, offCtx, {});
    offCanvas.toBlob((blob) => {
      building = null;
      if (!blob) {
        setStatus('เตรียมรูปไม่สำเร็จ ลองแก้ไขรูปนั้นอีกครั้ง', true);
        return;
      }
      if (it.rev === rev) it.file = blob;
      if (it !== item()) releaseImage(it);
      updateSendBar();
      buildNext();
    }, 'image/jpeg', 0.92);
  }

  // --- Sending ---

  const itemsToSend = () => state.items.filter(sendable);

  function updateSendBar() {
    const batch = itemsToSend();
    const ready = batch.length > 0 && batch.every((it) => it.file);
    sendBtn.disabled = !ready;
    if (!batch.length) sendBtn.textContent = 'ใส่ราคาก่อนส่ง';
    else if (!ready) sendBtn.textContent = 'กำลังเตรียมรูป…';
    else sendBtn.textContent = batch.length > 1 ? `ส่งเข้า LINE ${batch.length} รูป` : 'ส่งเข้า LINE';

    const noPrice = state.items
      .map((it, i) => (sendable(it) ? 0 : i + 1))
      .filter(Boolean);
    const note = $('sendNote');
    note.hidden = !noPrice.length || !batch.length;
    note.textContent = `ชิ้นที่ ${noPrice.join(', ')} ยังไม่มีราคา จะไม่ถูกส่งและจะถูกลบ`;
  }

  function fileFor(it) {
    const code = it.code.trim().toUpperCase().replace(/[^\w-]+/g, '_') || 'product';
    return new File([it.file], `${state.items.indexOf(it) + 1}-${code}.jpg`, { type: 'image/jpeg' });
  }

  // Sending ends the run: everything is wiped, including items without a price.
  function finishSent(message) {
    deleteAll();
    setStatus(message);
  }

  function saveFallback(files) {
    files.forEach((file, i) => setTimeout(() => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, i * 400));
    finishSent(`บันทึก ${files.length} รูปแล้ว เปิด LINE แล้วส่งรูปได้เลย`);
  }

  async function send() {
    const batch = itemsToSend();
    if (!batch.length || batch.some((it) => !it.file)) return;
    const files = batch.map(fileFor);
    if (!navigator.canShare || !navigator.canShare({ files })) {
      saveFallback(files);
      return;
    }
    try {
      await navigator.share({ files });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('เปิดหน้าส่งรูปไม่ได้ ลองแตะอีกครั้ง', true);
      return;
    }
    finishSent(`ส่งแล้ว ${files.length} รูป และลบข้อมูลทั้งหมดออกจากเครื่องแล้ว`);
  }

  function nextItem() {
    state.adding = true;
    show('screenPhoto');
  }

  // --- Wiring ---

  [['productCam', onProduct], ['productLib', onProduct], ['retakeCam', onRetake], ['retakeLib', onRetake]].forEach(([id, handler]) => {
    const input = $(id);
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.value = '';     // lets the same photo be picked twice
      handler(file);
    });
  });

  [[priceInput, 'price'], [fullInput, 'full'], [codeInput, 'code']].forEach(([input, key]) => {
    input.addEventListener('input', () => {
      item()[key] = input.value;
      changed();
      render();
    });
  });

  $('allSizesBtn').addEventListener('click', () => {
    item().category.sizes.forEach((label) => item().sizes.add(label));
    sizesChanged();
  });
  $('noSizesBtn').addEventListener('click', () => {
    item().sizes.clear();
    sizesChanged();
  });

  document.querySelectorAll('.seg').forEach((seg) => {
    const key = seg.dataset.opt;
    const paint = () => seg.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.v === state.prefs[key];
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state.prefs[key] = btn.dataset.v;
      savePrefs();
      paint();
      state.items.forEach(invalidate);   // colours and size apply to every item
      changed();
      render();
    });
    seg.paint = paint;
  });

  function canvasPoint(e) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * OUTPUT,
      y: ((e.clientY - box.top) / box.height) * OUTPUT,
    };
  }

  // Topmost first, matching the drawing order.
  function blockAt(p) {
    return ['code', 'sizes', 'price'].find((name) => {
      const b = state.blocks[name];
      return b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!item() || !item().img) return;
    const p = canvasPoint(e);
    const name = blockAt(p);
    canvas.setPointerCapture(e.pointerId);
    if (name) {
      const b = state.blocks[name];
      state.drag = { name, dx: p.x - b.x, dy: p.y - b.y };
    } else {
      state.drag = { pan: { ...item().pan }, start: p, fromX: e.clientX, fromY: e.clientY, mode: null };
    }
  });

  function dragPhoto(p) {
    const { side, x, y } = cropSlack();
    const toPhoto = side / OUTPUT;
    const slide = (start, moved, slack) => (slack
      ? Math.max(0, Math.min(1, start - (moved * toPhoto) / slack))
      : 0.5);
    item().pan = {
      x: slide(state.drag.pan.x, p.x - state.drag.start.x, x),
      y: slide(state.drag.pan.y, p.y - state.drag.start.y, y),
    };
  }

  // A sideways drag changes item, unless the photo itself can slide sideways.
  function chooseDragMode(dx, dy) {
    const swipeable = state.items.length > 1 && !cropSlack().x;
    return swipeable && Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'pan';
  }

  canvas.addEventListener('pointermove', (e) => {
    const { drag } = state;
    if (!drag) return;
    const it = item();
    const p = canvasPoint(e);
    if (drag.name) {
      it.moved[drag.name] = { x: (p.x - drag.dx) / OUTPUT, y: (p.y - drag.dy) / OUTPUT };
    } else {
      const dx = e.clientX - drag.fromX;
      const dy = e.clientY - drag.fromY;
      if (!drag.mode) {
        if (Math.hypot(dx, dy) < AXIS_PX) return;
        drag.mode = chooseDragMode(dx, dy);
      }
      if (drag.mode === 'swipe') {
        drag.travel = dx;
        canvas.style.transform = `translateX(${dx}px)`;
        return;
      }
      dragPhoto(p);
    }
    changed();
    render();
  });

  function endDrag() {
    const { drag } = state;
    state.drag = null;
    canvas.style.transform = '';
    if (drag && drag.mode === 'swipe' && Math.abs(drag.travel) >= SWIPE_PX) goToItem(drag.travel < 0 ? 1 : -1);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { state.drag = null; canvas.style.transform = ''; });
  // Stops the page scrolling while a finger drags a block or the photo, or swipes.
  canvas.addEventListener('touchstart', (e) => {
    if (!item() || !item().img) return;
    const { x, y } = cropSlack();
    if (x || y || state.items.length > 1 || blockAt(canvasPoint(e.touches[0]))) e.preventDefault();
  }, { passive: false });

  // Swiping anywhere else on the form also changes item. Inputs keep their own
  // touch handling so text can still be selected.
  let swipeStart = null;
  $('screenForm').addEventListener('touchstart', (e) => {
    const onOwnGesture = e.target === canvas || e.target.tagName === 'INPUT';
    swipeStart = onOwnGesture || e.touches.length > 1 ? null : e.touches[0];
  }, { passive: true });
  $('screenForm').addEventListener('touchend', (e) => {
    if (!swipeStart) return;
    const end = e.changedTouches[0];
    const dx = end.clientX - swipeStart.clientX;
    const dy = end.clientY - swipeStart.clientY;
    swipeStart = null;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 2) goToItem(dx < 0 ? 1 : -1);
  }, { passive: true });

  // iOS can stop the app at any moment once it leaves the screen.
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSaves(); });
  window.addEventListener('pagehide', flushSaves);

  $('earlierBtn').addEventListener('click', () => goToItem(-1));
  $('laterBtn').addEventListener('click', () => goToItem(1));

  $('resetPosBtn').addEventListener('click', () => {
    item().moved = emptyMoved();
    item().pan = { x: 0.5, y: 0.5 };
    changed();
    render();
  });

  $('backBtn').addEventListener('click', goBack);
  $('nextBtn').addEventListener('click', nextItem);
  sendBtn.addEventListener('click', send);

  // Install prompt: only for iPhone/iPad users still in the browser.
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let hintClosed = false;
  try { hintClosed = localStorage.getItem('tag-hint-closed') === '1'; } catch (e) { /* ignore */ }
  if (isIos && !navigator.standalone && !hintClosed) $('installHint').hidden = false;
  $('installClose').addEventListener('click', () => {
    $('installHint').hidden = true;
    try { localStorage.setItem('tag-hint-closed', '1'); } catch (e) { /* ignore */ }
  });

  loadPrefs();
  document.querySelectorAll('.seg').forEach((seg) => seg.paint());
  buildBrands();

  // Reopening the app carries on from the item left on screen.
  async function restore() {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    let records;
    try {
      records = await Store.loadItems();
    } catch (e) {
      setStatus('อ่านข้อมูลในเครื่องไม่ได้ งานใหม่อาจไม่ถูกบันทึก', true);
      return;
    }
    // Work sent by a version that kept it after sending.
    records.filter((r) => r.shared).forEach((r) => Store.removeItem(r.id).catch(saveFailed));
    const all = records.filter((r) => !r.shared).sort((x, y) => x.id - y.id).map(fromRecord);
    all.filter((it) => !it.category).forEach(dropItem);
    state.items = all.filter((it) => it.category);
    if (!state.items.length) return;
    lastId = state.items[state.items.length - 1].id;
    const left = state.items.findIndex((it) => it.id === savedSession());
    state.index = left >= 0 ? left : state.items.length - 1;
    state.brand = Catalog.BRANDS.find((b) => b.id === item().brandId);
    state.lastCategory = item().category;
    state.adding = false;
    buildCategories(state.brand);
    openForm();
  }
  restore();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* app still works online */ });
  }
})();
