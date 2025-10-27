const socket = io();

const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');

let socketId = null;

socket.on('connect', () => {
  console.log('Conectado ao servidor com ID:', socket.id);
  socketId = socket.id;
});

downloadBtn.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value;
  if (!videoUrl || !socketId) {
    alert('Por favor, insira uma URL válida.');
    return;
  }

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

    if (response.status === 202) {
      statusDiv.innerText = `Pedido recebido! Seu job é o #${data.position}. Aguardando na fila...`;
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
  statusDiv.innerText = `Erro no download: ${data.error}`;
});
