// 學生頭貼：照片、卡通頭像，沒設定時顯示名字第一個字
window.Avatar = (() => {
  'use strict';
  const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
    '🐔', '🐧', '🐤', '🦄', '🐝', '🐞', '🦋', '🐢', '🐙', '🐳', '🐬', '🦖', '🦕', '🦉', '🦒'];
  const BGS = ['#ffe3a3', '#ffd0c2', '#d7ecff', '#d9f2d0', '#eadcff', '#ffd6e7', '#cdeee8', '#f1e4cf'];
  const INITIAL_COLORS = [['#ffe3a3', '#8a5a00'], ['#ffd0c2', '#8f3418'], ['#d7ecff', '#1d4f86'], ['#d9f2d0', '#2f6b1f'],
    ['#eadcff', '#4b2a8a'], ['#ffd6e7', '#8a1f4f'], ['#cdeee8', '#145e52']];

  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; }

  // 回傳頭貼的 HTML，size 是像素
  function html(s, size = 48) {
    const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px`;
    const a = s.avatar;
    if (a && a.type === 'photo' && a.file) {
      return `<span class="avatar" style="${st}"><img src="${esc(W.fileUrl(a.file, a.v))}" alt="" draggable="false"></span>`;
    }
    if (a && a.type === 'emoji') {
      return `<span class="avatar emoji" style="${st};background:${esc(a.bg || BGS[0])}">${esc(a.emoji)}</span>`;
    }
    const [bg, fg] = INITIAL_COLORS[hash(s.id) % INITIAL_COLORS.length];
    const first = [...String(s.name || '?')][0] || '?';
    return `<span class="avatar initial" style="${st};background:${bg};color:${fg};font-size:${Math.round(size * 0.46)}px">${esc(first)}</span>`;
  }

  // 照片裁成正方形、縮小，存到資料夾的 avatars
  function cropPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = Math.max(0, (img.height - side) / 2 - side * 0.08); // 稍微偏上，臉比較不會被切掉
          const c = document.createElement('canvas');
          c.width = c.height = 320;
          c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, 320, 320);
          c.toBlob((blob) => blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))), 'image/jpeg', 0.86);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openPicker(student, onDone) {
    let bg = (student.avatar && student.avatar.bg) || BGS[0];
    const body = `
      <div class="picker">
        <div class="picker-head">${html(student, 64)}<div><b>${esc(student.name)}</b><div class="muted">選一個頭像，或用照片</div></div></div>
        <div class="picker-label">背景顏色</div>
        <div class="bg-row">${BGS.map((c) => `<button class="bg-dot${c === bg ? ' sel' : ''}" data-bg="${c}" style="background:${c}" aria-label="背景色"></button>`).join('')}</div>
        <div class="picker-label">卡通頭像</div>
        <div class="emoji-grid">${EMOJIS.map((e) => `<button class="emoji-btn" data-emoji="${e}" style="background:${bg}">${e}</button>`).join('')}</div>
        <div class="btn-row" style="margin-top:10px">
          <button id="pkPhoto" class="primary">選照片…</button>
          <button id="pkClear">移除頭貼</button>
          <button id="pkCancel">取消</button>
        </div>
        <input id="pkFile" type="file" accept="image/*" class="hidden">
        <p class="muted" style="margin-top:8px">照片只會存在這台電腦的資料夾裡，不會上傳到網路。</p>
      </div>`;
    W.openSheet(body, (root) => {
      root.querySelectorAll('.bg-dot').forEach((b) => b.onclick = () => {
        bg = b.dataset.bg;
        root.querySelectorAll('.bg-dot').forEach((x) => x.classList.toggle('sel', x === b));
        root.querySelectorAll('.emoji-btn').forEach((x) => { x.style.background = bg; });
      });
      root.querySelectorAll('.emoji-btn').forEach((b) => b.onclick = () => {
        W.snapshot('換頭貼');
        student.avatar = { type: 'emoji', emoji: b.dataset.emoji, bg };
        W.save(); W.closeSheet(); onDone && onDone();
      });
      root.querySelector('#pkPhoto').onclick = () => root.querySelector('#pkFile').click();
      root.querySelector('#pkFile').onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          const bytes = await cropPhoto(f);
          const rel = `avatars/${student.id}.jpg`;
          await window.api.saveFile(rel, bytes);
          W.snapshot('換頭貼');
          student.avatar = { type: 'photo', file: rel, v: Date.now() };
          W.save(); W.closeSheet(); onDone && onDone();
        } catch (err) {
          W.toast('這張照片讀不到，請換一張試試', false);
        }
      };
      root.querySelector('#pkClear').onclick = () => {
        W.snapshot('移除頭貼');
        student.avatar = null;
        W.save(); W.closeSheet(); onDone && onDone();
      };
      root.querySelector('#pkCancel').onclick = () => W.closeSheet();
    });
  }

  // 照片檔不立刻刪除，按「復原」時照片還在；同一位學生的照片檔名固定，下次選照片會直接覆蓋
  return { html, openPicker, EMOJIS };
})();
