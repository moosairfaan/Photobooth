/**
 * Downtown Strip Photobooth — EmailJS + Gmail
 * https://www.emailjs.com/
 *
 * In EmailJS → Email Templates → your template:
 *   To Email:  {{to_email}}     ← must be this, NOT your Gmail address
 *   Body HTML: <img src="{{strip_image}}" alt="strip" style="max-width:200px;" />
 *   (Image is compressed to fit EmailJS 50KB variable limit.)
 */
const EMAILJS_CONFIG = {
  publicKey: "B0Bt2ml8mMlrc86SY",
  serviceId: "service_34plbbl",
  templateId: "template_7hk6sip",
};

/**
 * Cloudinary — unsigned upload preset (Settings → Upload → Upload presets)
 * https://cloudinary.com/
 */
const CLOUDINARY_CONFIG = {
  cloudName: "dbopivcyv",
  uploadPreset: "Photobooth",
};

const THEMES = {
  oldies: {
    stripLabel: "old friends • nyc",
    stripBg: "#faf6f0",
    borderColor: "#faf6f0",
    labelColor: "#5c4033",
    labelFont: 'italic 11px "IM Fell English", Georgia, serif',
    cameraFilter: "sepia(0.6) contrast(1.1) brightness(0.95)",
    canvasGrain: true,
  },
  cyberpunk: {
    stripLabel: "// NEON_RUN • 2077",
    stripBg: "#0a0a12",
    borderColor: "#00f5ff",
    labelColor: "#00f5ff",
    labelFont: '11px "Share Tech Mono", monospace',
    cameraFilter: "saturate(1.8) hue-rotate(160deg) contrast(1.3)",
    canvasGrain: false,
  },
  fantasy: {
    stripLabel: "✦ wish upon a star ✦",
    stripBg: "#fffafc",
    borderColor: "#f3e8ff",
    labelColor: "#7d5a8c",
    labelFont: 'italic 12px "Cormorant Garamond", Georgia, serif',
    cameraFilter: "saturate(1.3) brightness(1.1) hue-rotate(20deg)",
    canvasGrain: false,
  },
  simple: {
    stripLabel: "DOWNTOWN STRIP",
    stripBg: "#ffffff",
    borderColor: "#ffffff",
    labelColor: "#111111",
    labelFont: '600 10px "Instrument Sans", "DM Sans", sans-serif',
    cameraFilter: "grayscale(1) contrast(1.05)",
    canvasGrain: false,
  },
};

let selectedTheme = "oldies";
const COUNTDOWN_SECONDS = 3;
const PHOTO_COUNT = 4;
const STRIP_WIDTH = 280;
const PHOTO_HEIGHT = 200;
const BORDER = 4;
const LABEL_HEIGHT = 36;

const screens = {
  landing: document.getElementById("screen-landing"),
  themes: document.getElementById("screen-themes"),
  camera: document.getElementById("screen-camera"),
  strip: document.getElementById("screen-strip"),
  email: document.getElementById("screen-email"),
  success: document.getElementById("screen-success"),
};

const video = document.getElementById("camera-preview");
const captureCanvas = document.getElementById("capture-canvas");
const stripCanvas = document.getElementById("strip-canvas");
const countdownEl = document.getElementById("countdown");
const flashEl = document.getElementById("flash");
const shotCurrentEl = document.getElementById("shot-current");
const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email-input");
const emailError = document.getElementById("email-error");
const qrPanel = document.getElementById("qr-panel");
const qrCodeEl = document.getElementById("qr-code");
const qrStatusEl = document.getElementById("qr-status");
const btnShareScan = document.getElementById("btn-share-scan");
const downloadLink = document.getElementById("download-link");

let mediaStream = null;
let capturedPhotos = [];
let stripDataUrl = null;
let cloudinaryImageUrl = null;
let isCapturing = false;

/** Theme-screen choices (editable until Enter the booth) */
let uiCameraFacing = "user";
let uiFlashEnabled = true;

