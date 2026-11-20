// 學生加分小工具 — 主程式（視窗、置頂、存檔）
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------- 資料存放位置 ----------
// 免安裝版（portable）：資料放在 exe 旁邊的「加分小工具資料」資料夾，
// 這樣整個資料夾放在 D 槽、隨身碟或雲端同步資料夾都能帶著走，不怕還原卡。
function resolveDataDir() {
  const candidates = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) candidates.push(process.env.PORTABLE_EXECUTABLE_DIR);
  if (app.isPackaged) candidates.push(path.dirname(process.execPath));
  else candidates.push(__dirname);
  for (const base of candidates) {
    const dir = path.join(base, '加分小工具資料');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (e) { /* 這個位置不能寫，試下一個 */ }
  }
  const fallback = path.join(app.getPath('userData'), '加分小工具資料');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

let DATA_DIR, DATA_FILE, WIN_FILE, BACKUP_DIR;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// 先寫暫存檔再改名，避免寫到一半當機把資料弄壞
function writeJSONSafe(file, obj) {
  const text = JSON.stringify(obj, null, 2);
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.writeFileSync(file, text, 'utf8');
  }
}

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// 每天第一次開啟時備份一份，保留最近 30 份
function dailyBackup() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const target = path.join(BACKUP_DIR, `data-${todayStamp()}.json`);
    if (!fs.existsSync(target)) fs.copyFileSync(DATA_FILE, target);
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^data-\d{8}\.json$/.test(f)).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch (e) { /* 備份失敗不影響使用 */ }
}

function loadData() {
  let data = readJSON(DATA_FILE);
  if (!data) {
    // 主檔讀不到時，改用最新的備份
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
      if (files.length) data = readJSON(path.join(BACKUP_DIR, files[files.length - 1]));
    } catch (e) { /* 沒有備份 */ }
  }
  return data;
}

// ---------- 視窗 ----------
let win = null;
let winState = { width: 340, height: 520, x: undefined, y: undefined, pinned: true, mini: false };

function boundsVisible(b) {
  if (b.x === undefined || b.y === undefined) return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x + 60 > a.x && b.x < a.x + a.width - 60 && b.y + 20 > a.y && b.y < a.y + a.height - 20;
  });
}

let saveWinTimer = null;
function saveWinState() {
  clearTimeout(saveWinTimer);
  saveWinTimer = setTimeout(() => writeJSONSafe(WIN_FILE, winState), 400);
}

function createWindow() {
  const saved = readJSON(WIN_FILE);
  if (saved) winState = { ...winState, ...saved };
  const opts = {
    width: winState.width,
    height: winState.mini ? 64 : winState.height,
    minWidth: 220,
    minHeight: winState.mini ? 40 : 160,
    frame: false,
    resizable: true,
    alwaysOnTop: winState.pinned,
    backgroundColor: '#fffaf0',
    title: '學生加分小工具',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
  if (boundsVisible(winState)) { opts.x = winState.x; opts.y = winState.y; }
  win = new BrowserWindow(opts);
  // 'screen-saver' 是最高的置頂層級：PowerPoint 全螢幕放映時也會浮在上面
  if (winState.pinned) win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const track = () => {
    if (!win || win.isMinimized() || win.isMaximized()) return;
    const b = win.getBounds();
    winState.x = b.x; winState.y = b.y; winState.width = b.width;
    if (!winState.mini) winState.height = b.height;
    saveWinState();
  };
  win.on('moved', track);
  win.on('resized', track);
  win.on('closed', () => { win = null; });
}

// 只允許開一個，避免兩個視窗同時寫同一份資料
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });

  app.whenReady().then(() => {
    DATA_DIR = resolveDataDir();
    DATA_FILE = path.join(DATA_DIR, 'data.json');
    WIN_FILE = path.join(DATA_DIR, 'window.json');
    BACKUP_DIR = path.join(DATA_DIR, 'backup');
    dailyBackup();
    createWindow();
  });

  app.on('window-all-closed', () => {
    clearTimeout(saveWinTimer);
    try { writeJSONSafe(WIN_FILE, winState); } catch (e) { /* ignore */ }
    app.quit();
  });
}

// ---------- 跟畫面溝通 ----------
ipcMain.handle('data:load', () => ({ data: loadData(), dataDir: DATA_DIR, pinned: winState.pinned, mini: winState.mini }));

ipcMain.handle('data:save', (_e, data) => {
  writeJSONSafe(DATA_FILE, data);
  return true;
});

ipcMain.handle('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:close', () => { if (win) win.close(); });

ipcMain.handle('win:pin', (_e, on) => {
  winState.pinned = !!on;
  if (win) {
    if (on) win.setAlwaysOnTop(true, 'screen-saver');
    else win.setAlwaysOnTop(false);
  }
  saveWinState();
  return winState.pinned;
});

ipcMain.handle('win:opacity', (_e, v) => {
  const val = Math.min(1, Math.max(0.3, Number(v) || 1));
  if (win) win.setOpacity(val);
  return val;
});

// 切換迷你模式：迷你時視窗高度跟著內容走
ipcMain.handle('win:mini', (_e, on, contentHeight) => {
  if (!win) return false;
  winState.mini = !!on;
  const b = win.getBounds();
  if (on) {
    win.setMinimumSize(220, 40);
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(40, Math.round(contentHeight || 64)) });
  } else {
    win.setMinimumSize(220, 160);
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(160, winState.height || 520) });
  }
  saveWinState();
  return winState.mini;
});

ipcMain.handle('win:fit', (_e, contentHeight) => {
  if (!win || !winState.mini) return;
  const b = win.getBounds();
  const h = Math.max(40, Math.round(contentHeight));
  if (Math.abs(b.height - h) > 1) win.setBounds({ x: b.x, y: b.y, width: b.width, height: h });
});

ipcMain.handle('app:openDataDir', () => shell.openPath(DATA_DIR));
