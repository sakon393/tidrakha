// In-app camera with a square viewfinder: what is in the square is exactly the 1080 × 1080 photo.
// "บุคคล" (portrait) keeps the middle sharp and blurs the edges. Web apps cannot use the iPhone's own
// Portrait mode, so this is done on the photo itself.
(function (root) {
  const OUTPUT = 1080;
  const MODE_KEY = 'tag-cam-mode';
  const SHARP = 0.30;   // radius of the sharp middle, as a fraction of the photo
  const SOFT = 0.62;    // radius where the blur is full

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function loadMode() {
    try { return localStorage.getItem(MODE_KEY) === 'portrait' ? 'portrait' : 'normal'; } catch (e) { return 'normal'; }
  }
  function saveMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* only a convenience */ }
  }

  let stream = null;
  let onPhoto = null;
  let mode = loadMode();
  const $ = (id) => document.getElementById(id);

  function paintMode() {
    $('camBlur').hidden = mode !== 'portrait';
    document.querySelectorAll('#camModes button').forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on);
    });
  }

  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $('camVideo').srcObject = null;
    $('camera').hidden = true;
    document.body.classList.remove('cam-open');
  }

  async function open(handler) {
    onPhoto = handler;
    $('camera').hidden = false;
    document.body.classList.add('cam-open');
    $('camShot').disabled = true;
    $('camError').hidden = true;
    paintMode();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
      });
      const video = $('camVideo');
      video.srcObject = stream;
      await video.play();
      $('camShot').disabled = false;
    } catch (e) {
      // The phone's own camera button under the viewfinder still works.
      $('camError').hidden = false;
    }
  }

  // Blur by shrinking and growing back in steps; works on every browser, unlike canvas filters.
  function blurred(source) {
    let cur = source;
    let size = OUTPUT;
    const steps = [];
    while (size > 40) {
      size = Math.round(size / 3);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, size, size);
      steps.push(c);
      cur = c;
    }
    for (let i = steps.length - 2; i >= -1; i--) {
      const next = i >= 0 ? steps[i] : document.createElement('canvas');
      if (i < 0) next.width = next.height = OUTPUT;
      const g = next.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
    }
    return cur;
  }

  function portrait(sharp) {
    const out = blurred(sharp);
    const middle = document.createElement('canvas');
    middle.width = middle.height = OUTPUT;
    const m = middle.getContext('2d');
    m.drawImage(sharp, 0, 0);
    const half = OUTPUT / 2;
    const fade = m.createRadialGradient(half, half, OUTPUT * SHARP, half, half, OUTPUT * SOFT);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    m.globalCompositeOperation = 'destination-in';
    m.fillStyle = fade;
    m.fillRect(0, 0, OUTPUT, OUTPUT);
    out.getContext('2d').drawImage(middle, 0, 0);
    return out;
  }

  function shoot() {
    const video = $('camVideo');
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const side = Math.min(w, h);
    let photo = document.createElement('canvas');
    photo.width = photo.height = OUTPUT;
    const c = photo.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, OUTPUT, OUTPUT);
    if (mode === 'portrait') photo = portrait(photo);
    const handler = onPhoto;
    photo.toBlob((blob) => {
      stop();
      if (blob && handler) handler(blob);
    }, 'image/jpeg', 0.95);
  }

  function init() {
    $('camShot').addEventListener('click', shoot);
    $('camClose').addEventListener('click', stop);
    // The phone's own camera, for when the in-app one is not wanted or cannot start.
    $('camNative').addEventListener('change', () => {
      const file = $('camNative').files[0];
      $('camNative').value = '';
      const handler = onPhoto;
      stop();
      if (file && handler) handler(file);
    });
    document.querySelectorAll('#camModes button').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        saveMode(mode);
        paintMode();
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stop(); });
  }

  root.Camera = { supported, open, init, stop };
})(globalThis);
