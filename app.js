'use strict';

let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
let firingAlarmId = null;
let audioCtx = null;
let alarmNodes = [];

// ---- 時刻更新 ----
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('current-time').textContent = `${hh}:${mm}:${ss}`;

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;
  document.getElementById('current-date').textContent = dateStr;

  checkAlarms(now);
}

// ---- アラームチェック ----
function checkAlarms(now) {
  if (firingAlarmId !== null) return;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;

  for (const alarm of alarms) {
    if (alarm.active && alarm.time === currentTime && !alarm.firedAt) {
      alarm.firedAt = currentTime;
      triggerAlarm(alarm);
      saveAlarms();
      break;
    }
    // 翌分になったらfiredAtをリセット
    if (alarm.firedAt && alarm.firedAt !== currentTime) {
      alarm.firedAt = null;
    }
  }
}

// ---- アラーム発火 ----
function triggerAlarm(alarm) {
  firingAlarmId = alarm.id;
  playAlarmSound();
  document.getElementById('modal-label').textContent = alarm.label || '';
  document.getElementById('modal-time').textContent = alarm.time;
  document.getElementById('alarm-modal').classList.remove('hidden');
}

// ---- 停止 ----
function stopAlarm() {
  stopAlarmSound();
  firingAlarmId = null;
  document.getElementById('alarm-modal').classList.add('hidden');
}

// ---- スヌーズ（5分後） ----
function snoozeAlarm() {
  stopAlarmSound();
  document.getElementById('alarm-modal').classList.add('hidden');

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const snoozeTime = `${hh}:${mm}`;

  const snoozeAlarmObj = {
    id: Date.now(),
    time: snoozeTime,
    label: 'スヌーズ',
    active: true,
    firedAt: null,
  };
  alarms.push(snoozeAlarmObj);
  saveAlarms();
  renderAlarms();
  firingAlarmId = null;
}

// ---- アラーム追加 ----
function addAlarm() {
  const timeInput = document.getElementById('alarm-time-input').value;
  const labelInput = document.getElementById('alarm-label-input').value.trim();

  if (!timeInput) {
    alert('時刻を選択してください');
    return;
  }

  const alarm = {
    id: Date.now(),
    time: timeInput,
    label: labelInput,
    active: true,
    firedAt: null,
  };

  alarms.push(alarm);
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  saveAlarms();
  renderAlarms();

  document.getElementById('alarm-time-input').value = '';
  document.getElementById('alarm-label-input').value = '';
}

// ---- アラーム削除 ----
function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  saveAlarms();
  renderAlarms();
}

// ---- アラームON/OFF ----
function toggleAlarm(id) {
  const alarm = alarms.find(a => a.id === id);
  if (alarm) {
    alarm.active = !alarm.active;
    alarm.firedAt = null;
    saveAlarms();
    renderAlarms();
  }
}

// ---- 描画 ----
function renderAlarms() {
  const list = document.getElementById('alarm-list');
  const noMsg = document.getElementById('no-alarms-msg');
  list.innerHTML = '';

  if (alarms.length === 0) {
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  for (const alarm of alarms) {
    const li = document.createElement('li');
    li.className = 'alarm-item' + (alarm.active ? '' : ' inactive');
    li.innerHTML = `
      <div class="alarm-item-left">
        <div>
          <div class="alarm-time">${alarm.time}</div>
          ${alarm.label ? `<div class="alarm-label">${escapeHtml(alarm.label)}</div>` : ''}
        </div>
      </div>
      <div class="alarm-item-right">
        <label class="toggle">
          <input type="checkbox" ${alarm.active ? 'checked' : ''} onchange="toggleAlarm(${alarm.id})">
          <span class="slider"></span>
        </label>
        <button class="delete-btn" onclick="deleteAlarm(${alarm.id})" title="削除">✕</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- 保存 ----
function saveAlarms() {
  localStorage.setItem('alarms', JSON.stringify(alarms));
}

// ---- アラーム音（Web Audio API） ----
function playAlarmSound() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function beep() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
    alarmNodes.push(osc);
  }

  beep();
  const intervalId = setInterval(beep, 800);
  alarmNodes.push({ stop: () => clearInterval(intervalId) });
}

function stopAlarmSound() {
  if (audioCtx) {
    alarmNodes.forEach(n => { try { n.stop(); } catch (_) {} });
    alarmNodes = [];
    audioCtx.close();
    audioCtx = null;
  }
}

// ---- 初期化 ----
renderAlarms();
setInterval(updateClock, 1000);
updateClock();
