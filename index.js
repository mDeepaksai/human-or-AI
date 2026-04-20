  const API_BASE = 'https://human-or-ai-production-8e10.up.railway.app';

  // Elements
  const dropZone    = document.getElementById('dropZone');
  const fileInput   = document.getElementById('fileInput');
  const fileInfo    = document.getElementById('fileInfo');
  const fileName    = document.getElementById('fileName');
  const fileSize    = document.getElementById('fileSize');
  const fileRemove  = document.getElementById('fileRemove');
  const waveform    = document.getElementById('waveform');
  const analyseBtn  = document.getElementById('analyseBtn');
  const loadingState = document.getElementById('loadingState');
  const resultCard  = document.getElementById('resultCard');
  const errorBox    = document.getElementById('errorBox');
  const errorMsg    = document.getElementById('errorMsg');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleKey   = document.getElementById('toggleKey');
  const historyList = document.getElementById('historyList');
  const clearHistory = document.getElementById('clearHistory');

  let selectedFile = null;
  let selectedLang = 'english';
  let history = JSON.parse(localStorage.getItem('voiceid_history') || '[]');

  // Generate waveform bars
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

  // Toggle API key visibility
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

  // Drag & drop
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) {
      showError('Only MP3 and WAV files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('File exceeds 10MB limit.');
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.add('visible');
    waveform.classList.add('visible');
    dropZone.classList.add('has-file');
    analyseBtn.disabled = false;
    hideError();
    resultCard.classList.remove('visible');
  }

  fileRemove.addEventListener('click', e => {
    e.stopPropagation();
    clearFile();
  });

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.remove('visible');
    waveform.classList.remove('visible');
    dropZone.classList.remove('has-file');
    analyseBtn.disabled = true;
    resultCard.classList.remove('visible');
    hideError();
  }

  // Analyse
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

      if (!res.ok) {
        throw new Error(data.detail || `Error ${res.status}`);
      }

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
    const isHuman = data.classification === 'HUMAN';
    const entry = {
      name: data.filename,
      result: data.classification,
      conf: Math.round(data.confidenceScore * 100),
      time: new Date().toLocaleTimeString()
    };
    history.unshift(entry);
    if (history.length > 10) history.pop();
    localStorage.setItem('voiceid_history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history">No analyses yet. Upload a file to get started.</div>';
      return;
    }

    historyList.innerHTML = history.map(h => {
      const isHuman = h.result === 'HUMAN';
      const cls = isHuman ? 'human' : 'ai';
      const label = isHuman ? 'HUMAN' : 'AI';
      return `
        <div class="history-item">
          <div class="history-dot ${cls}"></div>
          <span class="history-name">${escHtml(h.name)}</span>
          <span class="history-result ${cls}">${label}</span>
          <span class="history-conf">${h.conf}%</span>
        </div>
      `;
    }).join('');
  }

  clearHistory.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('voiceid_history');
    renderHistory();
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorBox.classList.add('visible');
  }

  function hideError() {
    errorBox.classList.remove('visible');
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Init
  renderHistory();