(function () {
  const OUTPUT = 1080;        // square output, the size of the shop's sample images
  const FONT = '"SF Thonburi", "Thonburi", -apple-system, system-ui, sans-serif';
  const COLORS = { red: '#e01b12', black: '#000000', yellow: '#ffd400', white: '#ffffff' };
  const PREFS_KEY = 'tag-prefs-v3';
  const TABLE_ONE_COLUMN_MAX = 5;   // more sizes than this split into two columns
  const PHOTO_EDGE = 1440;          // short edge of a stored photo; keeps the phone's storage from filling up
  const SAVE_DELAY = 300;
  const SESSION_KEY = 'tag-session-v1';
  const CUSTOM_SIZE_CHARS = 1000;   // keeps typing and drawing quick on the phone
  const LIST_PX = 35;               // size list text and row height, from the sample images
  const LIST_ROW = 55;
  const LIST_PAD = 40;
  const WRAP_PX = 50;               // size words are measured at, then scaled
  const SWIPE_PX = 60;              // finger travel that counts as a swipe
  const AXIS_PX = 10;               // travel needed to tell a swipe from a drag
  const SCREENS = ['screenBrand', 'screenPhoto', 'screenCategory', 'screenForm'];
  const TEXT_PX = 46;               // starting size of added text
  const OLD_TEXT_PX = { s: 34, m: 46, l: 64 };   // saved before the size became a slider
  const OLD_SCALES = { s: 80, m: 100, l: 125 };
  const COLOR_NAMES = { white: 'ขาว', black: 'ดำ', yellow: 'เหลือง', red: 'แดง' };
  const SHAPES = [['circle', 'วงกลม'], ['star', 'ดาว'], ['square', 'สี่เหลี่ยม'], ['heart', 'หัวใจ']];

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

  const allChartSizes = (category) => (category && category.sizeChart ? category.sizeChart.names : []);

  const newItem = (id, brandId, category) => ({
    id,
    brandId,
    img: null,              // HTMLImageElement, loaded only while needed
    url: null,
    photo: null,            // photo not yet written to the phone's storage
    loading: null,
    category,
    sizes: new Set(allChartSizes(category)),   // size labels, or size names on a chart
    chart: { kind: 'top', size: '', value: '', custom: '' },   // what was typed for a size chart
    sizeScale: 100,         // percent, for the size box of this item only
    pan: { x: 0.5, y: 0.5 },   // which part of the photo the square crop shows
    moved: emptyMoved(),    // top-left of a dragged block, as a fraction of the image
    price: '',
    full: '',
    code: '',
    extras: [],             // added text and pictures
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
    prefs: { scale: 100, box: 'red', text: 'white', subText: 'white' },
    blocks: {},             // where each block is drawn, in canvas pixels
    drag: null,
    framing: null,          // id of the added picture being adjusted inside its shape
  };

  const item = () => state.items[state.index] || null;

  // Preferences are a convenience only; the app works the same without storage.
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (saved) Object.assign(state.prefs, saved);
      if (state.prefs.size) state.prefs.scale = OLD_SCALES[state.prefs.size] || 100;
      delete state.prefs.size;
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

  const withoutImage = ({ img, url, photo, loading, ...kept }) => kept;

  const toRecord = (it) => ({
    id: it.id,
    brandId: it.brandId,
    categoryId: it.category ? it.category.id : null,
    sizes: [...it.sizes],
    chart: it.chart,
    sizeScale: it.sizeScale,
    pan: it.pan,
    moved: it.moved,
    price: it.price,
    full: it.full,
    code: it.code,
    extras: it.extras.map(withoutImage),
  });

  const upgradeExtra = (extra) => {
    if (extra.kind !== 'text' || !extra.size) return extra;
    const { size, ...kept } = extra;
    return { ...kept, px: OLD_TEXT_PX[size] };
  };

  function fromRecord(record) {
    const brand = Catalog.BRANDS.find((b) => b.id === record.brandId);
    const category = brand && brand.categories
      ? brand.categories.find((c) => c.id === record.categoryId) || null
      : null;
    const it = newItem(record.id, record.brandId, category);
    const { sizes, chart, sizeScale = 100, pan, moved, price, full, code, extras = [] } = record;
    Object.assign(it, { sizes: new Set(sizes), sizeScale, pan, moved, price, full, code, extras: extras.map(upgradeExtra) });
    if (chart) Object.assign(it.chart, chart);
    if (Array.isArray(it.chart.custom)) it.chart.custom = it.chart.custom.filter(Boolean).join('\n');   // was one row each
    // Clothes saved when the only choice was the fixed list S เอว 28 to 2XL เอว 36.
    else if (category && category.sizeChart) {
      Object.assign(it.chart, { kind: 'bottom', size: 'S', value: '28' });
      it.sizes = new Set(sizes.map((label) => label.split(' ')[0]));
    }
    return it;
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
    it.extras.forEach(forgetExtra);
    Store.removeItem(it.id).catch(saveFailed);
  }

  function forgetExtra(extra) {
    if (extra.kind !== 'image') return;
    releaseImage(extra);
    Store.removePhoto(extra.id).catch(saveFailed);
  }

  let lastId = 0;
  function nextId() {
    lastId = Math.max(Date.now(), lastId + 1);
    return lastId;
  }

  const addedPictures = (it) => it.extras.filter((extra) => extra.kind === 'image');

  // Photos are read from storage only when needed, so a long list stays light.
  // An item and each of its added pictures hold their photo the same way.
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

  const ensureAllImages = (it) => Promise.all([ensureImage(it), ...addedPictures(it).map(ensureImage)]);

  function releaseAllImages(it) {
    releaseImage(it);
    addedPictures(it).forEach(releaseImage);
  }

  function releaseOthers() {
    state.items.forEach((it) => { if (it !== item() && it !== building) releaseAllImages(it); });
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
    if (item()) {
      it.chart.kind = item().chart.kind;
      it.sizeScale = item().sizeScale;
    }
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
      it.sizes = new Set(allChartSizes(category));
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
    state.framing = null;
    buildSizes();
    buildExtras();
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
      await ensureAllImages(it);
    } catch (e) {
      if (it !== item()) return;
      setStatus('เปิดรูปบางรูปของชิ้นนี้ไม่ได้ แตะ “ถ่ายรูปใหม่” หรือลบภาพเพิ่มเติมแล้วใส่ใหม่', true);
      render();
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

  // S, xl or XXL become the names used on the chart.
  function chartName(raw) {
    const text = raw.trim().toUpperCase();
    const repeated = text.match(/^(X{2,4})(S|L)$/);
    return repeated ? `${repeated[1].length}X${repeated[2]}` : text;
  }

  function chartRows(it) {
    const { names, step, kinds } = it.category.sizeChart;
    const base = Number(it.chart.value);
    const start = names.indexOf(chartName(it.chart.size));
    if (start < 0 || !it.chart.value.trim() || !Number.isFinite(base)) return [];
    const { word } = kinds[it.chart.kind];
    return names
      .map((name, i) => ({ key: name, measure: base + (i - start) * step }))
      .filter((row) => row.measure > 0)
      .map(({ key, measure }) => ({ key, label: `${key} ${word} ${measure}` }));
  }

  // key is what a selection remembers, so a chart keeps it when its numbers change.
  function sizeRows(it) {
    if (isCustom(it)) return [];
    if (it.category.sizeChart) return chartRows(it);
    return it.category.sizes.map((label) => ({ key: label, label }));
  }

  const isCustom = (it) => !!it.category.sizeChart && it.chart.kind === 'custom';

  const chosenSizes = (it) => sizeRows(it).filter(({ key }) => it.sizes.has(key)).map(({ label }) => label);

  function chartHint(it) {
    const { names, kinds } = it.category.sizeChart;
    const { size, value, kind } = it.chart;
    if (size.trim() && !names.includes(chartName(size))) return `ไซส์ต้องอยู่ระหว่าง ${names[0]} ถึง ${names[names.length - 1]}`;
    if (value.trim() && !Number.isFinite(Number(value))) return `${kinds[kind].word}ต้องเป็นตัวเลข`;
    if (!sizeRows(it).length) return `กรอกไซส์และ${kinds[kind].word} แล้วไซส์ที่เหลือจะขึ้นมาเอง`;
    return 'แตะไซส์ที่ไม่มีเพื่อเอาออก';
  }

  function buildCustomSizes(box, it) {
    const wrap = box.appendChild(make('label', 'custom-size'));
    const area = wrap.appendChild(make('textarea'));
    Object.assign(area, { value: it.chart.custom, placeholder: 'พิมพ์ไซส์ได้หลายบรรทัด', maxLength: CUSTOM_SIZE_CHARS, rows: 4 });
    area.setAttribute('aria-label', 'ไซส์พิเศษ');
    const grow = () => {
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight + 2}px`;
    };
    area.addEventListener('input', () => {
      it.chart.custom = area.value;
      grow();
      sizesChanged();
    });
    box.appendChild(make('p', 'chart-hint', 'แตะขึ้นบรรทัดใหม่เพื่อแยกแถว ถ้าข้อความยาวเกินรูป แอปจะตัดบรรทัดและย่อตัวอักษรให้เอง'));
    requestAnimationFrame(grow);    // needs the panel on screen to measure
  }

  function buildChart() {
    const box = $('chartForm');
    box.textContent = '';
    const it = item();
    const chart = it.category.sizeChart;
    if (!chart) return;
    box.appendChild(optionRow('ประเภท', Object.entries(chart.kinds).map(([id, kind]) => [id, kind.name]), it.chart.kind, (kind) => {
      it.chart.kind = kind;
      sizesChanged();
      buildSizes();
    }));
    if (isCustom(it)) {
      buildCustomSizes(box, it);
      return;
    }
    const fields = box.appendChild(make('div', 'chart-fields'));
    const hint = make('p', 'chart-hint', chartHint(it));
    const field = (label, key, attrs) => {
      const wrap = fields.appendChild(make('label', 'field'));
      wrap.appendChild(make('span', '', label));
      const input = wrap.appendChild(make('input'));
      Object.assign(input, { value: it.chart[key], autocomplete: 'off', ...attrs });
      input.addEventListener('input', () => {
        it.chart[key] = input.value;
        hint.textContent = chartHint(it);
        sizesChanged();
        buildSizeButtons();
      });
    };
    field('ไซส์', 'size', { placeholder: 'เช่น S', autocapitalize: 'characters', spellcheck: false });
    field(chart.kinds[it.chart.kind].word, 'value', { placeholder: 'เช่น 30', inputMode: 'decimal' });
    box.appendChild(hint);
  }

  function buildSizeButtons() {
    $('sizeGrid').textContent = '';
    sizeRows(item()).forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.key = key;
      btn.addEventListener('click', () => {
        const chosen = item().sizes;
        if (chosen.has(key)) chosen.delete(key);
        else chosen.add(key);
        sizesChanged();
      });
      $('sizeGrid').appendChild(btn);
    });
    paintSizes();
  }

  function buildSizes() {
    const { category } = item();
    $('sizePanel').hidden = !category.sizeChart && !category.sizes.length;
    $('sizeBulk').hidden = isCustom(item());
    buildChart();
    buildSizeButtons();
    $('sizeScaleRow').textContent = '';
    $('sizeScaleRow').appendChild(sliderRow('ขนาดกล่องไซส์', 40, 150, item().sizeScale, (percent) => {
      item().sizeScale = percent;
      sizesChanged();
    }));
  }

  function paintSizes() {
    $('sizeGrid').querySelectorAll('button').forEach((btn) => {
      const on = item().sizes.has(btn.dataset.key);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on);
    });
  }

  function sizesChanged() {
    changed();
    paintSizes();
    render();
  }

  // --- Added text and pictures ---

  const startPoint = (i) => ({ x: 0.5, y: 0.35 + (i % 4) * 0.1 });

  function extrasChanged() {
    changed();
    render();
  }

  function removeExtra(extra) {
    const it = item();
    it.extras = it.extras.filter((one) => one !== extra);
    forgetExtra(extra);
    if (state.framing === extra.id) state.framing = null;
    extrasChanged();
    buildExtras();
  }

  function addText() {
    const it = item();
    it.extras.push({
      kind: 'text', id: nextId(), at: startPoint(it.extras.length),
      text: '', color: 'white', fill: 'black', px: TEXT_PX,
    });
    extrasChanged();
    buildExtras();
    const inputs = $('textList').querySelectorAll('input');
    inputs[inputs.length - 1].focus();
  }

  async function onExtraPhoto(file) {
    if (!file) return;
    try {
      const { img, url, blob } = await shrinkPhoto(file);
      const it = item();
      const extra = {
        kind: 'image', id: nextId(), at: startPoint(it.extras.length),
        shape: 'circle', size: 0.3, zoom: 1, crop: { x: 0.5, y: 0.5 },
        img, url, photo: null, loading: null,
      };
      it.extras.push(extra);
      keepPhoto(extra, blob);
      extrasChanged();
      buildExtras();
    } catch (e) {
      setStatus('เปิดภาพนี้ไม่ได้ ลองเลือกภาพอื่น', true);
    }
  }

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function optionRow(label, options, current, pick) {
    const row = make('div', 'opt');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.appendChild(make('span', '', label));
    const seg = row.appendChild(make('div', 'seg'));
    const buttons = options.map(([value, name]) => {
      const btn = seg.appendChild(make('button', '', name));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        pick(value);
        paint(value);
      });
      return [value, btn];
    });
    function paint(chosen) {
      buttons.forEach(([value, btn]) => {
        btn.classList.toggle('on', value === chosen);
        btn.setAttribute('aria-pressed', value === chosen);
      });
    }
    paint(current);
    return row;
  }

  function sliderRow(label, min, max, value, onInput) {
    const row = make('label', 'opt');
    row.appendChild(make('span', '', label));
    const input = row.appendChild(make('input'));
    Object.assign(input, { type: 'range', min, max, value });
    const shown = row.appendChild(make('output', '', String(Math.round(value))));
    input.addEventListener('input', () => {
      shown.textContent = input.value;
      onInput(Number(input.value));
    });
    return row;
  }

  function removeButton(text, extra) {
    const btn = make('button', 'link danger', text);
    btn.type = 'button';
    btn.addEventListener('click', () => removeExtra(extra));
    return btn;
  }

  function textCard(extra) {
    const card = make('div', 'extra-card');
    const field = card.appendChild(make('label', 'field'));
    field.appendChild(make('span', '', 'ข้อความ'));
    const input = field.appendChild(make('input'));
    Object.assign(input, { value: extra.text, placeholder: 'พิมพ์ข้อความ', maxLength: 80, autocomplete: 'off' });
    input.addEventListener('input', () => {
      extra.text = input.value;
      extrasChanged();
    });
    const set = (key) => (value) => {
      extra[key] = value;
      extrasChanged();
    };
    const colors = Object.entries(COLOR_NAMES);
    card.appendChild(optionRow('สีตัวหนังสือ', colors, extra.color, set('color')));
    card.appendChild(optionRow('พื้นหลัง', [['none', 'ไม่มี'], ...colors], extra.fill, set('fill')));
    card.appendChild(sliderRow('ขนาด', 16, 200, extra.px, set('px')));
    const actions = card.appendChild(make('div', 'extra-actions'));
    actions.appendChild(removeButton('ลบข้อความนี้', extra));
    return card;
  }

  function imageCard(extra) {
    const card = make('div', 'extra-card');
    card.appendChild(optionRow('รูปทรง', SHAPES, extra.shape, (shape) => {
      extra.shape = shape;
      extrasChanged();
    }));
    card.appendChild(sliderRow('ขนาดกรอบ', 15, 80, extra.size * 100, (percent) => {
      extra.size = percent / 100;
      extrasChanged();
    }));
    card.appendChild(sliderRow('ซูมภาพ', 100, 400, extra.zoom * 100, (percent) => {
      extra.zoom = percent / 100;
      extrasChanged();
    }));
    const framing = state.framing === extra.id;
    const actions = card.appendChild(make('div', 'extra-actions'));
    const frameBtn = actions.appendChild(make('button', 'link', framing ? 'จัดภาพเสร็จแล้ว' : 'จัดภาพในกรอบ'));
    frameBtn.type = 'button';
    frameBtn.addEventListener('click', () => {
      state.framing = framing ? null : extra.id;
      buildExtras();
      render();
    });
    actions.appendChild(removeButton('ลบภาพนี้', extra));
    if (framing) card.appendChild(make('p', 'extra-tip', 'ลากบนรูปเพื่อเลือกส่วนที่จะโชว์ ถ้าภาพไม่ขยับ ให้ซูมภาพเพิ่มก่อน'));
    return card;
  }

  function buildExtras() {
    $('textList').textContent = '';
    $('imageList').textContent = '';
    item().extras.forEach((extra) => {
      if (extra.kind === 'text') $('textList').appendChild(textCard(extra));
      else $('imageList').appendChild(imageCard(extra));
    });
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

  // Where the letters really land when drawn left-aligned at x = 0. Safari misplaces
  // centred Thai on a canvas, so the boxes go by drawn pixels instead of its metrics.
  const inkCanvas = document.createElement('canvas');
  const inkCache = new Map();

  function inkOf(text, weight, px) {
    const key = `${weight}|${px}|${text}`;
    if (inkCache.has(key)) return inkCache.get(key);
    const width = OUTPUT * 2;
    const height = px * 2;
    inkCanvas.width = width;     // also clears it
    inkCanvas.height = height;
    const c = inkCanvas.getContext('2d', { willReadFrequently: true });
    c.font = `${weight} ${px}px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(text, px, px);
    const { data } = c.getImageData(0, 0, width, height);
    let first = width;
    let last = -1;
    for (let i = 3, n = 0; i < data.length; i += 4, n++) {
      if (data[i] < 32) continue;
      const col = n % width;
      if (col < first) first = col;
      if (col > last) last = col;
    }
    const ink = last < 0
      ? { width: 0, center: 0 }
      : { width: last - first + 1, center: (first + last + 1) / 2 - px };
    if (inkCache.size > 3000) inkCache.clear();
    inkCache.set(key, ink);
    return ink;
  }

  function placeBlock(name, w, h, defaultX, defaultY) {
    const at = subject.moved[name];
    const x = Math.max(0, Math.min(OUTPUT - w, at ? at.x * OUTPUT : defaultX));
    const y = Math.max(0, Math.min(OUTPUT - h, at ? at.y * OUTPUT : defaultY));
    blocksOut[name] = { x, y, w, h };
    return { x, y };
  }

  function boxedText(text, weight, px, x, y, w, h, fill, ink) {
    if (fill) {
      pen.fillStyle = fill;
      pen.fillRect(x, y, w, h);
    }
    pen.fillStyle = ink;
    const room = w * 0.92;
    const natural = inkOf(text, weight, px);
    const size = natural.width > room ? Math.floor((px * room) / natural.width) : px;
    const drawn = size === px ? natural : inkOf(text, weight, size);
    pen.font = `${weight} ${size}px ${FONT}`;
    pen.textAlign = 'left';
    pen.textBaseline = 'middle';
    pen.fillText(text, x + w / 2 - drawn.center, y + h / 2);
  }

  // All measurements come from the shop's 1080px sample images; u is the size option.
  function drawPriceBlock(u, priceText, fullText) {
    const mainH = 102 * u;
    const subH = 58 * u;
    const mainPx = Math.round(62 * u);
    const subPx = Math.round(30 * u);
    const widest = Math.max(
      280 * u,
      priceText ? inkOf(priceText, 800, mainPx).width + 48 * u : 0,
      fullText ? inkOf(fullText, 700, subPx).width + 48 * u : 0
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
    const w = Math.min(Math.max(147 * u, inkOf(code, 700, px).width + 32 * u), OUTPUT * 0.9);
    const { x, y } = placeBlock('code', w, h, OUTPUT - w - 53 * u, OUTPUT - h - 48 * u);
    boxedText(code, 700, px, x, y, w, h, '#000000', COLORS[state.prefs.subText]);
  }

  // Thai has no spaces between words. Older iPhones lack Segmenter and break between letters.
  const splitterFor = (granularity) => (Intl.Segmenter ? new Intl.Segmenter('th', { granularity }) : null);
  const wordSplitter = splitterFor('word');
  const letterSplitter = splitterFor('grapheme');
  const split = (splitter, text) => (splitter ? [...splitter.segment(text)].map((part) => part.segment) : [...text]);

  const wordWidth = (word) => (word.trim() ? inkOf(word, 700, WRAP_PX).width : WRAP_PX * 0.3);

  function wrapLine(line, px, room) {
    const toRoom = px / WRAP_PX;
    const parts = split(wordSplitter, line)
      .flatMap((word) => (wordWidth(word) * toRoom > room ? split(letterSplitter, word) : [word]));
    const lines = [];
    let current = '';
    let used = 0;
    parts.forEach((part) => {
      const width = wordWidth(part) * toRoom;
      if (current && used + width > room) {
        lines.push(current);
        current = '';
        used = 0;
      }
      current += part;
      used += width;
    });
    lines.push(current);
    return lines.map((text) => text.trim());
  }

  // Long lines wrap, and the whole list shrinks when it is taller than the photo.
  function fitCustomSizes(text, u) {
    const typed = text.trimEnd();
    if (!typed) return { labels: [], scale: u };
    for (let scale = u; ; scale *= 0.9) {
      const room = OUTPUT * 0.9 - LIST_PAD * scale;
      const px = Math.round(LIST_PX * scale);
      const labels = typed.split('\n').flatMap((line) => wrapLine(line, px, room));
      if (labels.length * LIST_ROW * scale <= OUTPUT * 0.9 || scale < 0.3) return { labels, scale };
    }
  }

  // Large centred rows: clothes and socks.
  function drawSizeList(u, labels, bottom) {
    const px = Math.round(LIST_PX * u);
    const row = LIST_ROW * u;
    const inks = labels.map((t) => inkOf(t, 700, px));
    const w = Math.max(...inks.map((ink) => ink.width)) + LIST_PAD * u;
    const h = labels.length * row + u;
    const { x, y } = placeBlock('sizes', w, h, 60 * u, OUTPUT - (OUTPUT - bottom) * u - h);
    pen.fillStyle = '#000000';
    pen.fillRect(x, y, w, h);
    pen.fillStyle = COLORS[state.prefs.subText];
    pen.font = `700 ${px}px ${FONT}`;
    pen.textAlign = 'left';
    pen.textBaseline = 'middle';
    labels.forEach((t, i) => pen.fillText(t, x + w / 2 - inks[i].center, y + u / 2 + row * (i + 0.5)));
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

  function placeExtra(extra, w, h) {
    const x = Math.max(0, Math.min(OUTPUT - w, extra.at.x * OUTPUT - w / 2));
    const y = Math.max(0, Math.min(OUTPUT - h, extra.at.y * OUTPUT - h / 2));
    blocksOut.extras.push({ extra, x, y, w, h });
    return { x, y };
  }

  function drawTextExtra(extra) {
    const text = extra.text.trim();
    if (!text) return;
    const { px } = extra;
    const w = Math.min(inkOf(text, 700, px).width + px, OUTPUT * 0.9);
    const h = Math.round(px * 1.6);
    const { x, y } = placeExtra(extra, w, h);
    boxedText(text, 700, px, x, y, w, h, COLORS[extra.fill], COLORS[extra.color]);
  }

  function starPath(cx, cy, outer) {
    const inner = outer * 0.45;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      pen.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    pen.closePath();
  }

  function heartPath(x, y, s) {
    pen.moveTo(x + s / 2, y + s);
    pen.bezierCurveTo(x - s * 0.15, y + s * 0.55, x + s * 0.02, y - s * 0.05, x + s / 2, y + s * 0.25);
    pen.bezierCurveTo(x + s * 0.98, y - s * 0.05, x + s * 1.15, y + s * 0.55, x + s / 2, y + s);
    pen.closePath();
  }

  function shapePath(shape, x, y, side) {
    const r = side / 2;
    pen.beginPath();
    if (shape === 'circle') pen.arc(x + r, y + r, r, 0, Math.PI * 2);
    else if (shape === 'star') starPath(x + r, y + r * 1.1, r);
    else if (shape === 'heart') heartPath(x, y, side);
    else pen.rect(x, y, side, side);
  }

  // Side of the square taken from an added picture, in photo pixels.
  const shownSide = (extra) => Math.min(extra.img.naturalWidth, extra.img.naturalHeight) / extra.zoom;

  function drawImageExtra(extra) {
    if (!extra.img) return;
    const side = extra.size * OUTPUT;
    const { x, y } = placeExtra(extra, side, side);
    const shown = shownSide(extra);
    pen.save();
    shapePath(extra.shape, x, y, side);
    pen.clip();
    pen.drawImage(
      extra.img,
      (extra.img.naturalWidth - shown) * extra.crop.x, (extra.img.naturalHeight - shown) * extra.crop.y, shown, shown,
      x, y, side, side
    );
    pen.restore();
    if (pen === ctx && state.framing === extra.id) {   // guide on screen only, never in the sent image
      pen.save();
      pen.strokeStyle = '#ffd400';
      pen.lineWidth = 4;
      pen.setLineDash([16, 10]);
      pen.strokeRect(x, y, side, side);
      pen.restore();
    }
  }

  function drawExtras(it) {
    blocksOut.extras = [];
    addedPictures(it).forEach(drawImageExtra);
    it.extras.filter((extra) => extra.kind === 'text').forEach(drawTextExtra);   // words stay readable
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
    const u = state.prefs.scale / 100;
    const sizeU = u * (it.sizeScale / 100);
    const sizes = isCustom(it) ? fitCustomSizes(it.chart.custom, sizeU) : { labels: chosenSizes(it), scale: sizeU };

    if (priceText || fullText) drawPriceBlock(u, priceText, fullText);
    if (sizes.labels.length) {
      const draw = it.category.layout === 'list' ? drawSizeList : drawSizeTable;
      draw(sizes.scale, sizes.labels, it.category.bottom);
    }
    if (code) drawCodeBlock(u, code);
    drawExtras(it);
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
      await ensureAllImages(it);
    } catch (e) {
      building = null;
      if (state.items.includes(it)) setStatus('เปิดรูปบางชิ้นไม่ได้ เลื่อนไปชิ้นนั้นแล้วถ่ายรูปใหม่ หรือลบภาพเพิ่มเติมแล้วใส่ใหม่', true);
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
      if (it !== item()) releaseAllImages(it);
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

  [['productCam', onProduct], ['productLib', onProduct], ['retakeCam', onRetake], ['retakeLib', onRetake],
    ['extraCam', onExtraPhoto], ['extraLib', onExtraPhoto]].forEach(([id, handler]) => {
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

  $('addTextBtn').addEventListener('click', addText);

  $('allSizesBtn').addEventListener('click', () => {
    sizeRows(item()).forEach(({ key }) => item().sizes.add(key));
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

  function paintScale() {
    $('scaleRange').value = state.prefs.scale;
    $('scaleValue').textContent = state.prefs.scale;
  }

  $('scaleRange').addEventListener('input', () => {
    state.prefs.scale = Number($('scaleRange').value);
    savePrefs();
    paintScale();
    state.items.forEach(invalidate);
    changed();
    render();
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

  function extraAt(p) {
    return (state.blocks.extras || []).slice().reverse()
      .find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  }

  const framedExtra = () => item().extras.find((extra) => extra.id === state.framing && extra.img);

  canvas.addEventListener('pointerdown', (e) => {
    if (!item() || !item().img) return;
    const p = canvasPoint(e);
    const framed = framedExtra();
    const added = extraAt(p);
    const name = blockAt(p);
    canvas.setPointerCapture(e.pointerId);
    if (framed) {
      state.drag = { framed, start: p, crop: { ...framed.crop } };
    } else if (added) {
      state.drag = { added: added.extra, dx: p.x - (added.x + added.w / 2), dy: p.y - (added.y + added.h / 2) };
    } else if (name) {
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

  // Dragging right brings in more of the picture's left side, as with the main photo.
  function dragCrop(p) {
    const { framed, start, crop } = state.drag;
    const shown = shownSide(framed);
    const toPhoto = shown / (framed.size * OUTPUT);
    const slide = (from, moved, slack) => (slack > 0
      ? Math.max(0, Math.min(1, from - (moved * toPhoto) / slack))
      : 0.5);
    framed.crop = {
      x: slide(crop.x, p.x - start.x, framed.img.naturalWidth - shown),
      y: slide(crop.y, p.y - start.y, framed.img.naturalHeight - shown),
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
    if (drag.framed) {
      dragCrop(p);
    } else if (drag.added) {
      drag.added.at = { x: (p.x - drag.dx) / OUTPUT, y: (p.y - drag.dy) / OUTPUT };
    } else if (drag.name) {
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
    const p = canvasPoint(e.touches[0]);
    if (x || y || state.items.length > 1 || state.framing || extraAt(p) || blockAt(p)) e.preventDefault();
  }, { passive: false });

  // Swiping anywhere else on the form also changes item. Inputs keep their own
  // touch handling so text can still be selected.
  let swipeStart = null;
  $('screenForm').addEventListener('touchstart', (e) => {
    const onOwnGesture = e.target === canvas || ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
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
    item().extras.forEach((extra, i) => { extra.at = startPoint(i); });
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
  paintScale();
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
    const kept = new Set(state.items.flatMap((it) => [it.id, ...addedPictures(it).map((extra) => extra.id)]));
    Store.prunePhotos(kept).catch(() => { /* retried on the next launch */ });
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
