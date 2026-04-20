const API_BASE = 'https://human-or-ai-production-8e10.up.railway.app';

// Elements
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const fileInfo     = document.getElementById('fileInfo');
const fileName     = document.getElementById('fileName');
const fileSize     = document.getElementById('fileSize');
const fileRemove   = document.getElementById('fileRemove');
const waveform     = document.getElementById('waveform');
const analyseBtn   = document.getElementById('analyseBtn');
const loadingState = document.getElementById('loadingState');
const resultCard   = document.getElementById('resultCard');
const errorBox     = document.getElementById('errorBox');
const errorMsg     = document.getElementById('errorMsg');
const apiKeyInput  = document.getElementById('apiKeyInput');
const toggleKey    = document.getElementById('toggleKey');
const historyList  = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const audioPlayer  = document.getElementById('audioPlayer');
const playBtn      = document.getElementById('playBtn');
const playIcon     = document.getElementById('playIcon');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl   = document.getElementById('totalTime');
const spectrogramWrap = document.getElementById('spectrogramWrap');
const spectrogramCanvas = document.getElementById('spectrogramCanvas');

let selectedFile = null;
let selectedLang = 'english';
let currentMode = 'upload';
let history = JSON.parse(localStorage.getItem('voiceid_history') || '[]');
let lastResult = null;
let audioElement = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let audioCtx = null;
let analyserNode = null;
let micStream = null;

// Waveform bars
const waveCount = 36;
for (let i = 0; i < waveCount; i++) {
  const bar = document.createElement('div');
  bar.className = 'wave-bar';
  const h = Math.random() * 28 + 8;
  bar.style.height = h + 'px';
  bar.style.animationDelay = (i * 0.04) + 's';
  bar.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
  bar.style.opacity = (0.3 + Math.random() * 0.5).toString();
  waveform.appendChild(bar);
}

// Mic viz bars
const micViz = document.getElementById('micViz');
const micBarCount = 24;
const micBars = [];
for (let i = 0; i < micBarCount; i++) {
  const bar = document.createElement('div');
  bar.className = 'mic-bar';
  micViz.appendChild(bar);
  micBars.push(bar);
}

// Init stats count
updateTotalCount();

// Toggle API key
toggleKey.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  document.getElementById('eyeIcon').innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Language pills
document.querySelectorAll('.lang-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedLang = pill.dataset.lang;
  });
});

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMode = tab.dataset.mode;
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(currentMode === 'upload' ? 'uploadPanel' : 'recordPanel').classList.add('active');
    clearFile();
  });
});

// Drag & drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function setFile(file, isRecording = false) {
  const ext = isRecording ? 'wav' : file.name.split('.').pop().toLowerCase();
  if (!isRecording && !['mp3', 'wav'].includes(ext)) { showError('Only MP3 and WAV files are supported.'); return; }
  if (file.size > 10 * 1024 * 1024) { showError('File exceeds 10MB limit.'); return; }

  selectedFile = file;
  fileName.textContent = isRecording ? 'recording.wav' : file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.add('visible');
  waveform.classList.add('visible');
  if (!isRecording) dropZone.classList.add('has-file');
  analyseBtn.disabled = false;
  hideError();
  resultCard.classList.remove('visible');

  // Audio player
  const url = URL.createObjectURL(file);
  audioElement = new Audio(url);
  audioElement.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audioElement.duration);
  });
  audioElement.addEventListener('timeupdate', () => {
    const pct = (audioElement.currentTime / audioElement.duration) * 100;
    progressFill.style.width = pct + '%';
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  });
  audioElement.addEventListener('ended', () => {
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    progressFill.style.width = '0%';
  });
  audioPlayer.classList.add('visible');

  // Draw spectrogram
  drawSpectrogram(file);
}

fileRemove.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.remove('visible');
  waveform.classList.remove('visible');
  dropZone.classList.remove('has-file');
  analyseBtn.disabled = true;
  resultCard.classList.remove('visible');
  audioPlayer.classList.remove('visible');
  spectrogramWrap.classList.remove('visible');
  hideError();
  if (audioElement) { audioElement.pause(); audioElement = null; }
}

