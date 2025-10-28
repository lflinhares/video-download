# Real-Time Video Downloader API

This project is a robust, queue-based API for downloading videos from YouTube. It features a Node.js backend built with the **NestJS** framework, a real-time progress-tracking frontend, and a containerized environment using **Docker** for easy setup and deployment.

## Features

- **Queue System**: Handles multiple download requests gracefully without overloading the server. New requests are added to a persistent queue processed one by one.
- **Real-Time Progress**: Uses **WebSockets** (`socket.io`) to provide real-time feedback to the client, including queue position and download progress percentage.
- **Video Validation**: Pre-validates video URLs to check for size limits and prevent playlist downloads, ensuring only single videos are processed.
- **Temporary File Storage**: Downloaded videos are stored temporarily and automatically cleaned up by a scheduled cron job to save disk space.
- **Containerized Environment**: Fully containerized with **Docker** and **Docker Compose**, including the NestJS API and a Redis server for the queue.
- **Simple Frontend**: A clean, minimal frontend built with vanilla HTML, CSS, and JavaScript to interact with the API.

## Architecture

The system is designed with a background job architecture to handle long-running download tasks efficiently.

1.  **Client (Frontend)**: Connects to the backend via WebSocket and sends a `POST` request to the `/download` endpoint.
2.  **API (NestJS Controller)**: Receives the request, validates the video URL using `yt-dlp`.
3.  **Queue (BullMQ + Redis)**: If validation passes, a new download "job" is added to a persistent Redis queue. The API immediately responds with `202 Accepted` and the job's position in the queue.
4.  **Worker (NestJS Processor)**: A background worker picks up jobs from the queue one by one. It uses the `yt-dlp` command-line tool to download the video.
5.  **Real-Time Feedback (WebSocket Gateway)**: The worker emits progress events (`download-progress`, `download-complete`, `download-error`) via a WebSocket gateway back to the specific client that made the request.
6.  **File Serving & Cleanup**: Once downloaded, the file is served via a static route. A **Cron Job** (`CleanupService`) runs periodically to delete old video files from the server.

 <!-- You can create and add a diagram link here if you want -->

## Tech Stack

- **Backend**: NestJS (Node.js), TypeScript
- **Queue**: BullMQ, Redis
- **Real-Time**: WebSockets (Socket.io)
- **Downloader**: `yt-dlp` (executed as a child process)
- **Containerization**: Docker, Docker Compose
- **Frontend**: HTML, CSS, JavaScript (Vanilla)

---

## Getting Started: Local Development

### Running the Application

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd youtube-downloader-api
    ```

2.  **Build and run the containers:**
    The `docker-compose` command will build the API image (installing all system and Node dependencies) and start the `api` and `redis` services.
    ```bash
    docker-compose up --build
    ```

3.  **Access the application:**
    Open your browser and navigate to `http://localhost:3000`.

The application will now be running in development mode with live-reloading enabled. Any changes you make to the source code will automatically restart the NestJS server inside the container.

---

## Deployment to a Debian VPS

This project includes a production-ready multi-stage `Dockerfile` for optimized, smaller images.

### 1. Prepare Your VPS

- Connect to your VPS via SSH.
- Install `git`, `docker`, and `docker-compose`. Follow the official Docker installation guides for your distribution.

### 2. Set Up Your Project

- Clone your repository onto the VPS.
    ```bash
    git clone <your-repo-url>
    cd youtube-downloader-api
    ```
- **Important**: Make sure your `cookies.txt` file is present on the server. You may need to copy it securely (e.g., with `scp`) or add it to the repository if it's for a dedicated service account.

### 3. Build and Deploy

Use the production Docker Compose file (`docker-compose.prod.yml`) to build and run the application in detached mode.

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

- `-f docker-compose.prod.yml`: Specifies the production configuration file.
- `--build`: Builds the optimized production image using `Dockerfile.prod`.
- `-d`: Runs the containers in the background (detached mode).

### 4. Update Frontend for Production

Before deploying, ensure your frontend code in `public/script.js` points to your VPS IP address or domain name, not `localhost`. Use relative URLs to avoid CORS issues:

```javascript
// public/script.js

// Connects to the same host the page was served from
const socket = io(); 

// Fetch uses a relative path
const response = await fetch('/download', { /* ... */ });
```

### 5. Managing the Production Application

- **View logs:**
  ```bash
  docker-compose -f docker-compose.prod.yml logs -f api
  ```
- **Stop the application:**
  ```bash
  docker-compose -f docker-compose.prod.yml down
  ```
- **Update the application after a `git pull`:**
  ```bash
  docker-compose -f docker-compose.prod.yml up --build -d
  ```

