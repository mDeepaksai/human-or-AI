const SUPABASE_URL = 'https://jihjpdfnlriycbprmebh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppaGpwZGZubHJpeWNicHJtZWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTA4ODksImV4cCI6MjA5MjI4Njg4OX0.v-9yo_AQrVB28T5ixjNU9rwdIyJtmFWwZbu3DwTYJ14';

async function incrementCounter(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_counter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ counter_key: key })
    });
    const val = await res.json();
    return val;
  } catch { return null; }
}

async function getCount(key) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/counters?key=eq.${key}&select=value`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const data = await res.json();
    return data[0]?.value ?? null;
  } catch { return null; }
}

function animateCount(el, target) {
  if (!el || target === null || target === undefined) return;
  const duration = 900;
  const start    = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * ease).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
    else { el.textContent = target.toLocaleString(); el.classList.remove('loading'); }
  }
  requestAnimationFrame(tick);
}

async function loadLiveStats() {
  const [visitors, analyses] = await Promise.all([getCount('visitors'), getCount('analyses')]);
  animateCount(document.getElementById('globalVisitors'), visitors);
  animateCount(document.getElementById('globalAnalyses'), analyses);
  const mv = document.getElementById('modalGlobalVisitors');
  const ma = document.getElementById('modalGlobalAnalyses');
  if (mv && visitors !== null) mv.textContent = visitors.toLocaleString();
  if (ma && analyses !== null) ma.textContent = analyses.toLocaleString();
}

if (!sessionStorage.getItem('voiceid_visited')) {
  sessionStorage.setItem('voiceid_visited', '1');
  incrementCounter('visitors').then(v => {
    animateCount(document.getElementById('globalVisitors'), v);
    const mv = document.getElementById('modalGlobalVisitors');
    if (mv && v !== null) mv.textContent = v.toLocaleString();
  });
}

loadLiveStats();

const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const fileInfo          = document.getElementById('fileInfo');
const fileName          = document.getElementById('fileName');
const fileSize          = document.getElementById('fileSize');
const fileRemove        = document.getElementById('fileRemove');
const waveform          = document.getElementById('waveform');
const analyseBtn        = document.getElementById('analyseBtn');
const loadingState      = document.getElementById('loadingState');
const resultCard        = document.getElementById('resultCard');
const errorBox          = document.getElementById('errorBox');
const errorMsg          = document.getElementById('errorMsg');
const apiKeyInput       = document.getElementById('apiKeyInput');
const toggleKey         = document.getElementById('toggleKey');
const historyList       = document.getElementById('historyList');
const clearHistoryBtn   = document.getElementById('clearHistory');
const audioPlayer       = document.getElementById('audioPlayer');
const playBtn           = document.getElementById('playBtn');
const playIcon          = document.getElementById('playIcon');
const progressFill      = document.getElementById('progressFill');
const currentTimeEl     = document.getElementById('currentTime');
const totalTimeEl       = document.getElementById('totalTime');
const spectrogramWrap   = document.getElementById('spectrogramWrap');
const spectrogramCanvas = document.getElementById('spectrogramCanvas');

const API_BASE = 'https://human-or-ai-production-8e10.up.railway.app';
const DEFAULT_API_KEY = 'deeps@simi';

let selectedFile     = null;
let selectedLang     = 'english';
let currentMode      = 'upload';
let history          = JSON.parse(localStorage.getItem('voiceid_history') || '[]');
let lastResult       = null;
let audioElement     = null;
let mediaRecorder    = null;
let recordedChunks   = [];
let recordingTimer   = null;
let recordingSeconds = 0;
let analyserNode     = null;
let micStream        = null;
let audioCtxMic      = null;
let micAnimFrame     = null;

// Load API key from localStorage or use default
(function() {
  const stored = localStorage.getItem('voiceid_api_key');
  if (stored) {
    apiKeyInput.value = stored;
  } else {
    apiKeyInput.value = DEFAULT_API_KEY;
  }
  apiKeyInput.addEventListener('change', function() {
    localStorage.setItem('voiceid_api_key', this.value);
  });
})();

function getBestMimeType() {
  const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];
  for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
  return '';
}

function encodeWAV(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels, rate = audioBuffer.sampleRate;
  const samples = audioBuffer.length, bps = 2, block = numCh * bps;
  const br = rate * block, dSize = samples * block;
  const buf = new ArrayBuffer(44 + dSize), view = new DataView(buf);
  function ws(off, str) { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
  ws(0,'RIFF'); view.setUint32(4,36+dSize,true); ws(8,'WAVE'); ws(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,rate,true); view.setUint32(28,br,true); view.setUint16(32,block,true);
  view.setUint16(34,16,true); ws(36,'data'); view.setUint32(40,dSize,true);
  let off = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
  }
  return buf;
}

for (let i = 0; i < 36; i++) {
  const bar = document.createElement('div'); bar.className = 'wave-bar';
  bar.style.height = (Math.random() * 28 + 8) + 'px';
  bar.style.animationDelay = (i * 0.04) + 's';
  bar.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
  bar.style.opacity = (0.3 + Math.random() * 0.5).toString();
  waveform.appendChild(bar);
}

const micViz = document.getElementById('micViz');
const micBars = [];
for (let i = 0; i < 24; i++) {
  const bar = document.createElement('div'); bar.className = 'mic-bar';
  micViz.appendChild(bar); micBars.push(bar);
}

updateTotalCount(); renderHistory();

toggleKey.addEventListener('click', () => {
  const isPw = apiKeyInput.type === 'password';
  apiKeyInput.type = isPw ? 'text' : 'password';
  document.getElementById('eyeIcon').innerHTML = isPw
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

document.querySelectorAll('.lang-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active'); selectedLang = pill.dataset.lang;
  });
});

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active'); currentMode = tab.dataset.mode;
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(currentMode === 'upload' ? 'uploadPanel' : 'recordPanel').classList.add('active');
    clearFile();
  });
});

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function setFile(file, isRecording = false) {
  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = ['mp3','wav','webm','ogg','mp4'];
  if (!isRecording && !allowed.includes(ext)) { showError('Only MP3 or WAV files are supported.'); return; }
  if (file.size > 10 * 1024 * 1024) { showError('File exceeds 10MB limit.'); return; }
  selectedFile = file; fileName.textContent = file.name; fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.add('visible'); waveform.classList.add('visible');
  if (!isRecording) dropZone.classList.add('has-file');
  analyseBtn.disabled = false; hideError(); resultCard.classList.remove('visible');
  if (audioElement) { audioElement.pause(); audioElement = null; }
  const url = URL.createObjectURL(file); audioElement = new Audio(url);
  audioElement.addEventListener('loadedmetadata', () => {
    if (isFinite(audioElement.duration)) totalTimeEl.textContent = formatTime(audioElement.duration);
    else audioElement.currentTime = 1e101;
  });
  audioElement.addEventListener('durationchange', () => {
    if (isFinite(audioElement.duration)) totalTimeEl.textContent = formatTime(audioElement.duration);
  });
  audioElement.addEventListener('timeupdate', () => {
    if (!isFinite(audioElement.duration)) return;
    progressFill.style.width = (audioElement.currentTime / audioElement.duration * 100) + '%';
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  });
  audioElement.addEventListener('ended', () => {
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>'; progressFill.style.width = '0%'; currentTimeEl.textContent = '0:00';
  });
  audioPlayer.classList.add('visible'); drawSpectrogram(file);
}

fileRemove.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

function clearFile() {
  selectedFile = null; fileInput.value = '';
  fileInfo.classList.remove('visible'); waveform.classList.remove('visible');
  dropZone.classList.remove('has-file'); analyseBtn.disabled = true;
  resultCard.classList.remove('visible'); audioPlayer.classList.remove('visible');
  spectrogramWrap.classList.remove('visible'); hideError();
  if (audioElement) { audioElement.pause(); audioElement = null; }
  progressFill.style.width = '0%'; currentTimeEl.textContent = '0:00'; totalTimeEl.textContent = '0:00';
  playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  const micLabel = document.getElementById('micLabel'), micTimer = document.getElementById('micTimer');
  const micDiscard = document.getElementById('micDiscard'), micUse = document.getElementById('micUse');
  const micBtn = document.getElementById('micBtn');
  micLabel.textContent = 'Click to start recording'; micTimer.classList.remove('visible');
  micViz.classList.remove('active'); micDiscard.disabled = true; micUse.disabled = true;
  micBtn.classList.remove('recording');
  micBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f5c4" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
}

playBtn.addEventListener('click', () => {
  if (!audioElement) return;
  if (audioElement.paused) { audioElement.play(); playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'; }
  else { audioElement.pause(); playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>'; }
});
document.getElementById('progressTrack').addEventListener('click', e => {
  if (!audioElement || !isFinite(audioElement.duration)) return;
  const rect = e.currentTarget.getBoundingClientRect();
  audioElement.currentTime = ((e.clientX - rect.left) / rect.width) * audioElement.duration;
});

async function drawSpectrogram(file) {
  spectrogramWrap.classList.add('visible');
  const ctx = spectrogramCanvas.getContext('2d');
  const W = spectrogramCanvas.offsetWidth || 600, H = 80;
  spectrogramCanvas.width = W; spectrogramCanvas.height = H;
  try {
    const ac = new AudioContext(), audioBuf = await ac.decodeAudioData(await file.arrayBuffer());
    const data = audioBuf.getChannelData(0), fftSize = 256;
    const hopSize = Math.max(1, Math.floor(data.length / W));
    for (let col = 0; col < W; col++) {
      const fft = computeFFT(data.slice(col*hopSize, col*hopSize+fftSize), fftSize);
      const half = Math.floor(fft.length/2);
      for (let row = 0; row < H; row++) {
        const mag = Math.min(255, fft[Math.floor((row/H)*half)] * 3);
        ctx.fillStyle = `rgb(${mag>128?255:mag*2},${mag>128?(255-(mag-128)*2):0},${mag<64?mag*4:0})`;
        ctx.fillRect(col, H-row-1, 1, 1);
      }
    }
    await ac.close();
  } catch {
    for (let col = 0; col < W; col++) for (let row = 0; row < H; row++) {
      const mag = Math.random()*80 + Math.sin(col/20)*40;
      ctx.fillStyle = `rgba(${mag>64?Math.min(255,mag*2):0},0,${Math.max(0,80-mag)},0.8)`;
      ctx.fillRect(col, row, 1, 1);
    }
  }
}

function computeFFT(signal, size) {
  const N = Math.min(signal.length, size), mags = new Array(Math.floor(N/2)).fill(0);
  for (let k = 0; k < mags.length; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a=(2*Math.PI*k*n)/N; re+=signal[n]*Math.cos(a); im-=signal[n]*Math.sin(a); }
    mags[k] = Math.sqrt(re*re+im*im)/N;
  }
  return mags;
}

const micBtn = document.getElementById('micBtn');
const micLabel = document.getElementById('micLabel');
const micTimer = document.getElementById('micTimer');
const micDiscard = document.getElementById('micDiscard');
const micUse = document.getElementById('micUse');

micBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
  else await startRecording();
});

async function startRecording() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); recordedChunks = [];
    const mimeType = getBestMimeType();
    mediaRecorder = new MediaRecorder(micStream, mimeType ? { mimeType } : {});
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {}; mediaRecorder.start(100);
    micBtn.classList.add('recording');
    micBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="#ff4d6d" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
    micLabel.textContent = 'Recording… click to stop';
    micTimer.classList.add('visible'); micViz.classList.add('active');
    micDiscard.disabled = true; micUse.disabled = true;
    recordingSeconds = 0; clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      recordingSeconds++; if (recordingSeconds >= 120) stopRecording();
      micTimer.textContent = `${Math.floor(recordingSeconds/60)}:${(recordingSeconds%60).toString().padStart(2,'0')}`;
    }, 1000);
    audioCtxMic = new AudioContext();
    const src = audioCtxMic.createMediaStreamSource(micStream);
    analyserNode = audioCtxMic.createAnalyser(); analyserNode.fftSize = 64;
    src.connect(analyserNode); animateMicBars();
  } catch { showError('Microphone access denied. Please allow microphone permission.'); }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  clearInterval(recordingTimer);
  if (micAnimFrame) { cancelAnimationFrame(micAnimFrame); micAnimFrame = null; }
  if (audioCtxMic) { audioCtxMic.close(); audioCtxMic = null; } analyserNode = null;
  micBtn.classList.remove('recording');
  micBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f5c4" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  micLabel.textContent = 'Recording saved — click "Use Recording"';
  micTimer.classList.remove('visible'); micViz.classList.remove('active');
  micBars.forEach(b => { b.style.height = '4px'; });
  micDiscard.disabled = false; micUse.disabled = false;
}

function animateMicBars() {
  if (!analyserNode) return;
  const data = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(data);
  micBars.forEach((bar, i) => { bar.style.height = Math.max(4, (data[i%data.length]||0)/4) + 'px'; });
  micAnimFrame = requestAnimationFrame(animateMicBars);
}

micDiscard.addEventListener('click', () => { clearFile(); });

micUse.addEventListener('click', async () => {
  micDiscard.disabled = true; micUse.disabled = true; micLabel.textContent = 'Converting to WAV…';
  try {
    const usedMime = (mediaRecorder && mediaRecorder.mimeType) || getBestMimeType() || 'audio/webm';
    const blob = new Blob(recordedChunks, { type: usedMime });
    const ac = new AudioContext(), audioBuf = await ac.decodeAudioData(await blob.arrayBuffer());
    await ac.close();
    const wavFile = new File([encodeWAV(audioBuf)], 'recording.wav', { type: 'audio/wav' });
    setFile(wavFile, true); micLabel.textContent = 'Recording ready to analyse';
    showToast('Recording converted to WAV — press Analyse Voice!');
  } catch (err) {
    showError('Could not convert recording: ' + (err.message || 'Unknown error'));
    micDiscard.disabled = false; micUse.disabled = false; micLabel.textContent = 'Conversion failed — try again';
  }
});

analyseBtn.addEventListener('click', analyse);

async function analyse() {
  if (!selectedFile) return;
  // Use entered key, fallback to default if empty
  const apiKey = apiKeyInput.value.trim() || DEFAULT_API_KEY;
  analyseBtn.disabled = true; loadingState.classList.add('visible');
  resultCard.classList.remove('visible'); hideError();
  const formData = new FormData();
  formData.append('language', selectedLang); formData.append('file', selectedFile);
  const startTime = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/voice-detection`, { method:'POST', headers:{'x-api-key':apiKey}, body:formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
    if (!data.processingTimeMs) data.processingTimeMs = Math.round(performance.now() - startTime);
    lastResult = data; showResult(data); addHistory(data);
    incrementCounter('analyses').then(newTotal => {
      if (newTotal === null) return;
      animateCount(document.getElementById('globalAnalyses'), newTotal);
      const ma = document.getElementById('modalGlobalAnalyses');
      if (ma) ma.textContent = newTotal.toLocaleString();
    });
  } catch (err) { showError(err.message || 'Network error. Check your connection or API status.'); }
  finally { loadingState.classList.remove('visible'); analyseBtn.disabled = false; }
}