/** Locked for the active booth session */
let sessionCameraFacing = "user";
let sessionFlashEnabled = true;

// ——— Screen navigation ———
function setTheme(themeId) {
  selectedTheme = themeId;
  document.body.classList.remove(
    "theme-oldies", "theme-cyberpunk", "theme-fantasy", "theme-simple"
  );
  document.body.classList.add(`theme-${themeId}`);
}

function getTheme() {
  return THEMES[selectedTheme] || THEMES.oldies;
}

function syncThemeCards() {
  document.querySelectorAll(".theme-card").forEach((c) => {
    const on = c.dataset.theme === selectedTheme;
    c.classList.toggle("theme-card--selected", on);
    c.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function syncCameraPills() {
  document.querySelectorAll("[data-facing]").forEach((pill) => {
    const on = pill.dataset.facing === uiCameraFacing;
    pill.classList.toggle("pill--active", on);
  });
  document.querySelectorAll("[data-flash]").forEach((pill) => {
    const on =
      (pill.dataset.flash === "on" && uiFlashEnabled) ||
      (pill.dataset.flash === "off" && !uiFlashEnabled);
    pill.classList.toggle("pill--active", on);
  });
}

function lockSessionCameraSettings() {
  sessionCameraFacing = uiCameraFacing;
  sessionFlashEnabled = uiFlashEnabled;
}

function restoreCameraUiFromSession() {
  uiCameraFacing = sessionCameraFacing;
  uiFlashEnabled = sessionFlashEnabled;
  syncCameraPills();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    const active = key === name;
    el.classList.toggle("screen--active", active);
    el.hidden = !active;
  });
}

// ——— Web Audio shutter ———
let audioCtx = null;

function playShutter() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const duration = 0.06;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + duration);

    filter.type = "highpass";
    filter.frequency.value = 800;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);

    const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.02, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.15, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    noise.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
  } catch (_) {
    /* audio optional */
  }
}

// ——— Camera ———
async function startCamera() {
  stopCamera();
  const constraints = {
    video: {
      facingMode: sessionCameraFacing,
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
    audio: false,
  };
  mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = mediaStream;
  video.classList.toggle("camera-preview--back", sessionCameraFacing === "environment");
  await video.play();
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  video.srcObject = null;
}

function captureFrame() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  captureCanvas.width = w;
  captureCanvas.height = h;
  const ctx = captureCanvas.getContext("2d");
  if (sessionCameraFacing === "user") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  const theme = getTheme();
  ctx.filter = theme.cameraFilter;
  ctx.drawImage(video, 0, 0, w, h);
  ctx.filter = "none";
  return captureCanvas.toDataURL("image/jpeg", 0.92);
}

// ——— Countdown & flash ———
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showCountdown(num) {
  countdownEl.textContent = num;
  countdownEl.classList.add("countdown--visible", "countdown--pulse");
  void countdownEl.offsetWidth;
  countdownEl.classList.remove("countdown--pulse");
  void countdownEl.offsetWidth;
  countdownEl.classList.add("countdown--pulse");
}

function hideCountdown() {
  countdownEl.classList.remove("countdown--visible", "countdown--pulse");
  countdownEl.textContent = "";
}

async function triggerFlash() {
  if (sessionFlashEnabled) {
    flashEl.classList.remove("flash--active");
    void flashEl.offsetWidth;
    flashEl.classList.add("flash--active");
  }

  if (
    sessionFlashEnabled &&
    sessionCameraFacing === "environment" &&
    mediaStream
  ) {
    try {
      const track = mediaStream.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: true }] });
      setTimeout(() => {
        track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      }, 300);
    } catch (_) {
      /* torch unsupported — white overlay only */
    }
  }
}

async function runCountdown() {
  for (let i = COUNTDOWN_SECONDS; i >= 1; i--) {
    if (!isCapturing) return;
    showCountdown(i);
    await wait(1000);
  }
  hideCountdown();
}

