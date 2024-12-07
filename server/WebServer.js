import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const PORT = 3001;
const __dirname = dirname(fileURLToPath(import.meta.url)); 
const wss = new WebSocketServer({ server });

let esp32Client = null;
const webClients = new Set();

// Tạo HTTP Server
const server = createServer(async (req, res) => {
    if (req.method === 'GET') {
        try {
            if (req.url === '/') {
                const data = await readFile(join(__dirname, 'index.html'));
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            } else if (req.url === '/app.js') {
                const data = await readFile(join(__dirname, 'app.js'));
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(data);
            } else if (req.url === '/style.css') {
                const data = await readFile(join(__dirname, 'style.css'));
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.end(data);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
});

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        if (!esp32Client && message.toString() === 'ESP32') {
            esp32Client = ws;
            console.log('ESP32 connected');
            return;
        }

        if (ws === esp32Client) {
            if (message instanceof Buffer) {
                // Tạo tiến trình Python để xử lý YOLO
                const pythonProcess = spawn('python', ['fire_detect.py']);
                pythonProcess.stdin.write(message);
                pythonProcess.stdin.end();

                // Lắng nghe kết quả từ YOLO
                pythonProcess.stdout.on('data', (processedFrame) => {
                    // Gửi kết quả tới tất cả các web client
                    webClients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(processedFrame, { binary: true });
                        }
                    });
                });

                pythonProcess.on('error', (err) => {
                    console.error('Error running YOLO:', err);
                });
            }
        } else {
            console.log('Message from Web client:', message.toString());
            if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
                esp32Client.send(message.toString());
            }
        }
    });

    ws.on('close', () => {
        if (ws === esp32Client) {
            console.log('ESP32 disconnected');
            esp32Client = null;
        } else {
            console.log('Web client disconnected');
            webClients.delete(ws);
        }
    });

    if (ws !== esp32Client) {
        webClients.add(ws);
    }
});

// Chạy server HTTP và WebSocket
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