function showResult(data) {
  const isHuman = data.classification === 'HUMAN', cls = isHuman ? 'human' : 'ai';
  const pct = Math.round(data.confidenceScore * 100);
  const badge = document.getElementById('resultBadge'); badge.className = `result-badge ${cls}`;
  document.getElementById('resultLabel').textContent = isHuman ? 'Human Voice' : 'AI Generated';
  document.getElementById('confPercent').textContent = pct;
  const bar = document.getElementById('confBar'); bar.className = `conf-bar-fill ${cls}`; bar.style.width = '0%';
  setTimeout(() => { bar.style.width = pct + '%'; }, 50);
  document.getElementById('metaFile').textContent = data.filename || selectedFile.name;
  document.getElementById('metaLang').textContent = (data.language||selectedLang).charAt(0).toUpperCase() + (data.language||selectedLang).slice(1);
  document.getElementById('metaTime').textContent = data.processingTimeMs + 'ms';
  document.getElementById('explanationBox').textContent = data.explanation || 'No explanation provided.';
  resultCard.classList.add('visible');
  setTimeout(() => resultCard.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
}

function addHistory(data) {
  const entry = { name:data.filename||selectedFile.name, result:data.classification, conf:Math.round(data.confidenceScore*100), time:new Date().toLocaleTimeString(), lang:data.language||selectedLang, ms:data.processingTimeMs };
  history.unshift(entry); if (history.length > 20) history.pop();
  try { localStorage.setItem('voiceid_history', JSON.stringify(history)); } catch {}
  renderHistory(); updateTotalCount();
}

function renderHistory() {
  if (!history.length) { historyList.innerHTML = '<div class="empty-history">No analyses yet. Upload a file to get started.</div>'; return; }
  historyList.innerHTML = history.map(h => {
    const cls = h.result === 'HUMAN' ? 'human' : 'ai';
    return `<div class="history-item"><div class="history-dot ${cls}"></div><span class="history-name">${escHtml(h.name)}</span><span class="history-result ${cls}">${h.result==='HUMAN'?'HUMAN':'AI'}</span><span class="history-conf">${h.conf}%</span><span class="history-time">${h.time||''}</span></div>`;
  }).join('');
}

clearHistoryBtn.addEventListener('click', () => {
  if (!confirm('Clear all history?')) return;
  history = []; try { localStorage.removeItem('voiceid_history'); } catch {}
  renderHistory(); updateTotalCount();
});

function updateTotalCount() { document.getElementById('totalCount').textContent = history.length; }

document.getElementById('statsBtn').addEventListener('click', () => {
  const total = history.length, human = history.filter(h => h.result==='HUMAN').length, ai = total-human;
  const avg = total > 0 ? Math.round(history.reduce((s,h)=>s+h.conf,0)/total) : 0;
  const hp = total > 0 ? Math.round((human/total)*100) : 50;
  document.getElementById('statTotal').textContent = total; document.getElementById('statHuman').textContent = human;
  document.getElementById('statAI').textContent = ai; document.getElementById('statAvgConf').textContent = total > 0 ? avg+'%' : '—';
  document.getElementById('ratioHumanPct').textContent = `Human ${hp}%`; document.getElementById('ratioAIPct').textContent = `AI ${100-hp}%`;
  const mv = document.getElementById('modalGlobalVisitors'), ma = document.getElementById('modalGlobalAnalyses');
  if (mv) mv.textContent = document.getElementById('globalVisitors').textContent;
  if (ma) ma.textContent = document.getElementById('globalAnalyses').textContent;
  setTimeout(() => { document.getElementById('ratioHuman').style.width=hp+'%'; document.getElementById('ratioAI').style.width=(100-hp)+'%'; }, 100);
  document.getElementById('statsModal').classList.add('visible');
});
document.getElementById('statsModalClose').addEventListener('click', () => { document.getElementById('statsModal').classList.remove('visible'); });
document.getElementById('statsModal').addEventListener('click', e => { if (e.target===document.getElementById('statsModal')) document.getElementById('statsModal').classList.remove('visible'); });

document.getElementById('shareCardBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification==='HUMAN', pct = Math.round(lastResult.confidenceScore*100);
  document.getElementById('shareCardPreview').className = `share-card ${isHuman?'human':'ai'}`;
  document.getElementById('shareCardResult').textContent = isHuman ? '✓ Human Voice' : '⚠ AI Generated';
  document.getElementById('shareCardResult').className   = `share-card-result ${isHuman?'human':'ai'}`;
  document.getElementById('shareCardConf').textContent   = `${pct}% confidence · ${lastResult.language||selectedLang}`;
  document.getElementById('shareCardFile').textContent   = lastResult.filename||selectedFile.name;
  document.getElementById('shareModal').classList.add('visible');
});
document.getElementById('shareModalClose').addEventListener('click', () => { document.getElementById('shareModal').classList.remove('visible'); });
document.getElementById('shareModal').addEventListener('click', e => { if (e.target===document.getElementById('shareModal')) document.getElementById('shareModal').classList.remove('visible'); });

