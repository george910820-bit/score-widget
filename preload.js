// 把主程式的功能安全地提供給畫面使用
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  saveFile: (rel, bytes) => ipcRenderer.invoke('file:save', rel, bytes),
  deleteFile: (rel) => ipcRenderer.invoke('file:delete', rel),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  close: () => ipcRenderer.invoke('win:close'),
  toggleMax: () => ipcRenderer.invoke('win:toggleMax'),
  onMaximized: (cb) => ipcRenderer.on('win:maximized', (_e, v) => cb(v)),
  setPin: (on) => ipcRenderer.invoke('win:pin', on),
  setOpacity: (v) => ipcRenderer.invoke('win:opacity', v),
  setMini: (on, h) => ipcRenderer.invoke('win:mini', on, h),
  fit: (h) => ipcRenderer.invoke('win:fit', h),
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
  setZoom: (z) => webFrame.setZoomFactor(z),
  getZoom: () => webFrame.getZoomFactor()
});
