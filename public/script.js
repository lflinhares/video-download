const socket = io();

// Elementos da UI
const videoUrlInput = document.getElementById('videoUrl');
const fetchBtn = document.getElementById('fetchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const inputStep = document.getElementById('input-step');
const optionsStep = document.getElementById('options-step');
const thumbnail = document.getElementById('thumbnail');
const videoTitle = document.getElementById('videoTitle');
const formatTypeSelect = document.getElementById('formatType');
const qualityOptionsSelect = document.getElementById('qualityOptions');
const backBtn = document.getElementById('backBtn');
const noOptionsMessage = document.getElementById('no-options-message');
let socketId = null;
let availableFormats = null;
let currentMetadataId = null;

function resetUI() {
  inputStep.style.display = 'block';
  optionsStep.style.display = 'none';
  statusDiv.innerText = '';
  resultDiv.innerHTML = '';
  videoUrlInput.value = '';
  availableFormats = null;
  currentMetadataId = null;
}

socket.on('connect', () => {
  socketId = socket.id;
});

function populateQualityOptions() {
  const selectedType = formatTypeSelect.value;
  qualityOptionsSelect.innerHTML = ''; // Limpa opções antigas

  const formats = availableFormats ? availableFormats[selectedType + 's'] : [];

  if (formats && formats.length > 0) {
    // Se temos formatos, mostramos o seletor e o botão de download
    qualityOptionsSelect.style.display = 'inline-block';
    downloadBtn.style.display = 'inline-block';
    noOptionsMessage.style.display = 'none';

    formats.forEach((format) => {
      const option = document.createElement('option');
      option.value = format.formatId;
      const label =
        selectedType === 'video' ? format.resolution : format.quality;
      option.innerText = `${label} (~${format.sizeMB} MB)`;
      qualityOptionsSelect.appendChild(option);
    });
  } else {
    // Se não temos formatos, escondemos o seletor e o botão, e mostramos a mensagem
    qualityOptionsSelect.style.display = 'none';
    downloadBtn.style.display = 'none';
    noOptionsMessage.style.display = 'block';
    noOptionsMessage.innerText = `O tamanho do ${selectedType} excede o limite.`;
  }
}

backBtn.addEventListener('click', resetUI);

fetchBtn.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value;
  if (!videoUrl) {
    alert('Por favor, insira uma URL.');
    return;
  }

  statusDiv.innerText = 'Buscando informações do vídeo...';
  fetchBtn.disabled = true;

  try {
    const response = await fetch(
      `/download/metadata?video_url=${encodeURIComponent(videoUrl)}`,
    );
    const data = await response.json();

    if (response.ok) {
      availableFormats = data.formats;
      videoTitle.innerText = data.title;
      thumbnail.src = data.thumbnail;
      currentMetadataId = data.metadataId;
      populateQualityOptions();

      inputStep.style.display = 'none';
      optionsStep.style.display = 'block';
      statusDiv.innerText = '';
    } else {
      statusDiv.innerText = `Erro: ${data.message}`;
    }
  } catch (error) {
    statusDiv.innerText = 'Falha ao buscar metadados.';
  } finally {
    fetchBtn.disabled = false;
  }
});

formatTypeSelect.addEventListener('change', populateQualityOptions);

downloadBtn.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value;
  const format = formatTypeSelect.value;
  const quality = qualityOptionsSelect.value;

  if (!currentMetadataId) {
    alert('Metadados não encontrados. Tente buscar as opções novamente.');
    return;
  }

  optionsStep.style.display = 'none';
  statusDiv.innerText = 'Enviando pedido...';

  try {
    const response = await fetch('/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        socketId,
        format,
        quality,
        metadataId: currentMetadataId,
      }),
    });

    const data = await response.json();
    myJobId = data.jobId;

    if (response.status === 202) {
      statusDiv.innerText = `Pedido recebido! Aguardando na fila...`;
    } else {
      statusDiv.innerText = `Erro: ${data.message}`;
    }
  } catch (error) {
    statusDiv.innerText = 'Erro ao se comunicar com o servidor.';
    console.error(error);
  }
});

socket.on('download-progress', (data) => {
  statusDiv.innerText = `Baixando... ${data.progress.toFixed(2)}%`;
});

socket.on('download-complete', (data) => {
  statusDiv.innerText = 'Download concluído!';
  resultDiv.innerHTML = `<a href="${data.downloadLink}" download="${data.fileName}">Clique aqui para baixar</a>`;
  // Reabilitar o formulário
  optionsStep.style.display = 'block';
  downloadBtn.style.display = 'inline-block';
});

socket.on('download-error', (data) => {
  statusDiv.innerText = `Erro no download: ${data.error}`;
  // Reabilitar o formulário
  optionsStep.style.display = 'block';
  downloadBtn.style.display = 'inline-block';
});

socket.on('queue-update', (data) => {
  const myJobInQueue = data.queue.find((job) => job.jobId === myJobId);

  if (myJobInQueue) {
    statusDiv.innerText = `Seu download está na posição ${myJobInQueue.position} da fila.`;
  }
});
