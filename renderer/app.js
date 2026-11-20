// 學生加分小工具 — 畫面邏輯
(() => {
  'use strict';

  // ---------- 小圖示 ----------
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    pin: svg('<path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/>'),
    undo: svg('<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>'),
    mini: svg('<path d="M4 15h16"/><path d="M4 19h16"/><rect x="4" y="4" width="16" height="7" rx="2"/>'),
    expand: svg('<path d="M16 4h4v4"/><path d="M14 10l6 -6"/><path d="M8 20h-4v-4"/><path d="M4 20l6 -6"/>'),
    gear: svg('<path d="M10.3 4.3c.4 -1.8 3 -1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5 -.9 3.3 .8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8 .4 1.8 3 0 3.4a1.7 1.7 0 0 0 -1 2.6c.9 1.5 -.9 3.3 -2.4 2.4a1.7 1.7 0 0 0 -2.6 1c-.4 1.8 -3 1.8 -3.4 0a1.7 1.7 0 0 0 -2.6 -1c-1.5 .9 -3.3 -.9 -2.4 -2.4a1.7 1.7 0 0 0 -1 -2.6c-1.8 -.4 -1.8 -3 0 -3.4a1.7 1.7 0 0 0 1 -2.5c-.9 -1.6 .9 -3.3 2.4 -2.4a1.7 1.7 0 0 0 2.6 -1.1"/><circle cx="12" cy="12" r="3"/>'),
    minimize: svg('<path d="M5 12h14"/>'),
    close: svg('<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>'),
    back: svg('<path d="M15 6l-6 6l6 6"/>')
  };
  const $ = (id) => document.getElementById(id);
  $('btnPin').innerHTML = ICON.pin;
  $('btnMiniPin').innerHTML = ICON.pin;
  $('btnUndo').innerHTML = ICON.undo;
  $('btnMini').innerHTML = ICON.mini;
  $('btnExpand').innerHTML = ICON.expand;
  $('btnSettings').innerHTML = ICON.gear;
  $('btnMinimize').innerHTML = ICON.minimize;
  $('btnClose').innerHTML = ICON.close;
  $('btnBack').innerHTML = ICON.back;

  // ---------- 資料 ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const HISTORY_MAX = 50000;

  function defaultData() {
    const id = uid();
    return {
      version: 1,
      currentClassId: id,
      classes: [{ id, name: '我的班級', students: [] }],
      history: [],
      settings: { step: 1, sort: 'list', noNegative: true, opacity: 100, zoom: 100 }
    };
  }

  function normalize(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    const out = { ...base, ...d };
    out.settings = { ...base.settings, ...(d.settings || {}) };
    if (!Array.isArray(out.classes) || !out.classes.length) out.classes = base.classes;
    out.classes.forEach((c) => {
      if (!c.id) c.id = uid();
      if (!Array.isArray(c.students)) c.students = [];
      c.students.forEach((s) => { if (!s.id) s.id = uid(); s.score = Number(s.score) || 0; });
    });
    if (!Array.isArray(out.history)) out.history = [];
    if (!out.classes.some((c) => c.id === out.currentClassId)) out.currentClassId = out.classes[0].id;
    return out;
  }

  let data = defaultData();
  let pinned = true;
  let mini = false;
  const undoStack = [];

  const cls = () => data.classes.find((c) => c.id === data.currentClassId) || data.classes[0];

  function save() {
    if (data.history.length > HISTORY_MAX) data.history.splice(0, data.history.length - HISTORY_MAX);
    window.api.save(data);
  }

  // 任何會改變資料的動作之前，先記一份，按「復原」就能回到上一步
  function snapshot(label) {
    undoStack.push({ label, json: JSON.stringify(data) });
    if (undoStack.length > 50) undoStack.shift();
    updateUndoBtn();
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) { toast('沒有可以復原的動作', false); return; }
    data = normalize(JSON.parse(last.json));
    save();
    renderAll();
    toast('已復原：' + last.label, false);
  }

  function updateUndoBtn() {
    $('btnUndo').classList.toggle('off', undoStack.length === 0);
  }

  // ---------- 加減分 ----------
  function changeScore(studentId, sign) {
    const c = cls();
    const s = c.students.find((x) => x.id === studentId);
    if (!s) return;
    const step = Number(data.settings.step) || 1;
    let next = s.score + sign * step;
    if (data.settings.noNegative && next < 0) next = 0;
    const delta = next - s.score;
    if (delta === 0) { flash(studentId, -1, 0); return; }
    snapshot(`${s.name} ${delta > 0 ? '+' : ''}${delta}`);
    s.score = next;
    data.history.push({ t: new Date().toISOString(), classId: c.id, studentId: s.id, name: s.name, delta, score: next });
    save();
    renderList();
    renderMini();
    flash(studentId, sign, delta);
    toast(`${s.name} ${delta > 0 ? '+' : ''}${delta}　⭐ ${next}`, true);
  }

  function flash(studentId, sign, delta) {
    const cssClass = sign > 0 ? 'bump-up' : 'bump-down';
    document.querySelectorAll(`[data-id="${studentId}"]`).forEach((el) => {
      el.classList.remove('bump-up', 'bump-down');
      void el.offsetWidth;
      el.classList.add(cssClass);
      if (el.classList.contains('row') && delta) {
        const f = document.createElement('span');
        f.className = 'float ' + (delta > 0 ? 'up' : 'down');
        f.textContent = (delta > 0 ? '+' : '') + delta;
        el.appendChild(f);
        setTimeout(() => f.remove(), 900);
      }
    });
  }

  function sortedStudents() {
    const list = cls().students.slice();
    if (data.settings.sort === 'score') list.sort((a, b) => b.score - a.score);
    return list;
  }

  // ---------- 畫面 ----------
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function renderClassSelect() {
    const sel = $('classSelect');
    sel.innerHTML = data.classes.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    sel.value = data.currentClassId;
  }

  function renderList() {
    const list = $('list');
    const students = sortedStudents();
    if (!students.length) {
      list.innerHTML = `<div class="empty">這個班級還沒有學生<br><button id="btnEmptyAdd">＋ 新增學生名單</button></div>`;
      $('btnEmptyAdd').onclick = () => openSettings(true);
    } else {
      list.innerHTML = students.map((s) => `
        <div class="row" data-id="${s.id}">
          <button class="name" data-act="name" title="左鍵 +・右鍵 −">${esc(s.name)}</button>
          <span class="score"><span class="star">★</span>${s.score}</span>
          <button class="pm minus" data-act="minus" title="扣分">−</button>
          <button class="pm plus" data-act="plus" title="加分">＋</button>
        </div>`).join('');
    }
    const total = students.reduce((sum, s) => sum + s.score, 0);
    $('summary').textContent = `共 ${students.length} 人・合計 ${total} 分`;
  }

  function renderMini() {
    const box = $('miniChips');
    const students = sortedStudents();
    box.innerHTML = students.length
      ? students.map((s) => `<button class="chip" data-id="${s.id}" title="左鍵 +・右鍵 −">${esc(s.name)}<b>${s.score}</b></button>`).join('')
      : `<span style="padding:4px 6px;opacity:.8">還沒有學生</span>`;
    if (mini) requestAnimationFrame(fitMini);
  }

  function renderPin() {
    $('btnPin').classList.toggle('off', !pinned);
    $('btnMiniPin').classList.toggle('off', !pinned);
    const t = pinned ? '已置頂（點一下取消）' : '沒有置頂（點一下置頂）';
    $('btnPin').title = t; $('btnMiniPin').title = t;
  }

  function renderAll() {
    renderClassSelect();
    renderList();
    renderMini();
    renderPin();
    updateUndoBtn();
    if (!$('settings').classList.contains('hidden')) renderSettings();
  }

  // ---------- 迷你模式 ----------
  function miniHeight() {
    const z = (Number(data.settings.zoom) || 100) / 100;
    return Math.ceil($('mini').getBoundingClientRect().height * z);
  }
  function fitMini() { if (mini) window.api.fit(miniHeight()); }

  async function setMini(on) {
    mini = on;
    document.body.classList.toggle('is-mini', on);
    if (on) {
      renderMini();
      await new Promise((r) => requestAnimationFrame(r));
      await window.api.setMini(true, miniHeight());
    } else {
      await window.api.setMini(false);
    }
  }
  new ResizeObserver(() => fitMini()).observe($('mini'));

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('toastUndo').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2200);
  }

  function confirmBox(text, okLabel = '確定') {
    return new Promise((resolve) => {
      $('modalText').textContent = text;
      $('modalOk').textContent = okLabel;
      $('modal').classList.remove('hidden');
      const done = (v) => { $('modal').classList.add('hidden'); $('modalOk').onclick = $('modalCancel').onclick = null; resolve(v); };
      $('modalOk').onclick = () => done(true);
      $('modalCancel').onclick = () => done(false);
    });
  }

  // ---------- 設定 ----------
  function openSettings(focusPaste) {
    $('settings').classList.remove('hidden');
    renderSettings();
    if (focusPaste) setTimeout(() => $('inPaste').focus(), 50);
  }
  function closeSettings() {
    $('settings').classList.add('hidden');
    renderAll();
  }

  function renderSettings() {
    const c = cls();
    $('inClassName').value = c.name;
    $('btnDelClass').disabled = false;
    const box = $('studentEditList');
    box.innerHTML = c.students.length
      ? c.students.map((s, i) => `
        <div class="edit-row" data-sid="${s.id}">
          <span class="num">${i + 1}</span>
          <input type="text" value="${esc(s.name)}" maxlength="20" data-edit="name">
          <span class="sc">★ ${s.score}</span>
          <button data-edit="del" title="刪除這位學生">刪除</button>
        </div>`).join('')
      : `<div class="edit-empty">還沒有學生，可以在下面貼上名單。</div>`;
    $('inStep').value = String(data.settings.step);
    $('inSort').value = data.settings.sort;
    $('inNoNeg').checked = !!data.settings.noNegative;
    $('inOpacity').value = data.settings.opacity;
    $('outOpacity').textContent = data.settings.opacity + '%';
    $('inZoom').value = data.settings.zoom;
    $('outZoom').textContent = data.settings.zoom + '%';
  }

  $('inClassName').addEventListener('change', (e) => {
    const name = e.target.value.trim();
    if (!name) { e.target.value = cls().name; return; }
    snapshot('班級改名');
    cls().name = name;
    save(); renderClassSelect();
  });

  $('btnAddClass').onclick = () => {
    snapshot('新增班級');
    const id = uid();
    data.classes.push({ id, name: `班級 ${data.classes.length + 1}`, students: [] });
    data.currentClassId = id;
    save(); renderAll();
    $('inClassName').focus(); $('inClassName').select();
  };

  $('btnDelClass').onclick = async () => {
    const c = cls();
    if (data.classes.length === 1) { toast('至少要保留一個班級', false); return; }
    if (!(await confirmBox(`確定要刪除「${c.name}」和裡面 ${c.students.length} 位學生的分數嗎？\n（刪錯了可以按復原）`, '刪除'))) return;
    snapshot('刪除班級');
    data.classes = data.classes.filter((x) => x.id !== c.id);
    data.currentClassId = data.classes[0].id;
    save(); renderAll();
  };

  $('studentEditList').addEventListener('change', (e) => {
    if (e.target.dataset.edit !== 'name') return;
    const sid = e.target.closest('.edit-row').dataset.sid;
    const s = cls().students.find((x) => x.id === sid);
    const name = e.target.value.trim();
    if (!s) return;
    if (!name) { e.target.value = s.name; return; }
    snapshot('學生改名');
    s.name = name;
    save();
  });

  $('studentEditList').addEventListener('click', async (e) => {
    if (e.target.dataset.edit !== 'del') return;
    const sid = e.target.closest('.edit-row').dataset.sid;
    const s = cls().students.find((x) => x.id === sid);
    if (!s) return;
    if (!(await confirmBox(`確定要刪除「${s.name}」嗎？`, '刪除'))) return;
    snapshot('刪除學生');
    cls().students = cls().students.filter((x) => x.id !== sid);
    save(); renderSettings();
  });

  $('btnPaste').onclick = () => {
    const names = $('inPaste').value
      .split(/[\r\n\t,，、]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) { toast('請先貼上學生名字', false); $('inPaste').focus(); return; }
    const c = cls();
    const existing = new Set(c.students.map((s) => s.name));
    const fresh = [...new Set(names)].filter((n) => !existing.has(n));
    if (!fresh.length) { toast('這些學生都已經在名單裡了', false); return; }
    snapshot('加入名單');
    fresh.forEach((name) => c.students.push({ id: uid(), name: name.slice(0, 20), score: 0 }));
    $('inPaste').value = '';
    save(); renderSettings();
    toast(`已加入 ${fresh.length} 位學生`, false);
  };

  $('inStep').onchange = (e) => { data.settings.step = Number(e.target.value); save(); };
  $('inSort').onchange = (e) => { data.settings.sort = e.target.value; save(); };
  $('inNoNeg').onchange = (e) => { data.settings.noNegative = e.target.checked; save(); };

  $('btnResetScores').onclick = async () => {
    const c = cls();
    if (!(await confirmBox(`確定要把「${c.name}」全部學生的分數歸零嗎？\n（歸零錯了可以按復原）`, '歸零'))) return;
    snapshot('分數歸零');
    c.students.forEach((s) => { s.score = 0; });
    data.history.push({ t: new Date().toISOString(), classId: c.id, studentId: null, name: '（全班歸零）', delta: 0, score: 0 });
    save(); renderSettings();
    toast('分數已歸零', false);
  };

  $('inOpacity').oninput = (e) => {
    data.settings.opacity = Number(e.target.value);
    $('outOpacity').textContent = data.settings.opacity + '%';
    window.api.setOpacity(data.settings.opacity / 100);
  };
  $('inOpacity').onchange = save;

  $('inZoom').onchange = (e) => {
    data.settings.zoom = Number(e.target.value);
    $('outZoom').textContent = data.settings.zoom + '%';
    window.api.setZoom(data.settings.zoom / 100);
    save();
  };
  $('inZoom').oninput = (e) => { $('outZoom').textContent = e.target.value + '%'; };

  $('btnOpenDir').onclick = () => window.api.openDataDir();

  // ---------- 按鈕與滑鼠 ----------
  function handlePoint(e, sign) {
    const target = e.target.closest('[data-id]');
    if (!target) return;
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'minus') sign = -1;
    if (act && act.dataset.act === 'plus') sign = 1;
    changeScore(target.dataset.id, sign);
  }

  $('list').addEventListener('click', (e) => { if (e.target.closest('[data-act]')) handlePoint(e, 1); });
  $('list').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (e.target.closest('[data-act="name"]')) changeScore(e.target.closest('[data-id]').dataset.id, -1);
  });
  $('miniChips').addEventListener('click', (e) => { if (e.target.closest('.chip')) handlePoint(e, 1); });
  $('miniChips').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const chip = e.target.closest('.chip');
    if (chip) changeScore(chip.dataset.id, -1);
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('input, textarea')) e.preventDefault();
  });

  $('classSelect').onchange = (e) => {
    data.currentClassId = e.target.value;
    save(); renderList(); renderMini();
  };

  const togglePin = async () => { pinned = await window.api.setPin(!pinned); renderPin(); toast(pinned ? '已置頂' : '已取消置頂', false); };
  $('btnPin').onclick = togglePin;
  $('btnMiniPin').onclick = togglePin;
  $('btnUndo').onclick = undo;
  $('toastUndo').onclick = undo;
  $('btnMini').onclick = () => setMini(true);
  $('btnExpand').onclick = () => setMini(false);
  $('btnSettings').onclick = () => openSettings(false);
  $('btnBack').onclick = closeSettings;
  $('btnMinimize').onclick = () => window.api.minimize();
  $('btnClose').onclick = () => window.api.close();

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    if (e.key === 'Escape') {
      if (!$('modal').classList.contains('hidden')) $('modalCancel').click();
      else if (!$('settings').classList.contains('hidden')) closeSettings();
    }
  });

  // ---------- 啟動 ----------
  (async () => {
    const res = await window.api.load();
    data = normalize(res && res.data);
    pinned = res ? res.pinned !== false : true;
    $('dataPath').textContent = (res && res.dataDir) || '';
    window.api.setOpacity((Number(data.settings.opacity) || 100) / 100);
    window.api.setZoom((Number(data.settings.zoom) || 100) / 100);
    renderAll();
    if (res && res.mini) setMini(true);
    if (!res || !res.data) save();
  })();
})();
