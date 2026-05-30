const path = require('node:path');
const http = require('node:http');

const { app, BrowserWindow, shell } = require('electron');
const serveHandler = require('serve-handler');

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(devServerUrl);

let windowRef = null;
let staticServer = null;
let staticServerUrl = null;

const createStaticServer = async () => {
  if (staticServerUrl) return staticServerUrl;

  const distPath = path.resolve(__dirname, '..', 'dist');
  staticServer = http.createServer((request, response) => {
    serveHandler(request, response, {
      public: distPath,
      cleanUrls: false,
      rewrites: [{ source: '**', destination: '/index.html' }],
    });
  });

  await new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = staticServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine static server port for Electron renderer.');
  }

  staticServerUrl = `http://127.0.0.1:${address.port}`;
  return staticServerUrl;
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#111213',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  windowRef = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const url = await createStaticServer();
    await win.loadURL(url);
  }

  win.on('closed', () => {
    if (windowRef === win) windowRef = null;
  });
};

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (!staticServer) return;
  await new Promise((resolve) => {
    staticServer.close(() => resolve());
  });
});
