const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('open-ebook', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open eBook (PDF or TXT)',
    properties: ['openFile'],
    filters: [
      { name: 'eBooks', extensions: ['pdf','txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
  const filePath = filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const base64 = fs.readFileSync(filePath, {encoding:'base64'});
  return { canceled: false, filePath, ext, base64 };
});
