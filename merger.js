(() => {
  const btnOpen = document.getElementById('btnMerger');
  const overlay = document.getElementById('mergerOverlay');
  const btnClose = document.getElementById('btnCloseMerger');
  const startBtn = document.getElementById('mergeStartBtn');
  const videoInput = document.getElementById('mergeVideoInput');
  const audioInput = document.getElementById('mergeAudioInput');
  const status = document.getElementById('mergeStatus');
  const statusText = document.getElementById('mergeStatusText');
  const progressEl = document.getElementById('mergeProgress');
  const result = document.getElementById('mergeResult');
  const preview = document.getElementById('mergePreview');
  const filenameEl = document.getElementById('mergeFilename');
  const saveBtn = document.getElementById('mergeSaveBtn');
  if (!btnOpen || !window.FFmpegWASM || !window.FFmpegUtil) return;

  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const ffmpeg = new FFmpeg();
  let outputBlob = null;
  let outputURL = null;
  let outputName = '';

  function setStatus(text, show = true) {
    status.style.display = show ? 'block' : 'none';
    statusText.textContent = text;
  }

  ffmpeg.on('progress', ({ progress }) => {
    const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
    progressEl.value = pct;
    setStatus(`⏳ Memproses: ${pct}%`);
  });

  async function loadFFmpeg() {
    if (ffmpeg.loaded) return;
    setStatus('⚙️ Memuat mesin FFmpeg...');
    progressEl.value = 0;
    try {
      // Core JS sudah dibundel lokal. WASM dicoba lokal dahulu agar build mendatang
      // dapat sepenuhnya offline; bila file belum ada, gunakan CDN seperti aplikasi merger asli.
      let wasmURL = './lib/ffmpeg-core.wasm';
      const localWasm = await fetch(wasmURL, { cache: 'no-store' });
      if (!localWasm.ok) throw new Error('local wasm unavailable');
      await ffmpeg.load({ coreURL: './lib/ffmpeg-core.js', wasmURL });
    } catch (localErr) {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      setStatus('🌐 Mengunduh komponen FFmpeg pertama kali...');

      async function cachedBlobURL(url, mime) {
        const cache = await caches.open('fyde-ffmpeg-core-v1');
        let response = await cache.match(url);
        if (!response) {
          response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Gagal mengunduh ${url}`);
          await cache.put(url, response.clone());
        }
        const bytes = await response.arrayBuffer();
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
      }

      const coreURL = await cachedBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await cachedBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
    }
    setStatus('✅ FFmpeg siap.');
  }

  async function saveBlob(blob, name) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.warn('Save picker gagal, memakai download:', err);
      }
    }
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  btnOpen.addEventListener('click', () => {
    overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false');
  });
  btnClose.addEventListener('click', () => {
    overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true');
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) btnClose.click(); });

  startBtn.addEventListener('click', async () => {
    const videoFile = videoInput.files && videoInput.files[0];
    const audioFile = audioInput.files && audioInput.files[0];
    if (!videoFile || !audioFile) { alert('Pilih file video dan audio terlebih dahulu.'); return; }

    const vidExt = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
    const audExt = (audioFile.name.split('.').pop() || 'm4a').toLowerCase();
    const vin = `video_in.${vidExt}`;
    const ain = `audio_in.${audExt}`;
    const out = 'hasil_gabungan.mp4';
    startBtn.disabled = true; startBtn.textContent = 'Sedang Memproses...';
    result.style.display = 'none';
    try {
      await loadFFmpeg();
      setStatus('📂 Membaca video dan audio...');
      await ffmpeg.writeFile(vin, await fetchFile(videoFile));
      await ffmpeg.writeFile(ain, await fetchFile(audioFile));
      setStatus('🎬 Menggabungkan video + audio...');
      const exitCode = await ffmpeg.exec([
        '-i', vin, '-i', ain,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'copy',
        '-shortest', out
      ]);
      if (exitCode !== 0) throw new Error(`FFmpeg berhenti dengan kode ${exitCode}`);
      const data = await ffmpeg.readFile(out);
      outputBlob = new Blob([data.buffer], { type: 'video/mp4' });
      if (outputURL) URL.revokeObjectURL(outputURL);
      outputURL = URL.createObjectURL(outputBlob);
      outputName = `Gabungan_${Date.now()}.mp4`;
      preview.src = outputURL;
      filenameEl.textContent = `📄 ${outputName}`;
      result.style.display = 'block';
      progressEl.value = 100;
      setStatus('✅ Penggabungan selesai. Preview dan simpan hasil di bawah.');
    } catch (err) {
      console.error('Merger gagal:', err);
      setStatus(`❌ Gagal menggabungkan: ${err.message || err}`);
    } finally {
      for (const f of [vin, ain, out]) { try { await ffmpeg.deleteFile(f); } catch (_) {} }
      startBtn.disabled = false; startBtn.textContent = 'Mulai Penggabungan';
    }
  });

  saveBtn.addEventListener('click', () => {
    if (outputBlob && outputName) saveBlob(outputBlob, outputName);
  });
})();