document.getElementById('copyCardTextBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification==='HUMAN', pct = Math.round(lastResult.confidenceScore*100);
  const text = ['VoiceID Result', isHuman?'✓ Human Voice':'⚠ AI Generated', `${pct}% confidence · ${lastResult.language||selectedLang}`, `File: ${lastResult.filename||selectedFile.name}`, '', 'Detect AI voices: https://mdeepaksai.github.io/human-or-AI/'].join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
});

document.getElementById('tweetBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const isHuman = lastResult.classification==='HUMAN', pct = Math.round(lastResult.confidenceScore*100);
  const text = `Just analysed a voice with VoiceID 🎙️\n\nResult: ${isHuman?'✅ Human Voice':'🤖 AI Generated'}\nConfidence: ${pct}%\n\nTry it yourself:`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://mdeepaksai.github.io/human-or-AI/')}`, '_blank');
});

document.getElementById('copyResultBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById('copyResultBtn'); btn.classList.add('copied'); showToast('Link copied!');
    setTimeout(() => btn.classList.remove('copied'), 2000);
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify({...lastResult, exportedAt:new Date().toISOString(), clientVersion:'2.1'}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `voiceid-${(lastResult.filename||'result').replace(/[^a-z0-9]/gi,'_')}.json`; a.click(); showToast('Result exported!');
});

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast'); toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function showError(msg) { errorMsg.textContent = msg; errorBox.classList.add('visible'); }
function hideError()    { errorBox.classList.remove('visible'); }
function formatBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(1)+' MB'; }
function formatTime(s)  { if(!isFinite(s)||isNaN(s))return'0:00'; return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
function escHtml(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('keydown', e => {
  if (e.code==='Space' && e.target===document.body && audioElement) { e.preventDefault(); playBtn.click(); }
  if (e.key==='Escape') { document.getElementById('shareModal').classList.remove('visible'); document.getElementById('statsModal').classList.remove('visible'); }
});