// Audio Playback
playBtn.addEventListener('click', () => {
  if (!audioElement) return;
  if (audioElement.paused) {
    audioElement.play();
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    audioElement.pause();
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
});

document.getElementById('progressTrack').addEventListener('click', e => {
  if (!audioElement) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audioElement.currentTime = pct * audioElement.duration;
});

// Spectrogram
async function drawSpectrogram(file) {
  spectrogramWrap.classList.add('visible');
  const ctx = spectrogramCanvas.getContext('2d');
  const W = spectrogramCanvas.offsetWidth;
  const H = 80;
  spectrogramCanvas.width = W;
  spectrogramCanvas.height = H;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ac = new AudioContext();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    const fftSize = 256;
    const hopSize = Math.floor(data.length / W);
    const cols = W;

    for (let col = 0; col < cols; col++) {
      const start = col * hopSize;
      const slice = data.slice(start, start + fftSize);
      const fft = computeFFT(slice, fftSize);
      const half = fft.length / 2;
      for (let row = 0; row < H; row++) {
        const freqBin = Math.floor((row / H) * half);
        const mag = Math.min(255, fft[freqBin] * 3);
        const r = mag > 128 ? 255 : mag * 2;
        const g = mag > 128 ? (255 - (mag - 128) * 2) : 0;
        const b = mag < 64 ? mag * 4 : 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col, H - row - 1, 1, 1);
      }
    }
    await ac.close();
  } catch (e) {
    // fallback: draw a fake decorative spectrogram
    for (let col = 0; col < W; col++) {
      for (let row = 0; row < H; row++) {
        const mag = Math.random() * 80 + Math.sin(col / 20) * 40;
        const r = mag > 64 ? Math.min(255, mag * 2) : 0;
        const g = 0;
        const b = Math.max(0, 80 - mag);
        ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
        ctx.fillRect(col, row, 1, 1);
      }
    }
  }
}

function computeFFT(signal, size) {
  const N = Math.min(signal.length, size);
  const magnitudes = new Array(N).fill(0);
  for (let k = 0; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im) / N;
  }
  return magnitudes;
}

// ── MICROPHONE RECORDING ──
const micBtn     = document.getElementById('micBtn');
const micLabel   = document.getElementById('micLabel');
const micTimer   = document.getElementById('micTimer');
const micDiscard = document.getElementById('micDiscard');
const micUse     = document.getElementById('micUse');

micBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/wav' });
      const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
      setFile(file, true);
    };
    mediaRecorder.start(100);

    micBtn.classList.add('recording');
    micBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="#ff4d6d" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
    micLabel.textContent = 'Recording… click to stop';
    micTimer.classList.add('visible');
    micViz.classList.add('active');

    recordingSeconds = 0;
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60);
      const s = recordingSeconds % 60;
      micTimer.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }, 1000);

    // Visualise mic input
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 64;
    source.connect(analyserNode);
    animateMicBars();

  } catch (err) {
    showError('Microphone access denied. Please allow microphone permission.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  clearInterval(recordingTimer);

  micBtn.classList.remove('recording');
  micBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f5c4" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  micLabel.textContent = 'Recording saved';
  micTimer.classList.remove('visible');
  micViz.classList.remove('active');
  micDiscard.disabled = false;
  micUse.disabled = false;
}

function animateMicBars() {
  if (!analyserNode) return;
  const data = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(data);
  micBars.forEach((bar, i) => {
    const val = data[i % data.length] || 0;
    bar.style.height = Math.max(4, val / 4) + 'px';
  });
  if (mediaRecorder && mediaRecorder.state === 'recording') requestAnimationFrame(animateMicBars);
}

micDiscard.addEventListener('click', () => {
  clearFile();
  micLabel.textContent = 'Click to start recording';
  micTimer.classList.remove('visible');
  micDiscard.disabled = true;
  micUse.disabled = true;
});

micUse.addEventListener('click', () => {
  micDiscard.disabled = true;
  micUse.disabled = true;
  micLabel.textContent = 'Recording ready to analyse';
});

// ── ANALYSE ──
analyseBtn.addEventListener('click', analyse);

async function analyse() {
  if (!selectedFile) return;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showError('Please enter your API key.'); return; }

  analyseBtn.disabled = true;
  loadingState.classList.add('visible');
  resultCard.classList.remove('visible');
  hideError();

  const formData = new FormData();
  formData.append('language', selectedLang);
  formData.append('file', selectedFile);

  try {
    const res = await fetch(`${API_BASE}/api/voice-detection`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);

    lastResult = data;
    showResult(data);
    addHistory(data);

  } catch (err) {
    showError(err.message || 'Network error. Check the server is running.');
  } finally {
    loadingState.classList.remove('visible');
    analyseBtn.disabled = false;
  }
}

function showResult(data) {
  const isHuman = data.classification === 'HUMAN';
  const cls = isHuman ? 'human' : 'ai';
  const label = isHuman ? 'Human Voice' : 'AI Generated';
  const pct = Math.round(data.confidenceScore * 100);

  const badge = document.getElementById('resultBadge');
  badge.className = `result-badge ${cls}`;
  document.getElementById('resultLabel').textContent = label;
  document.getElementById('confPercent').textContent = pct;

  const bar = document.getElementById('confBar');
  bar.className = `conf-bar-fill ${cls}`;
  setTimeout(() => { bar.style.width = pct + '%'; }, 50);

  document.getElementById('metaFile').textContent = data.filename;
  document.getElementById('metaLang').textContent = data.language.charAt(0).toUpperCase() + data.language.slice(1);
  document.getElementById('metaTime').textContent = data.processingTimeMs + 'ms';
  document.getElementById('explanationBox').textContent = data.explanation;

  resultCard.classList.add('visible');
}