async function captureSequence() {
  if (isCapturing) return;
  isCapturing = true;
  capturedPhotos = [];

  for (let shot = 0; shot < PHOTO_COUNT; shot++) {
    if (!isCapturing) return;
    shotCurrentEl.textContent = String(shot + 1);
    await runCountdown();
    if (!isCapturing) return;
    await triggerFlash();
    playShutter();
    const frame = captureFrame();
    if (frame) capturedPhotos.push(frame);
    if (shot < PHOTO_COUNT - 1) await wait(400);
  }

  isCapturing = false;
  if (capturedPhotos.length < PHOTO_COUNT) return;
  stopCamera();
  await buildStrip();
  showScreen("strip");
}

// ——— Sepia + grain on canvas ———
function applySepia(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    d[i] = d[i] * 0.92 + 18;
    d[i + 1] = d[i + 1] * 0.9 + 14;
    d[i + 2] = d[i + 2] * 0.85 + 8;
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawGrain(ctx, w, h, intensity = 0.12) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * intensity;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(imageData, 0, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildStrip() {
  const innerW = STRIP_WIDTH - BORDER * 2;
  const totalH =
    BORDER +
    PHOTO_COUNT * PHOTO_HEIGHT +
    (PHOTO_COUNT - 1) * BORDER +
    LABEL_HEIGHT +
    BORDER;

  stripCanvas.width = STRIP_WIDTH;
  stripCanvas.height = totalH;
  const ctx = stripCanvas.getContext("2d");

  const theme = getTheme();
  ctx.fillStyle = theme.stripBg;
  ctx.fillRect(0, 0, STRIP_WIDTH, totalH);

  let y = BORDER;

  for (let i = 0; i < capturedPhotos.length; i++) {
    const img = await loadImage(capturedPhotos[i]);
    const targetAspect = innerW / PHOTO_HEIGHT;
    const imgAspect = img.width / img.height;
    let sx, sy, sw, sh;
    if (imgAspect > targetAspect) {
      sh = img.height;
      sw = img.height * targetAspect;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / targetAspect;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    const temp = document.createElement("canvas");
    temp.width = innerW;
    temp.height = PHOTO_HEIGHT;
    const tCtx = temp.getContext("2d");
    tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, innerW, PHOTO_HEIGHT);
    if (selectedTheme === "oldies") applySepia(tCtx, innerW, PHOTO_HEIGHT);
    ctx.drawImage(temp, BORDER, y);

    y += PHOTO_HEIGHT;
    if (i < capturedPhotos.length - 1) {
      ctx.fillStyle = theme.borderColor;
      ctx.fillRect(0, y, STRIP_WIDTH, BORDER);
      y += BORDER;
    }
  }

  y += BORDER * 0.5;
  ctx.fillStyle = theme.stripBg;
  ctx.fillRect(0, y, STRIP_WIDTH, LABEL_HEIGHT);

  ctx.fillStyle = theme.labelColor;
  ctx.font = theme.labelFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(theme.stripLabel, STRIP_WIDTH / 2, y + LABEL_HEIGHT / 2);

  if (theme.canvasGrain) drawGrain(ctx, STRIP_WIDTH, totalH, 0.1);
  stripDataUrl = stripCanvas.toDataURL("image/png");
  resetShareState();
}

/** EmailJS allows max 50KB for all template variables combined */
const EMAILJS_MAX_VARS_BYTES = 50 * 1024;
const EMAILJS_VARS_MARGIN = 2 * 1024;

function templateParamsByteSize(params) {
  return new Blob([JSON.stringify(params)]).size;
}

/** Shrink + compress until entire template payload fits under 50KB */
function getStripImageForEmail(otherParams) {
  if (!stripCanvas.width) return "";

  const otherBytes = templateParamsByteSize({ ...otherParams, strip_image: "" });
  const imageBudget = EMAILJS_MAX_VARS_BYTES - otherBytes - EMAILJS_VARS_MARGIN;

  if (imageBudget < 8 * 1024) {
    throw new Error("Template fields use too much space. Shorten message text in app.js.");
  }

  const widths = [200, 160, 140, 120, 100, 80];
  const qualities = [0.5, 0.4, 0.32, 0.25, 0.2, 0.15];

  for (const maxW of widths) {
    const scale = maxW / stripCanvas.width;
    const h = Math.max(1, Math.round(stripCanvas.height * scale));
    const out = document.createElement("canvas");
    out.width = maxW;
    out.height = h;
    out.getContext("2d").drawImage(stripCanvas, 0, 0, maxW, h);

    for (const q of qualities) {
      const strip_image = out.toDataURL("image/jpeg", q);
      if (new Blob([strip_image]).size <= imageBudget) {
        return strip_image;
      }
    }
  }

  throw new Error(
    "Could not compress strip enough for email (50KB limit). Use Save strip instead."
  );
}

function formatEmailJSError(err) {
  if (err?.text) return err.text;
  if (typeof err?.message === "string" && err.message) return err.message;
  return "Could not send email. Check EmailJS setup and try again.";
}

function downloadStrip() {
  const href = stripDataUrl || stripCanvas.toDataURL("image/png");
  downloadLink.href = href;
  downloadLink.download = `downtown-strip-${selectedTheme}-${Date.now()}.png`;
  downloadLink.click();
}

function resetShareState() {
  cloudinaryImageUrl = null;
  qrPanel.hidden = true;
  btnShareScan.classList.remove("share-option--active");
  btnShareScan.setAttribute("aria-expanded", "false");
  btnShareScan.classList.remove("share-option--loading");
  qrCodeEl.innerHTML = "";
  qrStatusEl.textContent = "Preparing your strip…";
  qrStatusEl.classList.remove("qr-panel__status--error");
}

function setQrStatus(text, isError = false) {
  qrStatusEl.textContent = text;
  qrStatusEl.classList.toggle("qr-panel__status--error", isError);
}

async function uploadStripToCloudinary() {
  if (cloudinaryImageUrl) return cloudinaryImageUrl;

  if (
    CLOUDINARY_CONFIG.cloudName === "YOUR_CLOUD_NAME" ||
    CLOUDINARY_CONFIG.uploadPreset === "YOUR_UNSIGNED_PRESET"
  ) {
    throw new Error(
      "Cloudinary is not configured. Set cloudName and uploadPreset in app.js."
    );
  }

  const file = stripDataUrl || stripCanvas.toDataURL("image/png");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Could not upload strip.");
  }

  cloudinaryImageUrl = data.secure_url;
  return cloudinaryImageUrl;
}

function renderQRCode(url) {
  qrCodeEl.innerHTML = "";
  if (typeof QRCode === "undefined") {
    throw new Error("QR code library failed to load.");
  }
  new QRCode(qrCodeEl, {
    text: url,
    width: 168,
    height: 168,
    colorDark: getComputedStyle(document.body).getPropertyValue("--qr-dark").trim() || "#111",
    colorLight: getComputedStyle(document.body).getPropertyValue("--qr-light").trim() || "#fff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

async function showScanToSave() {
  qrPanel.hidden = false;
  btnShareScan.classList.add("share-option--active");
  btnShareScan.setAttribute("aria-expanded", "true");
  qrCodeEl.innerHTML = "";
  setQrStatus("Preparing your strip…");

  btnShareScan.classList.add("share-option--loading");

  try {
    const url = await uploadStripToCloudinary();
    renderQRCode(url);
    setQrStatus("Point your camera here — then save the image.");
  } catch (err) {
    console.error("Cloudinary error:", err);
    setQrStatus(err.message || "Could not create QR code. Try Download instead.", true);
  } finally {
    btnShareScan.classList.remove("share-option--loading");
  }
}

// ——— EmailJS ———
function initEmailJS() {
  if (typeof emailjs === "undefined" || EMAILJS_CONFIG.publicKey === "YOUR_PUBLIC_KEY") {
    return;
  }
  emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
}

async function sendEmail(recipientEmail) {
  if (EMAILJS_CONFIG.publicKey === "YOUR_PUBLIC_KEY") {
    throw new Error(
      "EmailJS is not configured. Add your public key, service ID, and template ID in app.js."
    );
  }

  const baseParams = {
    to_email: recipientEmail,
    message: "Your photobooth strip.",
  };

  const strip_image = getStripImageForEmail(baseParams);
  const templateParams = { ...baseParams, strip_image };

  if (templateParamsByteSize(templateParams) > EMAILJS_MAX_VARS_BYTES) {
    throw new Error("Strip too large to email (50KB limit). Use Save strip instead.");
  }

  const result = await emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    templateParams,
    { publicKey: EMAILJS_CONFIG.publicKey }
  );
  return result;
}

// ——— Event listeners ———
document.getElementById("btn-start").addEventListener("click", () => {
  syncThemeCards();
  syncCameraPills();
  showScreen("themes");
});

document.querySelectorAll(".theme-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".theme-card").forEach((c) => {
      c.classList.remove("theme-card--selected");
      c.setAttribute("aria-selected", "false");
    });
    card.classList.add("theme-card--selected");
    card.setAttribute("aria-selected", "true");
    setTheme(card.dataset.theme);
  });
});

