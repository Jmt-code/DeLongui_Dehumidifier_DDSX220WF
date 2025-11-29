const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let tray;
let backendProcess;
let staticServer;
let splashWindow;

const isDev = !app.isPackaged;

// Paths based on environment
const getResourcePath = (folder) => {
  if (isDev) {
    return path.join(__dirname, '..', folder);
  }
  return path.join(process.resourcesPath, folder);
};

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          font-family: 'Segoe UI', sans-serif;
          color: white;
        }
        .logo { font-size: 80px; margin-bottom: 20px; }
        h1 { font-size: 20px; margin-bottom: 30px; }
        .loader {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .status { margin-top: 20px; font-size: 14px; opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="logo">🌡️</div>
      <h1>De'Longhi Control</h1>
      <div class="loader"></div>
      <div class="status">Starting...</div>
    </body>
    </html>
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 380,
    minHeight: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    backgroundColor: '#764ba2'
  });

  mainWindow.loadURL('http://localhost:5173');

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    // Always quit the app when closing the window
    app.isQuitting = true;
    cleanupAndQuit();
  });
}

function cleanupAndQuit() {
  console.log('Cleaning up processes...');
  
  if (staticServer) {
    try {
      staticServer.close();
    } catch (e) {}
  }
  
  if (backendProcess && backendProcess.pid) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        backendProcess.kill('SIGKILL');
      }
    } catch (e) {}
  }
  
  // Force quit after cleanup
  setTimeout(() => {
    app.exit(0);
  }, 500);
}

function createTray() {
  try {
    // Crear un icono por defecto embebido
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAJhSURBVFiF7ZdNaxNRFIafmUxmJpOkSdM0TdqqVVu1WnFR3Lli4cKVuHAhuHHjTty6d+fv8A/4B9y5cediF4IbFaul2tI2TT6bZDKZuS4ygUnaJDVFwe7hLs6ce9/73nPPnDvwn0sYh4GBgXHgKpAFdoANYMy27ZnDHkw4ClgIIZYDgcBZ4BowB9wGFoFHwFvHcQ6cPBQAy7Lm+/r6bkqSdB24ADwGvgNvgC+u6zq9xugJIBgMXpYk6RbgAO9UVX2ey+X6uo27/U1d0zTPADeBZV3Xl4LB4NZh44fqgGVZL4rF4pjruquapn2Ox+PZQCDQ1NFeADLGmEG/3z8HzAO3gTe5XG77oLO7AhiG8ayvrw9N024AM77f7xsNh8M7R8k+CsDv91uGYfwCnsiy/K1QKFxsN+41BhRVVWeCweBLWZYPA9DZB2AHSjqdznQy3DXGLMvahcb79B6wlkolF3gNJAEH2OzV3k3kZ2AF+NRFABNA7E8ECIZ/MQBN0xxd1wfb2vqBaeAEkARU0zRbBvS9wAWgi8dAqFcM4Tq2A/D/B+AEeMD/BHB8bz8AAYAE/M4Am8ATKeB97haDJ3sFaGULGPPc3u4PIAHE9jcEwEUg7LquCMWAJwAQuJYGEgn4/Y+fwpqm/fHOdjqtBfBz/QC0Y4x5jjH+A28FIBQKPQdSzXaEJEmk0+kpT/8EYDXLQ2yp6UkKsAOBQGuM0k8A4YOcPCqAw+bfNmAy0AJQP+bP9h1DjZn2pCCz0cfjhz+9CmC69MH/AnDcAXiZ3n5Aev/7t59dBR64APgFOBbtHr5T+qkAAAAASUVORK5CYII=');
    
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Open De\'Longhi Control', 
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      { type: 'separator' },
      { 
        label: 'Exit', 
        click: () => {
          app.isQuitting = true;
          cleanupAndQuit();
        }
      }
    ]);

    tray.setToolTip('De\'Longhi Control');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } catch (e) {
    console.error('Error creating tray:', e);
  }
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = getResourcePath('backend');
    console.log('Backend path:', backendPath);

    backendProcess = spawn('node', ['server_v3.js'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' }
    });

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Backend: ${output}`);
      if (output.includes('3001')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    setTimeout(resolve, 3000);
  });
}

// Simple static server to serve the frontend
function startStaticServer() {
  return new Promise((resolve) => {
    const frontendPath = isDev 
      ? path.join(__dirname, '..', 'frontend', 'dist')
      : path.join(process.resourcesPath, 'frontend', 'dist');
    
    console.log('Frontend path:', frontendPath);

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    staticServer = http.createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url;
      filePath = path.join(frontendPath, filePath);

      // Si no existe el archivo, servir index.html (SPA)
      if (!fs.existsSync(filePath)) {
        filePath = path.join(frontendPath, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

    staticServer.listen(5173, () => {
      console.log('Frontend server at http://localhost:5173');
      resolve();
    });
  });
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for server'));
        } else {
          setTimeout(check, 500);
        }
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for server'));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    
    check();
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    console.log('=================================');
    console.log('De\'Longhi Control - Starting...');
    console.log('Mode:', isDev ? 'Development' : 'Production');
    console.log('=================================');
    
    createSplashWindow();
    
    try {
      console.log('Starting backend...');
      await startBackend();
      
      console.log('Starting frontend...');
      await startStaticServer();
      
      console.log('Waiting for servers...');
      await waitForServer('http://localhost:5173');
      
      console.log('Servers ready!');
    } catch (e) {
      console.error('Error starting servers:', e);
    }
    
    createWindow();
    createTray();
  });
}

app.on('window-all-closed', () => {
  // Quit app when window is closed
  cleanupAndQuit();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('exit', () => {
  // Final cleanup on exit
  if (backendProcess && backendProcess.pid) {
    try {
      require('child_process').execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch (e) {}
  }
});