function addHistory(data) {
  const entry = {
    name: data.filename,
    result: data.classification,
    conf: Math.round(data.confidenceScore * 100),
    time: new Date().toLocaleTimeString(),
    lang: data.language,
    ms: data.processingTimeMs
  };
  history.unshift(entry);
  if (history.length > 20) history.pop();
  localStorage.setItem('voiceid_history', JSON.stringify(history));
  renderHistory();
  updateTotalCount();
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No analyses yet. Upload a file to get started.</div>';
    return;
  }
  historyList.innerHTML = history.map(h => {
    const isHuman = h.result === 'HUMAN';
    const cls = isHuman ? 'human' : 'ai';
    return `
      <div class="history-item">
        <div class="history-dot ${cls}"></div>
        <span class="history-name">${escHtml(h.name)}</span>
        <span class="history-result ${cls}">${isHuman ? 'HUMAN' : 'AI'}</span>
        <span class="history-conf">${h.conf}%</span>
        <span class="history-time">${h.time || ''}</span>
      </div>`;
  }).join('');
}

clearHistoryBtn.addEventListener('click', () => {
  history = [];
  localStorage.removeItem('voiceid_history');
  renderHistory();
  updateTotalCount();
});

function updateTotalCount() {
  document.getElementById('totalCount').textContent = history.length;
}

// ── STATS MODAL ──
document.getElementById('statsBtn').addEventListener('click', () => {
  const total = history.length;
  const humanCount = history.filter(h => h.result === 'HUMAN').length;
  const aiCount = total - humanCount;
  const avgConf = total > 0 ? Math.round(history.reduce((s, h) => s + h.conf, 0) / total) : 0;
  const humanPct = total > 0 ? Math.round((humanCount / total) * 100) : 50;
  const aiPct = 100 - humanPct;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statHuman').textContent = humanCount;
  document.getElementById('statAI').textContent = aiCount;
  document.getElementById('statAvgConf').textContent = total > 0 ? avgConf + '%' : '—';
  document.getElementById('ratioHumanPct').textContent = `Human ${humanPct}%`;
  document.getElementById('ratioAIPct').textContent = `AI ${aiPct}%`;

  setTimeout(() => {
    document.getElementById('ratioHuman').style.width = humanPct + '%';
    document.getElementById('ratioAI').style.width = aiPct + '%';
  }, 100);

  document.getElementById('statsModal').classList.add('visible');
});

document.getElementById('statsModalClose').addEventListener('click', () => {
  document.getElementById('statsModal').classList.remove('visible');
});

document.getElementById('statsModal').addEventListener('click', e => {
  if (e.target === document.getElementById('statsModal')) document.getElementById('statsModal').classList.remove('visible');
});

// ── SHARE MODAL ──
document.getElementById('shareCardBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification === 'HUMAN';
  const pct = Math.round(lastResult.confidenceScore * 100);
  const preview = document.getElementById('shareCardPreview');
  preview.className = `share-card ${isHuman ? 'human' : 'ai'}`;
  document.getElementById('shareCardResult').textContent = isHuman ? '✓ Human Voice' : '⚠ AI Generated';
  document.getElementById('shareCardResult').className = `share-card-result ${isHuman ? 'human' : 'ai'}`;
  document.getElementById('shareCardConf').textContent = `${pct}% confidence · ${lastResult.language}`;
  document.getElementById('shareCardFile').textContent = lastResult.filename;
  document.getElementById('shareModal').classList.add('visible');
});

document.getElementById('shareModalClose').addEventListener('click', () => {
  document.getElementById('shareModal').classList.remove('visible');
});

document.getElementById('shareModal').addEventListener('click', e => {
  if (e.target === document.getElementById('shareModal')) document.getElementById('shareModal').classList.remove('visible');
});

document.getElementById('copyCardTextBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification === 'HUMAN';
  const pct = Math.round(lastResult.confidenceScore * 100);
  const text = `VoiceID Result\n${isHuman ? '✓ Human Voice' : '⚠ AI Generated'}\n${pct}% confidence · ${lastResult.language}\nFile: ${lastResult.filename}\n\nDetect AI voices at voiceid.app`;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
});

document.getElementById('tweetBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification === 'HUMAN';
  const pct = Math.round(lastResult.confidenceScore * 100);
  const text = `Just analysed a voice with VoiceID 🎙️\n\nResult: ${isHuman ? '✅ Human Voice' : '🤖 AI Generated'}\nConfidence: ${pct}%\n\nTry it yourself:`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://mdeepaksai.github.io/human-or-AI/')}`;
  window.open(url, '_blank');
});

// ── COPY RESULT LINK ──
document.getElementById('copyResultBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById('copyResultBtn');
    btn.classList.add('copied');
    showToast('Link copied!');
    setTimeout(() => btn.classList.remove('copied'), 2000);
  });
});

// ── EXPORT JSON ──
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `voiceid-${lastResult.filename}-result.json`;
  a.click();
  showToast('Result exported!');
});

// ── TOAST ──
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── HELPERS ──
function showError(msg) { errorMsg.textContent = msg; errorBox.classList.add('visible'); }
function hideError() { errorBox.classList.remove('visible'); }

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(s) {
  if (isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

renderHistory();