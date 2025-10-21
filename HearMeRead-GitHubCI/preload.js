const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hearme', {
  openEbook: () => ipcRenderer.invoke('open-ebook')
});
