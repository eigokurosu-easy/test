'use strict';

// ==============================
// タブ切り替え
// ==============================
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['alarm', 'stopwatch'][i] === name);
  });
  document.getElementById('tab-alarm').classList.toggle('hidden', name !== 'alarm');
  document.getElementById('tab-stopwatch').classList.toggle('hidden', name !== 'stopwatch');
}

// ==============================
// アラーム
// ==============================
let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
let firingAlarmId = null;
let audioCtx = null;
let alarmNodes = [];

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('current-time').textContent = `${hh}:${mm}:${ss}`;

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('current-date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;

  checkAlarms(now);
}

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
    if (alarm.firedAt && alarm.firedAt !== currentTime) {
      alarm.firedAt = null;
    }
  }
}

function triggerAlarm(alarm) {
  firingAlarmId = alarm.id;
  playAlarmSound();
  document.getElementById('modal-label').textContent = alarm.label || '';
  document.getElementById('modal-time').textContent = alarm.time;
  document.getElementById('alarm-modal').classList.remove('hidden');
}

function stopAlarm() {
  stopAlarmSound();
  firingAlarmId = null;
  document.getElementById('alarm-modal').classList.add('hidden');
}

function snoozeAlarm() {
  stopAlarmSound();
  document.getElementById('alarm-modal').classList.add('hidden');

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  alarms.push({ id: Date.now(), time: `${hh}:${mm}`, label: 'スヌーズ', active: true, firedAt: null });
  saveAlarms();
  renderAlarms();
  firingAlarmId = null;
}

function addAlarm() {
  const timeInput = document.getElementById('alarm-time-input').value;
  const labelInput = document.getElementById('alarm-label-input').value.trim();
  if (!timeInput) { alert('時刻を選択してください'); return; }

  alarms.push({ id: Date.now(), time: timeInput, label: labelInput, active: true, firedAt: null });
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  saveAlarms();
  renderAlarms();
  document.getElementById('alarm-time-input').value = '';
  document.getElementById('alarm-label-input').value = '';
}

function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  saveAlarms();
  renderAlarms();
}

function toggleAlarm(id) {
  const alarm = alarms.find(a => a.id === id);
  if (alarm) { alarm.active = !alarm.active; alarm.firedAt = null; saveAlarms(); renderAlarms(); }
}

function renderAlarms() {
  const list = document.getElementById('alarm-list');
  const noMsg = document.getElementById('no-alarms-msg');
  list.innerHTML = '';
  if (alarms.length === 0) { noMsg.style.display = 'block'; return; }
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
      </div>`;
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function saveAlarms() { localStorage.setItem('alarms', JSON.stringify(alarms)); }

function playAlarmSound() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.5);
    alarmNodes.push(osc);
  }
  beep();
  const id = setInterval(beep, 800);
  alarmNodes.push({ stop: () => clearInterval(id) });
}

function stopAlarmSound() {
  if (audioCtx) {
    alarmNodes.forEach(n => { try { n.stop(); } catch (_) {} });
    alarmNodes = []; audioCtx.close(); audioCtx = null;
  }
}

// ==============================
// ストップウォッチ
// ==============================
let swRunning = false;
let swStartTime = 0;
let swElapsed = 0;
let swRafId = null;
let swLaps = [];
let swLapStart = 0;

function swFormat(ms) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function swTick() {
  const now = performance.now();
  const current = swElapsed + (now - swStartTime);
  document.getElementById('sw-display').textContent = swFormat(current);
  swRafId = requestAnimationFrame(swTick);
}

function swStartStop() {
  const btn = document.getElementById('sw-start-stop');
  const lapBtn = document.getElementById('sw-lap');
  const resetBtn = document.getElementById('sw-reset');

  if (!swRunning) {
    swStartTime = performance.now();
    swRunning = true;
    swRafId = requestAnimationFrame(swTick);
    btn.textContent = 'ストップ';
    btn.classList.replace('sw-btn-start', 'sw-btn-stop');
    lapBtn.disabled = false;
    resetBtn.disabled = false;
  } else {
    swElapsed += performance.now() - swStartTime;
    swRunning = false;
    cancelAnimationFrame(swRafId);
    btn.textContent = 'スタート';
    btn.classList.replace('sw-btn-stop', 'sw-btn-start');
    lapBtn.disabled = true;
  }
}

function swLap() {
  const now = performance.now();
  const total = swElapsed + (now - swStartTime);
  const lapTime = total - swLapStart;
  swLapStart = total;
  swLaps.unshift({ lap: swLaps.length + 1, lapTime, total });
  renderLaps();
}

function swReset() {
  if (swRunning) {
    cancelAnimationFrame(swRafId);
    swRunning = false;
  }
  swElapsed = 0;
  swLapStart = 0;
  swLaps = [];
  document.getElementById('sw-display').textContent = '00:00.00';
  const btn = document.getElementById('sw-start-stop');
  btn.textContent = 'スタート';
  btn.classList.remove('sw-btn-stop');
  btn.classList.add('sw-btn-start');
  document.getElementById('sw-lap').disabled = true;
  document.getElementById('sw-reset').disabled = true;
  renderLaps();
}

function renderLaps() {
  const list = document.getElementById('sw-laps');
  const header = document.getElementById('sw-laps-header');
  list.innerHTML = '';
  if (swLaps.length === 0) { header.classList.add('hidden'); return; }
  header.classList.remove('hidden');

  swLaps.forEach(({ lap, lapTime, total }) => {
    const li = document.createElement('li');
    li.className = 'sw-lap-item';
    li.innerHTML = `<span>Lap ${lap}</span><span>${swFormat(lapTime)}</span><span>${swFormat(total)}</span>`;
    list.appendChild(li);
  });
}

// ==============================
// 初期化
// ==============================
renderAlarms();
setInterval(updateClock, 1000);
updateClock();
