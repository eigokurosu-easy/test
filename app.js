'use strict';

const API_BASE = 'https://pokeapi.co/api/v2/pokemon/';
const MAX_POKEMON = 1025;

const STAT_LABELS = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  'special-attack': 'とくこう',
  'special-defense': 'とくぼう',
  speed: 'すばやさ',
};

// 種族値の最大値 (255) に対するバー幅の割合
const STAT_MAX = 255;

// タイプに応じたバーカラー
const STAT_COLORS = ['#cc3333', '#e87020', '#4488ee', '#8855dd', '#44aa44', '#ccaa00'];

const elLoading = document.getElementById('loading');
const elError   = document.getElementById('error');
const elErrorMsg = document.getElementById('error-msg');
const elView    = document.getElementById('pokemon-view');
const elNumber  = document.getElementById('poke-number');
const elName    = document.getElementById('poke-name');
const elTypes   = document.getElementById('poke-types');
const elImage   = document.getElementById('poke-image');
const elHeight  = document.getElementById('poke-height');
const elWeight  = document.getElementById('poke-weight');
const elAbilities = document.getElementById('poke-abilities');
const elStats   = document.getElementById('stats-list');
const elSearchInput = document.getElementById('search-input');

let lastQuery = null;

function showLoading() {
  elLoading.classList.remove('hidden');
  elError.classList.add('hidden');
  elView.classList.add('hidden');
}

function showError(msg) {
  elLoading.classList.add('hidden');
  elError.classList.remove('hidden');
  elView.classList.add('hidden');
  elErrorMsg.textContent = msg;
}

function showPokemon() {
  elLoading.classList.add('hidden');
  elError.classList.add('hidden');
  elView.classList.remove('hidden');
}

function formatName(name) {
  // 英語名をカタカナ変換せずそのまま表示（APIは英語名を返すため）
  return name.replace(/-/g, ' ');
}

async function fetchJaName(speciesUrl) {
  try {
    const res = await fetch(speciesUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data.names.find(n => n.language.name === 'ja') ||
                  data.names.find(n => n.language.name === 'ja-Hrkt');
    return entry ? entry.name : null;
  } catch {
    return null;
  }
}

async function fetchPokemon(query) {
  const key = String(query).toLowerCase().trim();
  showLoading();
  lastQuery = key;

  try {
    const res = await fetch(`${API_BASE}${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const jaName = await fetchJaName(data.species.url);
    renderPokemon(data, jaName);
  } catch {
    showError(`「${query}」は見つかりませんでした`);
  }
}

function renderPokemon(data, jaName) {
  const id = data.id;
  const name = jaName || formatName(data.name);

  // 番号・名前
  elNumber.textContent = `#${String(id).padStart(3, '0')}`;
  elName.textContent = name;

  // タイプ
  elTypes.innerHTML = '';
  data.types.forEach(({ type }) => {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${type.name}`;
    badge.textContent = type.name;
    elTypes.appendChild(badge);
  });

  // 画像（公式アートワーク → フォールバックでfrontDefault）
  const art = data.sprites?.other?.['official-artwork']?.front_default;
  const fallback = data.sprites?.front_default;
  const imgSrc = art || fallback || '';
  elImage.src = imgSrc;
  elImage.alt = name;

  // 高さ・重さ
  elHeight.textContent = `${(data.height / 10).toFixed(1)} m`;
  elWeight.textContent = `${(data.weight / 10).toFixed(1)} kg`;

  // 特性
  const abilities = data.abilities
    .filter(a => !a.is_hidden)
    .map(a => formatName(a.ability.name));
  const hidden = data.abilities
    .filter(a => a.is_hidden)
    .map(a => formatName(a.ability.name));
  const abilityText = abilities.join(' / ') + (hidden.length ? ` (隠: ${hidden.join(', ')})` : '');
  elAbilities.textContent = abilityText;

  // ステータス
  elStats.innerHTML = '';
  data.stats.forEach(({ stat, base_stat }, i) => {
    const label = STAT_LABELS[stat.name] || stat.name;
    const pct = Math.round((base_stat / STAT_MAX) * 100);
    const color = STAT_COLORS[i % STAT_COLORS.length];

    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-name">${label}</span>
      <span class="stat-value">${base_stat}</span>
      <div class="stat-bar-bg">
        <div class="stat-bar" style="width:0%; background:${color};"></div>
      </div>`;
    elStats.appendChild(row);

    // アニメーション（次フレームで幅をセット）
    requestAnimationFrame(() => {
      row.querySelector('.stat-bar').style.width = `${pct}%`;
    });
  });

  showPokemon();
}

function loadRandom() {
  const id = Math.floor(Math.random() * MAX_POKEMON) + 1;
  fetchPokemon(id);
}

function handleSearch() {
  const q = elSearchInput.value.trim();
  if (!q) return;
  fetchPokemon(q);
}

// ボタン
document.getElementById('btn-random').addEventListener('click', loadRandom);
document.getElementById('search-btn').addEventListener('click', handleSearch);
document.getElementById('btn-retry').addEventListener('click', () => {
  if (lastQuery) fetchPokemon(lastQuery);
  else loadRandom();
});

elSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

// 初回はランダム表示
loadRandom();
