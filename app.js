const { FFmpeg } = FFmpegWASM;
const { fetchFile } = FFmpegUtil;

const ffmpeg = new FFmpeg();
const statusEl = document.getElementById('status');
const mergeBtn = document.getElementById('mergeBtn');
const resultsSection = document.getElementById('resultsSection');
const outputList = document.getElementById('outputList');
const resultCountEl = document.getElementById('resultCount');

let videoCounter = 0; // Untuk menghitung jumlah video di folder

// Melacak progres
ffmpeg.on('progress', ({ progress }) => {
    statusEl.style.display = 'block';
    statusEl.innerText = `⏳ Memproses: ${Math.round(progress * 100)}% selesai...`;
});

// Memuat FFmpeg (Mempertahankan Opsi 1)
async function loadFFmpeg() {
    if (!ffmpeg.loaded) {
        statusEl.style.display = 'block';
        statusEl.innerText = '⚙️ Memuat mesin FFmpeg... (Hanya butuh sekali)';
        
        try {
            await ffmpeg.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
            });
            statusEl.innerText = '✅ FFmpeg siap! Mulai membaca file...';
        } catch (err) {
            console.error("Error saat memuat FFmpeg:", err);
            statusEl.innerText = `❌ GAGAL MEMUAT: ${err.message}.`;
            statusEl.style.backgroundColor = '#FEE2E2';
            statusEl.style.color = '#991B1B';
            throw err; 
        }
    }
}

// Fitur Download/Save Canggih
async function simpanVideo(blob, defaultFilename) {
    // Mengecek apakah browser mendukung fitur pemilih folder/file modern (File System Access API)
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultFilename,
                types: [{
                    description: 'Video MP4',
                    accept: {'video/mp4': ['.mp4']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            alert('✅ Video berhasil disimpan ke folder pilihan Anda!');
            return;
        } catch (err) {
            // Jika user membatalkan (cancel) jendela simpan, abaikan
            if (err.name !== 'AbortError') {
                console.error('Gagal menggunakan FilePicker:', err);
            } else {
                return; // User membatalkan save
            }
        }
    }
    
    // Fallback: Jika browser tidak mendukung, gunakan cara download standar
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href); // Bersihkan memori URL
}

mergeBtn.addEventListener('click', async () => {
    const videoFile = document.getElementById('videoInput').files[0];
    const audioFile = document.getElementById('audioInput').files[0];

    if (!videoFile || !audioFile) {
        alert("⚠️ Harap pilih file video dan audio terlebih dahulu!");
        return;
    }

    try {
        mergeBtn.disabled = true;
        mergeBtn.innerText = 'Sedang Memproses...';
        
        await loadFFmpeg();

        statusEl.innerText = '📂 Membaca file ke dalam memori browser...';
        
        await ffmpeg.writeFile('video_in.mp4', await fetchFile(videoFile));
        await ffmpeg.writeFile('audio_in.mp4', await fetchFile(audioFile));

        statusEl.innerText = '🎬 Mulai menggabungkan...';
        
        await ffmpeg.exec([
            '-i', 'video_in.mp4',
            '-i', 'audio_in.mp4',
            '-c:v', 'copy', 
            '-c:a', 'copy', 
            '-map', '0:v:0', 
            '-map', '1:a:0', 
            'hasil.mp4'
        ]);

        statusEl.innerText = '✨ Selesai! Menyiapkan hasil...';
        
        // Ambil hasil
        const data = await ffmpeg.readFile('hasil.mp4');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const videoURL = URL.createObjectURL(videoBlob);
        
        // Buat nama file unik berdasarkan waktu
        const timestamp = new Date().getTime();
        const outputFilename = `Gabungan_${timestamp}.mp4`;

        // -- MEMBUAT TAMPILAN KOLEKSI HASIL --
        videoCounter++;
        resultCountEl.innerText = `${videoCounter} Video`;
        resultsSection.style.display = 'block';

        // Buat Kartu Video Baru
        const cardDiv = document.createElement('div');
        cardDiv.className = 'video-card';
        
        const vidElement = document.createElement('video');
        vidElement.controls = true;
        vidElement.src = videoURL;
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'video-actions';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'video-title';
        titleSpan.innerText = `📄 ${outputFilename}`;
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save';
        saveBtn.innerHTML = '💾 Simpan Video';
        saveBtn.onclick = () => simpanVideo(videoBlob, outputFilename);
        
        // Rakit elemen ke dalam halaman
        actionDiv.appendChild(titleSpan);
        actionDiv.appendChild(saveBtn);
        cardDiv.appendChild(vidElement);
        cardDiv.appendChild(actionDiv);
        
        // Tambahkan di urutan paling atas (prepend)
        outputList.insertBefore(cardDiv, outputList.firstChild);

        statusEl.innerText = '✅ Proses berhasil ditambahkan ke Koleksi Hasil!';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000); // Sembunyikan status setelah 3 detik

        // Bersihkan memori internal FFmpeg
        await ffmpeg.deleteFile('video_in.mp4');
        await ffmpeg.deleteFile('audio_in.mp4');
        await ffmpeg.deleteFile('hasil.mp4');
        
        // Reset input file agar pengguna bisa memilih file baru
        document.getElementById('videoInput').value = '';
        document.getElementById('audioInput').value = '';

    } catch (error) {
        console.error("Terjadi kesalahan proses:", error);
        statusEl.innerText = '❌ Terjadi kesalahan saat memproses. Cek console (F12).';
        statusEl.style.backgroundColor = '#FEE2E2';
        statusEl.style.color = '#991B1B';
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.innerText = 'Mulai Proses Penggabungan';
    }
});