document.getElementById("btn-back-landing").addEventListener("click", () => {
  showScreen("landing");
});

document.querySelectorAll("[data-facing]").forEach((pill) => {
  pill.addEventListener("click", () => {
    uiCameraFacing = pill.dataset.facing;
    syncCameraPills();
  });
});

document.querySelectorAll("[data-flash]").forEach((pill) => {
  pill.addEventListener("click", () => {
    uiFlashEnabled = pill.dataset.flash === "on";
    syncCameraPills();
  });
});

document.getElementById("btn-enter-booth").addEventListener("click", async () => {
  lockSessionCameraSettings();
  try {
    showScreen("camera");
    await startCamera();
    await wait(600);
    await captureSequence();
  } catch (err) {
    console.error(err);
    alert(
      "Could not access the camera. Please allow camera permission and try again."
    );
    showScreen("themes");
    stopCamera();
  }
});

document.getElementById("btn-cancel-camera").addEventListener("click", () => {
  isCapturing = false;
  hideCountdown();
  stopCamera();
  restoreCameraUiFromSession();
  syncThemeCards();
  showScreen("themes");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  capturedPhotos = [];
  stripDataUrl = null;
  resetShareState();
  showScreen("camera");
  try {
    await startCamera();
    await wait(400);
    await captureSequence();
  } catch (err) {
    alert("Camera unavailable. Please try again.");
    showScreen("landing");
  }
});

