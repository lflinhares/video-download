const socket = io();

const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');

let socketId = null;
let myJobId = null;

function setFormEnabled(isEnabled) {
  videoUrlInput.disabled = !isEnabled;
  downloadBtn.disabled = !isEnabled;
  downloadBtn.innerText = isEnabled ? 'Download' : 'Wait...';
}

socket.on('connect', () => {
  socketId = socket.id;
});

downloadBtn.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value;
  if (!videoUrl || !socketId) {
    alert('Por favor, insira uma URL válida.');
    return;
  }
  setFormEnabled(false);
  statusDiv.innerText = 'Enviando pedido...';
  resultDiv.innerHTML = '';

  try {
    const response = await fetch('/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl,
        socketId: socketId,
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
  setFormEnabled(true);
  statusDiv.innerText = 'Download concluído!';

  resultDiv.innerHTML = `
        <a 
            href="${data.downloadLink}" 
            target="_blank" 
            download="${data.fileName}"
        >
            Clique aqui para baixar: ${data.fileName}
        </a>
    `;
});

socket.on('download-error', (data) => {
  setFormEnabled(true);
  statusDiv.innerText = `Erro no download: ${data.error}`;
});

socket.on('queue-update', (data) => {
  const myJobInQueue = data.queue.find((job) => job.jobId === myJobId);

  if (myJobInQueue) {
    statusDiv.innerText = `Seu download está na posição ${myJobInQueue.position} da fila.`;
  }
});