document.getElementById("btn-share-email").addEventListener("click", () => {
  emailError.hidden = true;
  emailInput.value = "";
  showScreen("email");
});

btnShareScan.addEventListener("click", () => {
  if (!qrPanel.hidden && cloudinaryImageUrl) {
    qrPanel.hidden = true;
    btnShareScan.classList.remove("share-option--active");
    btnShareScan.setAttribute("aria-expanded", "false");
    return;
  }
  showScanToSave();
});

document.getElementById("btn-share-download").addEventListener("click", downloadStrip);

document.getElementById("btn-back-strip").addEventListener("click", () => {
  showScreen("strip");
});

document.getElementById("btn-save-success").addEventListener("click", downloadStrip);

document.getElementById("btn-another").addEventListener("click", () => {
  capturedPhotos = [];
  stripDataUrl = null;
  resetShareState();
  showScreen("landing");
});

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  emailError.hidden = true;

  const email = emailInput.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.textContent = "Please enter a valid email address.";
    emailError.hidden = false;
    return;
  }

  const sendBtn = document.getElementById("btn-send");
  sendBtn.disabled = true;
  sendBtn.classList.add("btn--loading");

  try {
setTheme("oldies");
syncCameraPills();
initEmailJS();
    await sendEmail(email);
    showScreen("success");
  } catch (err) {
    console.error("EmailJS error:", err);
    emailError.textContent = formatEmailJSError(err);
    emailError.hidden = false;
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove("btn--loading");
  }
});

initEmailJS();
