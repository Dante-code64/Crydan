// src/main.js
import { createClient } from '@supabase/supabase-js';
import { escapeHtml, safeMediaUrl } from './utils/escapeHtml.js';
import { timeAgo, formatCry, formatLastSeen, _stripAt } from './utils/format.js';
import { sleep, rarityColor, createDiceElement, buildLinkHref, hslToHex, uid, fmtTime, initialsOf, normalizeUsernameInput, getGreeting } from './utils/helpers.js';
import { tttWinner, chessIsWhite, chessIsBlack, botDifficultyBar } from './games/helpers.js';
import { svgIcon, zoneAt, pvpPower, encounterChanceFor, monsterForDanger } from './rpg/helpers.js';
import { GUILD_ROLE_LABELS, GUILD_ROLE_RANK, GUILD_PRIVACY_LABELS, GUILD_ACHIEVEMENTS_INFO, GUILD_PAGE_SIZE, GUILDS_DEFAULT, guildTagHtml } from './guild/constants.js';
import { groupIconHtml, communityIconHtml, communityIconHtmlBig } from './social/helpers.js';
import {
  SAVE_KEY, CLASSES, RANKS, SHOP_ITEMS, HOUSES, COMPANIES, JOBS, QUESTS, BOSSES,
  ACHIEVEMENTS, MAP_ZONES, AVATARS, ACCENT_COLORS, BG_PALETTES, FONT_OPTIONS,
  BANNER_PRESETS, AVATAR_FRAMES_SPECIAL, AVATAR_FRAMES_PREMIUM, AVATAR_FRAME_RING_CUSTOM,
  AVATAR_FRAME_CUSTOM_IMAGE, AVATAR_FRAMES, FRAME_CATEGORIES, DRAGON_FRAME_SVG,
  BANNER_DRAGON_SVG, BANNER_ANIMS, LINK_PLATFORMS, EVENTS_DATA,
  CLASS_DESCRIPTIONS, BATTLE_COOLDOWN, MONSTERS, AVATAR_PARTICLE_PRESETS,
  PARTICLE_BANNER_PRESETS, MAP_COLS, MAP_ROWS
} from './rpg/data.js';
import { USERNAME_REGEX, OAUTH_PROVIDERS } from './auth/constants.js';
import { FB_TYPE_LABEL, RTC_CONFIG, DEVICE_VIEWS, MOBILE_NAV_CATEGORIES, MOBILE_PANEL_TO_CAT, STORY_COLORS, STORY_REACT_EMOJIS, NOTIF_ICONS, ONBOARDING_STEPS } from './ui/constants.js';
import { GAMES_LIST, BOT_DIFFICULTIES, TERMO_WORDS, FORCA_WORDS, HANGMAN_STAGES, QUIZ_QUESTIONS, MEMORY_EMOJIS, SIMON_COLORS } from './games/data.js';

// Ponto de entrada único do Crydan -- gerado a partir da fusão dos 3 blocos
// <script> (clássicos) que antes existiam soltos no index.html.
//
// Por que um módulo ES (type="module") e não continuar como <script> solto:
// os 3 blocos antigos compartilhavam escopo de let/const entre si porque
// eram scripts clássicos no mesmo documento -- não dava pra converter só
// um deles em módulo sem quebrar essa ordem (módulo roda de forma adiada,
// os clássicos que sobrassem rodariam antes, síncronos). Por isso a fusão
// dos 3 em um arquivo só teve que acontecer de uma vez.
//
// Por que expõe ~667 funções em window no final do arquivo: o HTML usa
// atributos onclick="nomeDaFuncao(...)" em ~520 lugares (inclusive em HTML
// gerado dinamicamente via innerHTML). Esses atributos só enxergam escopo
// global (window) -- um módulo ES, ao contrário de um <script> clássico,
// NÃO expõe suas funções em window automaticamente. Sem essas linhas no
// final, praticamente todo botão do app pararia de funcionar.
//
// O que isso NÃO faz ainda: dividir esse arquivo em módulos por
// responsabilidade (auth/, economy/, rpg/, etc). Essa fusão é só o passo
// que precisava ser atômico; a divisão em arquivos menores agora pode
// acontecer aos poucos, sem esse problema de ordem, movendo função por
// função e testando a cada passo.
//
// Risco residual conhecido: módulos ES rodam em modo estrito (strict
// mode) automaticamente; scripts clássicos, não. Se alguma função
// dependia de atribuir a uma variável nunca declarada (criação implícita
// de global, permitida em modo não-estrito), isso agora lança
// ReferenceError em vez de funcionar silenciosamente. Não encontrei nenhum
// caso ao revisar, mas é o tipo de erro que só aparece testando no
// navegador -- abra o console (F12) depois de subir esta versão e
// percorra o checklist funcional antes de considerar essa etapa concluída.

  // Chave pública (anon) do Supabase — é segura de deixar aqui, o acesso real
  // é controlado pelas políticas de Row Level Security (RLS) no banco de dados.
  const SUPABASE_URL = 'https://mkwqkedrnmzhyrpwzpse.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rd3FrZWRybm16aHlycHd6cHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5Mjk4NjEsImV4cCI6MjEwMDUwNTg2MX0.QLhIah3A7mZvvEw9wC5RjkNtBEGNkQBASWfJ-Bai0Sg';
  let supabaseInitError = null;
  let supabase = null;
  try {
    // Antes: window.supabase.createClient(...), vindo do <script> UMD do CDN
    // (cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4). Agora é o mesmo
    // pacote e a mesma versão exata (2.45.4, fixada no package.json), só que
    // importado de verdade pelo bundler em vez de carregado por script solto
    // -- o <script> UMD do CDN no <head> do index.html foi removido junto
    // com esta mudança (não é mais usado por nada).
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!supabase || !supabase.auth) {
      throw new Error('O cliente do Supabase foi criado, mas "auth" não existe nele.');
    }
  } catch (e) {
    supabaseInitError = e;
    console.error('Falha ao iniciar o Supabase:', e);
  }

// ══════════════════════════════════════════════════════════════
// (fronteira do antigo 2º bloco <script> do index.html)
// ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════
//   CRYDAN — SISTEMA COMPLETO v2.0
// ═══════════════════════════════════════════

// ── STATE ──────────────────────────────────
let G = {}; // game state
// id do usuário logado no Supabase, cacheado em loadGame()/saveGame() pra
// não precisar de "await supabase.auth.getSession()" toda hora — usado
// pelos recursos sociais reais (amigos, mensagens, PIX, PvP).
let currentUserId = null;
function myId() { return currentUserId; }
let lastProfileSyncAt = 0;
let logs = [];
let activeEvent = null;
let workTimer = null;
let hungerTimer = null;
let salaryTimer = null;
let cooldownTimer = null;

// App-level settings stored in Supabase 'app_settings' table
let APP_SETTINGS = {};

async function loadAppSettings() {
  try {
    const { data, error } = await supabase.from('app_settings').select('key,value');
    if (!error && data) {
      data.forEach(r => { APP_SETTINGS[r.key] = r.value; });
    }
  } catch (e) { console.error('Erro ao carregar app settings', e); }
}

// Diagnostics: detect missing onclick handlers and show runtime errors
function diagnoseOnclickHandlers() {
  try {
    const elems = Array.from(document.querySelectorAll('[onclick]'));
    const missing = new Map();
    elems.forEach(el => {
      const attr = el.getAttribute('onclick') || '';
      const m = attr.match(/\b([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g);
      if (m) {
        m.forEach(call => {
          const name = call.replace(/\s*\($/, '');
          if (typeof window[name] !== 'function') {
            if (!missing.has(name)) missing.set(name, []);
            missing.get(name).push(el);
          }
        });
      }
    });
    if (missing.size) {
      console.warn('Diagnóstico: handlers onclick ausentes:', Array.from(missing.keys()));
      notify('warn', `Diagnóstico: ${missing.size} handlers faltando (veja console).`, 5000);
      missing.forEach((els, name) => console.warn(name, els));
    } else {
      console.log('Diagnóstico: todos os handlers onclick existem.');
    }
    return missing;
  } catch (e) { console.error('Erro no diagnóstico de onclick', e); }
}

window.addEventListener('error', (ev) => {
  try {
    const msg = ev.error?.message || ev.message || String(ev);
    console.error('Global error captured:', ev.error || ev.message || ev);
    notify('error', 'Erro JS: ' + (msg || 'ver console'), 4000);
  } catch (e) { console.error(e); }
});

// Nota técnica: os inline onclick="..." deste arquivo funcionam nativamente
// pelo navegador (o script principal não é um "module", então toda função
// declarada aqui já fica acessível globalmente por padrão). Um mecanismo
// antigo que usava eval()/new Function() para "garantir" isso foi removido
// em 2026-08-30 por ser redundante — confirmado com centenas de onclick
// funcionando normalmente sem ele durante toda a auditoria de segurança.


function renderNavIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    const key = el.getAttribute('data-icon');
    if (el.dataset.iconRendered === key) return;
    el.innerHTML = svgIcon(key);
    el.dataset.iconRendered = key;
  });
}

// ══════════════════════════════════════════
//   NOTIFICAÇÕES REAIS (Supabase + Realtime)
// ══════════════════════════════════════════
let notifState = { list: [], unread: 0, channel: null, loaded: false };


// Registra o service worker assim que o site carrega, mesmo antes do
// jogador logar ou ativar notificações — é isso que permite o Crydan
// aparecer como "Instalar app" / "Adicionar à tela de início" no
// celular (PWA). A parte de notificação push (pedir permissão e se
// inscrever) continua separada, só quando o jogador clica no sino.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('Falha ao registrar service worker:', e));
  });
}

// ── Notificações push reais (funcionam mesmo com o site fechado) ──
// A chave pública abaixo é segura de deixar no código (é assim que o
// Web Push funciona — só a chave PRIVADA, que fica só no servidor,
// que precisa ficar em segredo).
const VAPID_PUBLIC_KEY = 'BJDx-9MUres0nBya__iq26Zn2G6z4iZHLXl5Qq6GZKXQgniRf3H3iBhvJ4v15wegJ6WN7miPrlW-G4IFjvs06C8';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function updatePushToggleLabel(active) {
  const el = document.getElementById('notif-push-toggle');
  if (el) el.textContent = active ? '🔔 Notificações ativas neste dispositivo' : '🔔 Ativar no dispositivo';
}

// Chamada quando o jogador clica em "Ativar no dispositivo", e também
// tentada silenciosamente no login se a permissão já tiver sido dada
// antes (pra manter a inscrição sempre atualizada nesse navegador).
async function enablePushNotifications(silent) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (!silent) notify('error', 'Esse navegador não suporta notificações push. No iPhone, precisa instalar o Crydan na tela de início primeiro (Compartilhar → Adicionar à Tela de Início).');
      return;
    }
    if (!silent) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        notify('error', perm === 'denied'
          ? 'As notificações estão bloqueadas nas permissões do navegador pra este site. Vá nas configurações do site (o cadeado ao lado do endereço) e permita notificações.'
          : 'Você precisa permitir as notificações pra isso funcionar.');
        return;
      }
    } else if (Notification.permission !== 'granted') {
      return;
    }

    let reg;
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    } catch (e) {
      console.error('Falha ao registrar o service worker:', e);
      if (!silent) notify('error', 'Não achei o arquivo /sw.js no site. Erro técnico: ' + e.message);
      return;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (e) {
        console.error('Falha ao criar inscrição push:', e);
        if (!silent) notify('error', 'Falha ao criar a inscrição push. Erro técnico: ' + e.message);
        return;
      }
    }

    const json = sub.toJSON();
    const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
      user_id: currentUserId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'endpoint' });
    if (dbErr) {
      console.error('Falha ao salvar inscrição push no banco:', dbErr);
      if (!silent) notify('error', 'Falha ao salvar no banco. Erro técnico: ' + dbErr.message);
      return;
    }

    updatePushToggleLabel(true);
    if (!silent) notify('success', 'Notificações ativadas neste dispositivo! 🔔');
  } catch (e) {
    console.error('Erro ao ativar push:', e);
    if (!silent) notify('error', 'Não foi possível ativar as notificações agora. Erro técnico: ' + (e.message || e));
  }
}

async function initNotifications() {
  if (!currentUserId) return;
  await loadNotifications();
  subscribeNotifications();
  enablePushNotifications(true);
  document.addEventListener('click', (ev) => {
    const wrap = document.querySelector('.notif-bell-wrap');
    const dd = document.getElementById('notif-dropdown');
    if (wrap && dd && dd.classList.contains('open') && !wrap.contains(ev.target)) {
      dd.classList.remove('open');
    }
  });
}

function teardownNotifications() {
  if (notifState.channel) {
    try { supabase.removeChannel(notifState.channel); } catch (e) {}
  }
  notifState = { list: [], unread: 0, channel: null, loaded: false };
}

async function loadNotifications() {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    notifState.list = data || [];
    notifState.unread = notifState.list.filter(n => !n.is_read).length;
    notifState.loaded = true;
    renderNotifBell();
  } catch (e) {
    console.error('Erro ao carregar notificações', e);
  }
}

function subscribeNotifications() {
  if (notifState.channel) return;
  notifState.channel = supabase
    .channel('notifications-' + currentUserId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, (payload) => {
      notifState.list.unshift(payload.new);
      notifState.unread++;
      renderNotifBell();
      notify('info', (payload.new.title || 'Nova notificação') + (payload.new.body ? ' — ' + payload.new.body : ''), 5000);
      try { confetti && payload.new.type === 'pvp_result' && payload.new.title && payload.new.title.includes('venceu') && confetti({ particleCount: 60, spread: 55 }); } catch (e) {}
    })
    .subscribe();
}

function renderNotifBell() {
  const badge = document.getElementById('notif-badge');
  const bell = document.getElementById('notif-bell-btn');
  if (badge && bell) {
    if (notifState.unread > 0) {
      badge.style.display = 'flex';
      badge.textContent = notifState.unread > 99 ? '99+' : notifState.unread;
      bell.classList.add('has-unread');
    } else {
      badge.style.display = 'none';
      bell.classList.remove('has-unread');
    }
  }
  const list = document.getElementById('notif-dropdown-list');
  if (!list) return;
  if (!notifState.list.length) {
    list.innerHTML = '<div class="notif-empty">Nenhuma notificação por aqui ainda.</div>';
    return;
  }
  list.innerHTML = notifState.list.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="openNotification('${n.id}')">
      <div class="notif-item-icon">${NOTIF_ICONS[n.type] || '📣'}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escapeHtml(n.title || '')}</div>
        ${n.body ? `<div class="notif-item-msg">${escapeHtml(n.body)}</div>` : ''}
        <div class="notif-item-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  dd.classList.toggle('open');
}

async function markNotificationRead(id) {
  const n = notifState.list.find(x => x.id === id);
  if (!n || n.is_read) return;
  n.is_read = true;
  notifState.unread = Math.max(0, notifState.unread - 1);
  renderNotifBell();
  try { await supabase.from('notifications').update({ is_read: true }).eq('id', id); } catch (e) { console.error(e); }
}

async function markAllNotificationsRead() {
  const unreadIds = notifState.list.filter(n => !n.is_read).map(n => n.id);
  notifState.list.forEach(n => n.is_read = true);
  notifState.unread = 0;
  renderNotifBell();
  if (!unreadIds.length) return;
  try { await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId).eq('is_read', false); } catch (e) { console.error(e); }
}

function openNotification(id) {
  const n = notifState.list.find(x => x.id === id);
  if (!n) return;
  markNotificationRead(id);
  document.getElementById('notif-dropdown').classList.remove('open');
  if (n.link) navigate(n.link);
}

// ══════════════════════════════════════════
//   RECADOS (Stories de 24h — anel na foto, como Instagram/Discord)
// ══════════════════════════════════════════
let myStoryCache = null;
let _storyComposerColor = STORY_COLORS[0];

async function checkMyStory() {
  if (!currentUserId) return;
  try {
    const { data } = await supabase.from('stories').select('*')
      .eq('user_id', currentUserId).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1);
    myStoryCache = (data && data[0]) || null;
  } catch (e) { console.error('Erro ao checar recado', e); myStoryCache = null; }
  const ring = document.getElementById('my-story-ring');
  const badge = document.getElementById('story-add-badge');
  if (ring) {
    ring.classList.toggle('has-story', !!myStoryCache);
    ring.classList.toggle('close-friends-story', !!(myStoryCache && myStoryCache.close_friends_only));
  }
  if (badge) badge.textContent = myStoryCache ? '✎' : '+';
}

function handleMyAvatarClick() {
  if (myStoryCache) viewUserStory(currentUserId, G.name || 'Você', true);
  else openStoryComposer();
}

function openStoryComposer() {
  _storyComposerColor = myStoryCache ? (myStoryCache.bg_color || STORY_COLORS[0]) : STORY_COLORS[0];
  showModal('📝 Postar Recado', `
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Fica visível por 24 horas em cima da sua foto, como no Instagram.</div>
    <div class="story-composer-preview" id="story-composer-preview" style="background:${_storyComposerColor}">
      <span id="story-composer-preview-text">${escapeHtml(myStoryCache?.text || 'Escreva algo...')}</span>
    </div>
    <div class="story-color-row" id="story-color-row"></div>
    <textarea class="form-input" id="story-composer-text" rows="3" maxlength="140" placeholder="O que está acontecendo?" oninput="updateStoryPreview()">${escapeHtml(myStoryCache?.text || '')}</textarea>
    <div style="font-size:11px;color:var(--text3);text-align:right;margin:4px 0 12px" id="story-char-count">0/140</div>
    <div class="cr-toggle-row" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:14px">
      <div><div class="cr-toggle-label">💚 Só Amigos Próximos</div><div class="cr-toggle-desc">Apenas quem está na sua lista de amigos próximos vê esse recado</div></div>
      <label class="cr-switch"><input type="checkbox" id="story-close-friends-toggle" ${myStoryCache?.close_friends_only ? 'checked' : ''}><span class="track"><span class="thumb"></span></span></label>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="postStory()">✦ Postar Recado</button>
      ${myStoryCache ? `<button class="btn btn-danger" onclick="deleteMyStory()">🗑️</button>` : ''}
    </div>
    <div style="text-align:center;margin-top:12px">
      <span style="font-size:11.5px;color:var(--gold2);cursor:pointer;text-decoration:underline" onclick="openCloseFriendsManager()">💚 Gerenciar meus Amigos Próximos</span>
    </div>
  `);
  const row = document.getElementById('story-color-row');
  row.innerHTML = STORY_COLORS.map(c => `<div class="story-color-swatch${c === _storyComposerColor ? ' selected' : ''}" style="background:${c}" onclick="selectStoryColor('${c}')"></div>`).join('');
  updateStoryPreview();
}
function selectStoryColor(c) {
  _storyComposerColor = c;
  document.querySelectorAll('.story-color-swatch').forEach(el => {
    el.classList.toggle('selected', (el.getAttribute('onclick') || '').includes(`'${c}'`));
  });
  const preview = document.getElementById('story-composer-preview');
  if (preview) preview.style.background = c;
}
function updateStoryPreview() {
  const text = document.getElementById('story-composer-text')?.value || '';
  const previewText = document.getElementById('story-composer-preview-text');
  if (previewText) previewText.textContent = text || 'Escreva algo...';
  const count = document.getElementById('story-char-count');
  if (count) count.textContent = text.length + '/140';
}
async function postStory() {
  const text = document.getElementById('story-composer-text')?.value.trim();
  const closeOnly = document.getElementById('story-close-friends-toggle')?.checked || false;
  if (!text) return notify('error', 'Escreva algo pro seu recado.');
  try {
    const { error } = await supabase.from('stories').insert([{ user_id: currentUserId, text, bg_color: _storyComposerColor, close_friends_only: closeOnly }]);
    if (error) throw error;
    notify('success', closeOnly ? '💚 Recado postado só pros seus amigos próximos!' : '✦ Recado postado! Fica visível por 24h.');
    closeModalDirect();
    checkMyStory();
  } catch (e) { notify('error', 'Não foi possível postar: ' + (e.message || 'erro')); }
}
async function deleteMyStory() {
  if (!myStoryCache) return;
  if (!await confirmDialog('Remover seu recado atual?', { danger: true })) return;
  try {
    await supabase.from('stories').delete().eq('id', myStoryCache.id);
    notify('success', 'Recado removido.');
    closeModalDirect();
    checkMyStory();
  } catch (e) { notify('error', 'Não foi possível remover.'); }
}

// ── Amigos Próximos ──
async function openCloseFriendsManager() {
  showModal('💚 Amigos Próximos', `<div style="text-align:center;padding:20px;color:var(--text3)">Carregando amigos...</div>`);
  try {
    const { data: friendRows } = await supabase.from('friend_requests').select('from_id,to_id')
      .eq('status', 'accepted').or(`from_id.eq.${currentUserId},to_id.eq.${currentUserId}`);
    const friendIds = (friendRows || []).map(r => r.from_id === currentUserId ? r.to_id : r.from_id);
    if (!friendIds.length) {
      showModal('💚 Amigos Próximos', `<div style="text-align:center;padding:20px;color:var(--text3)">Você ainda não tem amigos adicionados. Adicione amigos primeiro na área Amigos.</div>`);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id,name,avatar,avatar_photo').in('id', friendIds);
    const { data: closeRows } = await supabase.from('close_friends').select('friend_id').eq('owner_id', currentUserId);
    const closeSet = new Set((closeRows || []).map(r => r.friend_id));
    const html = `
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Marque quem pode ver seus recados de "Só Amigos Próximos".</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto">
        ${(profs || []).map(p => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:10px">
            <div class="user-avatar" style="width:34px;height:34px;font-size:15px">${p.avatar_photo ? `<img src="${p.avatar_photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (p.avatar || '⚔️')}</div>
            <span style="flex:1;font-size:13px">${escapeHtml(p.name)}</span>
            <label class="cr-switch"><input type="checkbox" data-friend-id="${p.id}" ${closeSet.has(p.id) ? 'checked' : ''} onchange="toggleCloseFriend('${p.id}', this.checked)"><span class="track"><span class="thumb"></span></span></label>
          </div>`).join('')}
      </div>`;
    showModal('💚 Amigos Próximos', html);
  } catch (e) { console.error(e); notify('error', 'Não foi possível carregar seus amigos.'); }
}
async function toggleCloseFriend(friendId, checked) {
  try {
    if (checked) {
      await supabase.from('close_friends').upsert([{ owner_id: currentUserId, friend_id: friendId }]);
    } else {
      await supabase.from('close_friends').delete().eq('owner_id', currentUserId).eq('friend_id', friendId);
    }
  } catch (e) { notify('error', 'Não foi possível atualizar.'); }
}

let _storyViewerTimer = null;
async function viewUserStory(userId, name, isMine) {
  let story = isMine ? myStoryCache : null;
  if (!story) {
    try {
      const { data } = await supabase.from('stories').select('*')
        .eq('user_id', userId).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1);
      story = data && data[0];
    } catch (e) { console.error(e); }
  }
  if (!story) {
    if (isMine) return openStoryComposer();
    return notify('info', `${name} não tem nenhum recado ativo agora.`);
  }
  renderStoryViewer(story, name, isMine);
  if (!isMine) {
    try { await supabase.from('story_views').upsert([{ story_id: story.id, viewer_id: currentUserId }]); } catch (e) {}
  }
}
function renderStoryViewer(story, name, isMine) {
  let overlay = document.getElementById('story-viewer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'story-viewer-overlay';
    overlay.className = 'story-viewer-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeStoryViewer(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="story-viewer-box" style="background:${story.bg_color || STORY_COLORS[0]}">
      <div class="story-viewer-progress"><div class="story-viewer-progress-fill" id="story-progress-fill"></div></div>
      <div class="story-viewer-head">
        <span class="name">${escapeHtml(name)}${story.close_friends_only ? ' 💚' : ''}</span>
        <span class="time">${timeAgo(story.created_at)}</span>
        <span class="story-viewer-close" onclick="closeStoryViewer()">✕</span>
      </div>
      <div class="story-viewer-text">${escapeHtml(story.text)}</div>
      ${isMine ? `
        <div class="story-viewer-views" onclick="openStoryViewersList('${story.id}')">👁️ <span id="story-view-count">…</span> visualizações</div>
      ` : `
        <div class="story-reaction-row">
          ${STORY_REACT_EMOJIS.map(e => `<span class="story-react-btn" onclick="reactToStory('${story.id}','${e}')">${e}</span>`).join('')}
        </div>
      `}
    </div>`;
  overlay.classList.add('open');
  const fill = document.getElementById('story-progress-fill');
  if (_storyViewerTimer) { clearTimeout(_storyViewerTimer); }
  if (typeof gsap !== 'undefined' && fill) {
    gsap.fromTo(fill, { width: '0%' }, { width: '100%', duration: 6, ease: 'linear' });
  } else if (fill) { fill.style.transition = 'width 6s linear'; requestAnimationFrame(() => fill.style.width = '100%'); }
  _storyViewerTimer = setTimeout(closeStoryViewer, 6200);
  if (isMine) {
    supabase.from('story_views').select('viewer_id', { count: 'exact', head: true }).eq('story_id', story.id)
      .then(({ count }) => { const el = document.getElementById('story-view-count'); if (el) el.textContent = count || 0; });
  }
}
async function reactToStory(storyId, emoji) {
  try {
    await supabase.from('story_reactions').upsert([{ story_id: storyId, user_id: currentUserId, emoji }], { onConflict: 'story_id,user_id' });
    notify('success', `Você reagiu com ${emoji}`);
    closeStoryViewer();
  } catch (e) { notify('error', 'Não foi possível reagir.'); }
}
async function openStoryViewersList(storyId) {
  closeStoryViewer();
  showModal('👁️ Visualizações', `<div style="text-align:center;padding:20px;color:var(--text3)">Carregando...</div>`);
  try {
    const { data: views } = await supabase.from('story_views').select('viewer_id,viewed_at').eq('story_id', storyId).order('viewed_at', { ascending: false });
    const { data: reactions } = await supabase.from('story_reactions').select('user_id,emoji').eq('story_id', storyId);
    const reactMap = Object.fromEntries((reactions || []).map(r => [r.user_id, r.emoji]));
    const ids = (views || []).map(v => v.viewer_id);
    if (!ids.length) { showModal('👁️ Visualizações', `<div style="text-align:center;padding:20px;color:var(--text3)">Ninguém viu ainda.</div>`); return; }
    const { data: profs } = await supabase.from('profiles').select('id,name,avatar,avatar_photo').in('id', ids);
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
    const html = `<div style="display:flex;flex-direction:column;gap:6px;max-height:380px;overflow-y:auto">
      ${(views || []).map(v => { const p = profMap[v.viewer_id] || {}; return `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 2px">
          <div class="user-avatar" style="width:32px;height:32px;font-size:14px">${p.avatar_photo ? `<img src="${p.avatar_photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (p.avatar || '⚔️')}</div>
          <span style="flex:1;font-size:13px">${escapeHtml(p.name || '?')}</span>
          ${reactMap[v.viewer_id] ? `<span style="font-size:16px">${reactMap[v.viewer_id]}</span>` : ''}
          <span style="font-size:10px;color:var(--text3)">${timeAgo(v.viewed_at)}</span>
        </div>`; }).join('')}
    </div>`;
    showModal(`👁️ ${ids.length} Visualizações`, html);
  } catch (e) { console.error(e); notify('error', 'Não foi possível carregar.'); }
}
function closeStoryViewer() {
  const overlay = document.getElementById('story-viewer-overlay');
  if (overlay) overlay.classList.remove('open');
  if (_storyViewerTimer) { clearTimeout(_storyViewerTimer); _storyViewerTimer = null; }
}

// ── INIT ───────────────────────────────────
// ══════════════════════════════════════════
//   LOGIN SEPARADO: JOGADOR x ADMINISTRAÇÃO
// ══════════════════════════════════════════
// A permissão de admin é checada de verdade no Supabase (tabela
// app_admins, protegida por RLS) — não existe mais senha fixa
// escrita no código-fonte da página.
let loginIntent = 'player'; // 'player' | 'admin' — pra saber pra onde ir depois do login

async function boot() {
  if (supabaseInitError) {
    showGateConnectionError(supabaseInitError.message);
    return;
  }
  // load global app settings from Supabase
  await loadAppSettings();
  try { setupKeyboardAccessibility(); } catch (e) {}

  // Fluxo novo: ninguém vê a escolha "Jogador / Administração" antes de
  // logar — isso ficava visível e clicável pra qualquer pessoa, o que
  // não é nem seguro nem profissional. Agora todo mundo cai direto na
  // tela de login/cadastro normal. Só DEPOIS de autenticado é que o
  // sistema confere no banco (tabela app_admins, protegida por RLS) se
  // aquela conta específica tem permissão de administração — e só nesse
  // caso a escolha aparece. Jogador comum nunca vê nem sabe que essa
  // tela existe.
  document.getElementById('gate-select-box').style.display = 'none';
  try {
    const { data } = await supabase.auth.getSession();
    if (data && data.session && data.session.user) {
      await postLoginRoute();
    } else {
      document.getElementById('access-gate').classList.add('hidden');
      openLoginModal();
    }
  } catch (e) {
    console.error('Erro ao verificar sessão na inicialização', e);
    document.getElementById('access-gate').classList.add('hidden');
    openLoginModal();
  }
}

// Chamado logo depois de qualquer login bem-sucedido (ou ao abrir o app
// já com sessão salva). Decide sozinho pra onde a pessoa vai: se a conta
// tem permissão de admin, mostra a escolha; senão, entra direto no jogo.
async function postLoginRoute() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
  let isAdmin = false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (uid) {
      const { data } = await supabase.from('app_admins').select('id').eq('id', uid).maybeSingle();
      isAdmin = !!data;
    }
  } catch (e) { console.error('Erro ao checar permissão de administrador', e); }

  if (isAdmin) {
    document.getElementById('access-gate').classList.remove('hidden');
    document.getElementById('gate-admin-box').style.display = 'none';
    document.getElementById('gate-connection-error-box').style.display = 'none';
    document.getElementById('gate-select-box').style.display = 'block';
  } else {
    document.getElementById('access-gate').classList.add('hidden');
    init();
  }
}

// ── Acessibilidade por teclado para elementos clicáveis não-nativos ────
// Muita coisa no Crydan é uma <div onclick="..."> (nav-item, aba, card,
// item de conversa etc.) — funciona no mouse/toque, mas não recebia foco
// nem respondia a Enter/Espaço no teclado. Em vez de editar centenas de
// elementos um por um, isso aplica automaticamente foco + ativação por
// teclado a esse padrão em toda a tela, inclusive em conteúdo que é
// recriado dinamicamente (innerHTML) durante o uso do app.
const A11Y_CLICKABLE_SELECTOR = '.nav-item, .comm-icon, .tab-btn, .chat-list-item, .frame-cat-tab, .admin-nav, .frame-shop-card, .msg-bubble[onclick], .user-search-item';
function enhanceClickableAccessibility(root) {
  (root || document).querySelectorAll(A11Y_CLICKABLE_SELECTOR).forEach(el => {
    if (el.hasAttribute('tabindex')) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT') return;
    el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
}
function setupKeyboardAccessibility() {
  enhanceClickableAccessibility(document);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (!el || el === document.body) return;
    if (el.matches(A11Y_CLICKABLE_SELECTOR) && el.getAttribute('tabindex') === '0') {
      e.preventDefault();
      el.click();
    }
  });
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => enhanceClickableAccessibility(document), 300);
  });
  const target = document.getElementById('main') || document.body;
  observer.observe(target, { childList: true, subtree: true });
}

async function chooseAccessMode(mode) {
  loginIntent = mode;
  if (supabaseInitError) { showGateConnectionError(supabaseInitError.message); return; }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const hasSession = !!(data && data.session && data.session.user);

    if (mode === 'player') {
      document.getElementById('access-gate').classList.add('hidden');
      if (hasSession) { init(); } else { openLoginModal(); }
    } else {
      if (hasSession) {
        document.getElementById('gate-select-box').style.display = 'none';
        document.getElementById('gate-admin-box').style.display = 'block';
        document.getElementById('gate-admin-status').style.display = 'block';
        document.getElementById('gate-admin-status').innerText = 'Verificando permissão...';
        document.getElementById('gate-admin-error').style.display = 'none';
        await checkAdminAndEnter();
      } else {
        document.getElementById('access-gate').classList.add('hidden');
        openLoginModal();
      }
    }
  } catch (e) {
    console.error('Erro ao verificar sessão do Supabase', e);
    showGateConnectionError(e.message);
  }
}

// Se o Supabase não responder (rede instável, projeto pausado, etc.), avisamos
// a pessoa em vez de deixar o botão parecendo travado sem explicação nenhuma.
function showGateConnectionError(detail) {
  document.getElementById('access-gate').classList.remove('hidden');
  document.getElementById('gate-select-box').style.display = 'none';
  document.getElementById('gate-admin-box').style.display = 'none';
  document.getElementById('gate-connection-error-box').style.display = 'block';
  const detailEl = document.getElementById('gate-connection-error-detail');
  if (detailEl) {
    if (detail) { detailEl.textContent = 'Detalhe técnico: ' + detail; detailEl.style.display = 'block'; }
    else { detailEl.style.display = 'none'; }
  }
}

function backToGateSelect() {
  document.getElementById('gate-admin-box').style.display = 'none';
  document.getElementById('gate-connection-error-box').style.display = 'none';
  document.getElementById('gate-select-box').style.display = 'block';
}

// Confere no Supabase (tabela app_admins) se o usuário logado tem
// permissão de administrador. Só entra na conta dele se a linha existir —
// e como a RLS não deixa o usuário criar essa linha sozinho, não dá pra forjar.
async function checkAdminAndEnter() {
  const statusEl = document.getElementById('gate-admin-status');
  const errEl = document.getElementById('gate-admin-error');
  try {
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data?.session;

    if (!session || !session.user) {
      document.getElementById('access-gate').classList.remove('hidden');
      openLoginModal();
      return;
    }

    const { data, error } = await supabase.from('app_admins').select('id').eq('id', session.user.id).maybeSingle();
    if (error) throw error;

    if (!data) {
      if (statusEl) statusEl.style.display = 'none';
      if (errEl) { errEl.textContent = 'Essa conta não tem permissão de administrador.'; errEl.style.display = 'block'; }
      document.getElementById('access-gate').classList.remove('hidden');
      document.getElementById('gate-select-box').style.display = 'none';
      document.getElementById('gate-admin-box').style.display = 'block';
      return;
    }

    document.getElementById('access-gate').classList.add('hidden');
    showAdminApp();
  } catch (e) {
    console.error('Erro ao checar permissão de administrador', e);
    showGateConnectionError();
  }
}

function showAdminApp() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('register-screen').classList.remove('open');
  document.getElementById('banned-screen').classList.remove('open');
  document.getElementById('header').style.display = 'none';
  document.getElementById('app-body').style.display = 'none';
  document.getElementById('admin-header').style.display = 'flex';
  document.getElementById('admin-body').style.display = 'flex';
  setDeviceView(APP_SETTINGS['default_device_view'] || 'pc');
  adminNavigate('dashboard');
}

async function adminLogout() {
  try { await supabase.auth.signOut(); } catch (e) { console.error('Erro ao sair do Supabase', e); }
  document.getElementById('admin-header').style.display = 'none';
  document.getElementById('admin-body').style.display = 'none';
  document.getElementById('gate-admin-box').style.display = 'none';
  document.getElementById('gate-select-box').style.display = 'none';
  document.getElementById('access-gate').classList.add('hidden');
  openLoginModal();
}

function adminNavigate(panel) {
  document.querySelectorAll('#admin-main .panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
  const el = document.getElementById('admpanel-' + panel);
  if (el) el.classList.add('active');
  document.querySelectorAll('.admin-nav').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${panel}'`)) { n.classList.add('active'); n.setAttribute('aria-current', 'page'); }
  });
  document.querySelectorAll('#admin-bottom-nav .mobile-cat-item').forEach(n => {
    const isActive = n.dataset.admPanel === panel;
    n.classList.toggle('active', isActive);
    if (isActive) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
  if (panel === 'dashboard') renderAdm();
  if (panel === 'logs') renderLogs();
  if (panel === 'tools') renderAdmTools();
  if (panel === 'feedback') renderAdmFeedback();
  if (panel === 'posts') renderAdmPosts();
  if (panel === 'guildclass') { renderAdmGuildRequests(); renderAdmClasses(); renderAdmLottie(); }
}

function init() {
  const msgs = ['CARREGANDO MUNDO...','INICIANDO ECONOMIA...','POPULANDO NPCS...','CALIBRANDO BATALHAS...','PRONTO!'];
  let i = 0;
  const lm = document.getElementById('loading-msg');
  const int = setInterval(() => {
    if (i < msgs.length) { lm.textContent = msgs[i++]; }
    else {
      clearInterval(int);
      setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        loadGame();
      }, 400);
    }
  }, 300);
}

// ── Re-aceite: se um admin lançar uma nova versão dos Termos/Privacidade
// no futuro (via update_legal_version), contas já existentes continuam
// válidas, mas precisam aceitar a nova versão antes de continuar usando
// o Crydan. Retorna true se BLOQUEOU o carregamento (aguardando aceite).
async function checkLegalReAcceptance(userId) {
  const v = await getLegalVersions();
  const { data: last } = await supabase.from('user_legal_acceptances')
    .select('terms_version,privacy_version').eq('user_id', userId)
    .order('accepted_at', { ascending: false }).limit(1).maybeSingle();
  if (last && last.terms_version === v.terms && last.privacy_version === v.privacy) return false;

  document.getElementById('loading-screen').style.display = 'none';
  showModal('📜 Termos Atualizados', `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:8px">📜</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold)">Nossos documentos foram atualizados</div>
      <div style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.6">
        Para continuar usando o Crydan, revise e aceite a versão mais recente dos
        <a href="/terms" target="_blank" style="color:var(--gold2);text-decoration:underline">Termos de Uso</a>
        e da
        <a href="/privacy" target="_blank" style="color:var(--gold2);text-decoration:underline">Política de Privacidade</a>.
      </div>
    </div>
    <label style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;margin-bottom:14px">
      <input type="checkbox" id="reaccept-checkbox" style="margin-top:2px;width:16px;height:16px;flex-shrink:0" onchange="document.getElementById('reaccept-btn').disabled = !this.checked">
      <span style="font-size:13px;color:var(--text)">Li e concordo com os Termos de Uso e a Política de Privacidade atualizados do Crydan.</span>
    </label>
    <div id="reaccept-msg" style="font-size:12px;color:var(--red);min-height:16px;margin-bottom:8px;text-align:center"></div>
    <button class="btn btn-primary" id="reaccept-btn" style="width:100%" disabled onclick="confirmReacceptance('${userId}')">✦ Concordo e Continuar</button>
  `);
  // Modal sem botão de fechar/skip — só continua depois de aceitar.
  const closeBtn = document.querySelector('#modal-overlay .modal-close');
  if (closeBtn) closeBtn.style.display = 'none';
  return true;
}

async function confirmReacceptance(userId) {
  const checkbox = document.getElementById('reaccept-checkbox');
  const msgEl = document.getElementById('reaccept-msg');
  if (!checkbox || !checkbox.checked) {
    if (msgEl) msgEl.textContent = 'É necessário aceitar os termos atualizados para continuar.';
    return;
  }
  const v = await getLegalVersions();
  try {
    const { error } = await supabase.from('user_legal_acceptances').insert([{ user_id: userId, terms_version: v.terms, privacy_version: v.privacy }]);
    if (error) throw error;
    closeModalDirect();
    document.getElementById('loading-screen').style.display = 'flex';
    loadGame();
  } catch (e) {
    console.error('Erro ao registrar novo aceite', e);
    if (msgEl) msgEl.textContent = 'Não foi possível registrar seu aceite agora. Tente novamente.';
  }
}

async function loadGame() {
  try {
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data?.session;
    if (!session || !session.user) {
      // Not authenticated with Supabase: show the login/register screen
      applyTheme(APP_SETTINGS['theme'] || 'dark');
      setDeviceView(APP_SETTINGS['default_device_view'] || 'pc');
      document.getElementById('register-screen').classList.add('open');
      regInit();
      return;
    }
    const userId = session.user.id;
    currentUserId = userId;

    // Se a versão dos Termos/Privacidade mudou desde o último aceite
    // dessa conta, pede pra aceitar de novo antes de continuar — sem
    // travar o usuário se a checagem em si falhar por algum motivo.
    const needsReaccept = await checkLegalReAcceptance(userId).catch(() => false);
    if (needsReaccept) return;

    const { data, error } = await supabase.from('saves').select('data').eq('id', userId).single();
    if (error || !data || !data.data) {
      // Logged in, but no character created yet
      applyTheme(APP_SETTINGS['theme'] || 'dark');
      setDeviceView(APP_SETTINGS['default_device_view'] || 'pc');
      document.getElementById('register-screen').classList.add('open');
      regInit();
      return;
    }
    G = data.data;
  } catch (err) {
    console.error('Erro ao carregar save do Supabase', err);
    notify('error', 'Erro ao carregar dados do servidor.');
    applyTheme(APP_SETTINGS['theme'] || 'dark');
    setDeviceView(APP_SETTINGS['default_device_view'] || 'pc');
    document.getElementById('register-screen').classList.add('open');
    regInit();
    return;
  }

  G.bio = G.bio || '';
  G.banner = G.banner || '';
  G.accent = G.accent || '';
  G.theme = G.theme || 'dark';
  G.feedbackList = G.feedbackList || [];
  G.communities = G.communities || [];
  G.chats = G.chats || [];
  G.claimedPvpChallenges = G.claimedPvpChallenges || [];
  G.deviceView = G.deviceView || APP_SETTINGS['default_device_view'] || 'pc';
  G.bgPalette = G.bgPalette || 'default';
  G.font = G.font || 'crimson';
  G.avatarPhoto = G.avatarPhoto || '';
  G.lastBattle = G.lastBattle || 0;
  G.posts = G.posts || [];
  G.favoriteSongs = G.favoriteSongs || [];
  G.customBgImage = G.customBgImage || '';
  G.profileLink = G.profileLink || '';
  G.profileLinks = G.profileLinks || {};
  if (G.profileLink && !G.profileLinks.site) { G.profileLinks.site = G.profileLink; }
  G.avatarFrame = G.avatarFrame || 'none';
  G.unlockedFrames = G.unlockedFrames || [];
  G.customRingColor = G.customRingColor || '#d4a017';
  G.bannerType = G.bannerType || 'image';
  G.bannerVideo = G.bannerVideo || '';
  G.customFrameImage = G.customFrameImage || '';
  G.aiCompanion = G.aiCompanion || null;
  G.aiChatHistory = G.aiChatHistory || [];
  if (G.tourSeen === undefined) G.tourSeen = true;
  G.bannerAnim = G.bannerAnim || 'none';
  G.bannerPosX = G.bannerPosX ?? 50;
  G.bannerPosY = G.bannerPosY ?? 50;
  G.bannerZoom = G.bannerZoom || 100;
  G.characterSheet = G.characterSheet || { customName:'', customClass:'', appearance:'', backstory:'', skills:[] };
  applyTheme(G.theme);
  setTimeout(() => initThemeLottie('theme-toggle-lottie'), 300);
  applyInterfacePrefs();
  setDeviceView(autoDetectDeviceView());
  if (G.accent) applyAccentColor(G.accent, false);
  if (G.bgPalette && G.bgPalette !== 'default') applyBackgroundPalette(G.bgPalette, false);
  if (G.font) applyFont(G.font, false);
  if (G.customBgImage) applyCustomBgImage(G.customBgImage, false);
  const restriction = await checkModerationStatus();
  if (restriction === 'banned') return; // tela de banido já foi mostrada
  if (restriction === 'suspended') return; // tela de suspensão já foi mostrada
  refreshMyCrystals();
  showApp();
  refreshAll();
  startTimers();
  checkDailyLoginBonus();
  G.lastSeen = Date.now();
  saveGame();
}

// ══════════════════════════════════════════
//   CADASTRO: WIZARD MODERNO DE PERSONAGEM
// ══════════════════════════════════════════
let regState = {
  step: 1,
  cls: 'guerreiro',
  username: '', usernameAvailable: false, usernameTouched: false,
  avatarPhoto: '', avatarFrame: 'none',
  bannerPreset: 'roxo', bannerImage: '', bannerAnim: 'none',
  bannerPosX: 50, bannerPosY: 50, bannerZoom: 100,
  frameCat: 'todas',
};

// ── sons leves (sem biblioteca externa) ──
let regAudioCtx = null;
function regGetAudioCtx() {
  if (!regAudioCtx) {
    try { regAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (regAudioCtx.state === 'suspended') regAudioCtx.resume();
  return regAudioCtx;
}
function regTone(freq, start, dur, vol, type) {
  const ctx = regGetAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start); osc.stop(start + dur);
}
function regSoundClick() { const ctx = regGetAudioCtx(); if (ctx) regTone(700, ctx.currentTime, 0.05, 0.06, 'triangle'); }
function regSoundStep() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  regTone(520, ctx.currentTime, 0.08, 0.05, 'sine');
  regTone(780, ctx.currentTime + 0.05, 0.1, 0.05, 'sine');
}
function regSoundSuccess() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  [523.25, 659.25, 783.99].forEach((f, i) => regTone(f, ctx.currentTime + i * 0.09, 0.35, 0.07, 'triangle'));
}
function regSoundError() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  regTone(220, ctx.currentTime, 0.18, 0.07, 'sawtooth');
  regTone(160, ctx.currentTime + 0.1, 0.22, 0.06, 'sawtooth');
}

// ── inicialização do wizard (chamada toda vez que a tela de cadastro abre) ──
function regInit() {
  regState = {
    step: 1, cls: 'guerreiro',
    avatarPhoto: '', avatarFrame: 'none',
    bannerPreset: 'roxo', bannerImage: '', bannerAnim: 'none',
    bannerPosX: 50, bannerPosY: 50, bannerZoom: 100,
    frameCat: 'todas',
  };
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-age').value = '';
  document.getElementById('reg-error').style.display = 'none';
  document.getElementById('reg-avatar-remove-btn').style.display = 'none';
  document.getElementById('reg-banner-remove-btn').style.display = 'none';
  document.getElementById('reg-banner-adjust-group').style.display = 'none';
  regRenderClassGrid();
  regRenderFrameCats();
  regRenderFrameGrid();
  regRenderBannerPresets();
  regRenderBannerAnims();
  regGoStep(1, true);
  regUpdatePreview();
}

function regRenderClassGrid() {
  const grid = document.getElementById('reg-class-grid');
  grid.innerHTML = Object.keys(CLASSES).map(id => {
    const cd = CLASSES[id];
    const label = id.charAt(0).toUpperCase() + id.slice(1);
    const sel = regState.cls === id ? ' sel' : '';
    return `<div class="reg-class-card${sel} press-fx" onclick="regSelectClass('${id}')">
      <span class="rc-icon">${cd.icon}</span>
      <div><div class="rc-name">${label}</div><div class="rc-desc">${CLASS_DESCRIPTIONS[id] || ''}</div></div>
    </div>`;
  }).join('');
}
function regSelectClass(id) {
  regState.cls = id;
  regSoundClick();
  regRenderClassGrid();
  regUpdatePreview();
}
function regUpdateIdentity() {
  // sugere um @usuario a partir do nome digitado, só se a pessoa ainda
  // não mexeu manualmente no campo de usuário (igual Instagram sugere)
  if (!regState.usernameTouched) {
    const nameEl = document.getElementById('reg-name');
    const userEl = document.getElementById('reg-username');
    if (nameEl && userEl) {
      const suggestion = normalizeUsernameInput(nameEl.value.toLowerCase().replace(/\s+/g, '_'));
      if (suggestion !== userEl.value) {
        userEl.value = suggestion;
        regCheckUsername(true);
      }
    }
  }
  regUpdatePreview();
}

let _regUsernameCheckTimer = null;
async function regCheckUsername(fromSuggestion = false) {
  if (!fromSuggestion) regState.usernameTouched = true;
  const input = document.getElementById('reg-username');
  const hint = document.getElementById('reg-username-hint');
  if (!input || !hint) return;
  const clean = normalizeUsernameInput(input.value);
  if (clean !== input.value) input.value = clean;
  regState.username = clean;
  regState.usernameAvailable = false;
  clearTimeout(_regUsernameCheckTimer);

  if (!clean) {
    hint.textContent = 'Único, como no Instagram — é como as pessoas vão te encontrar.';
    hint.style.color = 'var(--crydan-text-muted)';
    return;
  }
  if (!USERNAME_REGEX.test(clean)) {
    hint.textContent = '❌ Use apenas letras minúsculas, números, ponto e underline (não pode começar/terminar com ponto).';
    hint.style.color = 'var(--crydan-danger)';
    return;
  }
  hint.textContent = 'Verificando disponibilidade...';
  hint.style.color = 'var(--crydan-text-muted)';
  _regUsernameCheckTimer = setTimeout(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle();
      if (error) throw error;
      if (data) {
        hint.textContent = '❌ Esse @usuario já está em uso.';
        hint.style.color = 'var(--crydan-danger)';
        regState.usernameAvailable = false;
      } else {
        hint.textContent = '✓ Disponível!';
        hint.style.color = 'var(--crydan-success)';
        regState.usernameAvailable = true;
      }
    } catch (e) {
      hint.textContent = 'Não foi possível verificar agora.';
      hint.style.color = 'var(--crydan-text-muted)';
    }
  }, 400);
}

function regRenderFrameCats() {
  const wrap = document.getElementById('reg-frame-cats');
  wrap.innerHTML = FRAME_CATEGORIES.map(c => {
    const sel = regState.frameCat === c.id ? ' sel' : '';
    return `<span class="reg-cat-tab${sel} press-fx" onclick="regSetFrameCat('${c.id}')">${c.name}</span>`;
  }).join('');
}
function regSetFrameCat(id) {
  regState.frameCat = id;
  regSoundClick();
  regRenderFrameCats();
  regRenderFrameGrid();
}
function regRenderFrameGrid() {
  const grid = document.getElementById('reg-frame-grid');
  // Molduras customizáveis (cor/imagem própria) ficam de fora do cadastro —
  // dá pra configurar depois, direto no perfil, com mais calma.
  const list = AVATAR_FRAMES.filter(f => f.cost === 0 && !f.customColor && !f.customImage &&
    (regState.frameCat === 'todas' || f.cat === regState.frameCat));
  grid.innerHTML = list.map(f => {
    const sel = regState.avatarFrame === f.id ? ' sel' : '';
    const swatch = f.icon || f.emoji || '✨';
    return `<div class="reg-frame-item${sel} press-fx" onclick="regSelectFrame('${f.id}')" title="${f.name}">
      <span class="rf-swatch">${swatch}</span>
      <span class="rf-label">${f.name}</span>
    </div>`;
  }).join('');
}
function regSelectFrame(id) {
  regState.avatarFrame = id;
  regSoundClick();
  regRenderFrameGrid();
  regUpdatePreview();
}

function regHandleAvatarUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione uma imagem válida.'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 3MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    regState.avatarPhoto = ev.target.result;
    document.getElementById('reg-avatar-remove-btn').style.display = '';
    regSoundClick();
    regUpdatePreview();
  };
  reader.onerror = () => notify('error', 'Não foi possível ler a imagem.');
  reader.readAsDataURL(file);
  e.target.value = '';
}
function regRemoveAvatarPhoto() {
  regState.avatarPhoto = '';
  document.getElementById('reg-avatar-remove-btn').style.display = 'none';
  regUpdatePreview();
}

function regHandleBannerUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione uma imagem válida.'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 3MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    regState.bannerImage = ev.target.result;
    document.getElementById('reg-banner-remove-btn').style.display = '';
    document.getElementById('reg-banner-adjust-group').style.display = 'block';
    regSoundClick();
    regRenderBannerPresets();
    regUpdatePreview();
  };
  reader.onerror = () => notify('error', 'Não foi possível ler a imagem.');
  reader.readAsDataURL(file);
  e.target.value = '';
}
function regRemoveBannerImage() {
  regState.bannerImage = '';
  document.getElementById('reg-banner-remove-btn').style.display = 'none';
  document.getElementById('reg-banner-adjust-group').style.display = 'none';
  regRenderBannerPresets();
  regUpdatePreview();
}
function regRenderBannerPresets() {
  const wrap = document.getElementById('reg-banner-presets');
  wrap.innerHTML = BANNER_PRESETS.map(p => {
    const sel = (!regState.bannerImage && regState.bannerPreset === p.id) ? ' sel' : '';
    return `<div class="reg-preset-swatch${sel} press-fx" style="background:${p.css}" onclick="regSelectPreset('${p.id}')" title="Cor ${p.id}"></div>`;
  }).join('');
}
function regSelectPreset(id) {
  regState.bannerPreset = id;
  regState.bannerImage = '';
  document.getElementById('reg-banner-remove-btn').style.display = 'none';
  document.getElementById('reg-banner-adjust-group').style.display = 'none';
  regSoundClick();
  regRenderBannerPresets();
  regUpdatePreview();
}
function regUpdateBannerAdjust() {
  regState.bannerPosX = parseInt(document.getElementById('reg-banner-x').value);
  regState.bannerPosY = parseInt(document.getElementById('reg-banner-y').value);
  regState.bannerZoom = parseInt(document.getElementById('reg-banner-zoom').value);
  regUpdatePreview();
}
function regRenderBannerAnims() {
  const wrap = document.getElementById('reg-banner-anims');
  wrap.innerHTML = BANNER_ANIMS.map(a => {
    const sel = regState.bannerAnim === a.id ? ' sel' : '';
    return `<div class="reg-banner-anim-item${sel} press-fx" onclick="regSelectBannerAnim('${a.id}')">${a.name}</div>`;
  }).join('');
}
function regSelectBannerAnim(id) {
  regState.bannerAnim = id;
  regSoundClick();
  regRenderBannerAnims();
  regUpdatePreview();
}

// ── pré-visualização ao vivo (mesmo motor de moldura/banner do resto do app) ──
function regUpdatePreview() {
  const cd = CLASSES[regState.cls] || CLASSES.guerreiro;
  const avatarEl = document.getElementById('reg-preview-avatar');
  if (regState.avatarPhoto) {
    avatarEl.style.backgroundImage = `url('${regState.avatarPhoto}')`;
    avatarEl.style.backgroundSize = 'cover';
    avatarEl.style.backgroundPosition = 'center';
    avatarEl.textContent = '';
  } else {
    avatarEl.style.backgroundImage = '';
    avatarEl.textContent = cd.icon;
  }
  applyFrameToWrap(document.getElementById('reg-preview-frame-wrap'), regState.avatarFrame);

  const bannerEl = document.getElementById('reg-preview-banner');
  BANNER_ANIMS.forEach(a => bannerEl.classList.remove('anim-' + a.id));
  if (regState.bannerAnim !== 'none') bannerEl.classList.add('anim-' + regState.bannerAnim);
  mountBannerFx('reg-preview-banner-fx', regState.bannerAnim);

  if (regState.bannerImage) {
    bannerEl.style.background = `url('${regState.bannerImage}')`;
    bannerEl.style.backgroundSize = regState.bannerZoom + '%';
    bannerEl.style.backgroundPosition = regState.bannerPosX + '% ' + regState.bannerPosY + '%';
  } else {
    const preset = BANNER_PRESETS.find(b => b.id === regState.bannerPreset) || BANNER_PRESETS[0];
    bannerEl.style.background = preset.css;
    bannerEl.style.backgroundSize = '';
    bannerEl.style.backgroundPosition = '';
  }

  const name = document.getElementById('reg-name').value.trim();
  document.getElementById('reg-preview-name').textContent = name || 'Novo Aventureiro';
  const classLabel = regState.cls.charAt(0).toUpperCase() + regState.cls.slice(1);
  document.getElementById('reg-preview-sub').textContent = `Nível 1 · ${classLabel}`;
}

// ── navegação entre etapas ──
function regGoStep(n, silent) {
  if (n < 1) n = 1;
  if (n > 4) n = 4;
  if (n === regState.step && !silent) return;

  if (n > regState.step) {
    if (regState.step === 1) {
      const name = document.getElementById('reg-name').value.trim();
      const age = parseInt(document.getElementById('reg-age').value);
      const username = document.getElementById('reg-username').value.trim();
      const errEl = document.getElementById('reg-error');
      if (!name || name.length < 2) { errEl.textContent = 'Nome deve ter pelo menos 2 caracteres.'; errEl.style.display = 'block'; regSoundError(); return; }
      if (!username) { errEl.textContent = 'Escolha um @usuario para continuar.'; errEl.style.display = 'block'; regSoundError(); return; }
      if (!USERNAME_REGEX.test(username)) { errEl.textContent = '@usuario inválido — use apenas letras minúsculas, números, ponto e underline.'; errEl.style.display = 'block'; regSoundError(); return; }
      if (!regState.usernameAvailable) { errEl.textContent = 'Esse @usuario já está em uso ou ainda está sendo verificado — aguarde um instante.'; errEl.style.display = 'block'; regSoundError(); return; }
      if (isNaN(age) || age < 9 || age > 101) { errEl.textContent = 'Idade deve ser entre 9 e 101 anos.'; errEl.style.display = 'block'; regSoundError(); return; }
      errEl.style.display = 'none';
    }
  }

  regState.step = n;
  document.querySelectorAll('.reg-panel').forEach(p => { p.style.display = (parseInt(p.dataset.panel) === n) ? '' : 'none'; });
  document.querySelectorAll('.reg-step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  document.getElementById('reg-btn-back').style.visibility = n === 1 ? 'hidden' : 'visible';
  // Só trocamos o texto do botão aqui — nunca reatribua o onclick dele!
  // Fazer isso criaria um segundo clique concorrendo com o onclick nativo do
  // HTML e faria cada toque avançar duas etapas de uma vez (bug antigo já visto aqui).
  document.getElementById('reg-btn-next').textContent = (n === 4) ? '✦ Criar Personagem' : 'Continuar →';
  if (!silent) regSoundStep();
}

// Handler fixo do botão de avançar — decide "próxima etapa" ou "finalizar"
// olhando o estado atual em vez de trocar o onclick do botão em tempo real.
function regHandleNextClick() {
  if (regState.step >= 4) { regFinish(); } else { regGoStep(regState.step + 1); }
}

function regFinish() {
  const name = document.getElementById('reg-name').value.trim();
  const age = parseInt(document.getElementById('reg-age').value);
  const cls = regState.cls;
  const errEl = document.getElementById('reg-error');

  if (getBlockSignups()) { errEl.textContent = '🚫 Novos cadastros estão temporariamente desativados pela administração.'; errEl.style.display = 'block'; regSoundError(); return; }
  if (!name || name.length < 2 || isNaN(age) || age < 9 || age > 101) { regGoStep(1); return; }
  if (!regState.username || !USERNAME_REGEX.test(regState.username) || !regState.usernameAvailable) { regGoStep(1); return; }

  const cd = CLASSES[cls];
  G = {
    name, age, class: cls, avatar: cd.icon,
    profileTitle: `🔮 Novato de Crydan`,
    customTitle: '',
    bio: '', banner: regState.bannerImage || '', accent: '',
    theme: 'dark',
    feedbackList: [],
    level: 1, xp: 0, xpToNext: 100,
    hp: cd.hp, maxHp: cd.hp,
    mana: cd.mana, maxMana: cd.mana,
    stamina: cd.stamina, maxStamina: cd.stamina,
    hunger: 100, maxHunger: 100,
    energy: 100,
    str: 10 + cd.str, dex: 10 + cd.dex, int: 10 + cd.int, vit: 10 + cd.vit, wis: 10 + cd.wis,
    wallet: 100, bank: 0, totalEarned: 0,
    inventory: [
      { id:'pao', name:'Pão', icon:'🍞', type:'food', qty:3, power:20, rarity:'common' },
    ],
    equipped: { weapon:null, shield:null, armor:null, amulet:null, helmet:null },
    houses: [], companies: [],
    job: null, jobSalary: 0, workTurns: 0, lastWork: 0,
    guild: null, guildRole: null,
    married: null, friends: [],
    battles: 0, wins: 0, losses: 0, bossKills: 0, lastBattle: 0,
    questsCompleted: 0, activeQuests: [], completedQuests: [],
    itemsCollected: 0, itemsBought: 0,
    achievements: ['first_login'],
    bankHistory: [{ type:'bonus', desc:'Bônus inicial de cadastro', amount:100, ts: Date.now() }],
    activityFeed: ['🌅 Sua jornada em Crydan começa agora!'],
    collectProgress: { mineracao:0, pesca:0, caca:0, coleta:0 },
    questProgress: {},
    stats: { totalBattles:0, totalKills:0, totalWork:0 },
    isBanned: false,
    registeredAt: Date.now(),
    communities: [
      { id: 'c_geral', name: 'Reino de Crydan', icon: '🏰', createdAt: Date.now(),
        channels: [
          { id: 'ch_geral', name: 'geral', messages: [ { author: 'Sistema', text: 'Bem-vindo à comunidade oficial de Crydan! Converse com outros aventureiros aqui.', ts: Date.now() } ] },
          { id: 'ch_anuncios', name: 'anúncios', messages: [] },
          { id: 'ch_off', name: 'off-topic', messages: [] },
        ] }
    ],
    chats: [],
    deviceView: (APP_SETTINGS['default_device_view'] || 'pc'),
    bgPalette: 'default',
    font: 'crimson',
    avatarPhoto: regState.avatarPhoto || '',
    username: regState.username || '',
    posts: [],
    favoriteSongs: [],
    customBgImage: '',
    profileLink: '',
    profileLinks: {},
    avatarFrame: regState.avatarFrame || 'none',
    unlockedFrames: [],
    customRingColor: '#d4a017',
    bannerType: 'image',
    bannerPreset: regState.bannerPreset,
    bannerVideo: '',
    customFrameImage: '',
    aiCompanion: null,
    aiChatHistory: [],
    bannerAnim: regState.bannerAnim || 'none',
    bannerPosX: regState.bannerPosX,
    bannerPosY: regState.bannerPosY,
    bannerZoom: regState.bannerZoom,
    characterSheet: { customName:'', customClass:'', appearance:'', backstory:'', skills:[] },
    tourSeen: false,
  };

  applyTheme(G.theme);
  setDeviceView(autoDetectDeviceView());
  saveGame();
  document.getElementById('register-screen').classList.remove('open');
  showApp();
  refreshAll();
  startTimers();
  regSoundSuccess();
  notify('success', `✦ Bem-vindo a Crydan, ${name}!`);
  sysLog(`Novo jogador registrado: ${name} | Classe: ${cls} | Idade: ${age}`);
  startOnboardingTour();
}

function showApp() {
  document.getElementById('header').style.display = 'flex';
  document.getElementById('app-body').style.display = 'flex';
  navigate('inicio');
  renderNavIcons();
  initNotifications();
  checkMyStory();
  initCallSignaling();
  touchLastSeen();
  if (_lastSeenInterval) clearInterval(_lastSeenInterval);
  _lastSeenInterval = setInterval(touchLastSeen, 60000);
  if (_modCheckInterval) clearInterval(_modCheckInterval);
  _modCheckInterval = setInterval(async () => { if (await checkModerationStatus()) location.reload(); }, 120000);
}
let _modCheckInterval = null;
let _lastSeenInterval = null;
function touchLastSeen() {
  if (!currentUserId) return;
  supabase.rpc('touch_last_seen').then(() => {}).catch(() => {});
}

async function saveGame() {
  try {
    // Rede de segurança: carteira, banco e total ganho SEMPRE precisam ser
    // números inteiros — várias funções do servidor (como o cofre da
    // guilda) fazem cast direto pra inteiro e quebram com valor decimal.
    if (typeof G.wallet === 'number') G.wallet = Math.round(G.wallet);
    if (typeof G.bank === 'number') G.bank = Math.round(G.bank);
    if (typeof G.totalEarned === 'number') G.totalEarned = Math.round(G.totalEarned);
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data?.session;
    if (!session || !session.user) {
      console.warn('Usuário não autenticado no Supabase — não salvando remotamente.');
      return;
    }
    const userId = session.user.id;
    currentUserId = userId;
    const payload = { id: userId, name: G.name || '', data: G };
    const { error } = await supabase.from('saves').upsert([payload], { onConflict: 'id' });
    if (error) {
      console.error('Erro ao salvar no Supabase', error);
      notify('error', 'Erro ao salvar no servidor.');
    }
    syncProfile();
  } catch (e) {
    console.error(e);
    notify('error', 'Erro ao salvar no servidor.');
  }
}

// ── PERFIL PÚBLICO (nome, classe, nível, atributos) ────────────────
// Mantém a tabela "profiles" em dia — é o que permite outro jogador
// te encontrar pelo nome (amizade, PIX, PvP) sem ler seu save inteiro.
// Não bloqueia a UI nem trava saveGame() se falhar; e não roda a cada
// chamada de saveGame() (que acontece o tempo todo) — só a cada ~5s.
async function syncProfile() {
  if (!currentUserId || !G || !G.name) return;
  const now = Date.now();
  if (now - lastProfileSyncAt < 5000) return;
  lastProfileSyncAt = now;
  const basePayload = {
    id: currentUserId,
    name: G.name,
    avatar: G.avatar || '',
    class: G.class || '',
    level: G.level || 1,
    hp: G.hp || 0,
    max_hp: G.maxHp || 0,
    str: G.str || 10,
    dex: G.dex || 10,
    int_: G.int || 10,
    vit: G.vit || 10,
    wis: G.wis || 10,
    bio: G.bio || '',
    avatar_photo: G.avatarPhoto || '',
    avatar_frame: G.avatarFrame || 'none',
    custom_frame_image: G.customFrameImage || null,
    custom_ring_color: G.customRingColor || null,
    banner_preset: G.bannerPreset || '',
    banner_image: G.banner || '',
    banner_anim: G.bannerAnim || 'none',
    wallet: Math.floor(G.wallet || 0),
    bank: Math.floor(G.bank || 0),
    battles: G.battles || 0,
    quests_completed: G.questsCompleted || 0,
    favorite_songs: (G.favoriteSongs || []).slice(0, 30),
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('profiles')
      .upsert([{ ...basePayload, username: G.username || null }], { onConflict: 'id' });
    if (error) {
      // colisão rara de @usuario (duas contas tentando o mesmo ao mesmo
      // tempo) — não deixa isso travar o resto da sincronização do perfil
      if (error.code === '23505') {
        console.warn('@usuario em conflito, sincronizando o resto do perfil sem ele', error);
        G.username = '';
        notify('warn', 'Seu @usuario ficou indisponível (alguém pegou primeiro). Escolha outro em Configurações.');
        await supabase.from('profiles').upsert([basePayload], { onConflict: 'id' });
      } else {
        console.error('Erro ao sincronizar perfil público', error);
      }
    }
  } catch (e) {
    console.error('Erro ao sincronizar perfil público', e);
  }
}

// ── THEME ──────────────────────────────────
const _themeLottieEls = {};

function initThemeLottie(elId) {
  const el = document.getElementById(elId);
  if (!el || _themeLottieEls[elId]) return;
  _themeLottieEls[elId] = el;
  const setup = () => {
    if (!el.dotLottie) { setTimeout(setup, 150); return; }
    el.dotLottie.addEventListener('load', () => {
      el.dotLottie.stateMachineLoad('StateMachine1');
      el.dotLottie.stateMachineStart();
      // Sincroniza a animação com o tema atual salvo, sem disparar aviso nem regravar o save
      if ((G.theme || 'dark') === 'dark') el.dotLottie.stateMachineFireEvent('transition');
    });
    el.dotLottie.addEventListener('stateMachineStateEntered', (ev) => {
      const state = ev.state || (ev.detail && ev.detail.state);
      if (state === 'Night Idle') syncOtherThemeWidgets(elId, 'dark');
      else if (state === 'Day Idle') syncOtherThemeWidgets(elId, 'light');
    });
  };
  setup();
}
function syncOtherThemeWidgets(sourceId, theme) {
  applyTheme(theme);
  persistThemeSilently(theme);
  Object.entries(_themeLottieEls).forEach(([id, el]) => {
    if (id === sourceId || !el.dotLottie) return;
    const wantsNight = theme === 'dark';
    // Evita reprocessar: só dispara transição se o widget ainda não está no estado certo
    try { el.dotLottie.stateMachineFireEvent('transition'); } catch (e) {}
  });
}
function persistThemeSilently(theme) {
  if (G && G.name && G.theme !== theme) { G.theme = theme; saveGame(); }
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  const label = document.getElementById('theme-label');
  if (label) label.textContent = theme === 'light' ? 'Claro' : 'Escuro';
  const cfgLabel = document.getElementById('cfg-theme-current-label');
  if (cfgLabel) cfgLabel.textContent = theme === 'light' ? 'Claro' : 'Escuro';
  // persist theme to user save (G) instead of localStorage
  if (G && G.name) { G.theme = theme; saveGame(); }
  if (G && G.bgPalette && G.bgPalette !== 'default') applyBackgroundPalette(G.bgPalette, false);
}

function toggleTheme() {
  const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
  setTheme(next);
}

// ── Reduzir animações (acessibilidade real: desliga transições/animações
// CSS pra quem sente desconforto com movimento, ou só quer uma interface
// mais parada) e Modo compacto (reduz espaçamento pra caber mais na tela).
function toggleReduceMotion(on) {
  document.body.classList.toggle('reduce-motion', !!on);
  if (G && G.name) { G.reduceMotion = !!on; saveGame(); }
  notify('info', on ? '🧘 Animações reduzidas' : '✨ Animações normais', 1800);
}

function toggleCompactMode(on) {
  document.body.classList.toggle('compact-mode', !!on);
  if (G && G.name) { G.compactMode = !!on; saveGame(); }
  notify('info', on ? '📐 Modo compacto ativado' : '📐 Modo compacto desativado', 1800);
}

function applyInterfacePrefs() {
  if (!G) return;
  document.body.classList.toggle('reduce-motion', !!G.reduceMotion);
  document.body.classList.toggle('compact-mode', !!G.compactMode);
}

function setTheme(theme) {
  applyTheme(theme);
  if (G && G.name) { G.theme = theme; saveGame(); }
  notify('info', theme === 'light' ? '☀️ Tema claro ativado' : '🌙 Tema escuro ativado', 2000);
}

// ── PERSONALIZAÇÃO: cor de destaque, fundo do app, fonte e foto de perfil ──
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function applyAccentColor(hex, persist = true) {
  const { h, s } = hexToHsl(hex);
  const gold = hex;
  const gold2 = hslToHex(h, Math.min(s + 15, 90), 62);
  const gold3 = hslToHex(h, Math.min(s + 5, 85), 26);
  document.body.style.setProperty('--gold', gold);
  document.body.style.setProperty('--gold2', gold2);
  document.body.style.setProperty('--gold3', gold3);
  document.body.style.setProperty('--accent', gold);
  if (persist && G && G.name) { G.accent = hex; saveGame(); }
}

function applyBackgroundPalette(id, persist = true) {
  const pal = BG_PALETTES.find(p => p.id === id) || BG_PALETTES[0];
  if (pal.id === 'default') {
    ['--bg', '--bg2', '--bg3', '--bg4', '--border', '--border2', '--text', '--text2', '--text3'].forEach(v => document.body.style.removeProperty(v));
  } else {
    const light = document.body.classList.contains('theme-light');
    const { h, s } = pal;
    if (light) {
      document.body.style.setProperty('--bg', hslToHex(h, Math.min(s, 40), 93));
      document.body.style.setProperty('--bg2', hslToHex(h, Math.min(s, 35), 98));
      document.body.style.setProperty('--bg3', hslToHex(h, Math.min(s, 35), 89));
      document.body.style.setProperty('--bg4', hslToHex(h, Math.min(s, 35), 82));
      document.body.style.setProperty('--border', hslToHex(h, Math.min(s, 30), 76));
      document.body.style.setProperty('--border2', hslToHex(h, Math.min(s, 30), 65));
      document.body.style.setProperty('--text', hslToHex(h, 20, 16));
      document.body.style.setProperty('--text2', hslToHex(h, 15, 34));
      document.body.style.setProperty('--text3', hslToHex(h, 12, 52));
    } else {
      document.body.style.setProperty('--bg', hslToHex(h, s, 6));
      document.body.style.setProperty('--bg2', hslToHex(h, s, 10));
      document.body.style.setProperty('--bg3', hslToHex(h, s, 14));
      document.body.style.setProperty('--bg4', hslToHex(h, s, 19));
      document.body.style.setProperty('--border', hslToHex(h, Math.min(s + 5, 45), 24));
      document.body.style.setProperty('--border2', hslToHex(h, Math.min(s + 8, 50), 32));
      document.body.style.setProperty('--text', hslToHex(h, 25, 88));
      document.body.style.setProperty('--text2', hslToHex(h, 20, 62));
      document.body.style.setProperty('--text3', hslToHex(h, 15, 42));
    }
  }
  if (persist && G && G.name) { G.bgPalette = id; saveGame(); }
}

function applyFont(fontId, persist = true) {
  const f = FONT_OPTIONS.find(x => x.id === fontId) || FONT_OPTIONS[0];
  document.body.style.setProperty('--font-body', f.css);
  if (persist && G && G.name) { G.font = fontId; saveGame(); }
}

// ── MOLDURA DE AVATAR (frames animados estilo Discord) ──
let _avatarFxContainers = {};
function mountAvatarParticles(wrap, presetKey) {
  if (!wrap.id) wrap.id = 'afx-' + Math.random().toString(36).slice(2, 9);
  const key = wrap.id;
  const prev = _avatarFxContainers[key];
  if (prev) { try { prev.destroy(); } catch (e) {} delete _avatarFxContainers[key]; }
  let slot = wrap.querySelector('.frame-fx-slot');
  if (!slot) { slot = document.createElement('div'); slot.className = 'frame-fx-slot'; wrap.appendChild(slot); }
  slot.innerHTML = '';
  const preset = AVATAR_PARTICLE_PRESETS[presetKey];
  if (!preset || typeof tsParticles === 'undefined') return;
  const mountId = key + '-tsp';
  const mountDiv = document.createElement('div');
  mountDiv.id = mountId;
  mountDiv.style.cssText = 'position:absolute;inset:0;';
  slot.appendChild(mountDiv);
  tsParticles.load(mountId, preset).then(c => { _avatarFxContainers[key] = c; }).catch(() => {});
}
// ── Animações Lottie (LottieFiles) — molduras de avatar e banners extras,
//    gerenciadas pela administração. Identificadas por um id no formato
//    "lottie:<uuid>" guardado no mesmo campo de avatar_frame/banner_anim.
let _lottieCatalogCache = null;
async function getLottieCatalog() {
  if (_lottieCatalogCache) return _lottieCatalogCache;
  try {
    const { data, error } = await supabase.from('lottie_animations').select('*').order('created_at');
    if (error) throw error;
    _lottieCatalogCache = data || [];
  } catch (e) {
    console.error('Erro ao carregar catálogo Lottie', e);
    _lottieCatalogCache = [];
  }
  return _lottieCatalogCache;
}
function lottieUrlFor(id, catalog) {
  if (!id || !id.startsWith('lottie:')) return null;
  const entry = (catalog || _lottieCatalogCache || []).find(l => l.id === id.slice(7));
  return entry ? entry.url : null;
}
function lottieEntryFor(id, catalog) {
  if (!id || !id.startsWith('lottie:')) return null;
  return (catalog || _lottieCatalogCache || []).find(l => l.id === id.slice(7)) || null;
}
function renderAnimHtml(entry, styleAttr) {
  if (!entry) return '';
  // Vídeos MP4 (ex.: prévias do LottieFiles) vêm com fundo branco "gravado" no arquivo —
  // MP4/H.264 não suporta canal alfa. mix-blend-mode:multiply remove visualmente o branco,
  // deixando só o efeito (fogo/neve/raio/etc) por cima do banner/moldura, sem precisar trocar
  // o arquivo. Não usar isso em kind:'gif'/'lottie', que já têm transparência real.
  if (entry.kind === 'video') return `<video src="${entry.url}" style="${styleAttr};mix-blend-mode:multiply" autoplay loop muted playsinline></video>`;
  if (entry.kind === 'gif') return `<img src="${entry.url}" style="${styleAttr};object-fit:cover">`;
  return `<lottie-player src="${entry.url}" background="transparent" speed="1" style="${styleAttr}" loop autoplay></lottie-player>`;
}

function applyFrameToWrap(wrap, id, ownerData) {
  if (!wrap) return;
  Array.from(wrap.classList).forEach(c => { if (c.startsWith('frame-') || c.startsWith('fx-')) wrap.classList.remove(c); });
  ['--fx-c1', '--fx-c2', '--fx-emoji'].forEach(v => wrap.style.removeProperty(v));
  const svgSlot = wrap.querySelector('.frame-svg-slot');
  if (svgSlot) svgSlot.innerHTML = '';
  const fxSlot = wrap.querySelector('.frame-fx-slot');
  if (fxSlot) fxSlot.innerHTML = '';
  if (wrap.id && _avatarFxContainers[wrap.id]) { try { _avatarFxContainers[wrap.id].destroy(); } catch (e) {} delete _avatarFxContainers[wrap.id]; }
  if (!id || id === 'none') return;

  if (id.startsWith('lottie:')) {
    const entry = lottieEntryFor(id);
    if (entry && svgSlot) {
      svgSlot.innerHTML = renderAnimHtml(entry, 'position:absolute;inset:-15%;width:130%;height:130%;border-radius:50%');
    } else if (!_lottieCatalogCache) {
      getLottieCatalog().then(() => applyFrameToWrap(wrap, id, ownerData));
    }
    return;
  }

  const frame = AVATAR_FRAMES.find(f => f.id === id);
  if (!frame) return;
  const ringColor = (ownerData && ownerData.customRingColor) || G.customRingColor || '#d4a017';
  const frameImage = (ownerData && ownerData.customFrameImage) || (ownerData ? null : G.customFrameImage);
  if (frame.customColor) {
    const { h, s } = hexToHsl(ringColor);
    wrap.classList.add('fx-spin');
    wrap.style.setProperty('--fx-c1', ringColor);
    wrap.style.setProperty('--fx-c2', hslToHex(h, Math.min(s + 10, 90), 72));
  } else if (frame.customImage) {
    if (svgSlot && frameImage) {
      svgSlot.innerHTML = `<img src="${frameImage}" class="custom-frame-img" alt="Moldura personalizada">`;
    }
  } else if (frame.particles && frame.svg) {
    wrap.classList.add('fx-particleaura');
    mountAvatarParticles(wrap, frame.particles);
    if (svgSlot) svgSlot.innerHTML = DRAGON_FRAME_SVG;
  } else if (frame.particles) {
    wrap.classList.add('fx-particleaura');
    mountAvatarParticles(wrap, frame.particles);
  } else if (frame.tpl) {
    wrap.classList.add('fx-' + frame.tpl);
    if (frame.c1) wrap.style.setProperty('--fx-c1', frame.c1);
    if (frame.c2) wrap.style.setProperty('--fx-c2', frame.c2);
    if (frame.emoji) wrap.style.setProperty('--fx-emoji', `"${frame.emoji}"`);
  } else {
    wrap.classList.add('frame-' + id);
    if (frame.svg && svgSlot) svgSlot.innerHTML = DRAGON_FRAME_SVG;
  }
}

function setCustomRingColor(hex) {
  G.customRingColor = hex;
  saveGame();
  const mini = document.getElementById('mini-ring_custom');
  if (mini) applyFrameToWrap(mini, 'ring_custom');
  if (previewedFrameId === 'ring_custom') applyFrameToWrap(document.getElementById('frame-preview-wrap'), 'ring_custom');
  if ((G.avatarFrame || 'none') === 'ring_custom') applyFrameToWrap(document.getElementById('profile-avatar-frame'), 'ring_custom');
}

function handleCustomFrameImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione uma imagem ou GIF válido.'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { notify('error', 'Arquivo muito grande (máx. 3MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    G.customFrameImage = ev.target.result;
    saveGame();
    applyAvatarFrame('custom_image', true);
    renderAvatarFrameShop();
    notify('success', '🖼️ Decoração personalizada aplicada ao seu perfil!');
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler o arquivo selecionado.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function applyAvatarFrame(id, persist = true) {
  applyFrameToWrap(document.getElementById('profile-avatar-frame'), id);
  if (persist && G && G.name) { G.avatarFrame = id; saveGame(); }
}

// ── ANIMAÇÃO DE BANNER: partículas reais via tsParticles (motor gratuito,
//    o mesmo tipo de biblioteca usado em landing pages profissionais) ──
let _bannerFxContainers = {};
function mountBannerFx(fxSlotId, animId) {
  const slot = document.getElementById(fxSlotId);
  if (!slot) return;
  const prev = _bannerFxContainers[fxSlotId];
  if (prev) { try { prev.destroy(); } catch (e) {} delete _bannerFxContainers[fxSlotId]; }
  slot.innerHTML = '';
  if (animId && animId.startsWith('lottie:')) {
    const entry = lottieEntryFor(animId);
    if (entry) {
      slot.innerHTML = renderAnimHtml(entry, 'position:absolute;inset:0;width:100%;height:100%');
    } else if (!_lottieCatalogCache) {
      getLottieCatalog().then(() => mountBannerFx(fxSlotId, animId));
    }
    return;
  }
  if (animId === 'dragao') { slot.innerHTML = BANNER_DRAGON_SVG; return; }
  const preset = PARTICLE_BANNER_PRESETS[animId];
  if (!preset) return; // animação puramente CSS (brilho, aurora, chuva, raios...), nada a montar aqui
  const mountId = fxSlotId + '-tsp';
  const mountDiv = document.createElement('div');
  mountDiv.id = mountId;
  mountDiv.style.cssText = 'position:absolute;inset:0;';
  slot.appendChild(mountDiv);
  if (typeof tsParticles === 'undefined') return; // sem CDN disponível — o slot fica só com o overlay CSS de fallback
  tsParticles.load(mountId, preset).then(container => { _bannerFxContainers[fxSlotId] = container; }).catch(() => {});
}
function applyBannerAnim(id, persist = true) {
  const banner = document.getElementById('profile-banner');
  if (banner) {
    BANNER_ANIMS.forEach(a => banner.classList.remove('anim-' + a.id));
    if (id && id !== 'none' && !id.startsWith('lottie:')) banner.classList.add('anim-' + id);
  }
  mountBannerFx('banner-fx-slot', id);
  if (persist && G && G.name) { G.bannerAnim = id; saveGame(); }
}

// ── AJUSTE DE POSIÇÃO/ZOOM DO BANNER ──
function getCurrentBannerCss() {
  if (G.banner) return `url('${G.banner.replace(/'/g, "\\'")}')`;
  const preset = BANNER_PRESETS.find(b => b.id === G.bannerPreset) || BANNER_PRESETS[0];
  return preset.css;
}
function openBannerVideoModal() {
  const isVideo = G.bannerType === 'video' && G.bannerVideo;
  showModal('🎬 Banner em Vídeo', `
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.5">
      Deixe seu banner animado com um vídeo em loop, igual ao Discord Nitro. Cole o link de um vídeo (recomendado — sem limite de tamanho) ou envie um arquivo curto do seu dispositivo.
    </div>
    <div class="form-group"><label class="form-label">Link do vídeo (.mp4)</label><input class="form-input" id="banner-video-url" placeholder="https://exemplo.com/meu-video.mp4" value="${(G.bannerVideo && !G.bannerVideo.startsWith('data:')) ? G.bannerVideo : ''}"></div>
    <div class="form-group">
      <input type="file" id="banner-video-file-input" accept="video/*" style="display:none" onchange="handleBannerVideoFileSelect(event)">
      <button class="btn" style="width:100%" onclick="document.getElementById('banner-video-file-input').click()">📁 Carregar vídeo do dispositivo (máx. 3MB)</button>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="saveBannerVideoUrl()">💾 Usar Vídeo como Banner</button>
      ${isVideo ? `<button class="btn btn-danger" onclick="removeBannerVideo()">✕ Remover</button>` : ''}
    </div>
  `);
}
function saveBannerVideoUrl() {
  const url = document.getElementById('banner-video-url').value.trim();
  if (!url) return notify('error', 'Cole o link de um vídeo.');
  G.bannerVideo = url;
  G.bannerType = 'video';
  saveGame();
  refreshProfile();
  closeModalDirect();
  notify('success', '🎬 Banner em vídeo aplicado!');
}
function handleBannerVideoFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { notify('error', 'Selecione um arquivo de vídeo válido.'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { notify('error', 'Vídeo muito grande (máx. 3MB) — o navegador guarda tudo localmente. Prefira colar um link de vídeo.'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    G.bannerVideo = ev.target.result;
    G.bannerType = 'video';
    saveGame();
    refreshProfile();
    closeModalDirect();
    notify('success', '🎬 Banner em vídeo aplicado!');
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler o vídeo selecionado.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}
function removeBannerVideo() {
  G.bannerType = 'image';
  G.bannerVideo = '';
  saveGame();
  refreshProfile();
  closeModalDirect();
  notify('info', 'Banner em vídeo removido — voltando pra imagem.');
}
function openBannerAdjustModal() {
  showModal('🖼️ Ajustar Banner', `
    <div style="margin-bottom:14px;border-radius:8px;overflow:hidden;position:relative;height:140px;background:var(--bg3)">
      <div id="banner-adjust-preview-img" style="position:absolute;inset:0"></div>
    </div>
    <div class="form-group"><label class="form-label">Posição Horizontal</label><input type="range" min="0" max="100" id="banner-adj-x" value="${G.bannerPosX ?? 50}" oninput="updateBannerAdjustPreview()"></div>
    <div class="form-group"><label class="form-label">Posição Vertical</label><input type="range" min="0" max="100" id="banner-adj-y" value="${G.bannerPosY ?? 50}" oninput="updateBannerAdjustPreview()"></div>
    <div class="form-group"><label class="form-label">Zoom</label><input type="range" min="100" max="250" id="banner-adj-zoom" value="${G.bannerZoom || 100}" oninput="updateBannerAdjustPreview()"></div>
    <button class="btn btn-primary" style="width:100%" onclick="saveBannerAdjust()">💾 Salvar Ajuste</button>
  `);
  updateBannerAdjustPreview();
}
function updateBannerAdjustPreview() {
  const img = document.getElementById('banner-adjust-preview-img');
  if (!img) return;
  const x = document.getElementById('banner-adj-x').value;
  const y = document.getElementById('banner-adj-y').value;
  const zoom = document.getElementById('banner-adj-zoom').value;
  img.style.background = getCurrentBannerCss();
  img.style.backgroundSize = zoom + '%';
  img.style.backgroundPosition = x + '% ' + y + '%';
  img.style.backgroundRepeat = 'no-repeat';
}
function saveBannerAdjust() {
  G.bannerPosX = parseInt(document.getElementById('banner-adj-x').value);
  G.bannerPosY = parseInt(document.getElementById('banner-adj-y').value);
  G.bannerZoom = parseInt(document.getElementById('banner-adj-zoom').value);
  saveGame();
  refreshProfile();
  closeModalDirect();
  notify('success', '🖼️ Banner ajustado!');
}

// ── LINKS DO PERFIL (múltiplas plataformas) ──
function renderProfileLinks() {
  const el = document.getElementById('profile-link-row');
  if (!el) return;
  G.profileLinks = G.profileLinks || {};
  const filled = LINK_PLATFORMS.filter(p => G.profileLinks[p.id]);
  if (!filled.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  el.style.flexWrap = 'wrap';
  el.style.gap = '8px';
  el.innerHTML = filled.map(p => {
    const value = G.profileLinks[p.id];
    const href = buildLinkHref(p, value);
    if (href) return `<a class="social-pill" href="${href}" target="_blank" rel="noopener">${p.icon} ${escapeHtml(p.name)}</a>`;
    return `<span class="social-pill" style="cursor:default">${p.icon} ${escapeHtml(value)}</span>`;
  }).join('');
}

// ── FUNDO PERSONALIZADO (foto da galeria) ──
function applyCustomBgImage(dataUrl, persist = true) {
  document.body.style.backgroundImage = `url("${dataUrl}")`;
  document.body.classList.add('custom-bg-image');
  if (persist && G && G.name) { G.customBgImage = dataUrl; saveGame(); }
}
function removeCustomBgImage(persist = true) {
  document.body.style.backgroundImage = '';
  document.body.classList.remove('custom-bg-image');
  const btn = document.getElementById('cfg-bg-image-remove');
  if (btn) btn.style.display = 'none';
  if (persist && G && G.name) { G.customBgImage = ''; saveGame(); }
  if (persist) notify('info', 'Imagem de fundo removida.');
}
function handleBgImageFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione um arquivo de imagem válido.'); e.target.value = ''; return; }
  if (file.size > 4 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 4MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    applyCustomBgImage(ev.target.result, true);
    const btn = document.getElementById('cfg-bg-image-remove');
    if (btn) btn.style.display = 'inline-block';
    notify('success', '🖼️ Fundo do app atualizado com sua foto!');
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler a imagem selecionada.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function updateAvatarPreviewEl(imgId, removeBtnId) {
  const img = document.getElementById(imgId);
  const removeBtn = document.getElementById(removeBtnId);
  if (!img) return;
  if (G.avatarPhoto) { img.src = G.avatarPhoto; img.style.display = 'block'; if (removeBtn) removeBtn.style.display = 'inline-block'; }
  else { img.style.display = 'none'; if (removeBtn) removeBtn.style.display = 'none'; }
}

function handleAvatarFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione um arquivo de imagem válido.'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 3MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    G.avatarPhoto = ev.target.result;
    saveGame();
    updateHeader();
    refreshProfile();
    updateAvatarPreviewEl('cfg-avatar-preview', 'cfg-avatar-remove');
    updateAvatarPreviewEl('edit-avatar-preview', 'edit-avatar-remove');
    notify('success', '📷 Foto de perfil atualizada!');
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler a imagem selecionada.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function removeAvatarPhoto() {
  G.avatarPhoto = '';
  saveGame();
  updateHeader();
  refreshProfile();
  updateAvatarPreviewEl('cfg-avatar-preview', 'cfg-avatar-remove');
  updateAvatarPreviewEl('edit-avatar-preview', 'edit-avatar-remove');
  notify('info', 'Foto de perfil removida — usando avatar de emoji.');
}

async function logout() {
  if (await confirmDialog('Deseja sair? Seu progresso está salvo.', { confirmText: 'Sair' })) {
    stopTimers();
    stopPanelPolling();
    teardownNotifications();
    teardownCallSignaling();
    if (callState.active) teardownCall();
    currentUserId = null;
    try { await supabase.auth.signOut(); } catch (e) { console.error('Erro ao sair do Supabase', e); }
    document.getElementById('header').style.display = 'none';
    document.getElementById('app-body').style.display = 'none';
    document.getElementById('register-screen').classList.remove('open');
    document.getElementById('banned-screen').classList.remove('open');
    G = {};
    document.getElementById('gate-admin-box').style.display = 'none';
    document.getElementById('gate-select-box').style.display = 'none';
    document.getElementById('access-gate').classList.add('hidden');
    openLoginModal();
  }
}

async function resetGame() {
  if (await confirmDialog('Isso apagará <b>TODO</b> o seu progresso, permanentemente.', { danger: true, title: 'Tem certeza?', confirmText: 'Apagar tudo' })) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data?.session;
      if (session && session.user) {
        const { error } = await supabase.from('saves').delete().eq('id', session.user.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Erro ao remover save remoto', e);
      notify('error', 'Não foi possível apagar seu progresso agora — nada foi perdido. Tente de novo em instantes.');
      return;
    }
    location.reload();
  }
}

// ── NAVIGATION ─────────────────────────────
// Enquanto o painel de Amigos ou de Batalha (PvP) estiver aberto, busca
// solicitações/desafios novos periodicamente — os dois dependem de
// outra conta agir (aceitar, desafiar) então não têm como "empurrar"
// a atualização sozinhos sem sair do escopo (realtime completo).
// ── Animações (GSAP) — entrada de painel e efeitos em grade ──────────
// Biblioteca 100% gratuita, carregada via CDN. Se por algum motivo não
// carregar (ex: sem internet num teste local), o app continua funcionando
// normalmente — só não roda a animação extra.
function gsapPanelEnter(el) {
  if (!el || typeof gsap === 'undefined') return;
  gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
}
function gsapStagger(selector, root) {
  if (typeof gsap === 'undefined') return;
  const items = (root || document).querySelectorAll(selector);
  if (!items.length) return;
  gsap.fromTo(items, { opacity: 0, y: 10, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.035, ease: 'back.out(1.6)' });
}

let panelPollTimer = null;
function stopPanelPolling() { if (panelPollTimer) { clearInterval(panelPollTimer); panelPollTimer = null; } }
function startPanelPolling(panel) {
  stopPanelPolling();
  if (panel === 'amigos') panelPollTimer = setInterval(renderFriendsPanel, 6000);
  else if (panel === 'batalha') panelPollTimer = setInterval(renderPvpChallenges, 6000);
  else if (panel === 'conversas') panelPollTimer = setInterval(() => { discoverIncomingDMs(); pollAllFriendChats(); discoverMyGroups(); pollAllGroupChats(); pollCurrentChannel(); }, 6000);
}

// ══════════════════════════════════════════
//   NAV INFERIOR MOBILE — 6 categorias + folha deslizante
// ══════════════════════════════════════════

let _mobileCatSheetOpen = null;
let _mobileCatSheetOutsideBound = false;
function openMobileCategorySheet(cat) {
  if (_mobileCatSheetOpen === cat) { closeMobileCategorySheet(); return; }
  _mobileCatSheetOpen = cat;
  document.querySelectorAll('.mobile-cat-item').forEach(el => el.classList.toggle('active', el.dataset.cat === cat));
  const sheet = document.getElementById('mobile-category-sheet');
  const items = MOBILE_NAV_CATEGORIES[cat] || [];
  sheet.innerHTML = items.map(it => `<div class="mobile-sheet-item" onclick="selectMobileNavItem('${it.p}')"><span class="nav-icon" data-icon="${it.i}"></span><span>${it.l}</span></div>`).join('');
  sheet.classList.add('open');
  renderNavIcons(sheet);
  if (!_mobileCatSheetOutsideBound) {
    _mobileCatSheetOutsideBound = true;
    document.addEventListener('click', (ev) => {
      if (!_mobileCatSheetOpen) return;
      const sheetEl = document.getElementById('mobile-category-sheet');
      const barEl = document.getElementById('mobile-bottom-nav');
      if (sheetEl && barEl && !sheetEl.contains(ev.target) && !barEl.contains(ev.target)) closeMobileCategorySheet();
    });
  }
}
function closeMobileCategorySheet() {
  _mobileCatSheetOpen = null;
  document.getElementById('mobile-category-sheet').classList.remove('open');
}
function selectMobileNavItem(panel) {
  navigate(panel);
  closeMobileCategorySheet();
}

function navigate(panel) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
  const el = document.getElementById('panel-' + panel);
  if (el) { el.classList.add('active'); gsapPanelEnter(el); }
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${panel}'`)) {
      n.classList.add('active');
      n.setAttribute('aria-current', 'page');
      const section = n.closest('.sidebar-section');
      if (section) section.classList.remove('collapsed');
    }
  });
  const activeCat = MOBILE_PANEL_TO_CAT[panel];
  if (activeCat) document.querySelectorAll('.mobile-cat-item').forEach(el => {
    const isActive = el.dataset.cat === activeCat;
    el.classList.toggle('active', isActive);
    if (isActive) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  refreshPanel(panel);
  startPanelPolling(panel);
  if (document.body.classList.contains('view-mobile')) document.body.classList.remove('sidebar-open');
}

function toggleSidebarSection(titleEl) {
  const section = titleEl.closest('.sidebar-section');
  if (section) section.classList.toggle('collapsed');
}

function refreshPanel(p) {
  switch(p) {
    case 'inicio': refreshDashboard(); break;
    case 'perfil': refreshProfile(); break;
    case 'meupersonagem': renderCharacterSheet(); break;
    case 'inventario': renderInventory(); break;
    case 'banco': refreshBank(); break;
    case 'mercado': renderShop(); break;
    case 'casas': renderHouses(); break;
    case 'empresas': renderCompanies(); break;
    case 'empregos': renderJobs(); break;
    case 'batalha': updateBattleCooldown(); renderPvpChallenges(); break;
    case 'amigos': renderFriendsPanel(); break;
    case 'missoes': renderQuests(); break;
    case 'guildas': renderGuilds(); break;
    case 'boss': renderBosses(); break;
    case 'mapa': renderMap(); break;
    case 'ranking': renderRanking(); break;
    case 'conquistas': renderAchievements(); break;
    case 'galeria': renderGallery(); break;
    case 'eventos': renderEvents(); break;
    case 'config': renderConfig(); break;
    case 'feedback': renderFeedback(); break;
    case 'conversas': renderConversas(); discoverIncomingDMs(); pollAllFriendChats(); discoverMyGroups(); pollAllGroupChats(); break;
    case 'iacompanheira': renderAiCompanion(); break;
    case 'publicacoes': renderPublicacoes(); break;
    case 'musicas': renderMusicPanel(); break;
    case 'jogos': renderGamesHub(); break;
    case 'crystar': renderCrystarPanel(); break;
  }
}

// ── REFRESH ALL ────────────────────────────
function refreshAll() {
  updateHeader();
  refreshDashboard();
  checkAchievements();
  renderConversas();
  renderActivityRail();
}


function checkDailyLoginBonus() {
  const today = new Date().toDateString();
  if (G.lastDailyBonus === today) return;
  const bonus = 50 + (G.level || 1) * 5;
  G.wallet += bonus;
  G.totalEarned = (G.totalEarned || 0) + bonus;
  G.lastDailyBonus = today;
  saveGame();
  updateHeader();
  addToFeed(`🎁 Bônus diário: +${bonus} Cry`);
  notify('success', `🎁 Bônus diário: +${bonus} Cry por voltar hoje!`, 5000);
}

function updateHeader() {
  if (!G.name) return;
  document.getElementById('user-name').textContent = G.name;
  const hdrAv = document.getElementById('hdr-avatar');
  hdrAv.innerHTML = G.avatarPhoto ? `<img src="${G.avatarPhoto}" alt="Seu avatar">` : (G.avatar || '⚔️');
  document.getElementById('hdr-cry').textContent = `✦ ${formatCry(G.wallet)} Cry`;
  const crEl = document.getElementById('hdr-crystals');
  if (crEl) crEl.textContent = `💎 ${G.crystals || 0}`;
  document.getElementById('hdr-level').textContent = `Nv.${G.level}`;
}

async function renderStoriesBar() {
  const wrap = document.getElementById('stories-bar-wrap');
  const bar = document.getElementById('stories-bar');
  if (!wrap || !bar || !currentUserId) return;
  let friendIds = [];
  try {
    const { data: friendRows } = await supabase.from('friend_requests').select('from_id,to_id')
      .eq('status', 'accepted').or(`from_id.eq.${currentUserId},to_id.eq.${currentUserId}`);
    friendIds = (friendRows || []).map(r => r.from_id === currentUserId ? r.to_id : r.from_id);
  } catch (e) { console.error(e); }

  let friendStories = [];
  if (friendIds.length) {
    try {
      const { data } = await supabase.from('stories').select('user_id,close_friends_only,created_at')
        .in('user_id', friendIds).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      const seen = new Set();
      friendStories = (data || []).filter(s => { if (seen.has(s.user_id)) return false; seen.add(s.user_id); return true; });
    } catch (e) { console.error(e); }
  }

  if (!friendStories.length && !myStoryCache) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  let profMap = {};
  if (friendStories.length) {
    try {
      const { data: profs } = await supabase.from('profiles').select('id,name,avatar,avatar_photo').in('id', friendStories.map(s => s.user_id));
      profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
    } catch (e) {}
  }

  const myAvatarInner = G.avatarPhoto ? `<img src="${G.avatarPhoto}" alt="Seu avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (G.avatar || '⚔️');
  let html = `
    <div class="story-bar-item" onclick="handleMyAvatarClick()">
      <div class="story-ring-wrap${myStoryCache ? ' has-story' : ''}${myStoryCache?.close_friends_only ? ' close-friends-story' : ''}" style="width:56px;height:56px">
        <div class="user-avatar" style="width:56px;height:56px;font-size:22px">${myAvatarInner}</div>
      </div>
      <div class="story-bar-name">${myStoryCache ? 'Seu recado' : 'Adicionar'}</div>
    </div>`;
  html += friendStories.map(s => {
    const p = profMap[s.user_id] || {};
    const avatarInner = p.avatar_photo ? `<img src="${p.avatar_photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (p.avatar || '⚔️');
    return `
      <div class="story-bar-item" onclick="viewUserStory('${s.user_id}', ${JSON.stringify(p.name || '?').replace(/"/g, '&quot;')})">
        <div class="story-ring-wrap has-story${s.close_friends_only ? ' close-friends-story' : ''}" style="width:56px;height:56px">
          <div class="user-avatar" style="width:56px;height:56px;font-size:22px">${avatarInner}</div>
        </div>
        <div class="story-bar-name">${escapeHtml((p.name || '?').split(' ')[0])}</div>
      </div>`;
  }).join('');
  bar.innerHTML = html;
}

function refreshDashboard() {
  if (!G.name) return;
  const greetEl = document.getElementById('dashboard-greeting');
  if (greetEl) greetEl.textContent = `${getGreeting()}, ${G.name}!`;
  renderStoriesBar();
  const motd = getMotd();
  const motdEl = document.getElementById('motd-banner');
  if (motdEl) {
    if (motd) {
      motdEl.style.display = 'flex';
      motdEl.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--gold3);border-left:3px solid var(--gold);border-radius:6px;padding:10px 14px;font-size:13px;color:var(--text)';
      motdEl.innerHTML = `<span style="font-size:18px">📢</span><span>${escapeHtml(motd)}</span>`;
    } else {
      motdEl.style.display = 'none';
    }
  }
  document.getElementById('stat-level').textContent = G.level;
  document.getElementById('stat-wallet').textContent = formatCry(G.wallet);
  document.getElementById('stat-bank').textContent = formatCry(G.bank);
  document.getElementById('stat-energy').textContent = G.energy + '%';
  document.getElementById('stat-hunger-label').textContent = G.hunger > 50 ? 'Alimentado' : G.hunger > 20 ? 'Com Fome' : '⚠️ Faminto!';

  setBar('bar-hp', G.hp, G.maxHp); setVal('val-hp', G.hp, G.maxHp);
  setBar('bar-mana', G.mana, G.maxMana); setVal('val-mana', G.mana, G.maxMana);
  setBar('bar-stamina', G.stamina, G.maxStamina); setVal('val-stamina', G.stamina, G.maxStamina);
  setBar('bar-xp', G.xp, G.xpToNext); setVal('val-xp', G.xp, G.xpToNext);
  setBar('bar-hunger', G.hunger, G.maxHunger); setVal('val-hunger', G.hunger, G.maxHunger);

  const rank = getRank();
  document.getElementById('char-rank-badge').textContent = rank.icon + ' ' + rank.name;
  document.getElementById('char-rank-badge').className = 'rank-display ' + rank.cls;
  const cd = CLASSES[G.class] || CLASSES.guerreiro;
  document.getElementById('char-class-badge').textContent = cd.icon + ' ' + G.class.charAt(0).toUpperCase() + G.class.slice(1);
  document.getElementById('char-guild-badge').textContent = (myGuildMembership && guildsCache.find(g=>g.id===myGuildMembership.guild_id)?.name) || 'Sem Guilda';

  const alertBar = document.getElementById('alert-bar');
  if (G.hunger <= 20) {
    alertBar.style.display = 'block';
    alertBar.textContent = '⚠️ Você está com fome crítica! Coma algo antes de trabalhar ou batalhar.';
  } else {
    alertBar.style.display = 'none';
  }

  const feed = document.getElementById('activity-feed');
  feed.innerHTML = (G.activityFeed || []).slice(-8).reverse().map((f, i) => {
    return `<div class="feed-item"><span>${f}</span><span class="feed-time" style="margin-left:auto">${i === 0 ? 'agora' : `${i*2}min`}</span></div>`;
  }).join('');
}

function setBar(id, cur, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.max(0, Math.min(100, (cur/max)*100)) + '%';
}
function setVal(id, cur, max) {
  const el = document.getElementById(id);
  if (el) el.textContent = `${Math.round(cur)}/${Math.round(max)}`;
}

// ── RANK ───────────────────────────────────
function getRank() {
  let r = RANKS[0];
  for (const rk of RANKS) { if (G.level >= rk.min) r = rk; }
  return r;
}

// ── PROFILE ────────────────────────────────
function refreshProfile() {
  loadOwnFollowCounts();
  document.getElementById('profile-name').textContent = G.name;
  const cd = CLASSES[G.class] || CLASSES.guerreiro;
  const avEl = document.getElementById('profile-avatar-icon');
  avEl.innerHTML = G.avatarPhoto ? `<img src="${G.avatarPhoto}" alt="Seu avatar">` : (G.avatar || cd.icon);
  document.getElementById('profile-title').textContent = G.customTitle || G.profileTitle;

  const bannerImg = document.getElementById('profile-banner-img');
  const bannerVideo = document.getElementById('profile-banner-video');
  if (G.bannerType === 'video' && G.bannerVideo) {
    bannerVideo.src = G.bannerVideo;
    bannerVideo.style.display = 'block';
    bannerImg.style.display = 'none';
    bannerVideo.style.objectPosition = (G.bannerPosX ?? 50) + '% ' + (G.bannerPosY ?? 50) + '%';
    bannerVideo.style.transform = `scale(${(G.bannerZoom || 100) / 100})`;
  } else {
    bannerVideo.style.display = 'none';
    bannerVideo.removeAttribute('src');
    bannerImg.style.display = 'block';
    if (G.banner) {
      bannerImg.style.background = `url('${G.banner.replace(/'/g,"\\'")}')`;
    } else {
      const preset = BANNER_PRESETS.find(b => b.id === G.bannerPreset) || BANNER_PRESETS[0];
      bannerImg.style.background = preset.css;
    }
    bannerImg.style.backgroundSize = (G.bannerZoom || 100) + '%';
    bannerImg.style.backgroundPosition = (G.bannerPosX ?? 50) + '% ' + (G.bannerPosY ?? 50) + '%';
    bannerImg.style.backgroundRepeat = 'no-repeat';
  }
  applyBannerAnim(G.bannerAnim || 'none', false);
  applyAvatarFrame(G.avatarFrame || 'none', false);

  const accent = G.accent || '#d4a017';
  document.getElementById('panel-perfil').style.setProperty('--accent', accent);

  const bioEl = document.getElementById('profile-bio');
  if (G.bio) { bioEl.style.display = 'block'; bioEl.textContent = G.bio; }
  else { bioEl.style.display = 'none'; }

  renderProfileLinks();

  const rank = getRank();
  document.getElementById('profile-rank-badge').textContent = rank.icon + ' ' + rank.name;
  document.getElementById('profile-rank-badge').className = 'rank-display ' + rank.cls;
  document.getElementById('profile-class-disp').textContent = cd.icon + ' ' + G.class.charAt(0).toUpperCase() + G.class.slice(1);
  document.getElementById('profile-age-badge').textContent = G.age + ' anos';
  document.getElementById('p-battles').textContent = G.battles;
  document.getElementById('p-wins').textContent = G.wins;
  document.getElementById('p-losses').textContent = G.losses;
  document.getElementById('p-quests').textContent = G.questsCompleted;
  document.getElementById('attr-str').textContent = G.str;
  document.getElementById('attr-dex').textContent = G.dex;
  document.getElementById('attr-int').textContent = G.int;
  document.getElementById('attr-vit').textContent = G.vit;
  document.getElementById('attr-wis').textContent = G.wis;
  ['str','dex','int','vit','wis'].forEach(k => {
    const fillEl = document.getElementById('attr-' + k + '-fill');
    if (fillEl) fillEl.style.width = Math.min(100, Math.max(4, (G[k] / 40) * 100)) + '%';
  });
  document.getElementById('p-wallet').textContent = G.wallet + ' Cry';
  document.getElementById('p-bank').textContent = G.bank + ' Cry';
  document.getElementById('p-earned').textContent = (G.totalEarned || 0) + ' Cry';
  document.getElementById('p-houses').textContent = (G.houses || []).length;
  document.getElementById('p-companies').textContent = (G.companies || []).length;
  document.getElementById('eq-weapon').textContent = G.equipped.weapon ? SHOP_ITEMS.find(i => i.id === G.equipped.weapon)?.name || '?' : 'Nenhuma';
  document.getElementById('eq-shield').textContent = G.equipped.shield ? SHOP_ITEMS.find(i => i.id === G.equipped.shield)?.name || '?' : 'Nenhum';
  document.getElementById('eq-armor').textContent = G.equipped.armor ? SHOP_ITEMS.find(i => i.id === G.equipped.armor)?.name || '?' : 'Nenhuma';
  document.getElementById('eq-amulet').textContent = G.equipped.amulet ? SHOP_ITEMS.find(i => i.id === G.equipped.amulet)?.name || '?' : 'Nenhum';
  document.getElementById('eq-helmet').textContent = G.equipped.helmet ? SHOP_ITEMS.find(i => i.id === G.equipped.helmet)?.name || '?' : 'Nenhum';
  [['weapon','eq-weapon'],['shield','eq-shield'],['armor','eq-armor'],['amulet','eq-amulet'],['helmet','eq-helmet']].forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('empty', !G.equipped[k]);
  });
  document.getElementById('profile-history').textContent = (G.activityFeed || []).slice(-3).reverse().join('\n') || 'Sem atividade';
}

function openEditProfile() {
  showModal('✏️ Personalizar Perfil', `
    <div class="form-group"><label class="form-label">Título Personalizado</label><input class="form-input" id="edit-title" value="${G.customTitle || ''}" placeholder="Ex: O Conquistador"></div>
    <div class="form-group"><label class="form-label">Bio / Sobre mim</label><textarea class="form-input" id="edit-bio" rows="3" maxlength="180" placeholder="Conte um pouco sobre seu aventureiro...">${G.bio || ''}</textarea></div>

    <div style="margin-bottom:12px">
      <div class="form-label" style="margin-bottom:6px">Avatar</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <img id="edit-avatar-preview" class="avatar-photo-preview" style="display:none" alt="Prévia do avatar">
        <button class="btn btn-sm" onclick="document.getElementById('avatar-file-input').click()">📷 Carregar foto da galeria</button>
        <button class="btn btn-sm btn-danger" id="edit-avatar-remove" style="display:none" onclick="removeAvatarPhoto()">✕ Remover</button>
      </div>
      <div class="form-label" style="margin-bottom:6px">Ou escolha um emoji</div>
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
        ${AVATARS.map(a => `<div onclick="selectAvatar('${a}')" style="text-align:center;font-size:20px;cursor:pointer;padding:6px;border-radius:4px;border:1px solid ${G.avatar===a?'var(--gold)':'var(--border)'};background:var(--bg3)" id="av-${a}">${a}</div>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div class="form-label" style="margin-bottom:6px">Banner do Perfil — cor predefinida</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${BANNER_PRESETS.map(b => `<div class="banner-preset ${((!G.banner)&&(G.bannerPreset===b.id || (!G.bannerPreset&&b.id==='roxo')))?'selected':''}" id="bp-${b.id}" style="background:${b.css}" onclick="selectBanner('${b.id}')"></div>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Ou cole a URL de uma imagem para o banner</label><input class="form-input" id="edit-banner-url" value="${G.banner || ''}" placeholder="https://exemplo.com/minha-imagem.jpg"></div>
    <div class="form-group">
      <button class="btn" style="width:100%" onclick="document.getElementById('banner-file-input').click()">📁 Carregar imagem da galeria ou do computador</button>
    </div>

    <div style="margin-bottom:16px">
      <div class="form-label" style="margin-bottom:6px">Cor de Destaque</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${ACCENT_COLORS.map(c => `<div class="accent-swatch ${G.accent===c?'selected':''}" id="ac-${c.replace('#','')}" style="background:${c}" onclick="selectAccent('${c}')"></div>`).join('')}
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%" onclick="saveProfile()">💾 Salvar Perfil</button>
  `);
  updateAvatarPreviewEl('edit-avatar-preview', 'edit-avatar-remove');
}

function selectAvatar(a) {
  document.querySelectorAll('[id^="av-"]').forEach(el => el.style.borderColor = 'var(--border)');
  const el = document.getElementById('av-' + a);
  if (el) el.style.borderColor = 'var(--gold)';
  G._tempAvatar = a;
}

function selectBanner(id) {
  document.querySelectorAll('.banner-preset').forEach(el => el.classList.remove('selected'));
  document.getElementById('bp-' + id)?.classList.add('selected');
  G._tempBannerPreset = id;
  const urlInput = document.getElementById('edit-banner-url');
  if (urlInput) urlInput.value = '';
  G._tempBannerCleared = true;
}

function selectAccent(c) {
  document.querySelectorAll('.accent-swatch').forEach(el => el.classList.remove('selected'));
  document.getElementById('ac-' + c.replace('#','')).classList.add('selected');
  G._tempAccent = c;
  applyAccentColor(c, false);
}

function saveProfile() {
  const title = document.getElementById('edit-title')?.value.trim();
  const bio = document.getElementById('edit-bio')?.value.trim();
  const bannerUrl = document.getElementById('edit-banner-url')?.value.trim();
  if (title !== undefined) G.customTitle = title;
  if (bio !== undefined) G.bio = bio;
  if (G._tempAvatar) G.avatar = G._tempAvatar;
  if (G._tempAccent) applyAccentColor(G._tempAccent, true);
  if (bannerUrl) { G.banner = bannerUrl; }
  else if (G._tempBannerCleared) { G.banner = ''; }
  if (G._tempBannerPreset) G.bannerPreset = G._tempBannerPreset;
  delete G._tempAvatar; delete G._tempAccent; delete G._tempBannerPreset; delete G._tempBannerCleared;
  saveGame(); updateHeader(); refreshProfile();
  closeModalDirect();
  notify('success', '✨ Perfil atualizado!');
}

// ── INVENTORY ──────────────────────────────
function renderInventory() {
  const inv = G.inventory || [];
  renderInvGrid('inventory-grid', inv);
  renderInvGrid('inv-weapons-grid', inv.filter(i => i.type === 'weapon' || i.type === 'shield' || i.type === 'armor' || i.type === 'helmet' || i.type === 'amulet'));
  renderInvGrid('inv-armor-grid', inv.filter(i => i.type === 'armor' || i.type === 'shield' || i.type === 'helmet'));
  renderInvGrid('inv-cons-grid', inv.filter(i => i.type === 'food' || i.type === 'potion'));
  renderInvGrid('inv-mat-grid', inv.filter(i => i.type === 'material'));
}

function renderInvGrid(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center;grid-column:1/-1">Vazio</div>'; return; }
  el.innerHTML = items.map(item => {
    const isEq = Object.values(G.equipped).includes(item.id);
    return `<div class="inv-item item-rarity-${item.rarity||'common'} ${isEq?'equipped':''}" onclick="useItem('${item.id}')" title="${item.desc||''}">
      <span class="item-icon">${item.icon}</span>
      <div class="item-name">${item.name}</div>
      ${item.qty > 1 ? `<div class="item-qty">x${item.qty}</div>` : ''}
    </div>`;
  }).join('');
}

function useItem(itemId) {
  const idx = G.inventory.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  const item = G.inventory[idx];
  if (item.type === 'food') {
    G.hunger = Math.min(G.maxHunger, G.hunger + item.power);
    G.energy = Math.min(100, Math.round(G.hunger));
    removeFromInventory(itemId, 1);
    addToFeed(`🍽️ Comeu ${item.name} (+${item.power} fome)`);
    notify('success', `🍽️ +${item.power} Fome!`);
  } else if (item.type === 'potion') {
    if (item.id.includes('hp')) { G.hp = Math.min(G.maxHp, G.hp + item.power); notify('success', `+${item.power} HP`); }
    else if (item.id.includes('mana')) { G.mana = Math.min(G.maxMana, G.mana + item.power); notify('success', `+${item.power} Mana`); }
    else if (item.id.includes('stamina')) { G.stamina = Math.min(G.maxStamina, G.stamina + item.power); notify('success', `+${item.power} Stamina`); }
    else if (item.id === 'pergaminho') { gainXP(item.power); notify('success', `+${item.power} XP!`); }
    removeFromInventory(itemId, 1);
    addToFeed(`🧪 Usou ${item.name}`);
  } else if (['weapon','shield','armor','amulet','helmet'].includes(item.type)) {
    const slot = item.type;
    if (G.equipped[slot] === item.id) { G.equipped[slot] = null; notify('info', `${item.name} desequipado`); }
    else { G.equipped[slot] = item.id; notify('success', `${item.name} equipado!`); }
  }
  saveGame(); renderInventory(); refreshDashboard();
}

function addToInventory(item, qty = 1) {
  const existing = G.inventory.find(i => i.id === item.id);
  if (existing) { existing.qty = (existing.qty || 1) + qty; }
  else { G.inventory.push({ ...item, qty }); }
  G.itemsCollected = (G.itemsCollected || 0) + qty;
}

function removeFromInventory(itemId, qty = 1) {
  const idx = G.inventory.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  G.inventory[idx].qty = (G.inventory[idx].qty || 1) - qty;
  if (G.inventory[idx].qty <= 0) G.inventory.splice(idx, 1);
}

// ── BANK ───────────────────────────────────
function pulseEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

function refreshBank() {
  document.getElementById('bank-wallet').textContent = G.wallet;
  document.getElementById('bank-balance').textContent = G.bank;
  document.getElementById('bank-total').textContent = G.wallet + G.bank;
  const h = document.getElementById('bank-history');
  const hist = (G.bankHistory || []).slice(-15).reverse();
  if (!hist.length) { h.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Sem movimentações</div>'; return; }
  h.innerHTML = hist.map(t => {
    const sign = t.amount > 0 ? '+' : '';
    const col = t.amount > 0 ? 'var(--green)' : 'var(--red)';
    return `<div class="bank-history-row">
      <span style="color:var(--text2)"><span style="color:${col};font-size:10px">${t.amount > 0 ? '▲' : '▼'}</span> ${t.desc}</span>
      <span style="color:${col};font-family:'JetBrains Mono',monospace;font-weight:600">${sign}${t.amount} Cry</span>
    </div>`;
  }).join('');
}

function bankDeposit() {
  const amt = parseInt(document.getElementById('dep-amount').value);
  if (!amt || amt <= 0) return notify('error', 'Valor inválido');
  if (amt > G.wallet) return notify('error', 'Cry insuficiente na carteira');
  G.wallet -= amt; G.bank += amt;
  addBankHistory('Depósito', amt);
  updateQuestProgress('bank', amt);
  saveGame(); refreshBank(); updateHeader(); renderQuests();
  pulseEl('bank-wallet'); pulseEl('bank-balance');
  notify('success', `Depositou ${amt} Cry no banco!`);
  sysLog(`${G.name} depositou ${amt} Cry`);
}

function bankWithdraw() {
  const amt = parseInt(document.getElementById('wit-amount').value);
  if (!amt || amt <= 0) return notify('error', 'Valor inválido');
  if (amt > G.bank) return notify('error', 'Saldo bancário insuficiente');
  G.bank -= amt; G.wallet += amt;
  addBankHistory('Saque', amt);
  saveGame(); refreshBank(); updateHeader();
  pulseEl('bank-wallet'); pulseEl('bank-balance');
  notify('success', `Sacou ${amt} Cry!`);
}

// PIX e Transferência são, na prática, a mesma coisa (só duas abas
// diferentes na UI) — as duas chamam esta função real, que usa a
// função send_pix() do banco (ver social-setup.sql). O saldo é
// conferido e movido no servidor, não no navegador: antes disso, o
// Cry só sumia da própria carteira e nunca chegava em ninguém.
async function sendMoneyTo(targetInputId, amountInputId, label) {
  const target = _stripAt(document.getElementById(targetInputId).value);
  const amt = parseInt(document.getElementById(amountInputId).value);
  if (!target) return notify('error', 'Informe o destinatário');
  if (!amt || amt <= 0) return notify('error', 'Valor inválido');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  if (target.toLowerCase() === (G.name || '').toLowerCase()) return notify('error', 'Você não pode enviar Cry para você mesmo!');

  try {
    const profile = await findProfileByNameOrUsername(target, 'id,name');
    if (!profile) { notify('error', `Nenhum jogador chamado "${target}" foi encontrado.`); return; }

    const { data, error } = await supabase.rpc('send_pix', { p_to_id: profile.id, p_amount: amt, p_note: label });
    if (error) throw error;

    if (data && typeof data.newWallet === 'number') G.wallet = data.newWallet;
    else G.wallet -= amt; // fallback improvável, só por segurança visual

    addBankHistory(`${label} para ${profile.name}`, -amt);
    saveGame(); refreshBank(); updateHeader();
    pulseEl('bank-wallet');
    notify('success', `⚡ ${amt} Cry enviados para ${profile.name}!`);
    addToFeed(`💸 Enviou ${label} de ${amt} Cry para ${profile.name}`);
    sysLog(`${G.name} → ${label} ${amt} Cry → ${profile.name}`);
    document.getElementById(targetInputId).value = '';
    document.getElementById(amountInputId).value = '';
  } catch (e) {
    console.error(`Erro ao enviar ${label}`, e);
    notify('error', `Não foi possível enviar: ${e.message || 'erro desconhecido'}`);
  }
}
function sendPix() { sendMoneyTo('pix-target', 'pix-amount', 'PIX'); }
function sendTransfer() { sendMoneyTo('trans-target', 'trans-amount', 'Transferência'); }

function addBankHistory(desc, amount) {
  G.bankHistory = G.bankHistory || [];
  G.bankHistory.push({ desc, amount, ts: Date.now() });
  if (G.bankHistory.length > 50) G.bankHistory = G.bankHistory.slice(-50);
}

// ── SHOP ───────────────────────────────────
function renderShop() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = SHOP_ITEMS.filter(i => !['food'].includes(i.type) || true).map(item => `
    <div class="market-item">
      <span style="font-size:22px">${item.icon}</span>
      <div>
        <div style="font-size:13px;color:var(--text)">${item.name}</div>
        <div style="font-size:11px;color:var(--text2)">${item.desc} • <span style="color:${rarityColor(item.rarity)}">${item.rarity}</span></div>
      </div>
      <div class="market-price">${item.price} ✦</div>
      <button class="btn btn-sm btn-primary" onclick="buyItem('${item.id}')">Comprar</button>
    </div>
  `).join('');

  const sellGrid = document.getElementById('inv-for-sale');
  if (!G.inventory.length) { sellGrid.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:10px;text-align:center">Inventário vazio</div>'; return; }
  sellGrid.innerHTML = '<div style="font-family:\'Cinzel\',serif;font-size:12px;color:var(--gold);margin-bottom:8px">Itens para vender:</div>' +
    G.inventory.map(item => `
    <div class="market-item" style="margin-bottom:6px">
      <span style="font-size:20px">${item.icon}</span>
      <div><div style="font-size:13px">${item.name}</div><div style="font-size:11px;color:var(--text2)">x${item.qty||1}</div></div>
      <div class="market-price">${Math.floor((SHOP_ITEMS.find(s=>s.id===item.id)?.price||10)*0.5)} ✦</div>
      <button class="btn btn-sm btn-danger" onclick="sellItem('${item.id}')">Vender</button>
    </div>
  `).join('');
}


function buyItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (G.wallet < item.price) return notify('error', `Cry insuficiente! Precisa de ${item.price} Cry`);
  G.wallet -= item.price;
  addToInventory(item);
  G.itemsBought = (G.itemsBought || 0) + 1;
  addToFeed(`🛒 Comprou ${item.icon} ${item.name} por ${item.price} Cry`);
  updateQuestProgress('buy', 1);
  saveGame(); updateHeader();
  notify('success', `${item.icon} ${item.name} adquirido!`);
  sysLog(`${G.name} comprou ${item.name}`);
}

function buyQuick(id, icon, name, price, type) {
  const item = SHOP_ITEMS.find(i => i.id === id) || { id, icon, name, price, type, power:20, rarity:'common', desc:'' };
  if (G.wallet < price) return notify('error', `Precisa de ${price} Cry`);
  G.wallet -= price;
  addToInventory(item);
  saveGame(); updateHeader(); renderInventory();
  notify('success', `${icon} ${name} comprado!`);
}

function sellItem(itemId) {
  const item = G.inventory.find(i => i.id === itemId);
  if (!item) return;
  const shop = SHOP_ITEMS.find(s => s.id === itemId);
  const price = Math.floor((shop?.price || 10) * 0.5);
  removeFromInventory(itemId, 1);
  G.wallet += price;
  G.totalEarned = (G.totalEarned || 0) + price;
  addToFeed(`💰 Vendeu ${item.icon} ${item.name} por ${price} Cry`);
  saveGame(); updateHeader(); renderShop();
  notify('success', `Vendeu por ${price} Cry!`);
}

// ── HOUSES ─────────────────────────────────
function renderHouses() {
  const bg = document.getElementById('houses-buy-grid');
  bg.innerHTML = HOUSES.map(h => `
    <div class="house-card" onclick="buyHouse('${h.id}')">
      <div class="house-header"><span class="house-icon">${h.icon}</span><div><div class="house-name">${h.name}</div><div style="font-size:11px;color:var(--text2)">${h.size}</div></div></div>
      <div class="house-body">
        <div class="house-stat"><span>Preço</span><span class="cry">${h.buyPrice} Cry</span></div>
        <div class="house-stat"><span>Renda/dia</span><span style="color:var(--green)">${h.perDay} Cry</span></div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">${h.desc}</div>
        <button class="btn btn-primary" style="width:100%;margin-top:8px">Comprar</button>
      </div>
    </div>
  `).join('');

  const rg = document.getElementById('houses-rent-grid');
  rg.innerHTML = HOUSES.map(h => `
    <div class="house-card" onclick="rentHouse('${h.id}')">
      <div class="house-header"><span class="house-icon">${h.icon}</span><div><div class="house-name">${h.name}</div><div style="font-size:11px;color:var(--text2)">${h.size}</div></div></div>
      <div class="house-body">
        <div class="house-stat"><span>Aluguel/mês</span><span class="cry">${h.rentPrice} Cry</span></div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">${h.desc}</div>
        <button class="btn btn-info" style="width:100%;margin-top:8px">Alugar</button>
      </div>
    </div>
  `).join('');

  const mh = document.getElementById('my-houses');
  if (!G.houses || !G.houses.length) { mh.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Nenhum imóvel</div>'; return; }
  mh.innerHTML = G.houses.map(owned => {
    const h = HOUSES.find(hh => hh.id === owned.id) || {};
    return `<div class="house-card">
      <div class="house-header"><span class="house-icon">${h.icon||'🏡'}</span><div><div class="house-name">${h.name||owned.id}</div><span class="badge ${owned.rented?'badge-blue':'badge-gold'}" style="font-size:10px">${owned.rented?'Alugado':'Próprio'}</span></div></div>
      <div class="house-body">
        <div class="house-stat"><span>Renda</span><span style="color:var(--green)">${h.perDay||0} Cry/dia</span></div>
        <button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="sellHouse('${owned.id}')">Vender</button>
      </div>
    </div>`;
  }).join('');
}

function buyHouse(houseId) {
  const h = HOUSES.find(h => h.id === houseId);
  if (!h) return;
  if (G.wallet < h.buyPrice) return notify('error', `Precisa de ${h.buyPrice} Cry`);
  if (G.houses.find(owned => owned.id === houseId)) return notify('warn', 'Você já possui este imóvel!');
  G.wallet -= h.buyPrice;
  G.houses.push({ id: houseId, rented: false, boughtAt: Date.now() });
  addToFeed(`🏡 Comprou ${h.icon} ${h.name} por ${h.buyPrice} Cry`);
  updateQuestProgress('house', 1);
  saveGame(); updateHeader(); renderHouses();
  notify('success', `${h.icon} ${h.name} comprada!`);
  sysLog(`${G.name} comprou ${h.name}`);
}

function rentHouse(houseId) {
  const h = HOUSES.find(h => h.id === houseId);
  if (!h) return;
  if (G.wallet < h.rentPrice) return notify('error', `Precisa de ${h.rentPrice} Cry`);
  G.wallet -= h.rentPrice;
  G.houses.push({ id: houseId, rented: true, boughtAt: Date.now() });
  addToFeed(`🏠 Alugou ${h.icon} ${h.name}`);
  updateQuestProgress('house', 1);
  saveGame(); updateHeader(); renderHouses();
  notify('success', `${h.icon} Alugado!`);
}

function sellHouse(houseId) {
  const h = HOUSES.find(h => h.id === houseId);
  const idx = G.houses.findIndex(o => o.id === houseId);
  if (idx < 0) return;
  const owned = G.houses[idx];
  if (owned.rented) { G.houses.splice(idx, 1); saveGame(); renderHouses(); notify('info', 'Contrato cancelado.'); return; }
  const price = Math.floor((h?.buyPrice || 500) * 0.7);
  G.wallet += price;
  G.houses.splice(idx, 1);
  addToFeed(`💰 Vendeu imóvel por ${price} Cry`);
  saveGame(); updateHeader(); renderHouses();
  notify('success', `Vendeu por ${price} Cry!`);
}

// ── COMPANIES ──────────────────────────────
function renderCompanies() {
  const cg = document.getElementById('companies-grid');
  cg.innerHTML = COMPANIES.map(c => `
    <div class="company-card">
      <div class="company-name">${c.icon} ${c.name}</div>
      <div class="company-stat"><span>Preço</span><span class="cry">${c.price} Cry</span></div>
      <div class="company-stat"><span>Renda/h</span><span style="color:var(--green)">${c.income} Cry</span></div>
      <div class="company-stat"><span>Funcionários</span><span>${c.staff}</span></div>
      <div style="font-size:11px;color:var(--text2);margin:6px 0">${c.desc}</div>
      <button class="btn btn-primary" style="width:100%" onclick="buyCompany('${c.id}')">Comprar Empresa</button>
    </div>
  `).join('');

  const mc = document.getElementById('my-companies');
  if (!G.companies || !G.companies.length) { mc.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Sem empresas</div>'; return; }
  mc.innerHTML = G.companies.map(owned => {
    const c = COMPANIES.find(cc => cc.id === owned.id) || {};
    return `<div class="company-card">
      <div class="company-name">${c.icon||'🏢'} ${c.name||owned.id}</div>
      <div class="company-stat"><span>Renda/h</span><span style="color:var(--green)">${c.income||0} Cry</span></div>
      <div class="company-stat"><span>Status</span><span class="badge badge-green">Ativa</span></div>
      <button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="sellCompany('${owned.id}')">Vender Empresa</button>
    </div>`;
  }).join('');
}

function buyCompany(cId) {
  const c = COMPANIES.find(c => c.id === cId);
  if (!c) return;
  if (G.wallet < c.price) return notify('error', `Precisa de ${c.price} Cry`);
  if (G.companies.find(o => o.id === cId)) return notify('warn', 'Você já possui esta empresa!');
  G.wallet -= c.price;
  G.companies.push({ id: cId, boughtAt: Date.now() });
  addToFeed(`🏢 Comprou a empresa ${c.icon} ${c.name}`);
  saveGame(); updateHeader(); renderCompanies();
  notify('success', `${c.icon} ${c.name} adquirida!`);
  sysLog(`${G.name} comprou empresa ${c.name}`);
}

function sellCompany(cId) {
  const c = COMPANIES.find(c => c.id === cId);
  const idx = G.companies.findIndex(o => o.id === cId);
  if (idx < 0) return;
  const price = Math.floor((c?.price || 1000) * 0.6);
  G.wallet += price;
  G.companies.splice(idx, 1);
  saveGame(); updateHeader(); renderCompanies();
  notify('success', `Vendeu empresa por ${price} Cry!`);
}

// ── JOBS ───────────────────────────────────
function renderJobs() {
  document.getElementById('current-job').textContent = G.job ? JOBS.find(j => j.id === G.job)?.name || G.job : 'Desempregado';
  document.getElementById('job-salary').textContent = G.job ? (G.jobSalary || 0) + ' Cry/turno' : '—';
  updateWorkCooldown();

  const list = document.getElementById('jobs-list');
  list.innerHTML = JOBS.map(job => {
    const hasTools = job.needs.every(n => G.inventory.some(i => i.id === n));
    const isCurrentJob = G.job === job.id;
    const canWork = G.hunger > 20 && G.energy > 10;
    const meetsLevel = G.level >= (job.minLevel || 1);
    const locked = !meetsLevel && !isCurrentJob;
    const missingTools = job.needs.filter(n => !G.inventory.some(i => i.id === n));
    return `<div class="market-item" style="${locked ? 'opacity:0.55' : ''}">
      <span style="font-size:24px">${job.icon}</span>
      <div style="flex:1">
        <div style="font-size:14px;font-family:'Cinzel',serif;color:var(--gold)">${job.name}</div>
        <div style="font-size:11px;color:var(--text2)">${job.desc}</div>
        <div style="font-size:10px;color:${meetsLevel?'var(--text3)':'var(--red)'};margin-top:2px">Requer: Nível ${job.minLevel || 1}${!meetsLevel ? ` (você é Nv.${G.level})` : ''}</div>
        ${job.needs.length ? `<div style="font-size:10px;margin-top:2px;color:${missingTools.length?'var(--red)':'var(--green)'}">
          Ferramenta: ${job.needs.join(', ')} ${missingTools.length ? `— <span style="text-decoration:underline;cursor:pointer" onclick="navigate('mercado')">comprar na loja 🛒</span>` : '✓ você já tem'}
        </div>` : ''}
      </div>
      <div style="text-align:right">
        <div class="cry" style="font-size:14px;margin-bottom:4px">${job.salary} Cry/turno</div>
        <div style="font-size:10px;color:var(--text3)">Turno: 1 min</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="btn btn-sm ${isCurrentJob?'btn-danger':'btn-success'}" ${locked?'disabled':''} onclick="${isCurrentJob?'quitJob()':`applyJob('${job.id}')`}" title="${locked ? 'Nível insuficiente' : ''}">${isCurrentJob?'Demitir-se':(locked ? '🔒 Bloqueado' : 'Candidatar')}</button>
        ${isCurrentJob ? `<button class="btn btn-sm btn-gold" onclick="workShift()" ${canWork?'':' disabled'}>⚡ Trabalhar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function applyJob(jobId) {
  const job = JOBS.find(j => j.id === jobId);
  if (!job) return;
  if (G.level < (job.minLevel || 1)) return notify('error', `Nível insuficiente! ${job.name} requer Nível ${job.minLevel}.`);
  const hasTools = job.needs.every(n => G.inventory.some(i => i.id === n));
  if (!hasTools && job.needs.length > 0) return notify('error', `Falta ferramenta: ${job.needs.join(', ')}. Compre na Loja (🛒 Mercado).`);
  G.job = jobId;
  G.jobSalary = job.salary;
  addToFeed(`💼 Empregado como ${job.icon} ${job.name}`);
  saveGame(); renderJobs();
  notify('success', `Empregado como ${job.name}!`);
  sysLog(`${G.name} emprego: ${job.name}`);
}

function quitJob() {
  if (!G.job) return;
  const job = JOBS.find(j => j.id === G.job);
  G.job = null; G.jobSalary = 0;
  addToFeed(`👋 Saiu do emprego de ${job?.name||'?'}`);
  saveGame(); renderJobs();
  notify('info', 'Você se demitiu.');
}

function workShift() {
  if (!G.job) return notify('error', 'Sem emprego!');
  if (G.hunger <= 20) return notify('error', '⚠️ Muito faminto para trabalhar! Coma algo primeiro.');
  if (G.energy <= 10) return notify('error', '⚠️ Sem energia para trabalhar!');

  const now = Date.now();
  const cooldown = 60 * 1000; // 1 min demo (60*60*1000 = 1h)
  if (G.lastWork && (now - G.lastWork) < cooldown) {
    const remaining = Math.ceil((cooldown - (now - G.lastWork)) / 1000);
    return notify('warn', `⏳ Aguarde ${remaining}s para o próximo turno`);
  }

  const job = JOBS.find(j => j.id === G.job);
  let salary = G.jobSalary || job.salary;
  if (activeEvent === 'gold') salary *= 2;

  G.wallet += salary;
  G.totalEarned = (G.totalEarned || 0) + salary;
  G.hunger = Math.max(0, G.hunger - 20);
  G.energy = Math.max(0, G.energy - 10);
  G.lastWork = now;
  G.workTurns = (G.workTurns || 0) + 1;
  G.stats = G.stats || {};
  G.stats.totalWork = (G.stats.totalWork || 0) + 1;

  gainXP(15);
  updateQuestProgress('work', 1);
  addBankHistory(`Salário — ${job.name}`, salary);
  addToFeed(`💼 Trabalhou como ${job.icon} ${job.name} (+${salary} Cry)`);
  saveGame(); updateHeader(); renderJobs();
  notify('success', `💼 Turno concluído! +${salary} Cry`);
  sysLog(`${G.name} trabalhou (${job.name}) +${salary} Cry`);
}

function updateWorkCooldown() {
  const el = document.getElementById('work-cooldown');
  if (!el) return;
  if (!G.lastWork) { el.textContent = 'Disponível'; return; }
  const cooldown = 60 * 1000;
  const remaining = cooldown - (Date.now() - G.lastWork);
  if (remaining <= 0) { el.textContent = 'Disponível'; }
  else { el.textContent = Math.ceil(remaining/1000) + 's'; }
}

// ── BATTLE ─────────────────────────────────
let battleInProgress = false;

function battleCooldownRemaining() {
  if (!G.lastBattle) return 0;
  return BATTLE_COOLDOWN - (Date.now() - G.lastBattle);
}

function updateBattleCooldown() {
  const el = document.getElementById('battle-cooldown');
  if (!el) return;
  const remaining = battleCooldownRemaining();
  if (remaining <= 0) { el.textContent = 'Disponível'; el.style.color = 'var(--green)'; }
  else { el.textContent = Math.ceil(remaining / 1000) + 's'; el.style.color = 'var(--cyan)'; }
  const hpEl = document.getElementById('battle-hp-display');
  if (hpEl) hpEl.textContent = `${G.hp}/${G.maxHp || G.hp}`;
}

function rollDiceVisual(elId) {
  return new Promise(resolve => {
    const el = document.getElementById(elId);
    const result = Math.floor(Math.random() * 6) + 1;
    if (!el) { resolve(result); return; }
    const faceRot = { 1:[0,0], 2:[0,-90], 3:[-90,0], 4:[90,0], 5:[0,90], 6:[0,180] }[result];
    const rx = 360 * 2 + faceRot[0];
    const ry = 360 * 3 + faceRot[1];
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    setTimeout(() => resolve(result), 900);
  });
}

// ══════════════════════════════════════════
//   TOUR DE BOAS-VINDAS (primeira vez no app)
// ══════════════════════════════════════════
let tourStep = 0;

function startOnboardingTour() {
  tourStep = 0;
  renderOnboardingTour();
}

function renderOnboardingTour() {
  let overlay = document.getElementById('onboarding-tour-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'onboarding-tour-overlay';
    overlay.className = 'call-overlay';
    document.body.appendChild(overlay);
  }
  const step = ONBOARDING_STEPS[tourStep];
  const isLast = tourStep === ONBOARDING_STEPS.length - 1;
  overlay.innerHTML = `
    <div class="call-box" style="max-width:380px;background:var(--bg2);border:1px solid var(--gold3);border-radius:14px;padding:28px">
      <div style="font-size:48px;margin-bottom:14px">${step.icon}</div>
      <div style="font-family:'Cinzel',serif;font-size:19px;color:var(--gold2);margin-bottom:10px">${step.title}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:18px">${step.text}</div>
      <div style="display:flex;justify-content:center;gap:5px;margin-bottom:18px">
        ${ONBOARDING_STEPS.map((_,i) => `<span style="width:7px;height:7px;border-radius:50%;background:${i===tourStep?'var(--gold)':'var(--border2)'}"></span>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        ${tourStep > 0 ? '<button class="btn btn-sm" onclick="tourPrev()">← Voltar</button>' : `<button class="btn btn-sm" onclick="closeOnboardingTour()">Pular</button>`}
        <button class="btn btn-primary" onclick="${isLast ? 'closeOnboardingTour()' : 'tourNext()'}">${isLast ? '🎉 Começar!' : 'Próximo →'}</button>
      </div>
    </div>`;
}
function tourNext() { tourStep = Math.min(ONBOARDING_STEPS.length - 1, tourStep + 1); renderOnboardingTour(); }
function tourPrev() { tourStep = Math.max(0, tourStep - 1); renderOnboardingTour(); }
function closeOnboardingTour() {
  const overlay = document.getElementById('onboarding-tour-overlay');
  if (overlay) overlay.remove();
  G.tourSeen = true;
  saveGame();
}
function replayTour() { startOnboardingTour(); }

function celebrate(intensity = 'normal') {
  try {
    if (typeof confetti !== 'function') return;
    if (intensity === 'big') {
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors: ['#d4a017','#f0c040','#9b59ff','#00d4ff'] });
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 250);
    } else {
      confetti({ particleCount: 60, spread: 65, origin: { y: 0.65 } });
    }
  } catch (e) { /* biblioteca pode não ter carregado (sem internet) — sem problema, o app continua normal */ }
}

function showBattleResultOverlay(win, title, subtitle) {
  const overlay = document.createElement('div');
  overlay.className = 'battle-result-overlay';
  overlay.innerHTML = `
    <div class="battle-result-box">
      <div style="font-size:64px;margin-bottom:10px">${win ? '🏆' : '💀'}</div>
      <div class="battle-result-title ${win ? 'win' : 'lose'}">${title}</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:20px">${subtitle}</div>
      <button class="btn btn-primary" onclick="this.closest('.battle-result-overlay').remove()">Continuar</button>
    </div>`;
  document.body.appendChild(overlay);
  if (win) celebrate('big');
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 4500);
}

// ══════════════════════════════════════════
//   FX DE BATALHA (GSAP — dano flutuante, impacto, tremor, crítico)
// ══════════════════════════════════════════
function spawnFloatingText(colEl, text, opts = {}) {
  if (!colEl) return;
  const { color = '#ff6b5b', size = 20, crit = false } = opts;
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;left:50%;top:26%;transform:translate(-50%,0);font-family:'Cinzel',serif;font-weight:800;font-size:${size}px;color:${color};text-shadow:0 2px 8px rgba(0,0,0,.7),0 0 14px ${color}55;pointer-events:none;z-index:20;white-space:nowrap;`;
  colEl.appendChild(el);
  if (typeof gsap === 'undefined') { setTimeout(() => el.remove(), 900); return; }
  gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(el, { y: 6, opacity: 0, scale: crit ? 0.4 : 0.7 }, { y: -6, opacity: 1, scale: crit ? 1.35 : 1, duration: 0.18, ease: 'back.out(3)' })
    .to(el, { y: -46, duration: 0.65, ease: 'power1.out' }, '<')
    .to(el, { opacity: 0, duration: 0.25 }, '-=0.2');
}
function impactFlash(avatarElId, color = 'rgba(255,255,255,0.85)') {
  const target = document.getElementById(avatarElId);
  if (!target || !target.parentElement) return;
  const flash = document.createElement('div');
  flash.style.cssText = `position:absolute;left:50%;top:42%;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle, ${color}, transparent 70%);transform:translate(-50%,-50%) scale(0.3);pointer-events:none;z-index:5;`;
  target.parentElement.appendChild(flash);
  if (typeof gsap === 'undefined') { setTimeout(() => flash.remove(), 350); return; }
  gsap.to(flash, { scale: 1.5, opacity: 0, duration: 0.4, ease: 'power2.out', onComplete: () => flash.remove() });
}
function shakeArena() {
  const arena = document.getElementById('battle-arena-card');
  if (!arena || typeof gsap === 'undefined') return;
  gsap.fromTo(arena, { x: 0 }, { x: 7, duration: 0.05, repeat: 5, yoyo: true, ease: 'power1.inOut', onComplete: () => gsap.set(arena, { x: 0 }) });
}

async function startBattle(monsterId) {

  const m = MONSTERS[monsterId];
  if (!m) return;
  if (battleInProgress) return notify('warn', '⏳ Uma batalha já está em andamento!');
  const remaining = battleCooldownRemaining();
  if (remaining > 0) return notify('warn', `⏳ Aguarde ${Math.ceil(remaining/1000)}s para batalhar novamente.`);
  if (G.hp <= 0) return notify('error', 'Você está sem HP! Use uma poção primeiro.');
  if (G.hunger <= 10) return notify('error', '⚠️ Muito faminto para batalhar!');

  battleInProgress = true;
  G.lastBattle = Date.now();
  saveGame();
  updateBattleCooldown();

  document.getElementById('battle-log-card').style.display = 'block';
  document.getElementById('battle-arena-card').style.display = 'block';
  const log = document.getElementById('battle-log');
  log.innerHTML = '';
  const playerAvatarEl = document.getElementById('battle-player-avatar');
  if ((G.class || '').toLowerCase() === 'mago') {
    playerAvatarEl.innerHTML = `<dotlottie-wc src="/Interactive_Mage_animation.lottie" style="width:100%;height:100%;background:transparent" autoplay loop></dotlottie-wc>`;
  } else {
    playerAvatarEl.textContent = G.avatarPhoto ? '🧑' : (G.avatar || '⚔️');
  }
  document.getElementById('battle-monster-avatar').textContent = m.icon;
  document.getElementById('battle-monster-name').textContent = m.name;
  const diceRow = document.getElementById('battle-dice-row');
  diceRow.innerHTML = createDiceElement('battle-dice-p') + createDiceElement('battle-dice-m');

  let playerHp = G.hp;
  const playerMaxHp = G.hp;
  let monsterHp = m.hp;
  const playerAtk = G.str + (G.equipped.weapon ? (SHOP_ITEMS.find(i=>i.id===G.equipped.weapon)?.power||0) : 0);
  const playerDef = G.vit + (G.equipped.armor ? (SHOP_ITEMS.find(i=>i.id===G.equipped.armor)?.power||0) : 0);

  function addLog(msg, col='var(--text)') {
    log.innerHTML += `<div style="color:${col};padding:3px 0;border-bottom:1px solid var(--border)">${msg}</div>`;
    log.scrollTop = log.scrollHeight;
  }
  function updateBars() {
    document.getElementById('battle-player-hp-bar').style.width = Math.max(0, (playerHp/playerMaxHp)*100) + '%';
    document.getElementById('battle-monster-hp-bar').style.width = Math.max(0, (monsterHp/m.hp)*100) + '%';
  }
  function shake(id) { const el = document.getElementById(id); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function lunge(id) { const el = document.getElementById(id); el.classList.remove('attack'); void el.offsetWidth; el.classList.add('attack'); }

  addLog(`⚔️ Batalha iniciada contra ${m.icon} ${m.name}!`, 'var(--gold2)');
  updateBars();

  let round = 1;
  while (playerHp > 0 && monsterHp > 0) {
    const [diceP, diceM] = await Promise.all([rollDiceVisual('battle-dice-p'), rollDiceVisual('battle-dice-m')]);
    await sleep(150);

    const playerCrit = Math.random() < 0.15;
    let pDmg = Math.max(1, playerAtk - m.def + diceP);
    if (playerCrit) pDmg = Math.round(pDmg * 1.8);
    monsterHp -= pDmg;
    lunge('battle-player-avatar'); shake('battle-monster-avatar');
    impactFlash('battle-monster-avatar', playerCrit ? 'rgba(240,192,64,0.9)' : 'rgba(255,255,255,0.8)');
    spawnFloatingText(document.getElementById('battle-monster-col'), playerCrit ? `CRÍTICO! −${pDmg}` : `−${pDmg}`, { color: playerCrit ? '#f0c040' : '#ff6b5b', size: playerCrit ? 23 : 19, crit: playerCrit });
    if (playerCrit) shakeArena();
    updateBars();
    addLog(`Rodada ${round}: 🎲${diceP}${playerCrit ? ' · CRÍTICO!' : ''} — Você causou ${pDmg} de dano! ${m.icon} HP: ${Math.max(0,monsterHp)}/${m.hp}`, playerCrit ? 'var(--gold2)' : 'var(--green)');
    await sleep(500);

    if (monsterHp <= 0) break;

    const monsterCrit = Math.random() < 0.1;
    let mDmg = Math.max(1, m.atk - playerDef + diceM);
    if (monsterCrit) mDmg = Math.round(mDmg * 1.7);
    playerHp = Math.max(0, playerHp - mDmg);
    lunge('battle-monster-avatar'); shake('battle-player-avatar');
    impactFlash('battle-player-avatar', monsterCrit ? 'rgba(214,45,45,0.9)' : 'rgba(255,255,255,0.8)');
    spawnFloatingText(document.getElementById('battle-player-col'), monsterCrit ? `CRÍTICO! −${mDmg}` : `−${mDmg}`, { color: monsterCrit ? '#ff3b3b' : '#ff6b5b', size: monsterCrit ? 23 : 19, crit: monsterCrit });
    if (monsterCrit) shakeArena();
    updateBars();
    addLog(`${m.icon} 🎲${diceM}${monsterCrit ? ' · CRÍTICO!' : ''} — causou ${mDmg} de dano! Seu HP: ${playerHp}/${playerMaxHp}`, 'var(--red)');
    await sleep(500);

    round++;
  }

  battleInProgress = false;
  if (monsterHp <= 0) {
    let xpGain = m.xp; let cryGain = m.cry;
    if (activeEvent === 'xp') xpGain *= 2;
    gainXP(xpGain);
    G.wallet += cryGain;
    G.totalEarned = (G.totalEarned||0) + cryGain;
    G.battles++; G.wins++;
    G.stats = G.stats || {}; G.stats.totalBattles = (G.stats.totalBattles||0)+1; G.stats.totalKills = (G.stats.totalKills||0)+1;
    addBankHistory(`Vitória vs ${m.name}`, cryGain);
    updateQuestProgress('battle', 1);
    addToFeed(`⚔️ Derrotou ${m.icon} ${m.name}! +${xpGain}XP +${cryGain}Cry`);
    addLog(`🏆 VITÓRIA! +${xpGain} XP +${cryGain} Cry`, 'var(--gold2)');
    G.hp = playerHp;
    saveGame(); updateHeader(); refreshDashboard();
    sysLog(`${G.name} derrotou ${m.name}`);
    showBattleResultOverlay(true, 'VITÓRIA!', `+${xpGain} XP · +${cryGain} Cry`);
  } else {
    G.hp = 10; G.battles++; G.losses++;
    addLog(`💀 DERROTA! Você foi derrotado por ${m.name}...`, 'var(--red)');
    addToFeed(`💀 Derrotado por ${m.icon} ${m.name}`);
    saveGame(); refreshDashboard();
    showBattleResultOverlay(false, 'DERROTA!', `${m.name} foi mais forte dessa vez.`);
  }
}

// Desafios de PvP reais, guardados na tabela pvp_challenges (ver
// social-setup.sql) — antes disso, "Desafiar" só mostrava um aviso
// pra você mesmo; o outro jogador nunca ficava sabendo. O resultado é
// calculado uma única vez, por quem aceita o desafio, e gravado no
// banco — assim as duas contas veem exatamente o mesmo resultado.
async function startPvP() {
  const target = _stripAt(document.getElementById('pvp-target').value);
  if (!target) return notify('error', 'Informe o adversário');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  if (target.toLowerCase() === (G.name || '').toLowerCase()) return notify('error', 'Você não pode desafiar você mesmo!');
  try {
    const profile = await findProfileByNameOrUsername(target, 'id,name');
    if (!profile) { notify('error', `Nenhum jogador chamado "${target}" foi encontrado.`); return; }
    const { error } = await supabase.from('pvp_challenges').insert([{ challenger_id: me, target_id: profile.id }]);
    if (error) throw error;
    notify('info', `⚔️ Desafio enviado para ${profile.name}!`);
    addToFeed(`⚔️ Desafiou ${profile.name} para PvP`);
    sysLog(`${G.name} desafiou ${profile.name} PvP`);
    document.getElementById('pvp-target').value = '';
    renderPvpChallenges();
  } catch (e) {
    console.error('Erro ao desafiar', e);
    notify('error', 'Não foi possível enviar o desafio: ' + (e.message || 'erro desconhecido'));
  }
}


// Roda só no lado de quem ACEITA o desafio — decide o vencedor com uma
// aleatoriedade ponderada pelo "poder" de cada um (nível + atributos +
// % de vida), grava o resultado, e devolve pro chamador aplicar o
// prêmio se tiver vencido. A recompensa é criada do zero (como já
// acontece nas batalhas contra monstros) — não sai da carteira de quem
// perde, então não tem risco de saldo negativo nem disputa de quem
// "devia" pagar o quê.
async function respondPvpChallenge(id, accept) {
  try {
    // O resultado e a recompensa agora são decididos inteiramente pelo servidor
    // (RPC pvp_respond_challenge, SECURITY DEFINER) -- o cliente só pede a ação e
    // exibe o que voltar. Isso fecha duas falhas do fluxo antigo: quem aceitava o
    // desafio conseguia sempre se declarar vencedor, e a recompensa era só um
    // "+G.wallet" local sem controle nenhum de duplicação.
    const { data, error } = await supabase.rpc('pvp_respond_challenge', { p_challenge_id: id, p_accept: accept });
    if (error) throw error;

    if (data.status === 'declined') {
      notify('info', 'Desafio recusado.');
      renderPvpChallenges();
      return;
    }

    if (data.i_won) {
      G.wallet = (G.wallet || 0) + (data.gold_gain || 0);
      if (data.xp_gain_suggestion) gainXP(data.xp_gain_suggestion);
      saveGame();
      addToFeed(`🏆 Venceu um duelo PvP! +${data.xp_gain_suggestion || 0} XP +${data.gold_gain || 0} Cry`);
      notify('success', `🏆 Você venceu o duelo! +${data.xp_gain_suggestion || 0} XP +${data.gold_gain || 0} Cry`);
    } else {
      addToFeed('💀 Perdeu um duelo de PvP.');
      notify('info', '💀 Você perdeu o duelo.');
    }
    renderPvpChallenges();
  } catch (e) {
    console.error('Erro ao responder desafio de PvP', e);
    notify('error', 'Não foi possível concluir o duelo: ' + (e.message || 'erro desconhecido'));
  }
}

// Confere desafios concluídos que ainda não foram "reclamados" nesta
// conta (dá prêmio pro vencedor, ou só avisa o perdedor) — necessário
// pro lado que NÃO clicou em aceitar também saber o resultado e
// receber a recompensa, já que a resolução roda só do outro lado.
async function claimCompletedPvpChallenges(challenges) {
  // O ouro do duelo já foi creditado pelo servidor dentro de pvp_respond_challenge
  // (o lado que clicou em "Aceitar" chama a RPC e recebe o resultado na hora --
  // ver respondPvpChallenge). Esta função só cobre o OUTRO lado (quem desafiou e
  // ainda não sabia do resultado): aqui a gente só sincroniza a carteira com o
  // valor real do servidor (nunca soma de novo) e aplica o ganho de XP local.
  const me = myId();
  G.claimedPvpChallenges = G.claimedPvpChallenges || [];
  const toSync = challenges.filter(c => c.status === 'completed' && !G.claimedPvpChallenges.includes(c.id));
  if (!toSync.length) return;

  let changed = false;
  let myWallet = null;
  for (const c of toSync) {
    G.claimedPvpChallenges.push(c.id);
    changed = true;
    if (c.winner_id === me) {
      const xpGain = 30 + (G.level || 1) * 5;
      gainXP(xpGain);
      if (myWallet === null) {
        const { data: prof } = await supabase.from('profiles').select('wallet').eq('id', me).single();
        myWallet = prof ? prof.wallet : null;
      }
      if (myWallet !== null) G.wallet = myWallet;
      addToFeed(`🏆 Venceu um duelo PvP! +${xpGain} XP`);
      notify('success', `🏆 Você venceu um duelo de PvP! +${xpGain} XP`);
    } else {
      addToFeed('💀 Perdeu um duelo de PvP.');
      notify('info', '💀 Você perdeu um duelo de PvP.');
    }
  }
  if (changed) { saveGame(); updateHeader(); }
}

async function renderPvpChallenges() {
  const el = document.getElementById('pvp-challenges');
  if (!el) return;
  const me = myId();
  if (!me) return;
  try {
    const { data, error } = await supabase.from('pvp_challenges')
      .select('*')
      .or(`challenger_id.eq.${me},target_id.eq.${me}`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    const challenges = data || [];

    await claimCompletedPvpChallenges(challenges.filter(c => c.status === 'completed'));

    const incoming = challenges.filter(c => c.target_id === me && c.status === 'pending');
    const outgoing = challenges.filter(c => c.challenger_id === me && c.status === 'pending');
    const recent = challenges.filter(c => c.status === 'completed' || c.status === 'declined').slice(0, 5);

    if (!incoming.length && !outgoing.length && !recent.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center">Nenhum desafio no momento.</div>';
      return;
    }

    const ids = [...new Set(challenges.flatMap(c => [c.challenger_id, c.target_id]))];
    const { data: profs } = await supabase.from('profiles').select('id,name').in('id', ids);
    const nameOf = id => (profs || []).find(p => p.id === id)?.name || 'Alguém';

    let html = '';
    incoming.forEach(c => {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:12px;flex:1;text-align:left">${escapeHtml(nameOf(c.challenger_id))} te desafiou</span>
        <button class="btn btn-sm btn-success" onclick="respondPvpChallenge('${c.id}',true)">Aceitar</button>
        <button class="btn btn-sm btn-danger" onclick="respondPvpChallenge('${c.id}',false)">Recusar</button>
      </div>`;
    });
    outgoing.forEach(c => {
      html += `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;color:var(--text3)">Aguardando resposta de ${escapeHtml(nameOf(c.target_id))}...</div>`;
    });
    recent.forEach(c => {
      const otherId = c.challenger_id === me ? c.target_id : c.challenger_id;
      let line;
      if (c.status === 'declined') line = `Desafio contra ${escapeHtml(nameOf(otherId))} foi recusado.`;
      else line = c.winner_id === me ? `🏆 Você venceu contra ${escapeHtml(nameOf(otherId))}.` : `💀 Você perdeu contra ${escapeHtml(nameOf(otherId))}.`;
      html += `<div style="padding:4px 0;font-size:11px;color:var(--text3)">${line}</div>`;
    });
    el.innerHTML = html;
  } catch (e) {
    console.error('Erro ao carregar desafios de PvP', e);
    el.innerHTML = '<div style="color:var(--red);font-size:12px;text-align:center">Erro ao carregar desafios.</div>';
  }
}

// ── QUESTS ─────────────────────────────────
function renderQuests() {
  const active = document.getElementById('active-quests');
  const available = document.getElementById('available-quests');

  const activeQ = QUESTS.filter(q => G.activeQuests && G.activeQuests.includes(q.id));
  const availQ = QUESTS.filter(q => !G.completedQuests?.includes(q.id) && !G.activeQuests?.includes(q.id));

  if (!activeQ.length) { active.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Nenhuma missão ativa</div>'; }
  else {
    active.innerHTML = activeQ.map(q => {
      const prog = (G.questProgress || {})[q.id] || 0;
      return `<div class="quest-item">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-title">${q.name}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="progress-bar" style="margin-top:4px"><div class="progress-fill progress-gold" style="width:${Math.min(100,(prog/q.target)*100)}%"></div></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${prog}/${q.target}</div>
        </div>
        <div class="quest-status">
          <div class="quest-reward">+${q.xp} XP<br>+${q.cry} Cry</div>
          ${prog >= q.target ? `<button class="btn btn-sm btn-success" onclick="claimQuest('${q.id}')">✓ Coletar</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  available.innerHTML = availQ.map(q => `
    <div class="quest-item">
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-info">
        <div class="quest-title">${q.name}</div>
        <div class="quest-desc">${q.desc}</div>
        <div class="quest-reward">+${q.xp} XP • +${q.cry} Cry</div>
      </div>
      <div class="quest-status">
        <button class="btn btn-sm btn-info" onclick="acceptQuest('${q.id}')">Aceitar</button>
      </div>
    </div>
  `).join('');
}

function acceptQuest(qId) {
  G.activeQuests = G.activeQuests || [];
  G.questProgress = G.questProgress || {};
  if (G.activeQuests.includes(qId)) return notify('warn', 'Missão já ativa!');
  G.activeQuests.push(qId);
  G.questProgress[qId] = 0;
  const q = QUESTS.find(q => q.id === qId);
  saveGame(); renderQuests();
  notify('info', `📜 Missão aceita: ${q?.name}`);
}

function claimQuest(qId) {
  const q = QUESTS.find(q => q.id === qId);
  if (!q) return;
  const prog = (G.questProgress || {})[qId] || 0;
  if (prog < q.target) return notify('warn', 'Missão não concluída!');
  G.wallet += q.cry;
  G.totalEarned = (G.totalEarned||0) + q.cry;
  gainXP(q.xp);
  G.completedQuests = G.completedQuests || [];
  G.completedQuests.push(qId);
  G.activeQuests = G.activeQuests.filter(id => id !== qId);
  G.questsCompleted = (G.questsCompleted||0) + 1;
  addToFeed(`📜 Missão concluída: ${q.icon} ${q.name} (+${q.xp}XP +${q.cry}Cry)`);
  addBankHistory(`Recompensa: ${q.name}`, q.cry);
  saveGame(); updateHeader(); renderQuests();
  notify('success', `🏆 Missão concluída! +${q.xp}XP +${q.cry}Cry`);
}

function updateQuestProgress(type, amount) {
  G.activeQuests = G.activeQuests || [];
  G.questProgress = G.questProgress || {};
  for (const qId of G.activeQuests) {
    const q = QUESTS.find(q => q.id === qId);
    if (q && q.type === type) {
      G.questProgress[qId] = (G.questProgress[qId] || 0) + amount;
    }
    if (type === 'level' && q && q.type === 'level') {
      G.questProgress[qId] = G.level;
    }
  }
}

// ── Tag da guilda em pontos estratégicos do Crydan (posts, perfil) ───
// Uma função só, reaproveitada em todo lugar que mostra nome de
// usuário, em vez de espalhar a mesma query em vários lugares.
async function fetchGuildTagsForUsers(userIds) {
  if (!userIds || !userIds.length) return {};
  try {
    const { data: members } = await supabase.from('guild_members').select('user_id,guild_id').in('user_id', userIds);
    if (!members || !members.length) return {};
    const guildIds = [...new Set(members.map(m => m.guild_id))];
    const { data: guilds } = await supabase.from('guilds').select('id,tag').in('id', guildIds);
    const tagByGuild = Object.fromEntries((guilds||[]).filter(g=>g.tag).map(g => [g.id, g.tag]));
    const result = {};
    members.forEach(m => { if (tagByGuild[m.guild_id]) result[m.user_id] = tagByGuild[m.guild_id]; });
    return result;
  } catch (e) {
    console.error('Erro ao buscar tags de guilda', e);
    return {};
  }
}
async function openGuildProfileByTag(tag) {
  try {
    const { data: g } = await supabase.from('guilds').select('id').eq('tag', tag).maybeSingle();
    if (g) openGuildProfile(g.id);
  } catch (e) { console.error('Erro ao abrir guilda pela tag', e); }
}

// ── GUILDS ─────────────────────────────────
// ── Sistema de Guildas — cargos, entrada controlada, XP/nível, honra,
// missão semanal, cofre e conquistas. Toda escrita sensível passa por
// funções RPC no Supabase (guild_*), nunca por INSERT/UPDATE direto —
// então mesmo alguém mexendo no DevTools não consegue se autopromover,
// inflar XP ou sacar do cofre sem permissão. Ver guild-setup.sql.
let guildsCache = [];
let myGuildMembership = null; // { guild_id, role }
let myPendingGuildRequests = []; // guild_ids que eu já solicitei entrada
let guildRankingSort = 'xp';
let guildRankingPage = 0;


async function refreshMyGuildMembership() {
  const me = myId();
  if (!me) { myGuildMembership = null; return; }
  const { data } = await supabase.from('guild_members').select('guild_id,role').eq('user_id', me).maybeSingle();
  myGuildMembership = data || null;
  const { data: pending } = await supabase.from('guild_join_requests').select('guild_id').eq('user_id', me).eq('status', 'pending');
  myPendingGuildRequests = (pending || []).map(r => r.guild_id);
}

async function renderGuilds() {
  const list = document.getElementById('guilds-list');
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Carregando guildas...</div>';
  try {
    await refreshMyGuildMembership();
    checkMyGuildRequest();
    const { data: guilds, error } = await supabase.from('guilds').select('*').order('honor', { ascending: false }).limit(60);
    if (error) throw error;
    guildsCache = guilds || [];

    const guildIds = guildsCache.map(g => g.id);
    const counts = {};
    if (guildIds.length) {
      const { data: allMembers } = await supabase.from('guild_members').select('guild_id').in('guild_id', guildIds);
      (allMembers || []).forEach(m => counts[m.guild_id] = (counts[m.guild_id] || 0) + 1);
    }

    if (!guildsCache.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🛡️</div><div class="empty-title">Nenhuma guilda foi criada ainda</div><div class="empty-sub">Seja o primeiro a fundar uma guilda para a comunidade Crydan!</div></div>`;
    } else {
      list.innerHTML = guildsCache.map(g => {
        const memberCount = counts[g.id] || 0;
        const isMine = myGuildMembership?.guild_id === g.id;
        let action;
        if (isMine) {
          action = `<span class="badge badge-gold">Membro</span>`;
        } else if (myGuildMembership) {
          action = `<button class="btn btn-info" disabled title="Saia da sua guilda atual primeiro">Entrar</button>`;
        } else if (g.privacy === 'open') {
          action = `<button class="btn btn-info" onclick="guildJoinOpen('${g.id}','${escapeHtml(g.name).replace(/'/g,"\\'")}')">Entrar</button>`;
        } else if (g.privacy === 'request') {
          const pending = myPendingGuildRequests.includes(g.id);
          action = pending
            ? `<span class="badge badge-gray">Solicitação enviada</span>`
            : `<button class="btn btn-info" onclick="guildRequestJoin('${g.id}','${escapeHtml(g.name).replace(/'/g,"\\'")}')">Solicitar</button>`;
        } else {
          action = `<span class="badge badge-gray">🔒 Só por convite</span>`;
        }
        return `
        <div class="guild-card" style="cursor:pointer" onclick="openGuildProfile('${g.id}')">
          <div class="guild-emblem">${g.emblem}</div>
          <div class="guild-info">
            <div class="guild-name">${escapeHtml(g.name)}${g.tag ? ` <span style="color:var(--text3);font-size:12px">【${escapeHtml(g.tag)}】</span>` : ''}</div>
            <div class="guild-desc">${escapeHtml(g.description || '')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
              <span class="badge badge-gray">Nv.${g.level||1}</span>
              <span class="badge badge-blue">${memberCount}/${g.member_limit} membros</span>
              <span class="badge badge-gray">${GUILD_PRIVACY_LABELS[g.privacy] || g.privacy}</span>
              ${g.min_level > 1 ? `<span class="badge badge-gray">Nv.mín ${g.min_level}</span>` : ''}
            </div>
          </div>
          <div onclick="event.stopPropagation()">${action}</div>
        </div>`;
      }).join('');
    }
    renderMyGuild();
    renderGuildInvites();
  } catch (e) {
    console.error('Erro ao carregar guildas', e);
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar as guildas agora.</div></div>`;
  }
}

// ── Ranking (paginado — não carrega tudo de uma vez) ──────────────────
async function renderGuildRanking(sort) {
  if (sort) { guildRankingSort = sort; guildRankingPage = 0; }
  const targetId = guildRankingSort === 'honor' ? 'guild-ranking-list-honor' : 'guild-ranking-list';
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3)">Carregando ranking...</div>';
  try {
    const from = guildRankingPage * GUILD_PAGE_SIZE;
    const to = from + GUILD_PAGE_SIZE - 1;
    const { data, count, error } = await supabase.from('guilds')
      .select('id,name,tag,emblem,level,xp,honor', { count: 'exact' })
      .order(guildRankingSort, { ascending: false })
      .range(from, to);
    if (error) throw error;
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = (data || []).map((g, i) => {
      const rank = from + i + 1;
      const rankDisplay = rank <= 3 ? medals[rank-1] : `#${rank}`;
      return `<div class="guild-card" style="cursor:pointer" onclick="openGuildProfile('${g.id}')">
        <div style="width:32px;text-align:center;font-size:15px">${rankDisplay}</div>
        <div class="guild-emblem" style="font-size:24px">${g.emblem}</div>
        <div class="guild-info">
          <div class="guild-name">${escapeHtml(g.name)}${g.tag ? ` <span style="color:var(--text3);font-size:11px">【${escapeHtml(g.tag)}】</span>` : ''}</div>
          <div style="font-size:11px;color:var(--text3)">Nv.${g.level||1}</div>
        </div>
        <div class="cry" style="font-size:13px">${guildRankingSort==='honor' ? (g.honor||0)+' Honra' : (g.xp||0)+' XP'}</div>
      </div>`;
    }).join('') || `<div class="empty-state"><div class="empty-sub">Nenhuma guilda nessa página.</div></div>`;
    document.getElementById('guild-ranking-page').textContent = `Página ${guildRankingPage + 1} de ${Math.max(1, Math.ceil((count||0) / GUILD_PAGE_SIZE))}`;
  } catch (e) {
    console.error('Erro no ranking de guildas', e);
    el.innerHTML = `<div class="empty-state"><div class="empty-sub">Não foi possível carregar o ranking.</div></div>`;
  }
}
function changeGuildRankingPage(delta) {
  guildRankingPage = Math.max(0, guildRankingPage + delta);
  renderGuildRanking();
}

// ── Entrada na guilda ───────────────────────────────────────────────
async function guildJoinOpen(guildId, guildName) {
  try {
    const { error } = await supabase.rpc('guild_join_open', { p_guild_id: guildId });
    if (error) throw error;
    updateQuestProgress('guild', 1);
    addToFeed(`🛡️ Entrou na guilda ${guildName}`);
    notify('success', `🛡️ Entrou em ${guildName}!`);
    sysLog(`${G.name} entrou na guilda ${guildName}`);
    renderGuilds();
  } catch (e) {
    console.error('Erro ao entrar na guilda', e);
    notify('error', e.message || 'Não foi possível entrar na guilda agora.');
  }
}
async function guildRequestJoin(guildId, guildName) {
  try {
    const { error } = await supabase.rpc('guild_request_join', { p_guild_id: guildId });
    if (error) throw error;
    notify('success', `📝 Solicitação enviada para ${guildName}!`);
    renderGuilds();
  } catch (e) {
    console.error('Erro ao solicitar entrada', e);
    notify('error', e.message || 'Não foi possível enviar a solicitação.');
  }
}

async function leaveGuild() {
  if (!myGuildMembership) return;
  if (!await confirmDialog('Sair da guilda? Você perde seu cargo e contribuição.', { danger: true })) return;
  const me = myId();
  try {
    const { error } = await supabase.from('guild_members').delete().eq('guild_id', myGuildMembership.guild_id).eq('user_id', me);
    if (error) throw error;
    myGuildMembership = null;
    notify('info', 'Você saiu da guilda.');
    renderGuilds();
  } catch (e) {
    console.error('Erro ao sair da guilda', e);
    notify('error', e.message || 'Não foi possível sair da guilda agora.');
  }
}

async function requestCreateGuild() {
  const name = document.getElementById('guild-name').value.trim();
  const tag = document.getElementById('guild-tag').value.trim().toUpperCase();
  const emblem = document.getElementById('guild-emblem').value.trim() || '🛡️';
  const desc = document.getElementById('guild-desc').value.trim();
  const category = document.getElementById('guild-category').value;
  const privacy = document.getElementById('guild-privacy').value;
  const minLevel = parseInt(document.getElementById('guild-minlevel').value, 10) || 1;
  if (!name) return notify('error', 'Nome da guilda é obrigatório');
  try {
    const { error } = await supabase.rpc('guild_request_create', {
      p_name: name, p_tag: tag || null, p_description: desc || null, p_emblem: emblem,
      p_banner_image: null, p_category: category, p_privacy: privacy, p_min_level: minLevel,
    });
    if (error) throw error;
    notify('success', '📝 Pedido enviado! A administração vai revisar em breve.');
    sysLog(`${G.name} solicitou criação da guilda ${name}`);
    checkMyGuildRequest();
  } catch (e) {
    console.error('Erro ao solicitar guilda', e);
    notify('error', 'Não foi possível enviar o pedido: ' + (e.message || 'erro desconhecido'));
  }
}

// Mostra o aviso de "pedido pendente" e trava o botão se já houver um
async function checkMyGuildRequest() {
  const box = document.getElementById('guild-pending-request-box');
  const btn = document.getElementById('guild-create-btn');
  if (!box || !btn) return;
  try {
    const me = myId();
    if (!me) return;
    const { data, error } = await supabase.from('guild_creation_requests')
      .select('id').eq('requester_id', me).eq('status', 'pending').maybeSingle();
    if (error) throw error;
    box.style.display = data ? 'block' : 'none';
    btn.disabled = !!data;
    btn.style.opacity = data ? '0.5' : '1';
  } catch (e) { console.error('Erro ao checar pedido de guilda', e); }
}

// ── Convites recebidos (aparecem no topo da aba Guildas) ─────────────
async function renderGuildInvites() {
  const card = document.getElementById('guild-invites-card');
  const list = document.getElementById('guild-invites-list');
  if (!card || !list) return;
  const me = myId();
  if (!me) { card.style.display = 'none'; return; }
  try {
    const { data: invites, error } = await supabase.from('guild_invites')
      .select('id,guild_id,invited_by,created_at').eq('invited_user_id', me).eq('status', 'pending');
    if (error) throw error;
    if (!invites || !invites.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    const guildIds = [...new Set(invites.map(i => i.guild_id))];
    const { data: guilds } = await supabase.from('guilds').select('id,name,emblem,tag').in('id', guildIds);
    const guildMap = Object.fromEntries((guilds||[]).map(g => [g.id, g]));
    list.innerHTML = invites.map(inv => {
      const g = guildMap[inv.guild_id] || {};
      return `<div class="guild-card">
        <div class="guild-emblem">${g.emblem || '🛡️'}</div>
        <div class="guild-info"><div class="guild-name">${escapeHtml(g.name || 'Guilda')}</div><div style="font-size:11px;color:var(--text3)">Convite recebido</div></div>
        <button class="btn btn-success btn-sm" onclick="guildRespondInvite('${inv.id}',true)">✓</button>
        <button class="btn btn-danger btn-sm" onclick="guildRespondInvite('${inv.id}',false)">✕</button>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar convites de guilda', e);
    card.style.display = 'none';
  }
}
async function guildRespondInvite(inviteId, accept) {
  try {
    const { error } = await supabase.rpc('guild_respond_invite', { p_invite_id: inviteId, p_accept: accept });
    if (error) throw error;
    notify(accept ? 'success' : 'info', accept ? '🛡️ Você entrou na guilda!' : 'Convite recusado.');
    renderGuilds();
  } catch (e) {
    notify('error', e.message || 'Não foi possível responder ao convite.');
  }
}

// ── Painel "Minha Guilda" — dashboard completo ────────────────────────
async function renderMyGuild() {
  const mgp = document.getElementById('my-guild-panel');
  if (!mgp) return;
  if (!myGuildMembership) {
    mgp.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Você não pertence a nenhuma guilda.</div>';
    return;
  }
  const g = guildsCache.find(x => x.id === myGuildMembership.guild_id);
  if (!g) { mgp.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Carregando...</div>'; return; }
  const myRole = myGuildMembership.role;
  const canManageMembers = ['leader','vice_leader','officer'].includes(myRole);
  const canManageRequests = ['leader','vice_leader'].includes(myRole);
  const isLeader = myRole === 'leader';

  const [{ data: members }, { data: mission }, { data: achievements }, joinReqRes] = await Promise.all([
    supabase.from('guild_members').select('user_id,role,contribution,joined_at').eq('guild_id', g.id).order('contribution', { ascending: false }),
    supabase.from('guild_missions').select('*').eq('guild_id', g.id).eq('status', 'active').maybeSingle(),
    supabase.from('guild_achievements').select('achievement_id').eq('guild_id', g.id),
    canManageRequests ? supabase.from('guild_join_requests').select('id,user_id,created_at').eq('guild_id', g.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
  ]);

  const memberIds = (members || []).map(m => m.user_id);
  const { data: profs } = memberIds.length ? await supabase.from('profiles').select('id,name,username,level,avatar').in('id', memberIds) : { data: [] };
  const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));

  const xpForNext = await guildXpForLevel(g.level + 1);
  const xpThisLevel = await guildXpForLevel(g.level);
  const xpProgress = xpForNext > xpThisLevel ? Math.min(100, Math.round(((g.xp - xpThisLevel) / (xpForNext - xpThisLevel)) * 100)) : 100;

  let html = `
    <div class="guild-card" style="margin-bottom:12px;flex-wrap:wrap">
      <div class="guild-emblem" style="font-size:40px">${g.emblem}</div>
      <div class="guild-info">
        <div class="guild-name" style="font-size:18px">${escapeHtml(g.name)}${g.tag ? ` <span style="color:var(--text3);font-size:13px">【${escapeHtml(g.tag)}】</span>` : ''}</div>
        <div class="guild-desc">${escapeHtml(g.description || '')}</div>
        <span class="badge badge-gold">${GUILD_ROLE_LABELS[myRole] || myRole}</span>
        <span class="badge badge-gray">${GUILD_PRIVACY_LABELS[g.privacy]}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">
      <div class="stat-card"><div style="font-size:11px;color:var(--text3)">Nível</div><div style="font-size:18px;color:var(--gold)">${g.level}</div></div>
      <div class="stat-card"><div style="font-size:11px;color:var(--text3)">Honra</div><div style="font-size:18px;color:var(--gold)">🏵️ ${g.honor}</div></div>
      <div class="stat-card"><div style="font-size:11px;color:var(--text3)">Membros</div><div style="font-size:18px">${members.length}/${g.member_limit}</div></div>
      <div class="stat-card"><div style="font-size:11px;color:var(--text3)">Cofre</div><div style="font-size:18px" class="cry">${g.vault_balance} Cry</div></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:3px"><span>XP da Guilda</span><span>${g.xp} / ${xpForNext} XP</span></div>
      <div class="progress-bar"><div class="progress-fill progress-gold" style="width:${xpProgress}%"></div></div>
    </div>`;

  if (mission) {
    const missionPct = Math.min(100, Math.round((mission.current / mission.target) * 100));
    html += `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title" style="font-size:13px">📜 Missão Semanal — ${escapeHtml(mission.title)}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${escapeHtml(mission.description)}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:3px"><span>${mission.current} / ${mission.target} pontos</span><span>+${mission.reward_xp} XP</span></div>
      <div class="progress-bar" style="margin-bottom:8px"><div class="progress-fill" style="width:${missionPct}%"></div></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="guildContributeMission('${g.id}',50)">Contribuir 50 Cry</button>
        <button class="btn btn-sm" onclick="guildContributeMission('${g.id}',200)">Contribuir 200 Cry</button>
      </div>
    </div>`;
  }

  if (achievements && achievements.length) {
    html += `<div class="card" style="margin-bottom:12px"><div class="card-title" style="font-size:13px">🏆 Conquistas</div><div style="display:flex;gap:8px;flex-wrap:wrap">
      ${achievements.map(a => { const info = GUILD_ACHIEVEMENTS_INFO[a.achievement_id]; return info ? `<span class="badge badge-gold" title="${info.desc}">${info.icon} ${info.name}</span>` : ''; }).join('')}
    </div></div>`;
  }

  if (canManageRequests && joinReqRes.data && joinReqRes.data.length) {
    const reqIds = joinReqRes.data.map(r => r.user_id);
    const { data: reqProfs } = await supabase.from('profiles').select('id,name,level').in('id', reqIds);
    const reqProfMap = Object.fromEntries((reqProfs||[]).map(p=>[p.id,p]));
    html += `<div class="card" style="margin-bottom:12px"><div class="card-title" style="font-size:13px">📝 Solicitações de Entrada</div>
      ${joinReqRes.data.map(r => { const p = reqProfMap[r.user_id] || {}; return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:13px">${escapeHtml(p.name||'?')} <span style="color:var(--text3);font-size:11px">Nv.${p.level||1}</span></span>
        <button class="btn btn-sm btn-success" onclick="guildRespondJoinRequest('${r.id}',true)">✓</button>
        <button class="btn btn-sm btn-danger" onclick="guildRespondJoinRequest('${r.id}',false)">✕</button>
      </div>`; }).join('')}
    </div>`;
  }

  html += `<div class="card" style="margin-bottom:12px">
    <div class="card-title" style="font-size:13px">💰 Cofre da Guilda</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <input class="form-input" type="number" id="guild-vault-amount" placeholder="Valor" style="max-width:120px" min="1">
      <button class="btn btn-sm" onclick="guildVaultDeposit('${g.id}')">Depositar</button>
      ${['leader','vice_leader'].includes(myRole) ? `<button class="btn btn-sm btn-gold" onclick="guildVaultWithdraw('${g.id}')">Sacar</button>` : ''}
    </div>
  </div>`;

  html += `<div class="card" style="margin-bottom:12px"><div class="card-title" style="font-size:13px">👥 Membros (${members.length})</div>
    ${members.map(m => {
      const p = profMap[m.user_id] || {};
      const canAct = canManageMembers && m.user_id !== myId() && GUILD_ROLE_RANK[myRole] > GUILD_ROLE_RANK[m.role];
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:13px;cursor:pointer" onclick="openPublicProfile(${JSON.stringify(p.username || p.name || '').replace(/"/g, '&quot;')})">${escapeHtml(p.name || '?')} <span style="color:var(--text3);font-size:11px">Nv.${p.level||1}</span></span>
        <span class="badge badge-gray" style="font-size:10px">${GUILD_ROLE_LABELS[m.role] || m.role}</span>
        <span style="font-size:10px;color:var(--text3)">${m.contribution||0} Cry doados</span>
        ${canAct ? `<button class="btn btn-sm" onclick="openGuildMemberActions('${g.id}','${m.user_id}','${m.role}','${escapeHtml(p.name||'').replace(/'/g,"\\'")}')">⋯</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;

  if (isLeader) {
    html += `<div class="card" style="margin-bottom:12px">
      <div class="card-title" style="font-size:13px">⚙️ Configurações (Líder)</div>
      <div class="form-group"><label class="form-label">Descrição</label><input class="form-input" id="guild-edit-desc" value="${escapeHtml(g.description||'')}" maxlength="200"></div>
      <div class="form-group"><label class="form-label">Privacidade</label>
        <select class="form-input" id="guild-edit-privacy">
          <option value="open" ${g.privacy==='open'?'selected':''}>🔓 Aberta</option>
          <option value="request" ${g.privacy==='request'?'selected':''}>📝 Solicitação</option>
          <option value="closed" ${g.privacy==='closed'?'selected':''}>🔒 Fechada</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Nível mínimo</label><input class="form-input" type="number" id="guild-edit-minlevel" value="${g.min_level}" min="1" max="99"></div>
      <button class="btn btn-sm btn-primary" onclick="guildSaveSettings('${g.id}')">Salvar</button>
      <hr style="border-color:var(--border);margin:12px 0">
      <div class="form-group"><label class="form-label">Convidar jogador (por nome)</label>
        <div style="display:flex;gap:6px"><input class="form-input" id="guild-invite-name" placeholder="Nome do jogador"><button class="btn btn-sm" onclick="guildInviteByName('${g.id}')">Convidar</button></div>
      </div>
      <hr style="border-color:var(--border);margin:12px 0">
      <button class="btn btn-sm btn-danger" onclick="guildDisbandConfirm('${g.id}')">💥 Dissolver Guilda</button>
    </div>`;
  } else if (canManageMembers) {
    html += `<div class="card" style="margin-bottom:12px">
      <div class="card-title" style="font-size:13px">✉️ Convidar jogador</div>
      <div style="display:flex;gap:6px"><input class="form-input" id="guild-invite-name" placeholder="Nome do jogador"><button class="btn btn-sm" onclick="guildInviteByName('${g.id}')">Convidar</button></div>
    </div>`;
  }

  html += `<button class="btn btn-danger" style="width:100%" onclick="leaveGuild()">Sair da Guilda</button>`;
  mgp.innerHTML = html;
}

// cache simples pra não bater no banco toda hora só pra saber o XP de um nível
let _guildLevelConfigCache = null;
async function guildXpForLevel(level) {
  if (!_guildLevelConfigCache) {
    const { data } = await supabase.from('guild_level_config').select('level,xp_required');
    _guildLevelConfigCache = Object.fromEntries((data||[]).map(r => [r.level, r.xp_required]));
  }
  return _guildLevelConfigCache[level] ?? (_guildLevelConfigCache[60] || 999999999);
}

function openGuildMemberActions(guildId, userId, role, name) {
  const myRole = myGuildMembership?.role;
  const options = [];
  if (['leader','vice_leader'].includes(myRole) && role !== 'vice_leader') options.push(['⚜️ Promover a Vice-líder', `guildChangeRole('${guildId}','${userId}','vice_leader')`]);
  if (['leader','vice_leader'].includes(myRole) && role !== 'officer') options.push(['🛡️ Definir como Oficial', `guildChangeRole('${guildId}','${userId}','officer')`]);
  if (role !== 'member') options.push(['⚔️ Rebaixar para Membro', `guildChangeRole('${guildId}','${userId}','member')`]);
  if (myRole === 'leader') options.push(['👑 Transferir Liderança', `guildTransferLeadershipConfirm('${guildId}','${userId}','${name}')`]);
  options.push(['🚪 Expulsar da Guilda', `guildKickConfirm('${guildId}','${userId}','${name}')`]);
  showModal(`Ações — ${escapeHtml(name)}`, `<div style="display:flex;flex-direction:column;gap:6px">
    ${options.map(([label,fn]) => `<button class="btn" onclick="${fn};closeModalDirect()">${label}</button>`).join('')}
  </div>`);
}

async function guildChangeRole(guildId, userId, newRole) {
  try {
    const { error } = await supabase.rpc('guild_change_role', { p_guild_id: guildId, p_target_user: userId, p_new_role: newRole });
    if (error) throw error;
    notify('success', 'Cargo atualizado.');
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível alterar o cargo.'); }
}
async function guildKickConfirm(guildId, userId, name) {
  if (!await confirmDialog(`Expulsar ${name} da guilda?`, { danger: true })) return;
  try {
    const { error } = await supabase.rpc('guild_kick_member', { p_guild_id: guildId, p_target_user: userId });
    if (error) throw error;
    notify('info', `${name} foi expulso da guilda.`);
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível expulsar.'); }
}
async function guildTransferLeadershipConfirm(guildId, userId, name) {
  if (!await confirmDialog(`Transferir a liderança para ${name}? Você vira Vice-líder.`, { danger: true })) return;
  try {
    const { error } = await supabase.rpc('guild_transfer_leadership', { p_guild_id: guildId, p_new_leader_id: userId });
    if (error) throw error;
    notify('success', `Liderança transferida para ${name}.`);
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível transferir a liderança.'); }
}
async function guildDisbandConfirm(guildId) {
  if (!await confirmDialog('Dissolver a guilda para sempre? Essa ação não pode ser desfeita.', { danger: true })) return;
  try {
    const { error } = await supabase.rpc('guild_disband', { p_guild_id: guildId });
    if (error) throw error;
    myGuildMembership = null;
    notify('info', 'Guilda dissolvida.');
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível dissolver a guilda.'); }
}
async function guildRespondJoinRequest(reqId, accept) {
  try {
    const { error } = await supabase.rpc('guild_respond_join_request', { p_request_id: reqId, p_accept: accept });
    if (error) throw error;
    notify(accept ? 'success' : 'info', accept ? 'Membro aceito!' : 'Solicitação recusada.');
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível responder.'); }
}
async function guildInviteByName(guildId) {
  const name = document.getElementById('guild-invite-name').value.trim();
  if (!name) return;
  try {
    const found = await findProfileByNameOrUsername(name, 'id,name');
    if (!found) return notify('error', 'Jogador não encontrado.');
    const { error } = await supabase.rpc('guild_invite', { p_guild_id: guildId, p_user_id: found.id });
    if (error) throw error;
    notify('success', `Convite enviado para ${found.name}!`);
    document.getElementById('guild-invite-name').value = '';
  } catch (e) { notify('error', e.message || 'Não foi possível convidar.'); }
}
async function guildSaveSettings(guildId) {
  try {
    const { error } = await supabase.rpc('guild_update_settings', {
      p_guild_id: guildId,
      p_description: document.getElementById('guild-edit-desc').value.trim(),
      p_privacy: document.getElementById('guild-edit-privacy').value,
      p_min_level: parseInt(document.getElementById('guild-edit-minlevel').value, 10) || 1,
    });
    if (error) throw error;
    notify('success', 'Configurações salvas.');
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível salvar.'); }
}
async function guildContributeMission(guildId, amount) {
  if ((G.wallet || 0) < amount) return notify('error', 'Cry insuficiente.');
  try {
    const { data, error } = await supabase.rpc('guild_contribute_mission', { p_guild_id: guildId, p_amount: amount });
    if (error) throw error;
    G.wallet -= amount; saveGame(); updateHeader();
    notify('success', data?.completed ? '🎉 Missão concluída! A guilda ganhou XP.' : `+${amount} pontos de atividade!`);
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível contribuir.'); }
}
async function guildVaultDeposit(guildId) {
  const amount = parseInt(document.getElementById('guild-vault-amount').value, 10);
  if (!amount || amount <= 0) return notify('error', 'Informe um valor válido.');
  if ((G.wallet || 0) < amount) return notify('error', 'Cry insuficiente.');
  try {
    const { error } = await supabase.rpc('guild_vault_deposit', { p_guild_id: guildId, p_amount: amount });
    if (error) throw error;
    G.wallet -= amount; saveGame(); updateHeader();
    notify('success', `+${amount} Cry depositados no cofre.`);
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível depositar.'); }
}
async function guildVaultWithdraw(guildId) {
  const amount = parseInt(document.getElementById('guild-vault-amount').value, 10);
  if (!amount || amount <= 0) return notify('error', 'Informe um valor válido.');
  if (!await confirmDialog(`Sacar ${amount} Cry do cofre da guilda?`, { danger: true })) return;
  try {
    const { error } = await supabase.rpc('guild_vault_withdraw', { p_guild_id: guildId, p_amount: amount });
    if (error) throw error;
    G.wallet += amount; saveGame(); updateHeader();
    notify('success', `${amount} Cry sacados do cofre.`);
    renderGuilds();
  } catch (e) { notify('error', e.message || 'Não foi possível sacar.'); }
}

// ── Perfil público de uma guilda (visto por qualquer um, membro ou não)
async function openGuildProfile(guildId) {
  showModal('Guilda', `<div style="text-align:center;padding:24px;color:var(--text3)">Carregando...</div>`);
  try {
    const { data: g, error } = await supabase.from('guilds').select('*').eq('id', guildId).single();
    if (error) throw error;
    const { count: memberCount } = await supabase.from('guild_members').select('*', { count: 'exact', head: true }).eq('guild_id', guildId);
    const { data: achievements } = await supabase.from('guild_achievements').select('achievement_id').eq('guild_id', guildId);
    const { data: leaderRow } = await supabase.from('guild_members').select('user_id').eq('guild_id', guildId).eq('role', 'leader').maybeSingle();
    let leaderName = '—';
    if (leaderRow) {
      const { data: leaderProf } = await supabase.from('profiles').select('name').eq('id', leaderRow.user_id).maybeSingle();
      leaderName = leaderProf?.name || '—';
    }
    showModal(`${g.emblem} ${g.name}`, `
      <div style="text-align:center">
        <div style="font-size:44px">${g.emblem}</div>
        <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--gold)">${escapeHtml(g.name)} ${g.tag ? `<span style="color:var(--text3);font-size:13px">【${escapeHtml(g.tag)}】</span>` : ''}</div>
        ${g.description ? `<div style="font-size:12px;color:var(--text2);margin:6px 0">"${escapeHtml(g.description)}"</div>` : ''}
        <div style="display:flex;gap:16px;justify-content:center;margin:12px 0;font-size:12px;color:var(--text2)">
          <span>Nv.${g.level}</span><span>🏵️ ${g.honor} Honra</span><span>${memberCount}/${g.member_limit} membros</span>
        </div>
        <div style="font-size:11px;color:var(--text3)">Líder: ${escapeHtml(leaderName)} · ${GUILD_PRIVACY_LABELS[g.privacy]} · Fundada em ${new Date(g.created_at).toLocaleDateString('pt-BR')}</div>
        ${achievements && achievements.length ? `<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px">
          ${achievements.map(a => { const info = GUILD_ACHIEVEMENTS_INFO[a.achievement_id]; return info ? `<span class="badge badge-gold" title="${info.desc}">${info.icon} ${info.name}</span>` : ''; }).join('')}
        </div>` : ''}
      </div>
    `);
  } catch (e) {
    console.error('Erro ao abrir perfil da guilda', e);
    showModal('Guilda', `<div class="empty-state"><div class="empty-sub">Não foi possível carregar essa guilda.</div></div>`);
  }
}

// ── BOSSES ─────────────────────────────────
function renderBosses() {
  const grid = document.getElementById('bosses-grid');
  grid.innerHTML = BOSSES.map(b => `
    <div class="boss-card" onclick="fightBoss('${b.id}')">
      <span class="boss-icon">${b.icon}</span>
      <div class="boss-name">${b.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">${b.desc}</div>
      <div style="font-size:11px;color:var(--text3)">Nível Mín: ${b.level}</div>
      <div style="font-size:12px;color:var(--gold2)">+${b.xp}XP +${b.cry}Cry</div>
      <div style="margin-top:8px"><span class="badge badge-red">HP: ${b.hp}</span></div>
    </div>
  `).join('');
}

function fightBoss(bossId) {
  const b = BOSSES.find(b => b.id === bossId);
  if (!b) return;
  if (G.level < b.level) return notify('error', `Nível insuficiente! Requer Nv.${b.level}`);
  if (G.hp <= 20) return notify('error', 'HP muito baixo! Use poções primeiro.');
  const bossRemaining = battleCooldownRemaining();
  if (bossRemaining > 0) return notify('warn', `⏳ Aguarde ${Math.ceil(bossRemaining/1000)}s para batalhar novamente.`);
  G.lastBattle = Date.now();
  updateBattleCooldown();

  const playerAtk = G.str * 2 + (G.equipped.weapon ? (SHOP_ITEMS.find(i=>i.id===G.equipped.weapon)?.power||0) : 0);
  const playerDef = G.vit + (G.equipped.armor ? (SHOP_ITEMS.find(i=>i.id===G.equipped.armor)?.power||0)*0.5 : 0);
  const rounds = Math.ceil(b.hp / Math.max(1, playerAtk - (b.hp/100)));
  const survived = G.hp > (b.hp / 10) && Math.random() > 0.3;

  if (survived) {
    let xpGain = b.xp;
    if (activeEvent === 'xp') xpGain *= 3;
    gainXP(xpGain);
    G.wallet += b.cry;
    G.totalEarned = (G.totalEarned||0) + b.cry;
    G.bossKills = (G.bossKills||0) + 1;
    G.battles++; G.wins++;
    G.hp = Math.max(10, G.hp - Math.floor(b.hp * 0.1));
    addBankHistory(`Boss kill: ${b.name}`, b.cry);
    addToFeed(`👹 DERROTOU O BOSS ${b.icon} ${b.name}! +${xpGain}XP +${b.cry}Cry`);
    saveGame(); updateHeader(); refreshDashboard();
    notify('success', `👹 Boss derrotado! +${xpGain}XP +${b.cry}Cry`);
    sysLog(`${G.name} derrotou boss ${b.name}`);
  } else {
    G.hp = Math.max(1, Math.floor(G.hp * 0.3));
    G.battles++; G.losses++;
    addToFeed(`💀 Derrotado pelo boss ${b.icon} ${b.name}...`);
    saveGame(); refreshDashboard();
    notify('error', `💀 O boss ${b.name} te derrotou! HP crítico.`);
  }
}

// ── MAP ────────────────────────────────────
// ── MAPA 2D ANDÁVEL (estilo Pokémon) ────────
let _mapKeyListenerAttached = false;
let _mapLastDir = 'down';

function terrainClassFor(z) {
  const n = z.name.toLowerCase();
  if (/(vilarejo|capital|forte|castelo|feira)/.test(n)) return 'terrain-town';
  if (/(floresta)/.test(n)) return 'terrain-forest';
  if (/(montanha|pico|mina)/.test(n)) return 'terrain-mountain';
  if (/(deserto)/.test(n)) return 'terrain-desert';
  if (/(tundra|gelado)/.test(n)) return 'terrain-snow';
  if (/(costa|pântano|abismo)/.test(n)) return 'terrain-water';
  if (/(vulcão|guerra)/.test(n)) return 'terrain-volcano';
  if (/(ruínas|templo|caverna|torre|portal)/.test(n)) return 'terrain-ruins';
  if (/(vale|planície)/.test(n)) return 'terrain-forest';
  if (/(ninho)/.test(n)) return 'terrain-volcano';
  return 'terrain-forest';
}

function renderMap() {
  const grid = document.getElementById('world-grid');
  if (!grid) return;
  G.mapPos = G.mapPos || { x: 0, y: 0 };
  grid.innerHTML = MAP_ZONES.map((z, i) => {
    const x = i % MAP_COLS, y = Math.floor(i / MAP_COLS);
    return `<div class="map-cell ${terrainClassFor(z)} mc-danger-${z.danger}" id="map-cell-${x}-${y}" onclick="walkToZone(${x},${y})" title="${escapeHtml(z.name)}"><span class="map-cell-icon">${z.icon}</span></div>`;
  }).join('') + `<div class="map-player-token" id="map-player-token"><span id="map-player-sprite">${G.avatarPhoto ? '🧑' : (G.avatar || '🚶')}</span></div>`;
  positionPlayerToken(false);
  showZoneInfo(zoneAt(G.mapPos.x, G.mapPos.y));

  if (!_mapKeyListenerAttached) {
    _mapKeyListenerAttached = true;
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('panel-mapa')?.classList.contains('active')) return;
      if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      const map = { ArrowUp:[0,-1], w:[0,-1], ArrowDown:[0,1], s:[0,1], ArrowLeft:[-1,0], a:[-1,0], ArrowRight:[1,0], d:[1,0] };
      const move = map[e.key];
      if (move) { e.preventDefault(); moveOnMap(move[0], move[1]); }
    });
  }
}


function positionPlayerToken(animate) {
  const token = document.getElementById('map-player-token');
  if (!token) return;
  const { x, y } = G.mapPos;
  token.style.transition = animate ? 'transform .18s ease' : 'none';
  token.style.transform = `translate(${x * 55}px, ${y * 55}px)`;
  if (animate) {
    const sprite = document.getElementById('map-player-sprite');
    if (sprite) {
      sprite.style.setProperty('--flip', _mapLastDir === 'left' ? -1 : 1);
      sprite.classList.remove('map-walk-bob'); void sprite.offsetWidth; sprite.classList.add('map-walk-bob');
    }
  }
}

function moveOnMap(dx, dy) {
  if (!G.name) return;
  G.mapPos = G.mapPos || { x: 0, y: 0 };
  const nx = Math.min(MAP_COLS - 1, Math.max(0, G.mapPos.x + dx));
  const ny = Math.min(MAP_ROWS - 1, Math.max(0, G.mapPos.y + dy));
  if (nx === G.mapPos.x && ny === G.mapPos.y) return;
  if (dx > 0) _mapLastDir = 'right'; else if (dx < 0) _mapLastDir = 'left';
  G.mapPos = { x: nx, y: ny };
  saveGame();
  positionPlayerToken(true);
  const zone = zoneAt(nx, ny);
  showZoneInfo(zone);
  maybeTriggerEncounter(zone, nx, ny);
}

function walkToZone(x, y) {
  // Clique direto numa casa: anda o caminho em linha reta (eixo a eixo), disparando encontros no percurso
  const path = [];
  let cx = G.mapPos.x, cy = G.mapPos.y;
  while (cx !== x) { const step = (x > cx) ? 1 : -1; _mapLastDir = step > 0 ? 'right' : 'left'; cx += step; path.push({ x: cx, y: cy }); }
  while (cy !== y) { cy += (y > cy) ? 1 : -1; path.push({ x: cx, y: cy }); }
  let i = 0;
  const step = () => {
    if (i >= path.length || battleInProgress) return;
    const p = path[i++];
    G.mapPos = p; saveGame(); positionPlayerToken(true);
    const zone = zoneAt(p.x, p.y);
    showZoneInfo(zone);
    if (maybeTriggerEncounter(zone, p.x, p.y)) return; // para o percurso se cair em batalha
    setTimeout(step, 220);
  };
  step();
}

function maybeTriggerEncounter(zone, x, y) {
  const chance = encounterChanceFor(zone.danger);
  if (chance <= 0 || Math.random() >= chance) return false;
  if (battleInProgress || battleCooldownRemaining() > 0 || G.hp <= 0) return false;
  const cell = document.getElementById(`map-cell-${x}-${y}`);
  if (cell) cell.classList.add('mc-encounter-flash');
  const monsterId = monsterForDanger(zone.danger);
  const m = MONSTERS[monsterId];
  notify('warn', `⚔️ Um ${m ? m.name : 'monstro'} selvagem apareceu em ${zone.name}!`);
  setTimeout(() => { navigate('batalha'); startBattle(monsterId); }, 500);
  return true;
}

function showZoneInfo(z) {
  const zinfo = document.getElementById('zone-info');
  if (!zinfo) return;
  const dangerLabels = ['🟢 Seguro','🟡 Perigoso','🟠 Muito Perigoso','🔴 Perigo Alto','☠️ Extremo','💀 Mortal'];
  const dangerBadge = ['badge-green','badge-orange','badge-orange','badge-red','badge-red','badge-red'][z.danger];
  zinfo.innerHTML = `
    <div style="font-size:28px;text-align:center;margin-bottom:8px">${z.icon}</div>
    <div style="color:var(--gold);font-family:'Cinzel',serif;margin-bottom:6px;text-align:center">${escapeHtml(z.name)}</div>
    <div class="badge ${dangerBadge}" style="display:block;text-align:center;margin-bottom:8px">${dangerLabels[z.danger]}</div>
    <div style="color:var(--text2);font-size:12px;text-align:center">${z.danger === 0 ? 'Nenhum monstro por aqui — área tranquila.' : `Chance de encontro selvagem: ${Math.round(encounterChanceFor(z.danger)*100)}% a cada passo.`}</div>
  `;
}

// ── COLLECT ────────────────────────────────
function collect(type, itemId, icon) {
  if (G.energy < 10) return notify('error', 'Sem energia para coletar! Coma algo.');
  const chance = Math.random();
  if (chance < 0.2) { notify('warn', '❌ Coleta falhou. Tente novamente.'); return; }

  const itemDef = { id: itemId, name: itemId.replace(/_/g,' '), icon, type:'material', rarity: chance > 0.95 ? 'epic' : chance > 0.85 ? 'rare' : chance > 0.7 ? 'uncommon' : 'common', qty:1, power:0, desc:'Material coletado' };
  addToInventory(itemDef);
  G.energy = Math.max(0, G.energy - 5);
  G.hunger = Math.max(0, G.hunger - 5);
  G.collectProgress = G.collectProgress || {};
  G.collectProgress[type] = (G.collectProgress[type] || 0) + 1;
  G.itemsCollected = (G.itemsCollected||0) + 1;

  const xpMap = { mineracao:10, pesca:8, caca:12, coleta:6 };
  gainXP(xpMap[type]||8);
  updateQuestProgress('collect', 1);
  addToFeed(`${icon} Coletou ${itemDef.name} (${itemDef.rarity})`);
  saveGame(); updateHeader();
  notify('success', `${icon} ${itemDef.name} coletado! (${itemDef.rarity})`);
}

// ── FOOD ───────────────────────────────────
function consumeFood() {
  const food = G.inventory.find(i => i.type === 'food');
  if (!food) return notify('error', 'Sem comida no inventário! Compre no mercado.');
  useItem(food.id);
}

// ── FRIENDS ────────────────────────────────
// Pedidos de amizade de verdade, entre contas diferentes, guardados na
// tabela friend_requests (ver social-setup.sql). Substitui a versão
// antiga, que só colocava um texto numa lista local — sem pedido, sem
// aceite, sem a outra pessoa nunca saber que tinha sido "adicionada".

async function getFriendsList() {
  const me = myId();
  if (!me) return [];
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('from_id, to_id')
      .eq('status', 'accepted')
      .or(`from_id.eq.${me},to_id.eq.${me}`);
    if (error) throw error;
    const otherIds = (data || []).map(r => r.from_id === me ? r.to_id : r.from_id);
    if (!otherIds.length) return [];
    const { data: profs, error: perr } = await supabase.from('profiles').select('id,name,avatar,level,class').in('id', otherIds);
    if (perr) throw perr;
    return profs || [];
  } catch (e) {
    console.error('Erro ao buscar amigos', e);
    return [];
  }
}

async function renderFriendsPanel() {
  const listEl = document.getElementById('friends-list');
  const reqEl = document.getElementById('friend-requests');
  if (!listEl || !reqEl) return;
  const me = myId();
  if (!me) return;

  const friends = await getFriendsList();
  listEl.innerHTML = friends.length ? friends.map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--purple2),var(--cyan2));display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer" onclick="openPublicProfile(${JSON.stringify(f.name).replace(/"/g, '&quot;')})">👤</div>
      <span style="font-size:13px;cursor:pointer" onclick="openPublicProfile(${JSON.stringify(f.name).replace(/"/g, '&quot;')})">${escapeHtml(f.name)}</span>
      <button class="btn btn-sm" style="margin-left:auto" onclick="startDMWithFriend('${f.id}','${escapeHtml(f.name).replace(/'/g,"\\'")}')" title="Conversar">💬</button>
      <button class="btn btn-sm btn-danger" onclick="removeFriend('${f.id}','${escapeHtml(f.name).replace(/'/g,"\\'")}')">-</button>
    </div>
  `).join('') : `<div class="empty-state">
    <div class="empty-icon">🤝</div>
    <div class="empty-title">Você ainda não tem amigos adicionados</div>
    <div class="empty-sub">Use o campo "@nomedousuario" acima para encontrar outros aventureiros e enviar pedidos de amizade.</div>
  </div>`;

  try {
    const { data: incoming, error } = await supabase
      .from('friend_requests')
      .select('id, from_id')
      .eq('to_id', me).eq('status', 'pending');
    if (error) throw error;
    if (!incoming || !incoming.length) {
      reqEl.innerHTML = `<div class="empty-state" style="padding:20px 16px">
        <div class="empty-icon">📭</div>
        <div class="empty-sub">Nenhuma solicitação pendente no momento.</div>
      </div>`;
      return;
    }
    const fromIds = incoming.map(r => r.from_id);
    const { data: profs } = await supabase.from('profiles').select('id,name').in('id', fromIds);
    const nameOf = id => (profs || []).find(p => p.id === id)?.name || 'Alguém';
    reqEl.innerHTML = incoming.map(r => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;flex:1;text-align:left">${escapeHtml(nameOf(r.from_id))} quer ser seu amigo</span>
        <button class="btn btn-sm btn-success" onclick="respondFriendRequest('${r.id}',true)">✓</button>
        <button class="btn btn-sm btn-danger" onclick="respondFriendRequest('${r.id}',false)">✕</button>
      </div>
    `).join('');
  } catch (e) {
    console.error('Erro ao buscar solicitações de amizade', e);
    reqEl.innerHTML = '<div style="color:var(--red);font-size:12px;padding:10px;text-align:center">Erro ao carregar solicitações.</div>';
  }
}

// ── Busca de usuário estilo @usuario (autocomplete), reutilizada nos
// campos de Amigos, PIX, PvP e Casamento. Não muda a lógica de quem
// consome o valor final do input — só ajuda a preencher mais rápido.
let _userSearchTimers = {};

async function userSearchInput(inputId, viewMode = false) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(inputId + '-results');
  if (!input || !box) return;
  const term = _stripAt(input.value);
  clearTimeout(_userSearchTimers[inputId]);
  if (term.length < 2) { box.classList.remove('open'); box.innerHTML = ''; return; }
  _userSearchTimers[inputId] = setTimeout(async () => {
    try {
      const cols = 'id,name,username,avatar,avatar_photo,level,class';
      // duas consultas separadas em vez de um filtro .or() cru — evita o
      // bug em que ponto/vírgula no termo buscado quebrava o parser do
      // PostgREST e mostrava um erro confuso de "coluna não existe"
      const [byName, byUsername] = await Promise.all([
        supabase.from('profiles').select(cols).ilike('name', `%${term}%`).limit(8),
        supabase.from('profiles').select(cols).ilike('username', `%${term}%`).limit(8),
      ]);
      if (byName.error) throw byName.error;
      if (byUsername.error) throw byUsername.error;
      const merged = new Map();
      [...(byName.data || []), ...(byUsername.data || [])].forEach(p => merged.set(p.id, p));
      const data = [...merged.values()];
      const me = (typeof myId === 'function') ? myId() : null;
      const results = data.filter(p => p.id !== me).slice(0, 8);
      if (!results.length) {
        box.innerHTML = '<div class="user-search-empty">Nenhum usuário encontrado</div>';
        box.classList.add('open');
        return;
      }
      box.innerHTML = results.map(p => `
        <div class="user-search-item" onmousedown="${viewMode ? `openPublicProfile(${JSON.stringify(p.username || p.name).replace(/"/g, '&quot;')})` : `userSearchPick('${inputId}', ${JSON.stringify(p.name).replace(/"/g, '&quot;')})`}">
          <div class="usr-avatar">${p.avatar_photo ? `<img src="${p.avatar_photo}" alt="">` : (p.avatar ? `<img src="${p.avatar}" alt="">` : (p.name || '?').slice(0,1).toUpperCase())}</div>
          <div>
            <div class="usr-name">${p.username ? `<span class="at">@</span>${p.username}` : escapeHtml(p.name)}</div>
            <div class="usr-meta">${p.username ? escapeHtml(p.name) + ' · ' : ''}${p.class ? p.class + ' · ' : ''}Nível ${p.level ?? 1}</div>
          </div>
        </div>`).join('');
      box.classList.add('open');
    } catch (e) {
      console.error('Erro na busca de usuário', e);
      box.classList.remove('open');
    }
  }, 250);
}

function userSearchPick(inputId, name) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(inputId + '-results');
  if (input) input.value = name;
  if (box) { box.classList.remove('open'); box.innerHTML = ''; }
}

function userSearchBlur(inputId) {
  // pequeno atraso pra o clique (onmousedown) no resultado disparar antes do blur fechar a lista
  setTimeout(() => {
    const box = document.getElementById(inputId + '-results');
    if (box) box.classList.remove('open');
  }, 150);
}

// ── Visualizar perfil público de outro usuário (por @usuario) ──────────
// Mostra o perfil exatamente como a pessoa configurou: avatar, moldura,
// banner (com animação) e bio — sem precisar ser amigo.
// ── Busca global de pessoas — acessível de qualquer tela pelo ícone 🔍
// no cabeçalho (antes só existia escondida dentro da tela de Perfil).
function openGlobalProfileSearch() {
  showModal('🔍 Buscar Pessoas', `
    <div class="user-search-wrap">
      <input class="form-input" id="global-profile-search" placeholder="@nomedousuario ou nome" autocomplete="off" oninput="userSearchInput('global-profile-search', true)" onblur="userSearchBlur('global-profile-search')" autofocus>
      <div class="user-search-results" id="global-profile-search-results"></div>
    </div>
    <div style="font-size:12px;color:var(--crydan-text-muted);margin-top:10px;text-align:center">Digite pelo menos 2 letras do @usuário ou do nome do aventureiro.</div>
  `);
  setTimeout(() => document.getElementById('global-profile-search')?.focus(), 100);
}

async function openPublicProfileById(userId) {
  showModal('Perfil', `<div style="text-align:center;padding:30px;color:var(--text3)">Carregando perfil...</div>`);
  try {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (!profile) {
      showModal('Perfil não encontrado', `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-sub">Não encontramos esse perfil.</div></div>`);
      return;
    }
    renderPublicProfileModal(profile);
  } catch (e) {
    console.error('Erro ao abrir perfil público', e);
    showModal('Erro', `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar esse perfil agora.</div></div>`);
  }
}

async function openPublicProfile(handleOrName) {
  const box = document.getElementById('public-profile-search-results');
  if (box) { box.classList.remove('open'); box.innerHTML = ''; }
  const search = document.getElementById('public-profile-search');
  if (search) search.value = '';

  showModal('Perfil', `<div style="text-align:center;padding:30px;color:var(--text3)">Carregando perfil...</div>`);
  try {
    let { data: profile, error } = await supabase.from('profiles')
      .select('*').eq('username', handleOrName).maybeSingle();
    if (error) throw error;
    if (!profile) {
      const r2 = await supabase.from('profiles').select('*').ilike('name', handleOrName).maybeSingle();
      if (r2.error) throw r2.error;
      profile = r2.data;
    }
    if (!profile) {
      showModal('Perfil não encontrado', `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-sub">Não encontramos nenhum aventureiro com esse @usuario.</div></div>`);
      return;
    }
    renderPublicProfileModal(profile);
  } catch (e) {
    console.error('Erro ao abrir perfil público', e);
    showModal('Erro', `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar esse perfil agora.</div></div>`);
  }
}

function verifiedBadgeHtml(p) {
  if (!p || !p.verified_badge) return '';
  const map = {
    admin:    { color: '#3b9dff', title: 'Administrador' },
    partner:  { color: '#3ecf6a', title: 'Parceria' },
    owner:    { color: '#e0433d', title: 'Dono' },
    subowner: { color: '#b24bf3', title: 'Subdono' },
  };
  const b = map[p.verified_badge];
  if (!b) return '';
  return `<svg viewBox="0 0 24 24" width="16" height="16" style="display:inline-block;vertical-align:-2px;margin-left:3px" title="${b.title}"><path fill="${b.color}" d="M12 2l2.4 2.2 3.2-.6.9 3.1 3 1.3-1 3.1 1 3.1-3 1.3-.9 3.1-3.2-.6L12 22l-2.4-2.2-3.2.6-.9-3.1-3-1.3 1-3.1-1-3.1 3-1.3.9-3.1 3.2.6z"/><path fill="#fff" d="M9.9 12.4l1.7 1.7 3.6-3.9-1-1-2.7 2.9-.8-.8z"/></svg>`;
}

function renderPublicProfileModal(p) {
  const preset = BANNER_PRESETS.find(b => b.id === p.banner_preset);
  const bannerCss = p.banner_image ? `background-image:url('${p.banner_image}');background-size:cover;background-position:center` : `background:${preset ? preset.css : BANNER_PRESETS[0].css}`;
  const bannerAnimClass = p.banner_anim && p.banner_anim !== 'none' && !p.banner_anim.startsWith('lottie:') ? `anim-${p.banner_anim}` : '';
  const avatarInner = p.avatar_photo ? `<img src="${p.avatar_photo}" alt="Avatar de ${escapeHtml(p.name)}">` : (p.avatar || '⚔️');
  const me = myId();
  const isMe = me && p.id === me;

  showModal(`Perfil de ${escapeHtml(p.name)}`, `
    <div class="ppv-banner-wrap" style="margin:-18px -18px 0;position:relative">
      <div class="profile-banner ${bannerAnimClass}" id="ppv-banner" style="${bannerCss};height:150px;position:relative;overflow:hidden">
        <div class="banner-fx-slot" id="ppv-banner-fx"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,5,9,0) 45%,rgba(6,5,9,.55) 82%,var(--bg2) 100%)"></div>
      </div>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-end;margin-top:-40px;position:relative;z-index:2;padding:0 2px">
      <div class="story-ring-wrap" id="ppv-story-ring" onclick="viewUserStory('${p.id}', ${JSON.stringify(p.name).replace(/"/g, '&quot;')})">
        <div class="avatar-frame-wrap" id="ppv-avatar-wrap" style="width:84px;height:84px;flex-shrink:0">
          <div class="profile-avatar" style="width:84px;height:84px;font-size:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:var(--bg3);border:3px solid var(--bg2);box-shadow:0 0 0 1px rgba(212,175,55,.35),0 6px 18px rgba(0,0,0,.5)">${avatarInner}</div>
          <div class="frame-svg-slot"></div>
        </div>
      </div>
      <div style="flex:1;min-width:0;padding-bottom:3px">
        <div style="font-size:18px;font-weight:700;font-family:var(--font-display);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 8px rgba(0,0,0,.6)">${escapeHtml(p.name)}${verifiedBadgeHtml(p)} <span id="ppv-guild-tag"></span></div>
        ${p.username ? `<div style="font-size:12.5px;color:var(--gold2)">@${escapeHtml(p.username)}</div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-top:1px">${formatLastSeen(p.last_seen)}</div>
      </div>
    </div>

    <div style="display:flex;gap:18px;font-size:13px;color:var(--text2);margin:14px 0 12px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap">
      <span id="ppv-post-count"><b style="color:var(--text)">${p.postCount ?? '—'}</b> posts</span>
      <span style="display:flex;gap:18px" id="ppv-follow-counts" data-target-id="${p.id}"><span>—</span></span>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span class="badge badge-purple">⚔️ ${escapeHtml(p.class || 'Aventureiro')}</span>
      <span class="badge badge-gold">✦ Nível ${p.level ?? 1}</span>
    </div>
    ${p.bio ? `<div style="font-size:13px;color:var(--text2);margin:4px 0 14px;line-height:1.55">${escapeHtml(p.bio)}</div>` : ''}
    <div class="cr-stat-row" style="margin-bottom:16px">
      <span class="cr-stat-chip">STR <b style="color:var(--red)">${p.str ?? 10}</b></span>
      <span class="cr-stat-chip">DEX <b style="color:var(--green)">${p.dex ?? 10}</b></span>
      <span class="cr-stat-chip">INT <b style="color:var(--cyan)">${p.int_ ?? 10}</b></span>
      <span class="cr-stat-chip">VIT <b style="color:var(--purple)">${p.vit ?? 10}</b></span>
      <span class="cr-stat-chip">WIS <b style="color:var(--gold2)">${p.wis ?? 10}</b></span>
    </div>
    ${!isMe ? `<div class="ppv-actions-row" style="display:flex;gap:8px;width:100%;margin-bottom:16px">
      <button class="btn btn-primary" id="ppv-follow-btn" style="flex:1" onclick="toggleFollow('${p.id}')">Seguir</button>
      <button class="btn" style="flex:1" onclick="quickAddFriendFromProfile(${JSON.stringify(p.username || p.name).replace(/"/g, '&quot;')})">🤝 Amizade</button>
      <button class="btn" style="flex:1" onclick="quickChallengeFromProfile(${JSON.stringify(p.username || p.name).replace(/"/g, '&quot;')})">⚔️ Desafiar</button>
    </div>` : `<div style="font-size:12px;color:var(--crydan-text-muted);margin-bottom:16px">Este é o seu perfil público — edite em Configurações.</div>`}
    ${(p.favorite_songs && p.favorite_songs.length) ? `
    <div style="width:100%;margin-bottom:16px;text-align:left">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">🎵 Músicas favoritas</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">
        ${p.favorite_songs.slice(0, 10).map(s => `
          <div style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:6px">
            <img src="${s.thumb}" style="width:44px;height:32px;object-fit:cover;border-radius:6px;flex-shrink:0" alt="">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.title)}</div>
              <div style="font-size:10px;color:var(--text3)">${escapeHtml(s.channel || '')}</div>
            </div>
            <button class="call-icon-btn" style="width:30px;height:30px;font-size:12px" onclick="playSong(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Tocar">▶️</button>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="border-top:1px solid var(--border);margin:0 -18px;padding:14px 18px 0">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">📝 Publicações</div>
      <div id="ppv-posts-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">
        <div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:12px;padding:16px">Carregando...</div>
      </div>
    </div>
  `);
  if (p.avatar_frame && p.avatar_frame !== 'none') {
    setTimeout(() => {
      const wrap = document.getElementById('ppv-avatar-wrap');
      if (wrap) applyFrameToWrap(wrap, p.avatar_frame, { customFrameImage: p.custom_frame_image, customRingColor: p.custom_ring_color });
    }, 30);
  }
  if (p.banner_anim && p.banner_anim !== 'none') {
    setTimeout(() => mountBannerFx('ppv-banner-fx', p.banner_anim), 30);
  }
  supabase.from('stories').select('id,close_friends_only').eq('user_id', p.id).gt('expires_at', new Date().toISOString()).limit(1)
    .then(({ data }) => {
      const ring = document.getElementById('ppv-story-ring');
      if (ring) {
        ring.classList.toggle('has-story', !!(data && data.length));
        ring.classList.toggle('close-friends-story', !!(data && data.length && data[0].close_friends_only));
      }
    });
  loadFollowState(p.id);
  loadProfilePosts(p.id);
  fetchGuildTagsForUsers([p.id]).then(tags => {
    const el = document.getElementById('ppv-guild-tag');
    if (el && tags[p.id]) el.innerHTML = `<span style="color:var(--text3);font-weight:400;font-size:13px;cursor:pointer" onclick="openGuildProfileByTag('${tags[p.id]}')">【${escapeHtml(tags[p.id])}】</span>`;
  });
}

// ── Publicações de um perfil, mostradas direto dentro do modal de
// perfil público (antes só apareciam no feed geral de Publicações).
async function loadProfilePosts(userId) {
  const el = document.getElementById('ppv-posts-grid');
  if (!el) return;
  try {
    const { data: posts, error } = await supabase.from('posts')
      .select('id,text,image,video,created_at').eq('author_id', userId)
      .order('created_at', { ascending: false }).limit(30);
    if (error) throw error;

    const countEl = document.getElementById('ppv-post-count');
    if (countEl) countEl.innerHTML = `<b style="color:var(--text)">${posts ? posts.length : 0}</b> posts`;

    if (!posts || !posts.length) {
      el.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:12px;padding:20px">Nenhuma publicação ainda.</div>`;
      return;
    }
    window._ppvPostsById = Object.fromEntries(posts.map(pp => [pp.id, pp]));
    el.innerHTML = posts.map(post => {
      if (post.video) {
        return `<div style="aspect-ratio:1;cursor:pointer;background:var(--bg4);border-radius:2px;position:relative;display:flex;align-items:center;justify-content:center" onclick="openPostLightbox('${post.id}')">
          <span style="font-size:22px;color:var(--text2)">▶</span>
        </div>`;
      }
      if (post.image) {
        // post.image nunca deveria conter aspas de verdade (é uma URL); removê-las
        // impede que alguém quebre o contexto CSS url('...')/atributo style="..."
        const safeImg = safeMediaUrl(post.image);
        return `<div style="aspect-ratio:1;cursor:pointer;background:url('${safeImg}') center/cover;border-radius:2px" onclick="openPostLightbox('${post.id}')"></div>`;
      }
      const preview = (post.text || '').slice(0, 90);
      return `<div style="aspect-ratio:1;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:8px;overflow:hidden;display:flex;align-items:center" onclick="openPostLightbox('${post.id}')">
        <span style="font-size:10.5px;color:var(--text2);line-height:1.35;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(preview)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar publicações do perfil', e);
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:12px;padding:20px">Não foi possível carregar as publicações.</div>`;
  }
}

function openPostLightbox(postId) {
  const post = (window._ppvPostsById || {})[postId];
  if (!post) return;
  showModal('Publicação', `
    <div>
      ${post.video ? `<video src="${post.video}" controls preload="metadata" style="width:100%;border-radius:8px;margin-bottom:10px;display:block"></video>` : ''}
      ${post.image ? `<img src="${post.image}" style="width:100%;border-radius:8px;margin-bottom:10px" alt="">` : ''}
      ${post.text ? `<div style="font-size:14px;color:var(--text);white-space:pre-wrap;line-height:1.5">${escapeHtml(post.text)}</div>` : ''}
      <div style="font-size:11px;color:var(--text3);margin-top:10px">${new Date(post.created_at).toLocaleString('pt-BR')}</div>
    </div>
  `);
}

// ── Seguir (estilo Instagram) — diferente de Amizade: não precisa de
// aceite mútuo, e qualquer um pode seguir um perfil público direto.
let _followState = { targetId: null, amFollowing: false };
async function loadFollowState(targetId) {
  const me = myId();
  try {
    const [{ count: followers }, { count: following }, mine] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      me ? supabase.from('follows').select('follower_id').eq('follower_id', me).eq('followed_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const countsEl = document.getElementById('ppv-follow-counts');
    if (countsEl) countsEl.innerHTML = `
      <span style="cursor:pointer" onclick="showFollowList('${targetId}','followers')"><b style="color:var(--text)">${followers || 0}</b> seguidores</span>
      <span style="cursor:pointer" onclick="showFollowList('${targetId}','following')"><b style="color:var(--text)">${following || 0}</b> seguindo</span>`;
    _followState = { targetId, amFollowing: !!(mine && mine.data) };
    const btn = document.getElementById('ppv-follow-btn');
    if (btn) {
      btn.textContent = _followState.amFollowing ? '✓ Seguindo' : 'Seguir';
      btn.className = _followState.amFollowing ? 'btn' : 'btn btn-primary';
    }
  } catch (e) {
    console.error('Erro ao carregar seguidores', e);
    const countsEl = document.getElementById('ppv-follow-counts');
    if (countsEl && (e.message || '').includes('relation "public.follows" does not exist')) {
      countsEl.innerHTML = `<span style="color:var(--crydan-text-muted)">Sistema de seguir ainda não configurado</span>`;
      const btn = document.getElementById('ppv-follow-btn');
      if (btn) { btn.disabled = true; btn.title = 'Rode follow-setup.sql no Supabase'; }
    }
  }
}
async function toggleFollow(targetId) {
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  const btn = document.getElementById('ppv-follow-btn');
  const wasFollowing = _followState.amFollowing;
  try {
    if (wasFollowing) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('followed_id', targetId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('follows').insert([{ follower_id: me, followed_id: targetId }]);
      if (error && error.code !== '23505') throw error;
    }
    await loadFollowState(targetId);
  } catch (e) {
    console.error('Erro ao seguir/deixar de seguir', e);
    notify('error', 'Não foi possível fazer isso agora.');
  }
}

// ── Mostra pra você mesmo quantos seguidores/seguindo você tem, direto
// na sua própria aba de Perfil (antes só dava pra ver isso no perfil
// público de outra pessoa).
async function loadOwnFollowCounts() {
  const el = document.getElementById('own-follow-counts');
  const me = myId();
  if (!el || !me) return;
  try {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', me),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', me),
    ]);
    el.innerHTML = `
      <span style="cursor:pointer" onclick="showFollowList('${me}','followers')"><b style="color:var(--text)">${followers || 0}</b> seguidores</span>
      <span style="cursor:pointer" onclick="showFollowList('${me}','following')"><b style="color:var(--text)">${following || 0}</b> seguindo</span>`;
  } catch (e) {
    console.error('Erro ao carregar seus seguidores/seguindo', e);
    el.innerHTML = `<span style="color:var(--text3)">Não foi possível carregar agora.</span>`;
  }
}

// ── Lista de seguidores/seguindo (estilo Instagram) — cada linha abre
// o perfil público daquela pessoa, inclusive dentro do próprio modal.
async function showFollowList(targetId, kind) {
  const title = kind === 'followers' ? 'Seguidores' : 'Seguindo';
  showModal(title, `<div style="text-align:center;padding:24px;color:var(--text3)">Carregando...</div>`);
  try {
    const col = kind === 'followers' ? 'follower_id' : 'followed_id';
    const other = kind === 'followers' ? 'followed_id' : 'follower_id';
    const { data: rows, error } = await supabase.from('follows').select(col).eq(other, targetId).limit(200);
    if (error) throw error;
    const ids = [...new Set((rows || []).map(r => r[col]))];
    if (!ids.length) {
      showModal(title, `<div class="empty-state"><div class="empty-icon">${kind === 'followers' ? '👥' : '🧭'}</div><div class="empty-sub">${kind === 'followers' ? 'Ninguém segue esse perfil ainda.' : 'Esse perfil ainda não segue ninguém.'}</div></div>`);
      return;
    }
    const { data: profs, error: e2 } = await supabase.from('profiles').select('id,name,username,avatar,avatar_photo,level,class').in('id', ids);
    if (e2) throw e2;
    showModal(title, `<div style="display:flex;flex-direction:column;gap:2px;max-height:60vh;overflow-y:auto">
      ${(profs || []).map(p => `
        <div class="user-search-item" onmousedown="openPublicProfile(${JSON.stringify(p.username || p.name)})">
          <div class="usr-avatar">${p.avatar_photo ? `<img src="${p.avatar_photo}" alt="">` : (p.avatar || (p.name||'?').slice(0,1).toUpperCase())}</div>
          <div>
            <div class="usr-name">${p.username ? `<span class="at">@</span>${escapeHtml(p.username)}` : escapeHtml(p.name)}</div>
            <div class="usr-meta">${p.username ? escapeHtml(p.name) + ' · ' : ''}${p.class ? p.class + ' · ' : ''}Nível ${p.level ?? 1}</div>
          </div>
        </div>`).join('')}
    </div>`);
  } catch (e) {
    console.error('Erro ao carregar lista de seguidores/seguindo', e);
    showModal(title, `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar essa lista agora.</div></div>`);
  }
}

function quickAddFriendFromProfile(handle) {
  closeModalDirect();
  navigate('amigos');
  setTimeout(() => {
    const input = document.getElementById('friend-name');
    if (input) { input.value = handle; addFriend(); }
  }, 200);
}
function quickChallengeFromProfile(handle) {
  closeModalDirect();
  navigate('batalha');
  setTimeout(() => {
    const input = document.getElementById('pvp-target');
    if (input) input.value = handle;
  }, 200);
}

// ── Busca segura de perfil por @usuario OU nome de exibição ────────────
// Antes disso usava supabase.or(`name.ilike.${x},username.eq.${x}`) —
// quebrava com "column profiles.name does not exist" sempre que o texto
// buscado tinha ponto, vírgula ou outro caractere especial de filtro do
// PostgREST (comum agora que @usuario aceita ponto). Em vez de montar
// filtro cru, faz duas consultas simples e seguras.
async function findProfileByNameOrUsername(term, columns = 'id,name') {
  const clean = (term || '').trim();
  if (!clean) return null;
  const byUsername = await supabase.from('profiles').select(columns).eq('username', clean.toLowerCase()).maybeSingle();
  if (byUsername.error) throw byUsername.error;
  if (byUsername.data) return byUsername.data;
  const byName = await supabase.from('profiles').select(columns).ilike('name', clean).maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data || null;
}

async function addFriend() {
  const name = _stripAt(document.getElementById('friend-name').value);
  if (!name) return notify('error', 'Informe o nome');
  if (name.toLowerCase() === (G.name || '').toLowerCase()) return notify('error', 'Você não pode se adicionar!');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  try {
    const target = await findProfileByNameOrUsername(name, 'id,name');
    if (!target) { notify('error', `Nenhum jogador chamado "${name}" foi encontrado.`); return; }
    const { error } = await supabase.from('friend_requests').insert([{ from_id: me, to_id: target.id }]);
    if (error) {
      if (error.code === '23505') notify('warn', 'Vocês já são amigos ou já existe um pedido pendente.');
      else throw error;
    } else {
      notify('success', `Pedido de amizade enviado para ${target.name}!`);
      addToFeed(`🤝 Enviou pedido de amizade para ${target.name}`);
    }
  } catch (e) {
    console.error('Erro ao adicionar amigo', e);
    notify('error', 'Não foi possível enviar o pedido: ' + (e.message || 'erro desconhecido'));
  }
  document.getElementById('friend-name').value = '';
  renderFriendsPanel();
}

async function respondFriendRequest(id, accept) {
  try {
    if (accept) {
      const { error } = await supabase.from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      notify('success', 'Pedido de amizade aceito!');
    } else {
      const { error } = await supabase.from('friend_requests').delete().eq('id', id);
      if (error) throw error;
      notify('info', 'Pedido recusado.');
    }
  } catch (e) {
    console.error('Erro ao responder pedido de amizade', e);
    notify('error', 'Não foi possível responder ao pedido.');
  }
  renderFriendsPanel();
}

async function removeFriend(friendId, friendName) {
  if (!await confirmDialog(`Remover ${friendName} dos seus amigos?`, { danger: true })) return;
  const me = myId();
  try {
    const { error } = await supabase.from('friend_requests').delete()
      .eq('status', 'accepted')
      .or(`and(from_id.eq.${me},to_id.eq.${friendId}),and(from_id.eq.${friendId},to_id.eq.${me})`);
    if (error) throw error;
    notify('info', `${friendName} removido.`);
  } catch (e) {
    console.error('Erro ao remover amigo', e);
    notify('error', 'Não foi possível remover.');
  }
  renderFriendsPanel();
}

// ── MARRIAGE ───────────────────────────────
function proposeMarriage() {
  const target = _stripAt(document.getElementById('marry-target').value);
  if (!target) return notify('error', 'Informe o nome do(a) parceiro(a)');
  if (G.wallet < 200) return notify('error', 'Precisa de 200 Cry para o pedido!');
  if (G.married) return notify('warn', 'Você já é casado(a)!');
  G.wallet -= 200;
  G.married = target;
  document.getElementById('marriage-panel').innerHTML = `
    <div class="marriage-display">
      <div style="font-size:48px;margin-bottom:10px">💍</div>
      <div style="font-family:'Cinzel',serif;font-size:18px;color:#cc88ff;margin-bottom:6px">Casado(a)!</div>
      <div style="color:var(--text2);font-size:14px">Você e <b style="color:#ff88cc">${target}</b> estão juntos em Crydan</div>
      <div style="margin-top:12px;font-size:12px;color:var(--text3)">Bônus: +10% XP para ambos</div>
      <button class="btn btn-danger" style="margin-top:16px" onclick="divorce()">💔 Divorciar-se (100 Cry)</button>
    </div>
  `;
  updateQuestProgress('marry', 1);
  addToFeed(`💍 Se casou com ${target}!`);
  saveGame(); updateHeader();
  notify('success', `💍 Casado(a) com ${target}!`);
  sysLog(`${G.name} se casou com ${target}`);
}

function divorce() {
  if (G.wallet < 100) return notify('error', 'Precisa de 100 Cry para o divórcio');
  G.wallet -= 100;
  const ex = G.married;
  G.married = null;
  addToFeed(`💔 Se divorciou de ${ex}`);
  saveGame(); updateHeader();
  document.getElementById('marriage-panel').innerHTML = `<div style="text-align:center;padding:20px;color:var(--text2)">Você está solteiro(a) novamente.</div>`;
  notify('info', '💔 Divorciado(a).');
}

// ── RANKING ────────────────────────────────
async function renderRanking() {
  const tables = ['rank-level-table', 'rank-wealth-table', 'rank-battles-table', 'rank-quests-table'];
  tables.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Carregando ranking...</div>';
  });

  let players = [];
  try {
    const { data, error } = await supabase.from('profiles')
      .select('id,name,username,avatar,avatar_photo,level,wallet,bank,battles,quests_completed')
      .order('level', { ascending: false })
      .limit(200);
    if (error) throw error;
    players = data || [];
  } catch (e) {
    console.error('Erro ao carregar ranking', e);
    tables.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar o ranking agora.</div></div>`;
    });
    return;
  }

  const me = myId();
  // garante que EU apareço com meus dados mais atuais, mesmo se a
  // sincronização do perfil ainda não rodou nos últimos segundos
  const myEntry = { id: me, name: G.name, avatar: G.avatar, avatar_photo: G.avatarPhoto || '', level: G.level, wallet: Math.floor((G.wallet||0)+(G.bank||0)), battles: G.battles||0, quests_completed: G.questsCompleted||0 };
  players = players.filter(p => p.id !== me).map(p => ({ ...p, wallet: (p.wallet||0) + (p.bank||0) }));
  players.push(myEntry);

  if (!players.length) {
    tables.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-sub">Ainda não há jogadores suficientes no ranking.</div></div>`;
    });
    return;
  }

  function makeTable(sorted, valueKey, valueLabel, valueFmt) {
    return `<table class="data-table"><thead><tr><th>#</th><th>Jogador</th><th>Nível</th><th>${valueLabel}</th></tr></thead><tbody>` +
      sorted.map((p, i) => {
        const medals = ['🥇','🥈','🥉'];
        const isMe = p.id === me;
        const avatarInner = p.avatar_photo ? `<img src="${p.avatar_photo}" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px">` : (p.avatar || '⚔️') + ' ';
        const displayName = p.username ? `@${escapeHtml(p.username)}` : escapeHtml(p.name || 'Aventureiro');
        return `<tr ${isMe?'style="background:rgba(140,22,33,0.10)"':''}><td style="color:var(--gold2)">${medals[i]||('#'+(i+1))}</td><td style="cursor:pointer" onclick="openPublicProfile(${JSON.stringify(p.username || p.name || '').replace(/"/g, '&quot;')})">${avatarInner}${displayName}${isMe?' <span class="badge badge-gold" style="font-size:9px">Você</span>':''}</td><td><span class="badge badge-purple">Nv.${p.level ?? 1}</span></td><td class="cry">${valueFmt(p[valueKey] || 0)}</td></tr>`;
      }).join('') + '</tbody></table>';
  }

  const fmtNum = n => n.toLocaleString('pt-BR');
  const fmtCry = n => n.toLocaleString('pt-BR') + ' Cry';

  document.getElementById('rank-level-table').innerHTML = makeTable([...players].sort((a,b)=>(b.level||0)-(a.level||0)).slice(0,50), 'level', 'Nível', fmtNum);
  document.getElementById('rank-wealth-table').innerHTML = makeTable([...players].sort((a,b)=>(b.wallet||0)-(a.wallet||0)).slice(0,50), 'wallet', 'Riqueza', fmtCry);
  document.getElementById('rank-battles-table').innerHTML = makeTable([...players].sort((a,b)=>(b.battles||0)-(a.battles||0)).slice(0,50), 'battles', 'Batalhas', fmtNum);
  document.getElementById('rank-quests-table').innerHTML = makeTable([...players].sort((a,b)=>(b.quests_completed||0)-(a.quests_completed||0)).slice(0,50), 'quests_completed', 'Missões', fmtNum);
}

// ── ACHIEVEMENTS ───────────────────────────
function checkAchievements() {
  G.achievements = G.achievements || [];
  const totalCry = G.wallet + G.bank;
  for (const ach of ACHIEVEMENTS) {
    if (G.achievements.includes(ach.id)) continue;
    let unlocked = false;
    if (ach.cond === 'always') unlocked = true;
    else if (ach.cond.includes('>=')) {
      const [key, val] = ach.cond.split('>=');
      const v = key === 'totalCry' ? totalCry : G[key];
      if (v >= parseInt(val)) unlocked = true;
    } else if (ach.cond === 'married' && G.married) unlocked = true;
    else if (ach.cond === 'guild' && myGuildMembership) unlocked = true;
    else if (ach.cond === 'houses>=1' && (G.houses||[]).length >= 1) unlocked = true;

    if (unlocked) {
      G.achievements.push(ach.id);
      notify('success', `🏆 Conquista: ${ach.icon} ${ach.name}!`);
      celebrate('normal');
      sysLog(`${G.name} desbloqueou conquista: ${ach.name}`);
      const rewardFrame = AVATAR_FRAMES.find(f => f.reqAch === ach.id);
      if (rewardFrame) {
        setTimeout(() => notify('success', `🎁 Moldura exclusiva desbloqueada: ${rewardFrame.name}! Equipe na Galeria.`, 6000), 900);
      }
    }
  }
  saveGame();
}

function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = (G.achievements||[]).includes(ach.id);
    return `<div class="achievement ${unlocked?'':'ach-locked'}">
      <div class="ach-icon">${ach.icon}</div>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
      <div class="ach-points">+${ach.pts}pts</div>
      ${unlocked ? '<span class="badge badge-gold">✓</span>' : '<span class="badge badge-gray">🔒</span>'}
    </div>`;
  }).join('');
}

// ── GALLERY ────────────────────────────────
// ══════════════════════════════════════════
// CRYSTAR — moeda premium (dinheiro real)
// ══════════════════════════════════════════
// O saldo (profiles.crystals) só é alterado pela função de banco
// approve_crystal_purchase(), nunca escrito direto pelo cliente —
// por isso G.crystals nunca entra no syncProfile()/upsert de perfil.
// Verifica banimento/suspensão direto na tabela profiles (fonte da
// verdade no servidor) — nunca confia em flag local, exatamente pra
// não deixar brecha pra scripts/exploits que tentam contornar o app.
async function checkModerationStatus() {
  try {
    const me = myId();
    if (!me) return null;
    const { data, error } = await supabase.from('profiles').select('banned, banned_reason, suspended_until, suspended_reason').eq('id', me).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.banned) {
      document.getElementById('banned-reason-text').textContent = data.banned_reason ? `Motivo: ${data.banned_reason}` : '';
      document.getElementById('banned-screen').classList.add('open');
      renderSupportThread('banned');
      return 'banned';
    }
    if (data.suspended_until && new Date(data.suspended_until).getTime() > Date.now()) {
      const until = new Date(data.suspended_until);
      document.getElementById('suspended-until-text').textContent = `Volta a funcionar em: ${until.toLocaleString('pt-BR')}`;
      document.getElementById('suspended-reason-text').textContent = data.suspended_reason ? `Motivo: ${data.suspended_reason}` : '';
      document.getElementById('suspended-screen').classList.add('open');
      renderSupportThread('suspended');
      return 'suspended';
    }
    return null;
  } catch (e) {
    console.error('Erro ao verificar status da conta', e);
    return null;
  }
}

// Mini canal de suporte disponível mesmo pra quem está banido/suspenso
// (a política do banco já permite isso — feedback_insert_own não bloqueia
// restrito, só as ações de jogo bloqueiam). Reaproveita a tabela feedback.
async function submitSupportMessage(kind) {
  const input = document.getElementById('support-msg-' + kind);
  const msg = input?.value.trim();
  if (!msg) return;
  const me = myId();
  if (!me) return;
  try {
    const fullText = `[suporte_conta] Conta ${kind === 'banned' ? 'banida' : 'suspensa'}\n${msg}`;
    const { error } = await supabase.from('feedback').insert([{ author_id: me, stars: 0, text: fullText }]);
    if (error) throw error;
    input.value = '';
    renderSupportThread(kind);
  } catch (e) {
    console.error('Erro ao enviar mensagem de suporte', e);
    notify('error', 'Não foi possível enviar sua mensagem agora. Tente de novo em instantes.');
  }
}
async function renderSupportThread(kind) {
  const holder = document.getElementById('support-thread-' + kind);
  if (!holder) return;
  const me = myId();
  if (!me) return;
  try {
    const { data, error } = await supabase.from('feedback').select('text,reply_text,replied_at,created_at').eq('author_id', me).like('text', '[suporte_conta]%').order('created_at', { ascending: true });
    if (error) throw error;
    holder.innerHTML = (data || []).map(f => {
      const msg = (f.text || '').replace(/^\[[^\]]+\]\s*[^\n]*\n?/, '');
      return `<div style="font-size:11.5px;color:var(--text2);margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)">
        <div>Você: ${escapeHtml(msg)}</div>
        ${f.reply_text ? `<div style="color:var(--gold2);margin-top:3px">Administração: ${escapeHtml(f.reply_text)}</div>` : `<div style="color:var(--text3);margin-top:3px">⏳ aguardando resposta</div>`}
      </div>`;
    }).join('') || '<div style="color:var(--text3);font-size:11px">Nenhuma mensagem enviada ainda.</div>';
  } catch (e) { console.error('Erro ao carregar conversa de suporte', e); }
}

async function refreshMyCrystals() {
  try {
    const me = myId();
    if (!me) return;
    const { data, error } = await supabase.from('profiles').select('crystals').eq('id', me).maybeSingle();
    if (error) throw error;
    G.crystals = (data && data.crystals) || 0;
    const el = document.getElementById('hdr-crystals');
    if (el) el.textContent = `💎 ${G.crystals}`;
  } catch (e) { console.error('Erro ao buscar saldo de Crystar', e); }
}

function getPixKey() { return APP_SETTINGS['crystar_pix_key'] || ''; }

async function renderCrystarPanel() {
  const box = document.getElementById('crystar-panel-content');
  if (!box) return;
  box.innerHTML = `<div class="card"><div style="text-align:center;padding:30px;color:var(--text3)">Carregando pacotes...</div></div>`;
  await refreshMyCrystals();

  let packages = [];
  let myPending = [];
  try {
    const [{ data: pkgs, error: e1 }, { data: pend, error: e2 }] = await Promise.all([
      supabase.from('crystal_packages').select('*').eq('active', true).order('sort_order'),
      supabase.from('crystal_purchases').select('id, package_id, crystals, price_cents, status, created_at').eq('user_id', myId()).eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    if (e1) throw e1;
    packages = pkgs || [];
    myPending = pend || (e2 ? [] : []);
  } catch (e) {
    box.innerHTML = `<div class="card"><div style="text-align:center;padding:30px;color:var(--red)">Não foi possível carregar os pacotes agora.</div></div>`;
    return;
  }

  const pixKey = getPixKey();

  box.innerHTML = `
    <div class="card">
      <div class="cr-section-head">
        <div class="cr-section-icon">💎</div>
        <div class="cr-section-text"><div class="cr-section-title">Crystar</div><div class="cr-section-sub">Moeda premium do Crydan — cosméticos e conveniências exclusivas, sem afetar o equilíbrio do PvP</div></div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">💎</span>
        <div><div style="font-size:11px;color:var(--text3)">SEU SALDO</div><div style="font-family:'Cinzel',serif;font-size:18px;color:#7fd8f0">${G.crystals || 0} Crystar</div></div>
      </div>

      ${myPending.length ? `
        <div style="background:var(--bg3);border:1px solid var(--gold);border-radius:8px;padding:12px;margin-bottom:16px">
          <div style="font-size:12px;color:var(--gold2);margin-bottom:6px">⏳ Pagamento(s) aguardando confirmação:</div>
          ${myPending.map(p => `<div style="font-size:12px;color:var(--text2)">${p.crystals} Crystar — R$ ${(p.price_cents/100).toFixed(2).replace('.',',')} — enviado ${fmtTime(new Date(p.created_at).getTime())}</div>`).join('')}
        </div>` : ''}

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px">
        ${packages.map(p => `
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:28px;margin-bottom:4px">💎</div>
            <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:14px">${escapeHtml(p.name)}</div>
            <div style="font-size:20px;color:#7fd8f0;margin:6px 0">${p.crystals} <span style="font-size:11px;color:var(--text3)">Crystar</span></div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:10px">R$ ${(p.price_cents/100).toFixed(2).replace('.',',')}</div>
            <button class="btn btn-primary" style="width:100%" onclick="openBuyCrystalModal('${p.id}', ${p.crystals}, ${p.price_cents})">Comprar</button>
          </div>`).join('')}
      </div>

      <div class="cr-section-head" style="margin-bottom:8px">
        <div class="cr-section-icon">💠</div>
        <div class="cr-section-text"><div class="cr-section-title">O que dá pra fazer com Crystar</div><div class="cr-section-sub">Sempre cosmético/conveniência — nunca poder de combate</div></div>
      </div>
      <ul style="font-size:12.5px;color:var(--text2);line-height:1.8;padding-left:18px">
        <li>Molduras de avatar e banners animados exclusivos</li>
        <li>Selo "Apoiador Crystar" no perfil e no chat</li>
        <li>Nome em destaque no Feed e no Ranking</li>
        <li>Construção instantânea de casa/empresa (pula a espera)</li>
        <li>Slot extra de inventário e de propriedades</li>
        <li>Título customizado de perfil</li>
      </ul>
    </div>`;
}

function openBuyCrystalModal(packageId, crystals, priceCents) {
  const pixKey = getPixKey();
  showModal('Comprar Crystar', `
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:26px">💎 ${crystals} Crystar</div>
      <div style="color:var(--text2);font-size:14px">R$ ${(priceCents/100).toFixed(2).replace('.',',')}</div>
    </div>
    ${pixKey ? `
      <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:12px;margin-bottom:14px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">1. Envie o PIX para:</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--gold2);flex:1;word-break:break-all">${escapeHtml(pixKey)}</div>
          <button class="btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(pixKey)}');notify('success','Chave copiada!')">📋 Copiar</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">2. Depois de pagar, informe seu nome/@usuário abaixo pra localizarmos seu PIX:</div>
      <input class="form-input" id="crystal-pix-note" placeholder="Seu nome ou @usuário usado no PIX" style="margin-bottom:10px">
      <button class="btn btn-primary" style="width:100%" onclick="confirmCrystalPurchase('${packageId}', ${crystals}, ${priceCents})">✓ Já paguei — enviar confirmação</button>
      <div style="font-size:10.5px;color:var(--text3);margin-top:8px;text-align:center">A administração confirma manualmente e credita o Crystar na sua conta.</div>
    ` : `<div style="color:var(--red);text-align:center;font-size:13px">A chave PIX ainda não foi configurada pela administração. Tente novamente mais tarde.</div>`}
  `);
}

async function confirmCrystalPurchase(packageId, crystals, priceCents) {
  const note = document.getElementById('crystal-pix-note')?.value.trim() || null;
  try {
    const me = myId();
    const { error } = await supabase.from('crystal_purchases').insert([{ user_id: me, package_id: packageId, crystals, price_cents: priceCents, status: 'pending', pix_note: note }]);
    if (error) throw error;
    closeModalDirect();
    notify('success', 'Confirmação enviada! Assim que o pagamento for validado, o Crystar cai na sua conta.');
    renderCrystarPanel();
  } catch (e) { notify('error', 'Não foi possível registrar: ' + (e.message || 'erro')); }
}

async function admGiveCrystals() {
  const player = document.getElementById('adm-crystar-player').value.trim();
  const amt = parseInt(document.getElementById('adm-crystar-amount').value);
  const reason = document.getElementById('adm-crystar-reason').value.trim() || null;
  if (!player || !amt) return notify('error', 'Preencha o jogador e uma quantidade válida (pode ser negativa).');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const { data, error } = await supabase.rpc('admin_grant_crystals', { p_user_id: target.id, p_amount: amt, p_reason: reason });
    if (error) throw error;
    notify('success', `ADM: ${amt > 0 ? '+' : ''}${amt} 💎 Crystar para ${target.name} (novo saldo: ${data.newBalance})`);
    admAudit('give_crystals', target.name, `${amt > 0 ? '+' : ''}${amt} Crystar${reason ? ' — ' + reason : ''}`);
    sysLog(`[ADM] ${amt > 0 ? '+' : ''}${amt} Crystar → ${target.name}`);
    document.getElementById('adm-crystar-amount').value = '';
    document.getElementById('adm-crystar-reason').value = '';
  } catch (e) {
    console.error('Erro ao conceder Crystar', e);
    notify('error', 'Não foi possível conceder Crystar agora: ' + (e.message || 'erro desconhecido'));
  }
}

// ── Admin: configurar a chave PIX que aparece pro jogador ──
function admSaveCrystarPixKey() {
  const key = document.getElementById('adm-crystar-pix-key')?.value.trim();
  if (!key) return notify('error', 'Informe uma chave PIX.');
  (async () => {
    try {
      await supabase.from('app_settings').upsert([{ key: 'crystar_pix_key', value: key }], { onConflict: 'key' });
      APP_SETTINGS['crystar_pix_key'] = key;
      notify('success', '💎 Chave PIX do Crystar salva.');
      sysLog('[ADM] Atualizou a chave PIX do Crystar');
    } catch (e) { notify('error', 'Erro ao salvar chave PIX.'); }
  })();
}

async function renderAdmCrystarPurchases() {
  const box = document.getElementById('adm-crystar-purchases-list');
  if (!box) return;
  box.innerHTML = `<div style="color:var(--text3);padding:10px">Carregando...</div>`;
  try {
    const { data, error } = await supabase.from('crystal_purchases').select('id, user_id, crystals, price_cents, pix_note, status, created_at').eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw error;
    const userIds = [...new Set((data || []).map(p => p.user_id))];
    await ensureProfilesCached(userIds);
    box.innerHTML = (data || []).length ? data.map(p => `
      <div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--gold2)">${escapeHtml((_chatProfileCache[p.user_id]||{}).name || 'Jogador')}</div>
          <div style="font-size:12px;color:var(--text2)">💎 ${p.crystals} Crystar — R$ ${(p.price_cents/100).toFixed(2).replace('.',',')}</div>
          ${p.pix_note ? `<div style="font-size:11.5px;color:var(--text3)">Nota do PIX: "${escapeHtml(p.pix_note)}"</div>` : ''}
        </div>
        <button class="btn-sm btn-success" onclick="admApproveCrystal('${p.id}')">✓ Confirmar</button>
        <button class="btn-sm btn-danger" onclick="admRejectCrystal('${p.id}')">✕ Rejeitar</button>
      </div>`).join('') : `<div style="color:var(--text3);padding:14px;text-align:center">Nenhum pagamento pendente.</div>`;
  } catch (e) { box.innerHTML = `<div style="color:var(--red);padding:10px">Erro ao carregar.</div>`; }
}
async function admApproveCrystal(purchaseId) {
  try {
    const { error } = await supabase.rpc('approve_crystal_purchase', { p_purchase_id: purchaseId });
    if (error) throw error;
    notify('success', 'Crystar creditado na conta do jogador!');
    renderAdmCrystarPurchases();
  } catch (e) { notify('error', 'Erro: ' + (e.message || 'não foi possível confirmar')); }
}
async function admRejectCrystal(purchaseId) {
  const ok = await confirmDialog('Rejeitar essa compra? Marque como rejeitada só se o PIX não foi encontrado/confirmado.', { danger: true, confirmText: 'Rejeitar' });
  if (!ok) return;
  try {
    const { error } = await supabase.rpc('reject_crystal_purchase', { p_purchase_id: purchaseId });
    if (error) throw error;
    notify('success', 'Compra rejeitada.');
    renderAdmCrystarPurchases();
  } catch (e) { notify('error', 'Erro: ' + (e.message || 'não foi possível rejeitar')); }
}

function renderGallery() {
  const gallery = document.getElementById('avatar-gallery');
  gallery.innerHTML = AVATARS.map(a => `
    <div onclick="equipAvatar('${a}')" style="text-align:center;font-size:28px;cursor:pointer;padding:10px;border-radius:6px;border:2px solid ${G.avatar===a?'var(--gold)':'var(--border)'};background:var(--bg3);transition:all 0.2s" onmouseover="this.style.borderColor='var(--gold2)'" onmouseout="this.style.borderColor='${G.avatar===a?'var(--gold)':'var(--border)'}'">
      ${a}
    </div>
  `).join('');
  renderFrameShopTabs();
  renderAvatarFrameShop();
  renderBannerAnimShop();
  const totalBadge = document.getElementById('frame-shop-total-badge');
  if (totalBadge) totalBadge.textContent = AVATAR_FRAMES.length + ' disponíveis';
}

let previewedBannerId = null;
async function renderBannerAnimShop() {
  const el = document.getElementById('banner-anim-shop');
  if (!el) return;
  const current = G.bannerAnim || 'none';
  const lottieCat = await getLottieCatalog();
  const lottieList = lottieCat.filter(l => l.category === 'banner').map(l => ({ id: 'lottie:' + l.id, name: '✨ ' + l.name, lottieUrl: l.url }));
  // As animações antigas (feitas só com CSS/tsParticles) saíram da loja — só oferecemos
  // animações reais (vídeo/Lottie) daqui pra frente. Se o jogador já tinha uma das antigas
  // equipada, ela continua aparecendo (marcada como "clássica") pra não sumir do nada.
  const legacyEquipped = (current !== 'none' && !current.startsWith('lottie:'))
    ? BANNER_ANIMS.filter(a => a.id === current).map(a => ({ ...a, name: a.name + ' (clássica)' }))
    : [];
  const list = [{ id: 'none', name: 'Nenhuma' }, ...lottieList, ...legacyEquipped];
  el.innerHTML = list.map(a => {
    const equipped = current === a.id;
    return `<div class="frame-shop-card">
      <div class="profile-banner" id="banner-mini-${a.id.replace(':','_')}" style="height:44px;border-radius:8px;position:relative;overflow:hidden;background:linear-gradient(135deg,var(--bg3),var(--bg4));margin-bottom:6px">
        <div class="banner-fx-slot" id="banner-mini-fx-${a.id.replace(':','_')}"></div>
      </div>
      <div class="frame-shop-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div>
      <div style="display:flex;gap:4px;margin-bottom:6px">
        <button class="btn-sm" style="flex:1" onclick="previewBannerAnim('${a.id}')">👁️ Ver</button>
      </div>
      ${equipped ? '<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>' : `<button class="btn-sm btn-success" style="width:100%" onclick="equipBannerAnim('${a.id}')">Equipar</button>`}
    </div>`;
  }).join('');
  list.forEach(a => {
    const banner = document.getElementById('banner-mini-' + a.id.replace(':','_'));
    if (banner && a.id !== 'none' && !a.id.startsWith('lottie:')) banner.classList.add('anim-' + a.id);
    mountBannerFx('banner-mini-fx-' + a.id.replace(':','_'), a.id);
  });
  gsapStagger('.frame-shop-card', el);
}
function previewBannerAnim(id) {
  previewedBannerId = id;
  const isLottie = id.startsWith('lottie:');
  const lEntry = isLottie ? (_lottieCatalogCache || []).find(l => l.id === id.slice(7)) : null;
  const anim = isLottie ? { id, name: lEntry ? '✨ ' + lEntry.name : 'Lottie' } : (BANNER_ANIMS.find(a => a.id === id) || { id: 'none', name: 'Nenhuma' });
  const card = document.getElementById('banner-preview-card');
  card.style.display = 'block';
  const box = document.getElementById('banner-preview-box');
  BANNER_ANIMS.forEach(a => box.classList.remove('anim-' + a.id));
  if (id !== 'none' && !isLottie) box.classList.add('anim-' + id);
  mountBannerFx('banner-preview-fx', id);
  document.getElementById('banner-preview-name').textContent = anim.name;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function equipBannerAnim(id) {
  applyBannerAnim(id, true);
  renderBannerAnimShop();
  if (id.startsWith('lottie:')) {
    const l = (_lottieCatalogCache || []).find(x => x.id === id.slice(7));
    notify('success', `✨ ${l ? l.name : 'Animação'} aplicada ao banner!`);
    closeBannerPreview();
    return;
  }
  const anim = BANNER_ANIMS.find(a => a.id === id);
  notify('success', `${anim ? anim.name : 'Nenhuma animação'} aplicada ao banner!`);
  closeBannerPreview();
}
function confirmEquipPreviewedBanner() {
  if (previewedBannerId === null) return;
  equipBannerAnim(previewedBannerId);
}
function closeBannerPreview() {
  previewedBannerId = null;
  const card = document.getElementById('banner-preview-card');
  if (card) card.style.display = 'none';
}

function equipAvatar(a) {
  G.avatar = a;
  saveGame(); updateHeader(); renderGallery();
  notify('success', `Avatar ${a} equipado!`);
}

// ══════════════════════════════════════════
//   LOJA DE MOLDURAS DE AVATAR (Galeria)
// ══════════════════════════════════════════
let frameShopCategory = 'todas';
let previewedFrameId = null;

function isFrameOwned(id) {
  if (id === 'none') return true;
  if (id.startsWith('lottie:')) return true;
  const frame = AVATAR_FRAMES.find(f => f.id === id);
  if (!frame) return false;
  if (frame.reqAch) return (G.achievements || []).includes(frame.reqAch);
  if (frame.seasonal) return frame.activeMonths.includes(new Date().getMonth());
  if (frame.cost === 0) return true;
  return (G.unlockedFrames || []).includes(id);
}

function renderFrameShopTabs() {
  const el = document.getElementById('frame-shop-tabs');
  if (!el) return;
  el.innerHTML = FRAME_CATEGORIES.map(c => `<div class="frame-cat-tab ${frameShopCategory===c.id?'active':''}" onclick="setFrameShopCategory('${c.id}')">${c.name}</div>`).join('');
}
function setFrameShopCategory(cat) {
  frameShopCategory = cat;
  renderFrameShopTabs();
  renderAvatarFrameShop();
}

async function renderAvatarFrameShop() {
  const el = document.getElementById('avatar-frame-shop');
  if (!el) return;
  const search = (document.getElementById('frame-shop-search')?.value || '').trim().toLowerCase();
  const lottieCat = await getLottieCatalog();
  const lottieFrames = lottieCat.filter(l => l.category === 'avatar').map(l => ({ id: 'lottie:' + l.id, name: '✨ ' + l.name, cat: 'lottie', lottieUrl: l.url, url: l.url, kind: l.kind, cost: 0, minLevel: 1 }));
  // As molduras antigas (CSS/tsParticles) saíram da loja de novas escolhas — só ficam
  // "custom_image"/"ring_custom" (conteúdo real do próprio jogador) e as novas Lottie/vídeo.
  // Quem já tinha uma moldura antiga equipada continua vendo ela na lista, como "clássica".
  const equippedId = G.avatarFrame || 'none';
  const realFrames = AVATAR_FRAMES.filter(f => f.customImage || f.customColor);
  const legacyEquippedFrame = (equippedId !== 'none' && !equippedId.startsWith('lottie:') && !realFrames.some(f => f.id === equippedId))
    ? AVATAR_FRAMES.filter(f => f.id === equippedId).map(f => ({ ...f, name: f.name + ' (clássica)' }))
    : [];
  let list = [...realFrames, ...lottieFrames, ...legacyEquippedFrame];
  if (frameShopCategory !== 'todas') list = list.filter(f => f.cat === frameShopCategory);
  if (search) list = list.filter(f => f.name.toLowerCase().includes(search));

  if (!list.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:24px">Nenhuma moldura encontrada.</div>';
    return;
  }

  el.innerHTML = list.map(frame => {
    const owned = isFrameOwned(frame.id);
    const equipped = (G.avatarFrame || 'none') === frame.id;
    const meetsLevel = G.level >= (frame.minLevel || 1);
    const canAfford = G.wallet >= frame.cost;

    if (frame.lottieUrl) {
      return `<div class="frame-shop-card">
        <div class="avatar-frame-wrap frame-mini-wrap" style="position:relative;width:64px;height:64px;margin:0 auto 6px">
          <div class="profile-avatar" style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg3)">${AVATARS[0]}</div>
          <div class="frame-svg-slot" style="position:absolute;inset:-15%">${renderAnimHtml(frame, 'width:130%;height:130%;border-radius:50%')}</div>
        </div>
        <div class="frame-shop-name" title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}</div>
        ${equipped ? '<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>' : `<button class="btn-sm btn-success" style="width:100%" onclick="equipOwnedFrame('${frame.id}')">Equipar</button>`}
      </div>`;
    }

    if (frame.customColor) {
      return `<div class="frame-shop-card">
        <div class="avatar-frame-wrap frame-mini-wrap" id="mini-${frame.id}">
          <div class="profile-avatar">${AVATARS[0]}</div>
          <div class="frame-svg-slot"></div>
        </div>
        <div class="frame-shop-name" title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}</div>
        <div class="frame-shop-price">Escolha qualquer cor</div>
        <input type="color" value="${G.customRingColor || '#d4a017'}" oninput="setCustomRingColor(this.value)" style="width:100%;height:26px;border:none;border-radius:6px;cursor:pointer;margin-bottom:6px;background:none">
        ${equipped ? '<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>' : `<button class="btn-sm btn-success" style="width:100%" onclick="equipOwnedFrame('${frame.id}')">Equipar</button>`}
      </div>`;
    }

    if (frame.customImage) {
      return `<div class="frame-shop-card">
        <div class="avatar-frame-wrap frame-mini-wrap" id="mini-${frame.id}">
          <div class="profile-avatar">${AVATARS[0]}</div>
          <div class="frame-svg-slot"></div>
        </div>
        <div class="frame-shop-name" title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}</div>
        <div class="frame-shop-price">${G.customFrameImage ? 'Imagem carregada' : 'Envie uma imagem/GIF'}</div>
        <input type="file" id="custom-frame-file-input" accept="image/*" style="display:none" onchange="handleCustomFrameImageSelect(event)">
        <button class="btn-sm" style="width:100%;margin-bottom:6px" onclick="document.getElementById('custom-frame-file-input').click()">📁 Enviar Imagem/GIF</button>
        ${equipped ? '<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>' : `<button class="btn-sm btn-success" style="width:100%" ${G.customFrameImage?'':'disabled'} onclick="equipOwnedFrame('${frame.id}')">Equipar</button>`}
      </div>`;
    }

    let actionBtn;
    if (equipped) {
      actionBtn = `<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>`;
    } else if (owned) {
      actionBtn = `<button class="btn-sm btn-success" style="width:100%" onclick="equipOwnedFrame('${frame.id}')">Equipar</button>`;
    } else if (frame.reqAch) {
      const ach = ACHIEVEMENTS.find(a => a.id === frame.reqAch);
      actionBtn = `<button class="btn-sm" style="width:100%" disabled title="Desbloqueie a conquista: ${ach ? escapeHtml(ach.name) : '?'}">🏆 ${ach ? escapeHtml(ach.icon + ' ' + ach.name) : 'Conquista'}</button>`;
    } else if (frame.seasonal) {
      const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      const nextMonth = frame.activeMonths[0];
      actionBtn = `<button class="btn-sm" style="width:100%" disabled title="Volta em ${MESES[nextMonth]}">🗓️ Fora de época</button>`;
    } else if (!meetsLevel) {
      actionBtn = `<button class="btn-sm" style="width:100%" disabled title="Requer Nível ${frame.minLevel}">🔒 Nv.${frame.minLevel}</button>`;
    } else {
      actionBtn = `<button class="btn-sm ${canAfford?'btn-primary':''}" style="width:100%" ${canAfford?'':'disabled'} onclick="buyAvatarFrame('${frame.id}')">🔒 ${frame.cost} Cry</button>`;
    }
    return `<div class="frame-shop-card">
      <div class="avatar-frame-wrap frame-mini-wrap" id="mini-${frame.id}">
        <div class="profile-avatar">${AVATARS[0]}</div>
        <div class="frame-svg-slot"></div>
      </div>
      <div class="frame-shop-name" title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}</div>
      <div class="frame-shop-price">${frame.cost === 0 ? 'Grátis' : frame.cost + ' Cry'}${frame.minLevel > 1 ? ' · Nv.' + frame.minLevel : ''}</div>
      <div style="display:flex;gap:4px;margin-bottom:6px">
        <button class="btn-sm" style="flex:1" onclick="previewAvatarFrame('${frame.id}')">👁️ Ver</button>
      </div>
      ${actionBtn}
    </div>`;
  }).join('');

  // aplica os efeitos visuais reais em cada miniatura da grade (não é só ícone, é a moldura de verdade)
  list.forEach(frame => {
    const wrap = document.getElementById('mini-' + frame.id);
    if (wrap) applyFrameToWrap(wrap, frame.id);
  });
  gsapStagger('.frame-shop-card', el);
}

function buyAvatarFrame(id) {
  const frame = AVATAR_FRAMES.find(f => f.id === id);
  if (!frame) return;
  if (G.level < (frame.minLevel || 1)) return notify('error', `Requer Nível ${frame.minLevel}.`);
  if (isFrameOwned(id)) return equipOwnedFrame(id);
  if (G.wallet < frame.cost) return notify('error', 'Cry insuficiente para comprar esta moldura.');
  G.wallet -= frame.cost;
  G.unlockedFrames = G.unlockedFrames || [];
  G.unlockedFrames.push(id);
  applyAvatarFrame(id, true);
  updateHeader();
  addToFeed(`🎭 Desbloqueou a moldura "${frame.name}"!`);
  notify('success', `${frame.name} comprada e equipada!`);
  renderAvatarFrameShop();
  closeFramePreview();
}

function equipOwnedFrame(id) {
  applyAvatarFrame(id, true);
  renderAvatarFrameShop();
  if (id.startsWith('lottie:')) {
    const l = (_lottieCatalogCache || []).find(x => x.id === id.slice(7));
    notify('success', `${l ? '✨ ' + l.name : 'Moldura'} equipada!`);
    closeFramePreview();
    return;
  }
  const frame = AVATAR_FRAMES.find(f => f.id === id);
  notify('success', `${frame ? frame.name : 'Moldura'} equipada!`);
  closeFramePreview();
}

function previewAvatarFrame(id) {
  previewedFrameId = id;
  const isLottie = id.startsWith('lottie:');
  const lEntry = isLottie ? (_lottieCatalogCache || []).find(l => l.id === id.slice(7)) : null;
  const frame = isLottie ? { id, name: lEntry ? '✨ ' + lEntry.name : 'Lottie', cost: 0 } : (AVATAR_FRAMES.find(f => f.id === id) || { id: 'none', name: 'Nenhuma', cost: 0 });
  const card = document.getElementById('frame-preview-card');
  card.style.display = 'block';
  document.getElementById('frame-preview-avatar').innerHTML = G.avatarPhoto ? `<img src="${G.avatarPhoto}" alt="Seu avatar">` : (G.avatar || '⚔️');
  const owned = isFrameOwned(id);
  document.getElementById('frame-preview-name').innerHTML = `${escapeHtml(frame.name)}${!owned ? ` <span style="color:var(--text3);font-size:12px">— ${frame.cost} Cry</span>` : ''}`;
  applyFrameToWrap(document.getElementById('frame-preview-wrap'), id);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function confirmEquipPreviewedFrame() {
  if (!previewedFrameId) return;
  if (!isFrameOwned(previewedFrameId)) { buyAvatarFrame(previewedFrameId); return; }
  equipOwnedFrame(previewedFrameId);
}

function closeFramePreview() {
  previewedFrameId = null;
  const card = document.getElementById('frame-preview-card');
  if (card) card.style.display = 'none';
}

// ── EVENTS ─────────────────────────────────
function renderEvents() {
  const list = document.getElementById('events-list');
  list.innerHTML = EVENTS_DATA.map(ev => `
    <div style="background:${ev.active?'var(--bg3)':'var(--bg2)'};border:1px solid ${ev.active?'var(--gold)':'var(--border)'};border-radius:8px;padding:14px;display:flex;align-items:center;gap:12px">
      <div style="font-size:36px">${ev.icon}</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;color:${ev.active?'var(--gold2)':'var(--text2)'};font-size:14px">${ev.name}</div>
        <div style="font-size:12px;color:var(--text2);margin:3px 0">${ev.desc}</div>
        <span class="badge badge-green">${ev.bonus}</span>
      </div>
      ${ev.active ? '<span class="badge badge-gold">🔴 ATIVO</span>' : '<span class="badge badge-gray">Inativo</span>'}
    </div>
  `).join('');
  renderSeasonalShop();
}
function renderSeasonalShop() {
  const grid = document.getElementById('seasonal-shop-grid');
  const sub = document.getElementById('seasonal-shop-sub');
  if (!grid) return;
  const now = new Date();
  const active = AVATAR_FRAMES.filter(f => f.seasonal && f.activeMonths.includes(now.getMonth()));
  if (sub) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysLeft = Math.ceil((endOfMonth - now) / 86400000);
    sub.textContent = active.length ? `Disponível por mais ${daysLeft} dia${daysLeft === 1 ? '' : 's'} — depois some até o ano que vem` : 'Nenhuma peça sazonal disponível neste mês — volte em outra época!';
  }
  if (!active.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:20px">🗓️ Nada sazonal ativo agora. Confira de novo em outro mês!</div>'; return; }
  grid.innerHTML = active.map(frame => {
    const equipped = (G.avatarFrame || 'none') === frame.id;
    return `<div class="frame-shop-card">
      <div class="avatar-frame-wrap frame-mini-wrap" id="mini-season-${frame.id}">
        <div class="profile-avatar">${AVATARS[0]}</div>
        <div class="frame-svg-slot"></div>
      </div>
      <div class="frame-shop-name" title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}</div>
      <div class="frame-shop-price">🗓️ Sazonal · Grátis</div>
      ${equipped ? '<span class="badge badge-gold" style="width:100%;display:block">Equipada</span>' : `<button class="btn-sm btn-success" style="width:100%" onclick="equipOwnedFrame('${frame.id}')">Equipar</button>`}
    </div>`;
  }).join('');
  active.forEach(frame => {
    const wrap = document.getElementById('mini-season-' + frame.id);
    if (wrap) applyFrameToWrap(wrap, frame.id);
  });
}

// ── Sistema de Convite/Referência ──
async function loadReferralInfo() {
  try {
    const { data } = await supabase.from('profiles').select('referral_code,referred_by').eq('id', currentUserId).single();
    const codeEl = document.getElementById('cfg-referral-code');
    if (codeEl) codeEl.value = data?.referral_code || '—';
    const redeemBox = document.getElementById('cfg-referral-redeem-box');
    if (redeemBox) redeemBox.style.display = data?.referred_by ? 'none' : 'block';
  } catch (e) { console.error('Erro ao carregar código de convite', e); }
}
function copyReferralCode() {
  const code = document.getElementById('cfg-referral-code')?.value;
  if (!code || code === '—' || code === 'Carregando...') return;
  navigator.clipboard.writeText(code).then(() => notify('success', '📋 Código copiado! Manda pra um amigo.'));
}
async function redeemReferralCode() {
  const code = document.getElementById('cfg-referral-input')?.value.trim().toUpperCase();
  if (!code) return notify('error', 'Digite um código.');
  try {
    const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code });
    if (error) throw error;
    if (!data.ok) return notify('error', data.error || 'Não foi possível resgatar.');
    notify('success', `🎉 Código aplicado! Você e quem te convidou ganharam ${data.reward} Cry cada um.`);
    G.wallet += data.reward;
    saveGame();
    refreshDashboard();
    loadReferralInfo();
  } catch (e) { notify('error', 'Não foi possível resgatar: ' + (e.message || 'erro')); }
}

// ── ADM ────────────────────────────────────
let admEventTimer = null;
let admPlayersCache = [];
let admPlayersSearchTerm = '';

async function renderAdm() {
  await Promise.all([refreshAdmStats(), refreshAdmPlayersList(), renderAdmCrystarPurchases()]);

  const evEl = document.getElementById('adm-active-event');
  if (evEl) {
    const names = { xp:'2x XP', gold:'2x Cry', drop:'Drops Raros' };
    evEl.textContent = activeEvent ? `Evento ativo: ${names[activeEvent]}` : 'Nenhum evento ativo';
  }
}

// Estatísticas reais da plataforma inteira — antes mostrava só os dados
// do jogador salvos no dispositivo do próprio admin.
async function refreshAdmStats() {
  const grid = document.getElementById('adm-stats-grid');
  if (!grid) return;
  try {
    const [players, banned, posts, communities, guilds, messagesToday, feedbackRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('guilds').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabase.from('feedback').select('stars'),
    ]);
    const feedbackList = feedbackRes.data || [];
    const avgRating = feedbackList.length ? (feedbackList.reduce((s, f) => s + (f.stars || 0), 0) / feedbackList.length).toFixed(1) : '—';
    grid.innerHTML = `
      <div class="adm-stat-card"><div class="adm-stat-label">Jogadores cadastrados</div><div class="adm-stat-value">${players.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Banidos</div><div class="adm-stat-value" style="color:${banned.count?'var(--red)':'inherit'}">${banned.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Publicações</div><div class="adm-stat-value">${posts.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Comunidades</div><div class="adm-stat-value">${communities.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Guildas</div><div class="adm-stat-value">${guilds.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Mensagens (24h)</div><div class="adm-stat-value">${messagesToday.count ?? 0}</div></div>
      <div class="adm-stat-card"><div class="adm-stat-label">Feedbacks / nota média</div><div class="adm-stat-value">${feedbackList.length} · ${avgRating}</div></div>
    `;
  } catch (e) {
    console.error('Erro ao carregar estatísticas administrativas', e);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar as estatísticas agora.</div></div>`;
  }
}

// Lista real de jogadores cadastrados, com busca por nome/@usuario —
// antes só mostrava a própria conta do admin, fingindo ser uma lista.
async function refreshAdmPlayersList() {
  const list = document.getElementById('adm-players-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Carregando jogadores...</div>';
  try {
    let query = supabase.from('profiles').select('id,name,username,avatar,avatar_photo,level,wallet,bank,banned,banned_reason').order('created_at', { ascending: false }).limit(100);
    if (admPlayersSearchTerm) {
      query = query.or(`name.ilike.%${admPlayersSearchTerm}%,username.ilike.%${admPlayersSearchTerm}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    admPlayersCache = data || [];
    if (!admPlayersCache.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-sub">${admPlayersSearchTerm ? 'Nenhum jogador encontrado com esse termo.' : 'Nenhum jogador cadastrado ainda.'}</div></div>`;
      return;
    }
    list.innerHTML = `<table class="data-table"><thead><tr><th>Jogador</th><th>Nível</th><th>Carteira</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      ${admPlayersCache.map(p => `
        <tr>
          <td style="cursor:pointer" onclick="openAdminPlayerModal('${p.id}')">${p.avatar_photo ? `<img src="${p.avatar_photo}" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px">` : (p.avatar||'⚔️')} ${escapeHtml(p.name)}${p.username?` <span style="color:var(--crydan-text-muted)">@${escapeHtml(p.username)}</span>`:''}</td>
          <td>Nv.${p.level ?? 1}</td>
          <td>${(p.wallet||0)+(p.bank||0)} Cry</td>
          <td>${p.banned ? `<span class="badge badge-red" title="${escapeHtml(p.banned_reason||'')}">Banido</span>` : '<span class="badge badge-green">Ativo</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn-sm" onclick="openAdminPlayerModal('${p.id}')" title="Gerenciar conta">⚙️ Gerenciar</button>
          </td>
        </tr>
      `).join('')}
    </tbody></table>`;
  } catch (e) {
    console.error('Erro ao carregar lista de jogadores', e);
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar os jogadores agora.</div></div>`;
  }
}

function admSearchPlayers() {
  admPlayersSearchTerm = (document.getElementById('adm-player-search')?.value || '').trim();
  refreshAdmPlayersList();
}

// Preenche os campos de nome nos cards de Economia/Moderação com um
// clique, em vez de precisar digitar o nome manualmente.
function admQuickTarget(name) {
  ['adm-player', 'adm-char-player'].forEach(id => { const el = document.getElementById(id); if (el) el.value = name; });
  notify('info', `🎯 Alvo definido: ${name}`);
}

// Registra a ação no log de auditoria real (tabela admin_logs) — além
// do log local (sysLog), agora fica gravado no banco pra sempre.
async function admAudit(action, targetName, details) {
  try {
    const me = myId();
    if (!me) return;
    await supabase.from('admin_logs').insert([{ admin_id: me, action, target_name: targetName || null, details: details || null }]);
  } catch (e) { console.error('Erro ao gravar log de auditoria', e); }
}

// Reproduz a mesma fórmula de level-up do gainXP(), mas sobre os dados
// de OUTRA conta (não dispara notificações/efeitos — é uma concessão
// administrativa silenciosa).
function simulateGainXP(data, amount) {
  const d = { ...data };
  d.xp = (d.xp || 0) + Math.max(0, Math.floor(amount));
  d.xpToNext = d.xpToNext || 100;
  d.level = d.level || 1;
  d.maxHp = d.maxHp || 100; d.hp = d.hp ?? d.maxHp;
  d.maxMana = d.maxMana || 50; d.mana = d.mana ?? d.maxMana;
  d.str = d.str || 10; d.dex = d.dex || 10; d.int = d.int || 10; d.vit = d.vit || 10; d.wis = d.wis || 10;
  while (d.xp >= d.xpToNext) {
    d.xp -= d.xpToNext;
    d.level++;
    d.xpToNext = Math.floor(d.xpToNext * 1.2 + 50);
    d.maxHp += 10; d.hp = d.maxHp;
    d.maxMana += 5; d.mana = d.maxMana;
    d.str++; d.dex++; d.int++; d.vit++; d.wis++;
  }
  return d;
}

// Ajusta a carteira de QUALQUER jogador (lê o save real dele, soma/
// subtrai, grava de volta) — usa a política de admin no RLS da tabela
// "saves" que dá esse acesso só pra quem está em app_admins.
async function admAdjustWallet(targetId, delta) {
  const { data: row, error } = await supabase.from('saves').select('data').eq('id', targetId).single();
  if (error) throw error;
  const current = row.data || {};
  const newWallet = Math.max(0, Math.floor((current.wallet || 0) + delta));
  const newData = { ...current, wallet: newWallet, totalEarned: delta > 0 ? (current.totalEarned || 0) + delta : current.totalEarned };
  const { error: uerr } = await supabase.from('saves').update({ data: newData }).eq('id', targetId);
  if (uerr) throw uerr;
  await supabase.from('profiles').update({ wallet: newWallet }).eq('id', targetId);
  return newWallet;
}

async function admGiveCry() {
  const player = document.getElementById('adm-player').value.trim();
  const amt = parseInt(document.getElementById('adm-amount').value);
  if (!player || !amt || amt <= 0) return notify('error', 'Preencha o jogador e uma quantidade válida.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const newWallet = await admAdjustWallet(target.id, amt);
    notify('success', `ADM: +${amt} Cry para ${target.name} (novo saldo: ${newWallet})`);
    admAudit('give_cry', target.name, `+${amt} Cry`);
    sysLog(`[ADM] +${amt} Cry → ${target.name}`);
    document.getElementById('adm-amount').value = '';
    renderAdm();
  } catch (e) {
    console.error('Erro ao dar Cry', e);
    notify('error', 'Não foi possível conceder Cry agora: ' + (e.message || 'erro desconhecido'));
  }
}

async function admTakeCry() {
  const player = document.getElementById('adm-player').value.trim();
  const amt = parseInt(document.getElementById('adm-amount').value);
  if (!player || !amt || amt <= 0) return notify('error', 'Preencha o jogador e uma quantidade válida.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const newWallet = await admAdjustWallet(target.id, -amt);
    notify('warn', `ADM: -${amt} Cry de ${target.name} (novo saldo: ${newWallet})`);
    admAudit('take_cry', target.name, `-${amt} Cry`);
    sysLog(`[ADM] -${amt} Cry ← ${target.name}`);
    document.getElementById('adm-amount').value = '';
    renderAdm();
  } catch (e) {
    console.error('Erro ao tirar Cry', e);
    notify('error', 'Não foi possível remover Cry agora: ' + (e.message || 'erro desconhecido'));
  }
}

async function admGiveXP() {
  const player = document.getElementById('adm-char-player').value.trim();
  const xp = parseInt(document.getElementById('adm-xp').value);
  if (!player || !xp || xp <= 0) return notify('error', 'Preencha o jogador e um XP válido.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', target.id).single();
    if (error) throw error;
    const newData = simulateGainXP(row.data || {}, xp);
    const { error: uerr } = await supabase.from('saves').update({ data: newData }).eq('id', target.id);
    if (uerr) throw uerr;
    await supabase.from('profiles').update({ level: newData.level }).eq('id', target.id);
    notify('success', `ADM: +${xp} XP para ${target.name} (agora Nv.${newData.level})`);
    admAudit('give_xp', target.name, `+${xp} XP`);
    sysLog(`[ADM] +${xp} XP → ${target.name}`);
    document.getElementById('adm-xp').value = '';
    renderAdm();
  } catch (e) {
    console.error('Erro ao dar XP', e);
    notify('error', 'Não foi possível conceder XP agora: ' + (e.message || 'erro desconhecido'));
  }
}

async function admSetBanned(targetId, targetName, banned, reason) {
  const { error } = banned
    ? await supabase.rpc('admin_ban_player', { p_user_id: targetId, p_reason: reason })
    : await supabase.rpc('admin_unban_player', { p_user_id: targetId });
  if (error) throw error;
  notify(banned ? 'warn' : 'success', banned ? `🚫 ${targetName} foi banido (e o e-mail bloqueado de criar nova conta).` : `✅ ${targetName} foi desbanido (e-mail liberado novamente).`);
  admAudit(banned ? 'ban' : 'unban', targetName, reason || '');
  sysLog(`[ADM] ${banned ? 'BANIU' : 'Desbaniu'} jogador: ${targetName}${reason ? ' — ' + reason : ''}`);
  renderAdm();
}

let _admEditTargetId = null;
async function admLoadPlayerForEdit() {
  const player = document.getElementById('adm-edit-player').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name,username');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', target.id).single();
    if (error) throw error;
    const d = row.data || {};
    _admEditTargetId = target.id;
    document.getElementById('adm-edit-name').value = d.name || target.name || '';
    document.getElementById('adm-edit-username').value = d.username || target.username || '';
    document.getElementById('adm-edit-avatar').value = d.avatarPhoto || '';
    document.getElementById('adm-edit-wins').value = d.wins ?? 0;
    document.getElementById('adm-edit-losses').value = d.losses ?? 0;
    document.getElementById('adm-edit-player-form').style.display = 'block';
    notify('success', `Dados de ${target.name} carregados.`);
  } catch (e) { notify('error', 'Não foi possível carregar: ' + (e.message || 'erro')); }
}
async function admSavePlayerEdit() {
  if (!_admEditTargetId) return notify('error', 'Carregue um jogador primeiro.');
  const newName = document.getElementById('adm-edit-name').value.trim();
  const newUsername = document.getElementById('adm-edit-username').value.trim().toLowerCase();
  const newAvatar = document.getElementById('adm-edit-avatar').value.trim();
  const winsVal = document.getElementById('adm-edit-wins').value;
  const lossesVal = document.getElementById('adm-edit-losses').value;
  if (newUsername && !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(newUsername)) {
    return notify('error', '@usuário inválido — só letras minúsculas, números, ponto e underline.');
  }
  try {
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', _admEditTargetId).single();
    if (error) throw error;
    const d = row.data || {};
    if (newName) d.name = newName;
    if (newUsername) d.username = newUsername;
    if (newAvatar) d.avatarPhoto = newAvatar;
    if (winsVal !== '') d.wins = parseInt(winsVal) || 0;
    if (lossesVal !== '') d.losses = parseInt(lossesVal) || 0;
    const { error: uerr } = await supabase.from('saves').update({ data: d }).eq('id', _admEditTargetId);
    if (uerr) throw uerr;

    const profUpdate = {};
    if (newName) profUpdate.name = newName;
    if (newUsername) profUpdate.username = newUsername;
    if (newAvatar) profUpdate.avatar_photo = newAvatar;
    if (Object.keys(profUpdate).length) {
      const { error: perr } = await supabase.from('profiles').update(profUpdate).eq('id', _admEditTargetId);
      if (perr) throw perr;
    }
    notify('success', '✏️ Conta do jogador atualizada.');
    admAudit('edit_account', newName || _admEditTargetId, `nome:${newName||'—'} @${newUsername||'—'} vitórias:${winsVal||'—'} derrotas:${lossesVal||'—'}`);
    sysLog(`[ADM] Editou a conta de ${newName || _admEditTargetId}`);
  } catch (e) {
    if ((e.message || '').includes('duplicate') || (e.message || '').includes('unique')) notify('error', 'Esse @usuário já está em uso por outra conta.');
    else notify('error', 'Não foi possível salvar: ' + (e.message || 'erro'));
  }
}

async function admRenameGuild() {
  const search = document.getElementById('adm-guild-search').value.trim();
  const newName = document.getElementById('adm-guild-newname').value.trim();
  if (!search || !newName) return notify('error', 'Preencha a guilda atual e o novo nome.');
  try {
    const { data: guild, error: e1 } = await supabase.from('guilds').select('id,name').or(`name.ilike.${search},tag.ilike.${search}`).maybeSingle();
    if (e1) throw e1;
    if (!guild) return notify('error', `Guilda "${search}" não encontrada.`);
    const { error } = await supabase.from('guilds').update({ name: newName }).eq('id', guild.id);
    if (error) throw error;
    notify('success', `🛡️ Guilda "${guild.name}" renomeada para "${newName}".`);
    admAudit('rename_guild', guild.name, `→ ${newName}`);
    sysLog(`[ADM] Renomeou guilda "${guild.name}" → "${newName}"`);
    document.getElementById('adm-guild-newname').value = '';
  } catch (e) { notify('error', 'Não foi possível renomear: ' + (e.message || 'erro')); }
}

async function admSuspendPlayer() {
  const player = document.getElementById('adm-char-player').value.trim();
  const days = parseInt(document.getElementById('adm-suspend-duration').value);
  const reason = document.getElementById('adm-ban-reason').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  if (!reason) return notify('error', 'O motivo da suspensão é obrigatório — o jogador vai ver essa mensagem.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase.rpc('admin_set_suspension', { p_user_id: target.id, p_until: until, p_reason: reason || null });
    if (error) throw error;
    notify('warn', `⏳ ${target.name} suspenso(a) por ${days} dia(s).`);
    admAudit('suspend', target.name, `${days} dias${reason ? ' — ' + reason : ''}`);
    sysLog(`[ADM] Suspendeu ${target.name} por ${days} dia(s)`);
    document.getElementById('adm-ban-reason').value = '';
  } catch (e) { notify('error', 'Não foi possível suspender: ' + (e.message || 'erro')); }
}
async function admLiftSuspension() {
  const player = document.getElementById('adm-char-player').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    const { error } = await supabase.rpc('admin_set_suspension', { p_user_id: target.id, p_until: null, p_reason: null });
    if (error) throw error;
    notify('success', `✅ Suspensão de ${target.name} foi levantada.`);
    admAudit('lift_suspension', target.name, '');
    sysLog(`[ADM] Levantou suspensão de ${target.name}`);
  } catch (e) { notify('error', 'Não foi possível levantar a suspensão: ' + (e.message || 'erro')); }
}
async function admDeleteAccountCore(target) {
  const ok = await confirmDialog(`Excluir a conta de <b>${escapeHtml(target.name)}</b> DEFINITIVAMENTE? Isso apaga o personagem, mensagens, publicações e tudo mais, e bloqueia o e-mail usado de criar uma nova conta. Não pode ser desfeito.`, { danger: true, confirmText: 'Excluir para sempre' });
  if (!ok) return false;
  const { error } = await supabase.rpc('admin_delete_account', { p_user_id: target.id });
  if (error) throw error;
  notify('success', `🗑️ Conta de ${target.name} foi excluída permanentemente e o e-mail bloqueado.`);
  admAudit('delete_account', target.name, '');
  sysLog(`[ADM] Excluiu permanentemente a conta de ${target.name}`);
  return true;
}
async function admDeleteAccount() {
  const player = document.getElementById('adm-char-player').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    if (await admDeleteAccountCore(target)) { document.getElementById('adm-char-player').value = ''; renderAdm(); }
  } catch (e) { notify('error', 'Não foi possível excluir a conta: ' + (e.message || 'erro')); }
}

async function admResetPlayerAccountCore(target) {
  const ok = await confirmDialog(`Resetar o progresso de <b>${escapeHtml(target.name)}</b>? Nível, dinheiro, inventário, casas, empresas, missões e conquistas voltam ao zero. O login e o nome da conta continuam os mesmos. Não pode ser desfeito.`, { danger: true, confirmText: 'Resetar progresso' });
  if (!ok) return false;

  const { data: row, error: rerr } = await supabase.from('saves').select('data').eq('id', target.id).single();
  if (rerr) throw rerr;
  const old = row.data || {};
  const fresh = {
    name: old.name, age: old.age, class: old.class, avatar: old.avatar, avatarPhoto: old.avatarPhoto,
    username: old.username, profileTitle: '🔮 Novato de Crydan', customTitle: '', bio: old.bio || '',
    banner: old.banner || '', accent: '', theme: old.theme || 'dark',
    level: 1, xp: 0, xpToNext: 100,
    hp: 100, maxHp: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100,
    hunger: 100, maxHunger: 100, energy: 100,
    str: 10, dex: 10, int: 10, vit: 10, wis: 10,
    wallet: 100, bank: 0, totalEarned: 0,
    inventory: [{ id: 'pao', name: 'Pão', icon: '🍞', type: 'food', qty: 3, power: 20, rarity: 'common' }],
    equipped: { weapon: null, shield: null, armor: null, amulet: null, helmet: null },
    houses: [], companies: [],
    job: null, jobSalary: 0, workTurns: 0, lastWork: 0,
    guild: null, guildRole: null,
    married: null, friends: old.friends || [],
    battles: 0, wins: 0, losses: 0, bossKills: 0, lastBattle: 0,
    questsCompleted: 0, activeQuests: [], completedQuests: [],
    itemsCollected: 0, itemsBought: 0,
    achievements: ['first_login'],
    bankHistory: [{ type: 'bonus', desc: 'Conta resetada pela administração', amount: 100, ts: Date.now() }],
    activityFeed: ['🔄 Sua jornada em Crydan recomeçou do zero.'],
    collectProgress: { mineracao: 0, pesca: 0, caca: 0, coleta: 0 },
    questProgress: {},
    stats: { totalBattles: 0, totalKills: 0, totalWork: 0 },
    isBanned: false, registeredAt: old.registeredAt || Date.now(),
    chats: old.chats || [], communities: old.communities || [],
  };
  const { error: uerr } = await supabase.from('saves').update({ data: fresh }).eq('id', target.id);
  if (uerr) throw uerr;
  const { error: perr } = await supabase.rpc('admin_reset_account', { p_user_id: target.id });
  if (perr) throw perr;

  notify('success', `🔄 Progresso de ${target.name} foi resetado — vai recomeçar do zero no próximo login.`);
  admAudit('reset_account', target.name, '');
  sysLog(`[ADM] Resetou o progresso de ${target.name}`);
  return true;
}
async function admResetPlayerAccount() {
  const player = document.getElementById('adm-char-player').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    await admResetPlayerAccountCore(target);
  } catch (e) { notify('error', 'Não foi possível resetar a conta: ' + (e.message || 'erro')); }
}

// ══════════════════════════════════════════
//   MODAL ÚNICO: GERENCIAR JOGADOR (a partir da lista, sem digitar nome)
// ══════════════════════════════════════════
async function openAdminPlayerModal(id) {
  try {
    const { data: p, error } = await supabase.from('profiles')
      .select('id,name,username,avatar,avatar_photo,level,wallet,bank,banned,banned_reason,suspended_until,suspended_reason,verified_badge')
      .eq('id', id).single();
    if (error) throw error;
    const { data: row } = await supabase.from('saves').select('data').eq('id', id).single();
    const d = row?.data || {};
    const isSuspended = p.suspended_until && new Date(p.suspended_until) > new Date();
    const statusHtml = p.banned
      ? `<span class="badge badge-red">🚫 Banido</span>`
      : isSuspended
        ? `<span class="badge" style="background:var(--gold)">⏳ Suspenso até ${new Date(p.suspended_until).toLocaleDateString('pt-BR')}</span>`
        : `<span class="badge badge-green">✅ Ativo</span>`;

    showModal(`⚙️ Gerenciar ${escapeHtml(p.name)}`, `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-family:'Cinzel',serif;color:var(--gold2)">${escapeHtml(p.name)}${p.username?` <span style="color:var(--text3);font-size:12px">@${escapeHtml(p.username)}</span>`:''}${verifiedBadgeHtml(p)}</div>
          ${statusHtml}
        </div>
        <div class="grid2" style="gap:6px;font-size:12px;color:var(--text2)">
          <div>Nível: <b style="color:var(--gold2)">${d.level ?? p.level ?? 1}</b></div>
          <div>Carteira+Banco: <b style="color:var(--gold2)">${(p.wallet||0)+(p.bank||0)} Cry</b></div>
          <div>Cristais: <b style="color:var(--purple)">${d.crystals ?? 0}</b></div>
          <div>Vitórias/Derrotas: <b>${d.wins ?? 0}/${d.losses ?? 0}</b></div>
        </div>
        ${p.banned_reason ? `<div style="font-size:11px;color:var(--red);margin-top:6px">Motivo do banimento: ${escapeHtml(p.banned_reason)}</div>` : ''}
        ${isSuspended && p.suspended_reason ? `<div style="font-size:11px;color:var(--gold2);margin-top:6px">Motivo da suspensão: ${escapeHtml(p.suspended_reason)}</div>` : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        <div style="font-size:11px;color:var(--text3)">💰 Economia</div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" style="flex:1" onclick="admQuickCry('${p.id}',${JSON.stringify(p.name)},1)">➕ Dar Cry</button>
          <button class="btn-sm" style="flex:1" onclick="admQuickCry('${p.id}',${JSON.stringify(p.name)},-1)">➖ Tirar Cry</button>
          <button class="btn-sm" style="flex:1" onclick="admQuickCrystals('${p.id}',${JSON.stringify(p.name)})">💎 Cristais</button>
          <button class="btn-sm" style="flex:1" onclick="admQuickXP('${p.id}',${JSON.stringify(p.name)})">✨ XP</button>
        </div>

        <div style="font-size:11px;color:var(--text3);margin-top:6px">🛡️ Moderação</div>
        <div style="display:flex;gap:6px">
          ${p.banned
            ? `<button class="btn-sm btn-success" style="flex:1" onclick="admQuickBan('${p.id}',${JSON.stringify(p.name)},true)">✅ Desbanir</button>`
            : `<button class="btn-sm btn-danger" style="flex:1" onclick="admQuickBan('${p.id}',${JSON.stringify(p.name)},false)">🚫 Banir</button>`}
          ${isSuspended
            ? `<button class="btn-sm btn-success" style="flex:1" onclick="admQuickLiftSuspension('${p.id}',${JSON.stringify(p.name)})">✅ Levantar suspensão</button>`
            : `<button class="btn-sm" style="flex:1" onclick="admQuickSuspend('${p.id}',${JSON.stringify(p.name)})">⏳ Suspender</button>`}
        </div>

        <div style="font-size:11px;color:var(--text3);margin-top:6px">✔️ Selo de verificação</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="admQuickBadge('${p.id}',${JSON.stringify(p.name)},'admin')">🔵 Admin</button>
          <button class="btn-sm" onclick="admQuickBadge('${p.id}',${JSON.stringify(p.name)},'partner')">🟢 Parceria</button>
          <button class="btn-sm" onclick="admQuickBadge('${p.id}',${JSON.stringify(p.name)},'owner')">🔴 Dono</button>
          <button class="btn-sm" onclick="admQuickBadge('${p.id}',${JSON.stringify(p.name)},'subowner')">🟣 Subdono</button>
          ${p.verified_badge ? `<button class="btn-sm btn-danger" onclick="admQuickBadge('${p.id}',${JSON.stringify(p.name)},null)">✕ Remover selo</button>` : ''}
        </div>

        <div style="font-size:11px;color:var(--text3);margin-top:6px">✏️ Editar conta</div>
        <div class="form-group"><input class="form-input" id="admq-edit-name" placeholder="Nome" value="${escapeHtml(d.name || p.name || '')}"></div>
        <div class="form-group"><input class="form-input" id="admq-edit-username" placeholder="@usuario" value="${escapeHtml(d.username || p.username || '')}"></div>
        <button class="btn-sm btn-primary" onclick="admQuickSaveEdit('${p.id}',${JSON.stringify(p.name)})">💾 Salvar edição</button>

        <div style="font-size:11px;color:var(--text3);margin-top:10px">⚠️ Zona de risco</div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" style="flex:1" onclick="admQuickReset('${p.id}',${JSON.stringify(p.name)})">🔄 Resetar progresso</button>
          <button class="btn-sm btn-danger" style="flex:1" onclick="admQuickDelete('${p.id}',${JSON.stringify(p.name)})">🗑️ Excluir conta</button>
        </div>
      </div>
    `);
  } catch (e) {
    console.error('Erro ao abrir gerenciamento do jogador', e);
    notify('error', 'Não foi possível carregar os dados desse jogador.');
  }
}

function _admReopenModal(id) { closeModalDirect(); openAdminPlayerModal(id); refreshAdmPlayersList(); }

async function admQuickCry(id, name, sign) {
  const amt = parseInt(prompt(`Quanto Cry ${sign > 0 ? 'dar para' : 'tirar de'} ${name}?`, '100'));
  if (!amt || amt <= 0) return;
  try {
    const newWallet = await admAdjustWallet(id, sign * amt);
    notify(sign > 0 ? 'success' : 'warn', `ADM: ${sign > 0 ? '+' : '-'}${amt} Cry ${sign > 0 ? 'para' : 'de'} ${name} (novo saldo: ${newWallet})`);
    admAudit(sign > 0 ? 'give_cry' : 'take_cry', name, `${sign > 0 ? '+' : '-'}${amt} Cry`);
    sysLog(`[ADM] ${sign > 0 ? '+' : '-'}${amt} Cry ${sign > 0 ? '→' : '←'} ${name}`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickCrystals(id, name) {
  const amt = parseInt(prompt(`Quantos cristais para ${name}? (negativo remove)`, '100'));
  if (!amt) return;
  const reason = prompt('Motivo:', 'Ajuste administrativo') || 'Ajuste administrativo';
  try {
    const { error } = await supabase.rpc('admin_grant_crystals', { p_user_id: id, p_amount: amt, p_reason: reason });
    if (error) throw error;
    notify('success', `💎 ${amt} cristais ajustados para ${name}.`);
    admAudit('grant_crystals', name, `${amt} — ${reason}`);
    sysLog(`[ADM] Ajustou ${amt} cristais de ${name}`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickXP(id, name) {
  const xp = parseInt(prompt(`Quanto XP dar para ${name}?`, '100'));
  if (!xp || xp <= 0) return;
  try {
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', id).single();
    if (error) throw error;
    const newData = simulateGainXP(row.data || {}, xp);
    const { error: uerr } = await supabase.from('saves').update({ data: newData }).eq('id', id);
    if (uerr) throw uerr;
    await supabase.from('profiles').update({ level: newData.level }).eq('id', id);
    notify('success', `ADM: +${xp} XP para ${name} (agora Nv.${newData.level})`);
    admAudit('give_xp', name, `+${xp} XP`);
    sysLog(`[ADM] +${xp} XP → ${name}`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickBan(id, name, currentlyBanned) {
  try {
    if (currentlyBanned) {
      if (!await confirmDialog(`Desbanir ${escapeHtml(name)}?`)) return;
      await admSetBanned(id, name, false, null);
    } else {
      const reason = prompt(`Motivo do banimento de ${name}:`);
      if (!reason) return notify('error', 'Motivo é obrigatório.');
      await admSetBanned(id, name, true, reason);
    }
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickSuspend(id, name) {
  const days = parseInt(prompt(`Suspender ${name} por quantos dias?`, '7'));
  if (!days || days <= 0) return;
  const reason = prompt('Motivo da suspensão (o jogador vai ver):');
  if (!reason) return notify('error', 'Motivo é obrigatório.');
  try {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase.rpc('admin_set_suspension', { p_user_id: id, p_until: until, p_reason: reason });
    if (error) throw error;
    notify('warn', `⏳ ${name} suspenso(a) por ${days} dia(s).`);
    admAudit('suspend', name, `${days} dias — ${reason}`);
    sysLog(`[ADM] Suspendeu ${name} por ${days} dia(s)`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickLiftSuspension(id, name) {
  try {
    const { error } = await supabase.rpc('admin_set_suspension', { p_user_id: id, p_until: null, p_reason: null });
    if (error) throw error;
    notify('success', `✅ Suspensão de ${name} foi levantada.`);
    admAudit('lift_suspension', name, '');
    sysLog(`[ADM] Levantou suspensão de ${name}`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickBadge(id, name, badge) {
  try {
    const { error } = await supabase.rpc('admin_set_verified_badge', { p_user_id: id, p_badge: badge });
    if (error) throw error;
    notify(badge ? 'success' : 'info', badge ? `✔️ Selo concedido a ${name}.` : `Selo removido de ${name}.`);
    admAudit(badge ? 'set_verified_badge' : 'remove_verified_badge', name, badge || '');
    sysLog(`[ADM] ${badge ? 'Concedeu selo ' + badge + ' a' : 'Removeu selo de'} ${name}`);
    _admReopenModal(id);
  } catch (e) { notify('error', 'Não foi possível: ' + (e.message || 'erro')); }
}

async function admQuickSaveEdit(id, name) {
  const newName = document.getElementById('admq-edit-name').value.trim();
  const newUsername = document.getElementById('admq-edit-username').value.trim().toLowerCase();
  if (newUsername && !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(newUsername)) {
    return notify('error', '@usuário inválido — só letras minúsculas, números, ponto e underline.');
  }
  try {
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', id).single();
    if (error) throw error;
    const d = row.data || {};
    if (newName) d.name = newName;
    if (newUsername) d.username = newUsername;
    const { error: uerr } = await supabase.from('saves').update({ data: d }).eq('id', id);
    if (uerr) throw uerr;
    const profUpdate = {};
    if (newName) profUpdate.name = newName;
    if (newUsername) profUpdate.username = newUsername;
    if (Object.keys(profUpdate).length) {
      const { error: perr } = await supabase.from('profiles').update(profUpdate).eq('id', id);
      if (perr) throw perr;
    }
    notify('success', '✏️ Conta atualizada.');
    admAudit('edit_account', newName || name, `nome:${newName||'—'} @${newUsername||'—'}`);
    sysLog(`[ADM] Editou a conta de ${newName || name}`);
    _admReopenModal(id);
  } catch (e) {
    if ((e.message || '').includes('duplicate') || (e.message || '').includes('unique')) notify('error', 'Esse @usuário já está em uso por outra conta.');
    else notify('error', 'Não foi possível salvar: ' + (e.message || 'erro'));
  }
}

async function admQuickReset(id, name) {
  try {
    if (await admResetPlayerAccountCore({ id, name })) { closeModalDirect(); refreshAdmPlayersList(); }
  } catch (e) { notify('error', 'Não foi possível resetar a conta: ' + (e.message || 'erro')); }
}

async function admQuickDelete(id, name) {
  try {
    if (await admDeleteAccountCore({ id, name })) { closeModalDirect(); refreshAdmPlayersList(); }
  } catch (e) { notify('error', 'Não foi possível excluir a conta: ' + (e.message || 'erro')); }
}

async function admLookupPlayer() {
  const player = document.getElementById('adm-lookup-player').value.trim();
  const box = document.getElementById('adm-lookup-result');
  if (!player) return notify('error', 'Informe o jogador.');
  box.innerHTML = `<div style="color:var(--text3);padding:10px">Buscando...</div>`;
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name,level,wallet,bank,banned,suspended_until');
    if (!target) { box.innerHTML = `<div style="color:var(--red);padding:10px">Jogador "${player}" não encontrado.</div>`; return; }
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', target.id).single();
    if (error) throw error;
    const d = row.data || {};
    const houses = d.houses || [];
    const companies = d.companies || [];
    const statusHtml = target.banned ? '<span class="badge" style="background:var(--red)">BANIDO</span>'
      : (target.suspended_until && new Date(target.suspended_until) > new Date()) ? '<span class="badge" style="background:var(--gold)">SUSPENSO</span>'
      : '<span class="badge badge-purple">ATIVO</span>';
    box.innerHTML = `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-family:'Cinzel',serif;color:var(--gold2)">${escapeHtml(target.name)}</div>
          ${statusHtml}
        </div>
        <div class="grid2" style="gap:8px;font-size:12px;color:var(--text2)">
          <div>Nível: <b style="color:var(--gold2)">${d.level ?? target.level ?? 1}</b></div>
          <div>XP: <b>${d.xp ?? 0}</b></div>
          <div>Carteira: <b style="color:var(--gold2)">${d.wallet ?? target.wallet ?? 0} Cry</b></div>
          <div>Banco: <b style="color:var(--gold2)">${d.bank ?? target.bank ?? 0} Cry</b></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:10px">
        <div style="font-size:12.5px;color:var(--gold2);margin-bottom:6px">🏠 Casas (${houses.length})</div>
        ${houses.length ? houses.map((h,i) => {
          const info = HOUSES.find(x => x.id === h.id);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span>${info ? escapeHtml(info.name) : h.id}</span>
            <button class="btn-sm btn-danger" onclick="admRemoveAsset('${target.id}','houses',${i})">Remover</button>
          </div>`;
        }).join('') : '<div style="color:var(--text3);font-size:12px">Nenhuma</div>'}
      </div>
      <div class="card">
        <div style="font-size:12.5px;color:var(--gold2);margin-bottom:6px">🏢 Empresas (${companies.length})</div>
        ${companies.length ? companies.map((c,i) => {
          const info = COMPANIES.find(x => x.id === c.id);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span>${info ? escapeHtml(info.name) : c.id}</span>
            <button class="btn-sm btn-danger" onclick="admRemoveAsset('${target.id}','companies',${i})">Remover</button>
          </div>`;
        }).join('') : '<div style="color:var(--text3);font-size:12px">Nenhuma</div>'}
      </div>`;
  } catch (e) { box.innerHTML = `<div style="color:var(--red);padding:10px">Erro ao buscar dados.</div>`; console.error(e); }
}
async function admRemoveAsset(userId, kind, index) {
  const ok = await confirmDialog(`Remover ${kind === 'houses' ? 'esta casa' : 'esta empresa'} da conta do jogador?`, { danger: true, confirmText: 'Remover' });
  if (!ok) return;
  try {
    const { data: row, error } = await supabase.from('saves').select('data').eq('id', userId).single();
    if (error) throw error;
    const d = row.data || {};
    if (!Array.isArray(d[kind]) || !d[kind][index]) return notify('error', 'Item não encontrado (talvez já tenha sido alterado).');
    d[kind].splice(index, 1);
    const { error: uerr } = await supabase.from('saves').update({ data: d }).eq('id', userId);
    if (uerr) throw uerr;
    notify('success', 'Removido com sucesso.');
    admAudit(kind === 'houses' ? 'remove_house' : 'remove_company', userId, '');
    admLookupPlayer();
  } catch (e) { notify('error', 'Não foi possível remover: ' + (e.message || 'erro')); }
}

async function admBanPlayer() {
  const player = document.getElementById('adm-char-player').value.trim();
  const reason = document.getElementById('adm-ban-reason').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  if (!reason) return notify('error', 'O motivo do banimento é obrigatório — o jogador vai ver essa mensagem.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    await admSetBanned(target.id, target.name, true, reason);
    document.getElementById('adm-ban-reason').value = '';
  } catch (e) {
    console.error('Erro ao banir', e);
    notify('error', 'Não foi possível banir agora: ' + (e.message || 'erro desconhecido'));
  }
}
async function admUnbanPlayer() {
  const player = document.getElementById('adm-char-player').value.trim();
  if (!player) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(player, 'id,name');
    if (!target) return notify('error', `Jogador "${player}" não encontrado.`);
    await admSetBanned(target.id, target.name, false);
  } catch (e) {
    console.error('Erro ao desbanir', e);
    notify('error', 'Não foi possível desbanir agora: ' + (e.message || 'erro desconhecido'));
  }
}
// Atalhos usados pelos botões da lista de jogadores (já com o id certo)
async function admBanById(id, name) {
  const reason = await promptDialog(`Motivo do banimento de ${name} (opcional):`);
  if (reason === null) return; // cancelou
  try { await admSetBanned(id, name, true, reason); }
  catch (e) { console.error(e); notify('error', 'Não foi possível banir agora.'); }
}
async function admUnbanById(id, name) {
  try { await admSetBanned(id, name, false); }
  catch (e) { console.error(e); notify('error', 'Não foi possível desbanir agora.'); }
}

async function admAnnounce() {
  const msg = document.getElementById('adm-msg').value.trim();
  if (!msg) return notify('error', 'Escreva a mensagem.');
  try {
    // Anúncio de verdade: grava em app_settings, visível pra TODOS os
    // jogadores (não só no feed local do próprio admin como antes).
    await supabase.from('app_settings').upsert([{ key: 'global_announcement', value: { text: msg, ts: Date.now() } }], { onConflict: 'key' });
    APP_SETTINGS['global_announcement'] = { text: msg, ts: Date.now() };
    notify('info', '📢 Anúncio publicado para todos os jogadores!');
    admAudit('announce', null, msg);
    sysLog(`[ADM] Anúncio global: ${msg}`);
    document.getElementById('adm-msg').value = '';
  } catch (e) {
    console.error('Erro ao publicar anúncio', e);
    notify('error', 'Não foi possível publicar o anúncio agora.');
  }
}

function admStartEvent(type) {
  const names = { xp:'2x XP', gold:'2x Cry', drop:'Drops Raros' };
  if (admEventTimer) { clearTimeout(admEventTimer); admEventTimer = null; }
  activeEvent = type;
  notify('success', `🎉 Evento ${names[type]} iniciado!`);
  if (G && G.name) addToFeed(`🎉 EVENTO ESPECIAL: ${names[type]} ativado!`);
  sysLog(`[ADM] Evento iniciado: ${names[type]}`);
  renderAdm();
  admEventTimer = setTimeout(() => {
    activeEvent = null; admEventTimer = null;
    notify('info', 'Evento encerrado.');
    renderAdm();
  }, 60000);
}

// ── LINKS DE CONTATO / REDES SOCIAIS (editável pelo admin) ──
function socialLinksDefaults() {
  return {
    waCommunity: 'https://chat.whatsapp.com/D4FnXP7VYAkF8y0zQC7Klr',
    waNumber: '5561999313305',
    igCrydan: 'crydan.brasil',
    igPessoal: 'dantali4n',
  };
}
function getSocialLinks() {
  // Prefer app-wide social links from APP_SETTINGS (key: 'social_links')
  try {
    const s = APP_SETTINGS['social_links'];
    if (s) return Object.assign(socialLinksDefaults(), s);
  } catch (e) {}
  return socialLinksDefaults();
}
function admSaveSocialLinks() {
  const links = {
    waCommunity: document.getElementById('adm-link-wa-community').value.trim() || socialLinksDefaults().waCommunity,
    waNumber: document.getElementById('adm-link-wa-number').value.trim().replace(/\D/g, '') || socialLinksDefaults().waNumber,
    igCrydan: document.getElementById('adm-link-ig-crydan').value.trim().replace(/^@/, '') || socialLinksDefaults().igCrydan,
    igPessoal: document.getElementById('adm-link-ig-pessoal').value.trim().replace(/^@/, '') || socialLinksDefaults().igPessoal,
  };
  (async () => {
    try {
      await supabase.from('app_settings').upsert([{ key: 'social_links', value: links }], { onConflict: 'key' });
      APP_SETTINGS['social_links'] = links;
      notify('success', '🔗 Links salvos com sucesso!');
      sysLog('[ADM] Atualizou links de contato / redes sociais');
    } catch (e) { console.error('Erro salvando social links', e); notify('error','Erro ao salvar links.'); }
  })();
}

// ── MENSAGEM DO DIA ────────────────────────
function getMotd() { return APP_SETTINGS['motd'] || ''; }
function getGlobalAnnouncement() {
  const a = APP_SETTINGS['global_announcement'];
  if (!a || !a.text) return '';
  // some visível só por 3 dias, pra não ficar um aviso velho pra sempre
  if (Date.now() - (a.ts || 0) > 3 * 86400000) return '';
  return a.text;
}
function admSaveMotd() {
  const msg = document.getElementById('adm-motd').value.trim();
  if (!msg) return notify('error', 'Escreva uma mensagem antes de salvar.');
  (async () => {
    try {
      await supabase.from('app_settings').upsert([{ key: 'motd', value: msg }], { onConflict: 'key' });
      APP_SETTINGS['motd'] = msg;
      notify('success', '📢 Mensagem do dia atualizada!');
      sysLog('[ADM] Atualizou a mensagem do dia');
    } catch (e) { console.error('Erro ao salvar MOTD', e); notify('error','Erro ao salvar MOTD'); }
  })();
}
function admClearMotd() {
  (async () => {
    try {
      await supabase.from('app_settings').delete().eq('key','motd');
      delete APP_SETTINGS['motd'];
      const el = document.getElementById('adm-motd'); if (el) el.value = '';
      notify('info', 'Mensagem do dia removida.');
      sysLog('[ADM] Removeu a mensagem do dia');
    } catch (e) { console.error('Erro ao remover MOTD', e); notify('error','Erro ao remover MOTD'); }
  })();
}

// ── BLOQUEIO DE CADASTROS ──────────────────
function getBlockSignups() { return APP_SETTINGS['block_signups'] === true; }
function admToggleBlockSignups(checked) {
  (async () => {
    try {
      await supabase.from('app_settings').upsert([{ key: 'block_signups', value: checked }], { onConflict: 'key' });
      APP_SETTINGS['block_signups'] = checked;
      notify(checked ? 'warn' : 'info', checked ? '🚫 Novos cadastros bloqueados.' : '✅ Novos cadastros liberados.');
      sysLog(`[ADM] Cadastros de novos jogadores ${checked ? 'bloqueados' : 'liberados'}`);
    } catch (e) { console.error('Erro ao atualizar block_signups', e); notify('error','Erro ao atualizar configuração'); }
  })();
}

function renderAdmTools() {
  const links = getSocialLinks();
  document.getElementById('adm-link-wa-community').value = links.waCommunity;
  document.getElementById('adm-link-wa-number').value = links.waNumber;
  document.getElementById('adm-link-ig-crydan').value = links.igCrydan;
  document.getElementById('adm-link-ig-pessoal').value = links.igPessoal;
  document.getElementById('adm-motd').value = getMotd();
  document.getElementById('adm-block-signups').checked = getBlockSignups();
  renderSocialModList();
  renderAdminsList();
}

// Lista real de administradores atuais + promover/remover — antes não
// existia nenhuma forma de gerenciar quem é admin pelo próprio painel.
async function renderAdminsList() {
  const el = document.getElementById('adm-admins-list');
  if (!el) return;
  try {
    const { data: admins, error } = await supabase.from('app_admins').select('id, criado_em');
    if (error) throw error;
    if (!admins || !admins.length) { el.innerHTML = 'Nenhum admin encontrado.'; return; }
    const ids = admins.map(a => a.id);
    const { data: profs } = await supabase.from('profiles').select('id,name,username').in('id', ids);
    const profById = {}; (profs || []).forEach(p => profById[p.id] = p);
    el.innerHTML = admins.map(a => {
      const p = profById[a.id];
      return `<div style="padding:3px 0">👑 ${p ? escapeHtml(p.name) + (p.username ? ` (@${escapeHtml(p.username)})` : '') : a.id.slice(0,8)}</div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao listar admins', e);
    el.innerHTML = 'Não foi possível carregar.';
  }
}

async function admPromoteAdmin() {
  const name = document.getElementById('adm-admin-target').value.trim();
  if (!name) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(name, 'id,name');
    if (!target) return notify('error', `Jogador "${name}" não encontrado.`);
    const { error } = await supabase.from('app_admins').insert([{ id: target.id }]);
    if (error && error.code !== '23505') throw error;
    notify('success', `👑 ${target.name} agora é administrador.`);
    admAudit('promote_admin', target.name);
    sysLog(`[ADM] Promoveu ${target.name} a administrador`);
    document.getElementById('adm-admin-target').value = '';
    renderAdminsList();
  } catch (e) {
    console.error('Erro ao promover admin', e);
    notify('error', 'Não foi possível promover agora: ' + (e.message || 'erro desconhecido'));
  }
}
async function admDemoteAdmin() {
  const name = document.getElementById('adm-admin-target').value.trim();
  if (!name) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(name, 'id,name');
    if (!target) return notify('error', `Jogador "${name}" não encontrado.`);
    if (target.id === myId()) return notify('error', 'Você não pode remover a si mesmo dos administradores por aqui.');
    const { error } = await supabase.from('app_admins').delete().eq('id', target.id);
    if (error) throw error;
    notify('info', `${target.name} não é mais administrador.`);
    admAudit('demote_admin', target.name);
    sysLog(`[ADM] Removeu ${target.name} dos administradores`);
    document.getElementById('adm-admin-target').value = '';
    renderAdminsList();
  } catch (e) {
    console.error('Erro ao remover admin', e);
    notify('error', 'Não foi possível remover agora: ' + (e.message || 'erro desconhecido'));
  }
}

// Moderação de comunidades REAIS (compartilhadas entre contas) + as
// conversas/grupos locais deste dispositivo (essa parte ainda é local).
async function renderSocialModList() {
  const el = document.getElementById('adm-social-mod-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text3)">Carregando...</div>';
  let html = '';
  try {
    const { data: comms, error } = await supabase.from('communities').select('id,name,icon,owner_id').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    if (comms && comms.length) {
      const ids = comms.map(c => c.id);
      const { data: chCounts } = await supabase.from('community_channels').select('community_id').in('community_id', ids);
      const { data: memberCounts } = await supabase.from('community_members').select('community_id').in('community_id', ids);
      const chBy = {}, memBy = {};
      (chCounts || []).forEach(c => chBy[c.community_id] = (chBy[c.community_id] || 0) + 1);
      (memberCounts || []).forEach(m => memBy[m.community_id] = (memBy[m.community_id] || 0) + 1);
      html += `<div style="font-size:12px;color:var(--text3);margin:8px 0 4px">🏰 Comunidades (todas as contas)</div>`;
      html += comms.map(c => `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
        <span style="flex:1">${c.icon || '🏰'} ${escapeHtml(c.name)} <span style="color:var(--text3);font-size:11px">— ${chBy[c.id]||0} canais, ${memBy[c.id]||0} membros</span></span>
        <button class="btn-sm btn-danger" onclick="admDeleteCommunityItem('${c.id}')">Excluir</button>
      </div>`).join('');
    }
  } catch (e) {
    console.error('Erro ao listar comunidades para moderação', e);
    html += `<div style="color:var(--red);font-size:12px;padding:8px">Não foi possível carregar comunidades agora.</div>`;
  }
  if ((G.chats || []).length) {
    html += `<div style="font-size:12px;color:var(--text3);margin:12px 0 4px">💬 Conversas / Grupos (só deste dispositivo)</div>`;
    html += G.chats.map(c => `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
      <span style="flex:1">${c.type==='group'?'👥':'👤'} ${escapeHtml(c.name)} <span style="color:var(--text3);font-size:11px">— ${(c.messages || []).length} msgs</span></span>
      <button class="btn-sm btn-danger" onclick="admDeleteChatItem('${c.id}')">Excluir</button>
    </div>`).join('');
  }
  el.innerHTML = html || '<div style="color:var(--text3);font-size:13px;padding:14px;text-align:center">Nenhuma comunidade ou conversa encontrada.</div>';
}

async function admDeleteCommunityItem(id) {
  if (!await confirmDialog('Excluir esta comunidade?', { danger: true })) return;
  try {
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) throw error;
    admAudit('delete_community', id);
    sysLog(`[ADM] Excluiu comunidade: ${id}`);
    renderSocialModList(); renderAdm();
  } catch (e) {
    console.error('Erro ao excluir comunidade', e);
    notify('error', 'Não foi possível excluir agora.');
  }
}
async function admDeleteChatItem(id) {
  if (!await confirmDialog('Excluir esta conversa?', { danger: true })) return;
  G.chats = (G.chats || []).filter(c => c.id !== id);
  saveGame();
  sysLog(`[ADM] Excluiu conversa local: ${id}`);
  renderSocialModList(); renderAdm();
}

// ── ADM TOOLS ──────────────────────────────
function admExportData() {
  if (!G || !G.name) return notify('error', 'Nenhum dado de jogador para exportar.');
  const blob = new Blob([JSON.stringify(G, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `crydan_save_${G.name}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  notify('success', '⬇️ Dados exportados.');
  sysLog('[ADM] Exportou dados do jogador');
}

function admImportData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data || typeof data !== 'object' || !data.name) throw new Error('Formato inválido');
      G = data;
      G.communities = G.communities || [];
      G.chats = G.chats || [];
      G.feedbackList = G.feedbackList || [];
      saveGame();
      notify('success', `✅ Dados de "${G.name}" importados.`);
      sysLog(`[ADM] Importou dados: ${G.name}`);
      renderAdm();
    } catch (err) {
      notify('error', 'Arquivo inválido. Selecione um JSON exportado pelo Crydan.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function admClearCommunities() {
  if (!await confirmDialog('Excluir <b>TODAS</b> as comunidades, canais e mensagens de canais de TODOS os jogadores?', { danger: true })) return;
  try {
    const { error } = await supabase.from('communities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    notify('info', '🏰 Todas as comunidades foram removidas.');
    admAudit('clear_communities');
    sysLog('[ADM] Limpou todas as comunidades (banco de dados)');
    renderAdm();
  } catch (e) {
    console.error('Erro ao limpar comunidades', e);
    notify('error', 'Não foi possível limpar as comunidades agora.');
  }
}

async function admClearChats() {
  if (!await confirmDialog('Excluir suas conversas privadas e grupos <b>salvos localmente neste dispositivo</b>? (mensagens diretas reais entre outras contas não são afetadas)', { danger: true })) return;
  G.chats = []; saveGame();
  notify('info', '💬 Conversas locais removidas.');
  sysLog('[ADM] Limpou conversas/grupos locais do próprio dispositivo');
  renderAdm();
}

async function admClearFeedback() {
  if (!await confirmDialog('Excluir <b>TODO</b> o histórico de feedback de todos os jogadores?', { danger: true })) return;
  try {
    const { error } = await supabase.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    G.feedbackList = []; saveGame();
    notify('info', '📮 Todos os feedbacks foram removidos.');
    admAudit('clear_feedback');
    sysLog('[ADM] Limpou todos os feedbacks (banco de dados)');
    renderAdm();
  } catch (e) {
    console.error('Erro ao limpar feedbacks', e);
    notify('error', 'Não foi possível limpar os feedbacks agora.');
  }
}

async function renderAdmPosts() {
  const holder = document.getElementById('adm-posts-list');
  if (!holder) return;
  holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Carregando...</div>';
  try {
    const { data, error } = await supabase.from('posts').select('id,author_id,text,image,video,created_at').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    if (!data || !data.length) {
      holder.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-sub">Nenhuma publicação ainda.</div></div>`;
      return;
    }
    const authorIds = [...new Set(data.map(p => p.author_id))];
    const { data: profs } = authorIds.length ? await supabase.from('profiles').select('id,name,username').in('id', authorIds) : { data: [] };
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
    const postIds = data.map(p => p.id);
    const { data: allComments } = postIds.length ? await supabase.from('post_comments').select('post_id').in('post_id', postIds) : { data: [] };
    const commentCounts = {};
    (allComments || []).forEach(c => { commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1; });

    holder.innerHTML = data.map(p => {
      const author = profMap[p.author_id];
      const authorName = author ? (author.username ? `@${author.username}` : author.name) : 'Jogador removido';
      return `
      <div class="card" style="padding:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:12px;color:var(--gold2);cursor:pointer" onclick="openPublicProfileById('${p.author_id}')">${escapeHtml(authorName)}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:auto">${new Date(p.created_at).toLocaleString('pt-BR')}</span>
          <button class="btn-sm btn-danger" onclick="admDeleteAnyPost('${p.id}')">🗑️ Remover</button>
        </div>
        ${p.text ? `<div style="font-size:13px;color:var(--text2);white-space:pre-wrap">${escapeHtml(p.text)}</div>` : ''}
        ${p.image ? `<img src="${safeMediaUrl(p.image)}" style="max-width:220px;border-radius:8px;margin-top:6px">` : ''}
        ${p.video ? `<video src="${safeMediaUrl(p.video)}" controls style="max-width:220px;border-radius:8px;margin-top:6px"></video>` : ''}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <span style="font-size:11.5px;color:var(--text3);cursor:pointer" onclick="admToggleCommentsMod('${p.id}')">💬 ${commentCounts[p.id] || 0} comentário(s) — ver/moderar</span>
          <div id="adm-comments-${p.id}" style="display:none;margin-top:8px"></div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar publicações', e);
    holder.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar as publicações agora.</div></div>`;
  }
}

// ── ADM: Pedidos de Guilda ──────────────────
async function renderAdmGuildRequests() {
  const holder = document.getElementById('adm-guild-requests-list');
  if (!holder) return;
  holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Carregando...</div>';
  try {
    const { data, error } = await supabase.from('guild_creation_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw error;
    if (!data || !data.length) {
      holder.innerHTML = `<div class="empty-state"><div class="empty-icon">🛡️</div><div class="empty-sub">Nenhum pedido pendente.</div></div>`;
      return;
    }
    const ids = [...new Set(data.map(r => r.requester_id))];
    const { data: profs } = await supabase.from('profiles').select('id,name,username').in('id', ids);
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
    holder.innerHTML = data.map(r => {
      const author = profMap[r.requester_id];
      const authorName = author ? (author.username ? `@${author.username}` : author.name) : 'Jogador removido';
      return `
      <div class="card" style="padding:12px">
        <div style="font-size:13px;margin-bottom:4px">${r.emblem || '🛡️'} <b>${escapeHtml(r.name)}</b>${r.tag ? ` 【${escapeHtml(r.tag)}】` : ''}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Pedido por ${escapeHtml(authorName)} em ${new Date(r.created_at).toLocaleString('pt-BR')}</div>
        ${r.description ? `<div style="font-size:12px;color:var(--text2);margin-bottom:6px">${escapeHtml(r.description)}</div>` : ''}
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" style="flex:1" onclick="admApproveGuildRequest('${r.id}')">✔️ Aceitar</button>
          <button class="btn btn-danger" style="flex:1" onclick="admDeclineGuildRequest('${r.id}')">✕ Recusar</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar pedidos de guilda', e);
    holder.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar os pedidos agora.</div></div>`;
  }
}
async function admApproveGuildRequest(id) {
  try {
    const { error } = await supabase.rpc('admin_approve_guild_request', { p_request_id: id });
    if (error) throw error;
    notify('success', '✔️ Guilda criada!');
    admAudit('approve_guild_request', id);
    sysLog(`[ADM] Aprovou pedido de guilda ${id}`);
    renderAdmGuildRequests();
  } catch (e) {
    console.error('Erro ao aprovar guilda', e);
    notify('error', 'Não foi possível aprovar: ' + (e.message || 'erro desconhecido'));
  }
}
async function admDeclineGuildRequest(id) {
  const reason = prompt('Motivo da recusa (opcional):') || null;
  try {
    const { error } = await supabase.rpc('admin_decline_guild_request', { p_request_id: id, p_reason: reason });
    if (error) throw error;
    notify('info', 'Pedido recusado.');
    admAudit('decline_guild_request', id);
    sysLog(`[ADM] Recusou pedido de guilda ${id}`);
    renderAdmGuildRequests();
  } catch (e) {
    console.error('Erro ao recusar guilda', e);
    notify('error', 'Não foi possível recusar: ' + (e.message || 'erro desconhecido'));
  }
}

// ── ADM: Classes ─────────────────────────────
async function renderAdmClasses() {
  const holder = document.getElementById('adm-classes-list');
  if (!holder) return;
  holder.innerHTML = 'Carregando...';
  try {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (error) throw error;
    holder.innerHTML = (data || []).map(c => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px">
        <span style="font-size:16px">${c.icon || '⚔️'}</span>
        <span style="flex:1;font-size:13px">${escapeHtml(c.name)} <span style="color:var(--text3);font-size:11px">(${c.id})</span></span>
        <button class="btn-sm btn-danger" onclick="admRemoveClass('${c.id}')">🗑️</button>
      </div>`).join('') || '<div style="color:var(--text3);font-size:12px">Nenhuma classe cadastrada.</div>';
  } catch (e) {
    console.error('Erro ao carregar classes', e);
    holder.innerHTML = 'Não foi possível carregar.';
  }
}
async function admAddClass() {
  const id = document.getElementById('adm-class-id').value.trim().toLowerCase();
  const name = document.getElementById('adm-class-name').value.trim();
  const icon = document.getElementById('adm-class-icon').value.trim() || '⚔️';
  if (!id || !/^[a-z0-9_]{2,20}$/.test(id)) return notify('error', 'ID inválido. Use só letras minúsculas, números e underline.');
  if (!name) return notify('error', 'Informe o nome de exibição.');
  try {
    const { error } = await supabase.from('classes').insert([{ id, name, icon }]);
    if (error) throw error;
    notify('success', `⚔️ Classe "${name}" adicionada.`);
    admAudit('add_class', id);
    sysLog(`[ADM] Adicionou a classe ${name}`);
    document.getElementById('adm-class-id').value = '';
    document.getElementById('adm-class-name').value = '';
    document.getElementById('adm-class-icon').value = '';
    renderAdmClasses();
  } catch (e) {
    console.error('Erro ao adicionar classe', e);
    notify('error', 'Não foi possível adicionar: ' + (e.message || 'já existe uma classe com esse ID'));
  }
}
async function admRemoveClass(id) {
  if (!await confirmDialog(`Remover a classe "${id}"? Jogadores que já escolheram essa classe não são afetados, mas ninguém mais vai poder escolhê-la.`)) return;
  try {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
    notify('info', 'Classe removida.');
    admAudit('remove_class', id);
    sysLog(`[ADM] Removeu a classe ${id}`);
    renderAdmClasses();
  } catch (e) {
    console.error('Erro ao remover classe', e);
    notify('error', 'Não foi possível remover: ' + (e.message || 'erro desconhecido'));
  }
}

// ── ADM: Animações de Perfil (avatar/banner) ──
function _animPreviewHtml(l, size) {
  size = size || 56;
  if (l.kind === 'video') return `<video src="${l.url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px" autoplay loop muted playsinline></video>`;
  if (l.kind === 'gif') return `<img src="${l.url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px">`;
  return `<lottie-player src="${l.url}" background="transparent" speed="1" style="width:${size}px;height:${size}px" loop autoplay></lottie-player>`;
}
async function renderAdmLottie() {
  const holder = document.getElementById('adm-lottie-list');
  if (!holder) return;
  holder.innerHTML = 'Carregando...';
  try {
    _lottieCatalogCache = null; // sempre busca fresco na tela de admin
    const list = await getLottieCatalog();
    holder.innerHTML = list.length ? list.map(l => `
      <div class="card" style="padding:10px;text-align:center">
        <div style="display:flex;justify-content:center;margin-bottom:6px;background:#0003;border-radius:8px;padding:4px">${_animPreviewHtml(l)}</div>
        <div style="font-size:12px;font-weight:600;margin-bottom:2px" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</div>
        <div style="font-size:10.5px;color:var(--text3);margin-bottom:6px">${l.category === 'avatar' ? '🖼️ Avatar' : '🎞️ Banner'} · ${l.kind}</div>
        <div style="display:flex;gap:4px">
          <button class="btn-sm" style="flex:1" onclick="admEditLottie('${l.id}',${JSON.stringify(l.name)})">✏️</button>
          <button class="btn-sm btn-danger" style="flex:1" onclick="admRemoveLottie('${l.id}')">🗑️</button>
        </div>
      </div>`).join('') : '<div style="grid-column:1/-1;color:var(--text3);font-size:12px;text-align:center;padding:16px">Nenhuma animação cadastrada ainda.</div>';
  } catch (e) {
    console.error('Erro ao carregar animações de perfil', e);
    holder.innerHTML = 'Não foi possível carregar.';
  }
}
async function admAddLottie() {
  const name = document.getElementById('adm-lottie-name').value.trim();
  const category = document.getElementById('adm-lottie-category').value;
  const url = document.getElementById('adm-lottie-url').value.trim();
  if (!name) return notify('error', 'Informe o nome.');
  if (!/^https:\/\/.+\.json(\?.*)?$/i.test(url)) return notify('error', 'Cole a URL do arquivo .json da animação (link "Use this animation" do LottieFiles).');
  try {
    const { error } = await supabase.from('lottie_animations').insert([{ name, category, url, kind: 'lottie' }]);
    if (error) throw error;
    notify('success', `✨ Animação "${name}" adicionada.`);
    admAudit('add_lottie', name, category);
    sysLog(`[ADM] Adicionou a animação "${name}" (${category})`);
    document.getElementById('adm-lottie-name').value = '';
    document.getElementById('adm-lottie-url').value = '';
    renderAdmLottie();
  } catch (e) {
    console.error('Erro ao adicionar animação', e);
    notify('error', 'Não foi possível adicionar: ' + (e.message || 'erro desconhecido'));
  }
}
async function admUploadAnimFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const name = document.getElementById('adm-upload-name').value.trim();
  const category = document.getElementById('adm-upload-category').value;
  const statusEl = document.getElementById('adm-upload-status');
  if (!name) return notify('error', 'Preencha o nome antes de escolher o arquivo.');

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let kind;
  if (ext === 'json' || ext === 'lottie') kind = 'lottie';
  else if (ext === 'mp4' || ext === 'webm') kind = 'video';
  else if (ext === 'gif') kind = 'gif';
  else return notify('error', 'Formato não suportado. Use .json, .lottie, .mp4, .webm ou .gif.');

  if (file.size > 20 * 1024 * 1024) return notify('error', 'Arquivo maior que 20MB. Escolha um arquivo menor.');

  statusEl.textContent = 'Enviando...';
  try {
    const path = `${category}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('profile-animations').upload(path, file);
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('profile-animations').getPublicUrl(path);
    const { error } = await supabase.from('lottie_animations').insert([{ name, category, url: pub.publicUrl, kind }]);
    if (error) throw error;
    notify('success', `📁 "${name}" enviado e adicionado!`);
    admAudit('upload_anim', name, `${category} · ${kind}`);
    sysLog(`[ADM] Enviou a animação "${name}" (${category}, ${kind})`);
    document.getElementById('adm-upload-name').value = '';
    statusEl.textContent = 'Aceita: .json/.lottie (Lottie), .mp4/.webm (vídeo) ou .gif';
    renderAdmLottie();
  } catch (e) {
    console.error('Erro ao enviar animação', e);
    statusEl.textContent = 'Aceita: .json/.lottie (Lottie), .mp4/.webm (vídeo) ou .gif';
    notify('error', 'Não foi possível enviar: ' + (e.message || 'erro desconhecido'));
  }
}
async function admEditLottie(id, currentName) {
  const newName = prompt('Novo nome da animação:', currentName);
  if (!newName || !newName.trim() || newName.trim() === currentName) return;
  try {
    const { error } = await supabase.from('lottie_animations').update({ name: newName.trim() }).eq('id', id);
    if (error) throw error;
    notify('success', 'Nome atualizado.');
    admAudit('edit_lottie', newName.trim(), `antes: ${currentName}`);
    sysLog(`[ADM] Renomeou animação "${currentName}" → "${newName.trim()}"`);
    renderAdmLottie();
  } catch (e) {
    console.error('Erro ao renomear animação', e);
    notify('error', 'Não foi possível renomear: ' + (e.message || 'erro desconhecido'));
  }
}
async function admRemoveLottie(id) {
  if (!await confirmDialog('Remover essa animação? Quem já estiver usando ela no perfil vai deixar de ver o efeito.')) return;
  try {
    const { error } = await supabase.from('lottie_animations').delete().eq('id', id);
    if (error) throw error;
    notify('info', 'Animação removida.');
    admAudit('remove_lottie', id);
    sysLog(`[ADM] Removeu uma animação de perfil`);
    renderAdmLottie();
  } catch (e) {
    console.error('Erro ao remover animação', e);
    notify('error', 'Não foi possível remover: ' + (e.message || 'erro desconhecido'));
  }
}

// ── ADM: Selo de Verificação ──────────────────
async function admSetBadge() {
  const name = document.getElementById('adm-badge-target').value.trim();
  const badge = document.getElementById('adm-badge-type').value;
  if (!name) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(name, 'id,name');
    if (!target) return notify('error', `Jogador "${name}" não encontrado.`);
    const { error } = await supabase.rpc('admin_set_verified_badge', { p_user_id: target.id, p_badge: badge });
    if (error) throw error;
    notify('success', `✔️ Selo concedido a ${target.name}.`);
    admAudit('set_verified_badge', `${target.name}:${badge}`);
    sysLog(`[ADM] Concedeu selo ${badge} a ${target.name}`);
    document.getElementById('adm-badge-target').value = '';
  } catch (e) {
    console.error('Erro ao conceder selo', e);
    notify('error', 'Não foi possível conceder: ' + (e.message || 'erro desconhecido'));
  }
}
async function admRemoveBadge() {
  const name = document.getElementById('adm-badge-target').value.trim();
  if (!name) return notify('error', 'Informe o jogador.');
  try {
    const target = await findProfileByNameOrUsername(name, 'id,name');
    if (!target) return notify('error', `Jogador "${name}" não encontrado.`);
    const { error } = await supabase.rpc('admin_set_verified_badge', { p_user_id: target.id, p_badge: null });
    if (error) throw error;
    notify('info', `Selo removido de ${target.name}.`);
    admAudit('remove_verified_badge', target.name);
    sysLog(`[ADM] Removeu o selo de ${target.name}`);
    document.getElementById('adm-badge-target').value = '';
  } catch (e) {
    console.error('Erro ao remover selo', e);
    notify('error', 'Não foi possível remover: ' + (e.message || 'erro desconhecido'));
  }
}

async function admToggleCommentsMod(postId) {
  const box = document.getElementById('adm-comments-' + postId);
  if (!box) return;
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = `<div style="color:var(--text3);font-size:12px">Carregando...</div>`;
  try {
    const { data, error } = await supabase.from('post_comments').select('id,author_id,text,created_at').eq('post_id', postId).order('created_at', { ascending: true });
    if (error) throw error;
    const authorIds = [...new Set((data || []).map(c => c.author_id))];
    const { data: profs } = authorIds.length ? await supabase.from('profiles').select('id,name,username').in('id', authorIds) : { data: [] };
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
    box.innerHTML = (data || []).length ? data.map(c => {
      const author = profMap[c.author_id];
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px">
        <span style="color:var(--gold2)">${escapeHtml(author ? (author.username ? '@'+author.username : author.name) : 'Jogador removido')}:</span>
        <span style="color:var(--text2);flex:1">${escapeHtml(c.text)}</span>
        <button class="btn-sm btn-danger" onclick="admDeleteComment('${c.id}','${postId}')">🗑️</button>
      </div>`;
    }).join('') : `<div style="color:var(--text3);font-size:12px">Nenhum comentário.</div>`;
  } catch (e) { box.innerHTML = `<div style="color:var(--red);font-size:12px">Erro ao carregar comentários.</div>`; }
}
async function admDeleteComment(commentId, postId) {
  const ok = await confirmDialog('Remover este comentário?', { danger: true, confirmText: 'Remover' });
  if (!ok) return;
  try {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) throw error;
    notify('success', 'Comentário removido.');
    admAudit('delete_comment', postId, '');
    admToggleCommentsMod(postId); admToggleCommentsMod(postId);
    renderAdmPosts();
  } catch (e) { notify('error', 'Não foi possível remover: ' + (e.message || 'erro')); }
}

async function admDeleteAnyPost(postId) {
  const ok = await confirmDialog('Remover esta publicação permanentemente? Ela some do Feed de todo mundo.', { danger: true, confirmText: 'Remover' });
  if (!ok) return;
  try {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw error;
    notify('success', 'Publicação removida.');
    admAudit('delete_post', postId, '');
    sysLog(`[ADM] Removeu uma publicação do Feed`);
    renderAdmPosts();
  } catch (e) { notify('error', 'Não foi possível remover: ' + (e.message || 'erro')); }
}

async function admClearPosts() {
  if (!await confirmDialog('Excluir <b>TODAS</b> as publicações de TODOS os jogadores?', { danger: true })) return;
  try {
    const { error } = await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    notify('info', '📰 Todas as publicações foram removidas.');
    admAudit('clear_posts');
    sysLog('[ADM] Limpou todas as publicações (banco de dados)');
    renderAdm();
  } catch (e) {
    console.error('Erro ao limpar publicações', e);
    notify('error', 'Não foi possível limpar as publicações agora.');
  }
}

function admClearLogs() {
  logs = [];
  renderLogs();
  notify('info', '🗑️ Logs limpos.');
}

async function admResetOwnSessionAccount() {
  if (!G || !G.name) return notify('error', 'Nenhum personagem logado neste dispositivo para resetar.');
  if (!await confirmDialog(`Tem certeza que deseja apagar <b>PERMANENTEMENTE</b> o personagem "${escapeHtml(G.name)}"?`, { danger: true })) return;
  try {
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data?.session;
    if (session && session.user) {
      const { error } = await supabase.from('saves').delete().eq('id', session.user.id);
      if (error) throw error;
    }
  } catch (e) {
    console.error('Erro ao remover save remoto', e);
    notify('error', 'Não foi possível apagar o save remoto agora. Tente de novo.');
    return;
  }
  G = {};
  notify('warn', '💣 Sua sessão de teste foi resetada.');
  sysLog('[ADM] Resetou a própria sessão de teste');
  renderAdm();
}

// ── LOGS ───────────────────────────────────
function sysLog(msg) {
  const ts = new Date().toLocaleTimeString();
  logs.unshift(`[${ts}] ${msg}`);
  if (logs.length > 100) logs.pop();
}

function renderLogs() {
  const el = document.getElementById('system-logs');
  if (el) {
    if (!logs.length) el.innerHTML = '<div style="color:var(--text3)">Sem logs</div>';
    else el.innerHTML = logs.map(l => `<div style="padding:3px 0;border-bottom:1px solid var(--border);color:var(--text2)">${escapeHtml(l)}</div>`).join('');
  }
  renderAuditLog();
}

// Log de auditoria real (tabela admin_logs) — mostra quem fez o quê,
// visível pra qualquer admin, não só no dispositivo de quem agiu.
async function renderAuditLog() {
  const el = document.getElementById('adm-audit-log');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3)">Carregando...</div>';
  try {
    const { data, error } = await supabase.from('admin_logs').select('admin_id,action,target_name,details,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    if (!data || !data.length) { el.innerHTML = '<div style="color:var(--text3)">Nenhuma ação registrada ainda.</div>'; return; }
    const adminIds = [...new Set(data.map(l => l.admin_id))];
    const { data: profs } = await supabase.from('profiles').select('id,name').in('id', adminIds);
    const nameById = {}; (profs || []).forEach(p => nameById[p.id] = p.name);
    const ACTION_LABEL = {
      give_cry: '💰 deu Cry', take_cry: '💸 removeu Cry', give_xp: '⭐ deu XP',
      ban: '🚫 baniu', unban: '✅ desbaniu', announce: '📢 anunciou',
      clear_communities: '🏰 limpou comunidades', clear_posts: '📰 limpou publicações',
      clear_feedback: '📮 limpou feedbacks', delete_community: '🗑️ excluiu comunidade',
      promote_admin: '👑 promoveu admin', demote_admin: '👑 removeu admin',
    };
    el.innerHTML = data.map(l => `<div style="padding:3px 0;border-bottom:1px solid var(--border);color:var(--text2)">
      <span style="color:var(--gold2)">${escapeHtml(nameById[l.admin_id] || l.admin_id.slice(0,8))}</span>
      ${ACTION_LABEL[l.action] || l.action}${l.target_name ? ` → <b style="color:var(--text)">${escapeHtml(l.target_name)}</b>` : ''}${l.details ? ` (${escapeHtml(l.details)})` : ''}
      <span style="color:var(--text3);float:right">${new Date(l.created_at).toLocaleString('pt-BR')}</span>
    </div>`).join('');
  } catch (e) {
    console.error('Erro ao carregar log de auditoria', e);
    el.innerHTML = '<div style="color:var(--red)">Não foi possível carregar o log agora.</div>';
  }
}

// ── CONFIG ─────────────────────────────────
function renderConfig() {
  setTimeout(() => initThemeLottie('theme-toggle-lottie-cfg'), 200);
  document.getElementById('cfg-username').value = G.username || '';
  document.getElementById('cfg-username-hint').textContent = 'Letras minúsculas, números, ponto e underline. É como as pessoas vão te encontrar (@usuario).';
  document.getElementById('cfg-username-hint').style.color = 'var(--crydan-text-muted)';
  document.getElementById('cfg-name').value = G.name || '';
  document.getElementById('cfg-title').value = G.customTitle || '';
  document.getElementById('cfg-bio').value = G.bio || '';
  document.getElementById('cfg-banner').value = G.banner || '';
  loadReferralInfo();
  loadLoginSecurity();
  applyTheme(G.theme || 'dark');

  updateAvatarPreviewEl('cfg-avatar-preview', 'cfg-avatar-remove');
  const bgImgRemoveBtn = document.getElementById('cfg-bg-image-remove');
  if (bgImgRemoveBtn) bgImgRemoveBtn.style.display = G.customBgImage ? 'inline-block' : 'none';

  const swatchHolder = document.getElementById('cfg-accent-swatches');
  swatchHolder.innerHTML = ACCENT_COLORS.map(c => `<div class="accent-swatch ${G.accent===c?'selected':''}" style="background:${c}" onclick="quickSetAccent('${c}')" title="${c}"></div>`).join('');

  const bgHolder = document.getElementById('cfg-bg-swatches');
  const currentBg = G.bgPalette || 'default';
  bgHolder.innerHTML = BG_PALETTES.map(p => `<div class="bg-swatch ${currentBg===p.id?'selected':''}" style="background:${p.swatch}" onclick="quickSetBgPalette('${p.id}')" title="${p.name}"></div>`).join('');

  const fontHolder = document.getElementById('cfg-font-options');
  const currentFont = G.font || 'crimson';
  fontHolder.innerHTML = FONT_OPTIONS.map(f => `<div class="font-option ${currentFont===f.id?'selected':''}" style="font-family:${f.css}" onclick="quickSetFont('${f.id}')">${f.name}</div>`).join('');

  const bannerAnimHolder = document.getElementById('cfg-banneranim-options');
  if (bannerAnimHolder) {
    const currentAnim = G.bannerAnim || 'none';
    bannerAnimHolder.innerHTML = BANNER_ANIMS.map(a => `<div class="font-option ${currentAnim===a.id?'selected':''}" onclick="quickSetBannerAnim('${a.id}')">${a.name}</div>`).join('');
  }

  const reduceMotionCb = document.getElementById('cfg-reduce-motion');
  if (reduceMotionCb) reduceMotionCb.checked = !!G.reduceMotion;
  const compactModeCb = document.getElementById('cfg-compact-mode');
  if (compactModeCb) compactModeCb.checked = !!G.compactMode;

  const linksHolder = document.getElementById('cfg-profile-links-inputs');
  if (linksHolder) {
    G.profileLinks = G.profileLinks || {};
    linksHolder.innerHTML = LINK_PLATFORMS.map(p => `
      <div class="form-group">
        <label class="form-label">${p.icon} ${p.name}</label>
        <input class="form-input" id="cfg-link-${p.id}" value="${escapeHtml(G.profileLinks[p.id] || '')}" placeholder="${p.placeholder}">
      </div>`).join('');
  }

  const links = getSocialLinks();
  document.getElementById('cfg-social-links').innerHTML = `
    <a class="social-pill wa" href="${links.waCommunity}" target="_blank" rel="noopener">💬 Comunidade no WhatsApp</a>
    <a class="social-pill wa" href="https://wa.me/${links.waNumber}" target="_blank" rel="noopener">📱 Fale comigo no WhatsApp</a>
    <a class="social-pill ig" href="https://instagram.com/${links.igCrydan}" target="_blank" rel="noopener">📸 @${links.igCrydan} (Crydan)</a>
    <a class="social-pill ig" href="https://instagram.com/${links.igPessoal}" target="_blank" rel="noopener">📸 @${links.igPessoal} (Pessoal)</a>
  `;
}

function quickSetAccent(c) {
  applyAccentColor(c, true);
  refreshProfile(); renderConfig();
  notify('success', '🎨 Cor de destaque atualizada!');
}

function quickSetBgPalette(id) {
  applyBackgroundPalette(id, true);
  renderConfig();
  const pal = BG_PALETTES.find(p => p.id === id);
  notify('success', `🎨 Fundo do app alterado para "${pal.name}"!`);
}

function quickSetFont(id) {
  applyFont(id, true);
  renderConfig();
  const f = FONT_OPTIONS.find(x => x.id === id);
  notify('success', `🔤 Fonte alterada para ${f.name}!`);
}

function quickSetBannerAnim(id) {
  applyBannerAnim(id, true);
  renderConfig();
  if (id.startsWith('lottie:')) {
    const l = (_lottieCatalogCache || []).find(x => x.id === id.slice(7));
    notify('success', `✨ Animação "${l ? l.name : 'Lottie'}" aplicada ao banner!`);
    return;
  }
  const a = BANNER_ANIMS.find(x => x.id === id);
  notify('success', `✨ Animação de banner "${a.name}" aplicada!`);
}

function saveProfileLinks() {
  G.profileLinks = G.profileLinks || {};
  LINK_PLATFORMS.forEach(p => {
    const input = document.getElementById('cfg-link-' + p.id);
    if (input) G.profileLinks[p.id] = input.value.trim();
  });
  saveGame();
  renderProfileLinks();
  notify('success', '🔗 Links do perfil salvos!');
}

// ── @usuário único (regras iguais Instagram) ────────────────────────
// 1–30 caracteres, letras minúsculas, números, ponto e underline;
// não pode começar/terminar com ponto nem ter ponto duplo.
let _usernameCheckTimer = null;
async function checkUsernameAvailability() {
  const input = document.getElementById('cfg-username');
  const hint = document.getElementById('cfg-username-hint');
  const clean = normalizeUsernameInput(input.value);
  if (clean !== input.value) input.value = clean;
  clearTimeout(_usernameCheckTimer);
  if (!clean) {
    hint.textContent = 'Letras minúsculas, números, ponto e underline. É como as pessoas vão te encontrar (@usuario).';
    hint.style.color = 'var(--crydan-text-muted)';
    return;
  }
  if (!USERNAME_REGEX.test(clean)) {
    hint.textContent = '❌ Use apenas letras minúsculas, números, ponto e underline (não pode começar/terminar com ponto).';
    hint.style.color = 'var(--crydan-danger)';
    return;
  }
  if (clean === (G.username || '')) {
    hint.textContent = '✓ Este já é o seu @usuario atual.';
    hint.style.color = 'var(--crydan-success)';
    return;
  }
  hint.textContent = 'Verificando disponibilidade...';
  hint.style.color = 'var(--crydan-text-muted)';
  _usernameCheckTimer = setTimeout(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle();
      if (error) throw error;
      if (data) {
        hint.textContent = '❌ Esse @usuario já está em uso.';
        hint.style.color = 'var(--crydan-danger)';
      } else {
        hint.textContent = '✓ Disponível!';
        hint.style.color = 'var(--crydan-success)';
      }
    } catch (e) {
      hint.textContent = 'Não foi possível verificar agora.';
      hint.style.color = 'var(--crydan-text-muted)';
    }
  }, 400);
}

async function saveConfig() {
  const n = document.getElementById('cfg-name').value.trim();
  const t = document.getElementById('cfg-title').value.trim();
  const b = document.getElementById('cfg-bio').value.trim();
  const bn = document.getElementById('cfg-banner').value.trim();
  const u = normalizeUsernameInput(document.getElementById('cfg-username').value);

  if (u && !USERNAME_REGEX.test(u)) {
    return notify('error', '@usuario inválido. Use apenas letras minúsculas, números, ponto e underline.');
  }
  if (u && u !== (G.username || '')) {
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle();
      if (error) throw error;
      if (data) return notify('error', `O @${u} já está em uso por outra pessoa.`);
    } catch (e) {
      return notify('error', 'Não foi possível verificar o @usuario agora. Tente de novo.');
    }
    G.username = u;
  } else if (!u) {
    G.username = '';
  }

  if (n) G.name = n;
  if (t) G.customTitle = t;
  G.bio = b;
  G.banner = bn;
  saveGame(); updateHeader(); refreshProfile();
  notify('success', '💾 Configurações salvas!');
}

// ── LOGIN & SEGURANÇA ──────────────────────

async function loadLoginSecurity() {
  const emailEl = document.getElementById('cfg-current-email');
  const methodsEl = document.getElementById('cfg-login-methods');
  if (!emailEl || !methodsEl) return;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    emailEl.value = user?.email || '(sem e-mail nesta conta)';

    let identities = [];
    try {
      const { data: idData } = await supabase.auth.getUserIdentities();
      identities = idData?.identities || [];
    } catch (e) { console.error('Erro ao carregar identidades', e); }

    methodsEl.innerHTML = OAUTH_PROVIDERS.map(p => {
      const linked = identities.some(i => i.provider === p.id);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:10px">
        <span style="font-size:16px">${p.icon}</span>
        <span style="flex:1;font-size:13px">${p.label}${linked ? ' — conectado' : ''}</span>
        ${linked
          ? `<button class="btn btn-sm btn-danger" onclick="disconnectLoginProvider('${p.id}')">Desconectar</button>`
          : `<button class="btn btn-sm" onclick="connectLoginProvider('${p.id}')">Conectar</button>`}
      </div>`;
    }).join('') + `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:10px">
        <span style="font-size:16px">✉️</span>
        <span style="flex:1;font-size:13px">E-mail e senha — conectado</span>
      </div>`;
  } catch (e) {
    console.error('Erro ao carregar login/segurança', e);
    emailEl.value = 'Não foi possível carregar.';
    methodsEl.innerHTML = '';
  }
}

async function requestEmailChange() {
  const newEmail = document.getElementById('cfg-new-email').value.trim();
  if (!newEmail || !newEmail.includes('@')) return notify('error', 'Digite um e-mail válido.');
  try {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
    notify('success', '📩 Link de confirmação enviado! Verifique sua caixa de entrada (e a de spam) para concluir a troca.');
    document.getElementById('cfg-email-change-box').style.display = 'none';
    document.getElementById('cfg-email-change-toggle').style.display = 'inline-block';
    document.getElementById('cfg-new-email').value = '';
  } catch (e) {
    console.error('Erro ao trocar e-mail', e);
    notify('error', e.message || 'Não foi possível iniciar a troca de e-mail agora.');
  }
}

async function connectLoginProvider(provider) {
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
    if (data?.url) window.location.href = data.url;
  } catch (e) {
    console.error('Erro ao conectar provedor', e);
    notify('error', e.message || `Não foi possível conectar com ${provider} agora. Pode ser que esse método de login ainda não esteja habilitado no Crydan.`);
  }
}

async function disconnectLoginProvider(provider) {
  if (!await confirmDialog(`Desconectar o login por ${provider}? Você continuará podendo entrar pelos outros métodos.`)) return;
  try {
    const { data: idData, error: idErr } = await supabase.auth.getUserIdentities();
    if (idErr) throw idErr;
    const identity = (idData?.identities || []).find(i => i.provider === provider);
    if (!identity) return notify('error', 'Método não encontrado.');
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) throw error;
    notify('success', `${provider} desconectado.`);
    loadLoginSecurity();
  } catch (e) {
    console.error('Erro ao desconectar provedor', e);
    notify('error', e.message || 'Não foi possível desconectar agora. Você precisa de pelo menos um método de login ativo.');
  }
}

// ── FEEDBACK ───────────────────────────────
let fbSelectedStars = 0;

function setupStarPicker() {
  const holder = document.getElementById('fb-stars');
  if (!holder || holder._wired) return;
  holder._wired = true;
  holder.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      fbSelectedStars = Number(star.dataset.v);
      paintStars();
    });
  });
}
function paintStars() {
  document.querySelectorAll('#fb-stars .star').forEach(s => s.classList.toggle('active', Number(s.dataset.v) <= fbSelectedStars));
}

async function submitFeedback() {
  const type = document.getElementById('fb-type').value;
  const title = document.getElementById('fb-title').value.trim();
  const msg = document.getElementById('fb-msg').value.trim();
  if (!title || !msg) return notify('error', 'Preencha o título e a mensagem.');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');

  try {
    const fullText = `[${type}] ${title}\n${msg}`;
    const { error } = await supabase.from('feedback').insert([{ author_id: me, stars: fbSelectedStars || 0, text: fullText }]);
    if (error) throw error;
    document.getElementById('fb-title').value = '';
    document.getElementById('fb-msg').value = '';
    fbSelectedStars = 0; paintStars();
    notify('success', '📨 Feedback enviado — obrigado por ajudar a melhorar o Crydan!');
    sysLog(`Feedback enviado por ${G.name}: [${type}] ${title}`);
  } catch (e) {
    console.error('Erro ao enviar feedback', e);
    if ((e.message || '').includes('relation "public.feedback" does not exist')) {
      notify('error', 'Sistema de feedback ainda não configurado no banco.');
    } else {
      notify('error', 'Não foi possível enviar o feedback agora.');
    }
  }
}

async function deleteFeedback(id) {
  try {
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) throw error;
    renderFeedback();
  } catch (e) {
    console.error('Erro ao excluir feedback', e);
    notify('error', 'Não foi possível excluir agora.');
  }
}


// ── Painel do admin — vê o feedback de TODOS os jogadores, não só o
// seu próprio. RLS já permite isso (feedback_select_own_or_admin usa
// is_admin()), então é só puxar tudo com o nome de quem enviou.
async function renderAdmFeedback() {
  const holder = document.getElementById('adm-feedback-list');
  if (!holder) return;
  holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Carregando...</div>';
  try {
    const { data, error } = await supabase.from('feedback').select('id,author_id,stars,text,created_at,reply_text,replied_at').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    if (!data || !data.length) {
      holder.innerHTML = `<div class="empty-state"><div class="empty-icon">📮</div><div class="empty-sub">Nenhum feedback enviado ainda.</div></div>`;
      return;
    }
    const authorIds = [...new Set(data.map(f => f.author_id))];
    const { data: profs } = authorIds.length ? await supabase.from('profiles').select('id,name,username').in('id', authorIds) : { data: [] };
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));

    holder.innerHTML = data.map(f => {
      const m = (f.text || '').match(/^\[(\w+)\]\s*([^\n]*)\n?([\s\S]*)$/);
      const type = m ? m[1] : 'outro';
      const title = m ? m[2] : '';
      const msg = m ? m[3] : (f.text || '');
      const author = profMap[f.author_id];
      const authorName = author ? (author.username ? `@${author.username}` : author.name) : 'Jogador removido';
      return `
      <div class="fb-item type-${type}">
        <div class="fb-head">
          <span class="badge badge-gray">${FB_TYPE_LABEL[type] || type}</span>
          <b style="font-family:'Cinzel',serif;font-size:13px;color:var(--text)">${escapeHtml(title)}</b>
          <span style="margin-left:auto;font-size:11px;color:var(--gold2);cursor:pointer" onclick="openPublicProfileById('${f.author_id}')">${escapeHtml(authorName)}</span>
          <button class="modal-close" style="position:static;font-size:14px" onclick="admDeleteFeedback('${f.id}')" title="Remover">✕</button>
        </div>
        <div class="fb-msg">${escapeHtml(msg)}</div>
        ${f.stars ? `<div style="color:var(--gold2);margin-top:6px">${'★'.repeat(f.stars)}${'☆'.repeat(5-f.stars)}</div>` : ''}
        <div class="fb-meta">${new Date(f.created_at).toLocaleString('pt-BR')}</div>
        ${f.reply_text ? `
          <div style="background:var(--bg3);border-left:2px solid var(--gold);border-radius:6px;padding:8px 10px;margin-top:8px">
            <div style="font-size:10.5px;color:var(--gold2);margin-bottom:3px">Sua resposta (${new Date(f.replied_at).toLocaleString('pt-BR')}):</div>
            <div style="font-size:12.5px;color:var(--text2)">${escapeHtml(f.reply_text)}</div>
          </div>` : `
          <div style="display:flex;gap:6px;margin-top:8px">
            <input class="form-input" id="fb-reply-${f.id}" placeholder="Responder ao jogador..." style="flex:1;font-size:12px">
            <button class="btn-sm btn-primary" onclick="admReplyFeedback('${f.id}')">Responder</button>
          </div>`}
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar feedback dos jogadores', e);
    holder.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar o feedback agora.</div></div>`;
  }
}
async function admReplyFeedback(id) {
  const input = document.getElementById('fb-reply-' + id);
  const text = input?.value.trim();
  if (!text) return notify('error', 'Escreva uma resposta.');
  try {
    const { error } = await supabase.from('feedback').update({ reply_text: text, replied_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    notify('success', 'Resposta enviada ao jogador.');
    admAudit('reply_feedback', id, text);
    renderAdmFeedback();
  } catch (e) { notify('error', 'Não foi possível responder: ' + (e.message || 'erro')); }
}

async function admDeleteFeedback(id) {
  if (!await confirmDialog('Remover esse feedback?', { danger: true })) return;
  try {
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) throw error;
    renderAdmFeedback();
  } catch (e) {
    console.error('Erro ao remover feedback', e);
    notify('error', 'Não foi possível remover agora.');
  }
}

async function renderFeedback() {
  setupStarPicker();
  paintStars();
  const holder = document.getElementById('fb-list');
  holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Carregando...</div>';
  const me = myId();
  if (!me) { holder.innerHTML = ''; return; }
  try {
    const { data, error } = await supabase.from('feedback').select('id,stars,text,created_at,reply_text,replied_at').eq('author_id', me).order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Nenhum feedback enviado ainda.</div>';
      return;
    }
    holder.innerHTML = data.map(f => {
      const m = (f.text || '').match(/^\[(\w+)\]\s*([^\n]*)\n?([\s\S]*)$/);
      const type = m ? m[1] : 'outro';
      const title = m ? m[2] : '';
      const msg = m ? m[3] : (f.text || '');
      return `
      <div class="fb-item type-${type}">
        <div class="fb-head">
          <span class="badge badge-gray">${FB_TYPE_LABEL[type] || type}</span>
          <b style="font-family:'Cinzel',serif;font-size:13px;color:var(--text)">${escapeHtml(title)}</b>
          <button class="modal-close" style="position:static;margin-left:auto;font-size:14px" onclick="deleteFeedback('${f.id}')" title="Remover">✕</button>
        </div>
        <div class="fb-msg">${escapeHtml(msg)}</div>
        ${f.stars ? `<div style="color:var(--gold2);margin-top:6px">${'★'.repeat(f.stars)}${'☆'.repeat(5-f.stars)}</div>` : ''}
        <div class="fb-meta">${new Date(f.created_at).toLocaleString('pt-BR')}</div>
        ${f.reply_text ? `<div style="background:var(--bg3);border-left:2px solid var(--gold);border-radius:6px;padding:8px 10px;margin-top:8px">
            <div style="font-size:10.5px;color:var(--gold2);margin-bottom:3px">Resposta da administração:</div>
            <div style="font-size:12.5px;color:var(--text2)">${escapeHtml(f.reply_text)}</div>
          </div>` : `<div style="font-size:11px;color:var(--text3);margin-top:6px">⏳ Aguardando resposta da administração</div>`}
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar feedback', e);
    holder.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">Não foi possível carregar seu feedback agora.</div>';
  }
}

// ── XP / LEVEL ─────────────────────────────
function gainXP(amount) {
  let bonus = 1;
  if (activeEvent === 'xp') bonus = 2;
  if (G.married) bonus *= 1.1;
  G.xp += Math.floor(amount * bonus);
  while (G.xp >= G.xpToNext) {
    G.xp -= G.xpToNext;
    G.level++;
    G.xpToNext = Math.floor(G.xpToNext * 1.2 + 50);
    G.maxHp += 10; G.hp = G.maxHp;
    G.maxMana += 5; G.mana = G.maxMana;
    G.str++; G.dex++; G.int++; G.vit++; G.wis++;
    addToFeed(`⭐ LEVEL UP! Agora você é Nível ${G.level}!`);
    notify('success', `⭐ LEVEL UP! Nível ${G.level}!`);
    celebrate('normal');
    updateQuestProgress('level', G.level);
    sysLog(`${G.name} chegou ao nível ${G.level}`);
  }
  checkAchievements();
}

// ── TIMERS ─────────────────────────────────
function startTimers() {
  // Antes a fome caía 1 ponto a cada 30s (zerava em ~50 minutos — rápido
  // demais). Agora cai 1 ponto a cada 6 minutos, então os 100 pontos
  // duram cerca de 10 horas de jogo antes de precisar comer de novo.
  hungerTimer = setInterval(() => {
    G.hunger = Math.max(0, G.hunger - 1);
    G.energy = Math.max(0, Math.round(G.hunger));
    if (G.hunger === 0) notify('error', '🍖 Você está com muita fome!');
    saveGame();
    const cur = document.querySelector('.panel.active');
    if (cur?.id === 'panel-inicio') refreshDashboard();
  }, 360000);

  cooldownTimer = setInterval(() => {
    updateWorkCooldown();
    updateBattleCooldown();
  }, 1000);

  workTimer = setInterval(() => {
    if (G.companies && G.companies.length > 0) {
      const income = G.companies.reduce((sum, owned) => {
        const c = COMPANIES.find(cc => cc.id === owned.id);
        return sum + (c?.income || 0);
      }, 0);
      if (income > 0) {
        G.wallet += Math.floor(income / 60);
        G.totalEarned = (G.totalEarned||0) + Math.floor(income/60);
        saveGame(); updateHeader();
      }
    }
    if (G.houses && G.houses.length > 0) {
      G.houses.filter(h => !h.rented).forEach(owned => {
        const h = HOUSES.find(hh => hh.id === owned.id);
        if (h && h.perDay > 0) {
          const perMin = h.perDay / 1440;
          // Antes isto somava a fração direto em G.wallet, o que ao longo de
          // horas transformava a carteira num número quebrado (ex.:
          // 45816.61111...), e qualquer função do banco que espera um
          // inteiro (como o cofre da guilda) quebrava com esse valor.
          // Agora a fração fica guardada aqui e só vira Cry de verdade
          // (número inteiro) quando acumula um Cry inteiro — o total
          // ganho ao longo do tempo é o mesmo, só a carteira nunca mais
          // vira decimal.
          G._houseIncomeAccum = (G._houseIncomeAccum || 0) + perMin;
          const whole = Math.floor(G._houseIncomeAccum);
          if (whole > 0) {
            G.wallet += whole;
            G.totalEarned = (G.totalEarned || 0) + whole;
            G._houseIncomeAccum -= whole;
          }
        }
      });
      saveGame();
    }
  }, 60000);
}

function stopTimers() {
  clearInterval(hungerTimer);
  clearInterval(workTimer);
  clearInterval(salaryTimer);
  clearInterval(cooldownTimer);
}

// ── MODAL ──────────────────────────────────
function showModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}

function closeModalDirect() {
  document.getElementById('modal-overlay').classList.remove('open');
  G._tempAvatar = undefined;
}

// ── SOM DE INTERFACE (reaproveita o motor de áudio do wizard de cadastro) ──
function uiSound(type) {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  if (type === 'success') [523.25, 659.25, 783.99].forEach((f, i) => regTone(f, ctx.currentTime + i * 0.07, 0.22, 0.045, 'triangle'));
  else if (type === 'error') { regTone(220, ctx.currentTime, 0.15, 0.05, 'sawtooth'); regTone(160, ctx.currentTime + 0.08, 0.18, 0.045, 'sawtooth'); }
  else if (type === 'warn') regTone(340, ctx.currentTime, 0.12, 0.045, 'triangle');
  else regTone(700, ctx.currentTime, 0.05, 0.04, 'triangle');
}

// ── NOTIFICATIONS ──────────────────────────
function notify(type, msg, duration = 3500) {
  const c = document.getElementById('notifications');
  const el = document.createElement('div');
  el.className = `notif notif-${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  el.innerHTML = `<span class="notif-icon">${icons[type]||'•'}</span><span class="notif-msg">${msg}</span>`;
  el.title = 'Clique para dispensar';
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => dismissNotif(el));
  c.appendChild(el);
  while (c.children.length > 4) { c.removeChild(c.children[0]); }
  uiSound(type);
  el._notifTimeout = setTimeout(() => dismissNotif(el), duration);
}
function dismissNotif(el) {
  if (!el || !el.parentNode || el.classList.contains('notif-out')) return;
  clearTimeout(el._notifTimeout);
  el.classList.add('notif-out');
  setTimeout(() => el.remove(), 280);
}

// ── CONFIRMAÇÃO (substitui o confirm() nativo do navegador) ──
function confirmDialog(message, opts = {}) {
  if (!window.Swal) return Promise.resolve(window.confirm(message.replace(/<[^>]+>/g, '')));
  uiSound(opts.danger ? 'warn' : 'info');
  return window.Swal.fire({
    title: opts.title || (opts.danger ? 'Tem certeza?' : 'Confirmar'),
    html: message,
    icon: opts.danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opts.confirmText || (opts.danger ? 'Sim, excluir' : 'Confirmar'),
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    customClass: { popup: 'crydan-swal', container: 'crydan-swal-backdrop' },
  }).then(r => r.isConfirmed);
}

// ── DEVICE VIEW (PC / TABLET / CELULAR) ────
// ── Detecção automática de dispositivo (responsividade real) ───────────
// Antes disso, a "visão de dispositivo" só mudava se o usuário clicasse
// manualmente no botão de alternância — ou seja, todo mundo entrava no
// layout de PC por padrão, mesmo abrindo direto pelo celular. Agora o
// tamanho real da tela decide o layout inicial sozinho.
function autoDetectDeviceView() {
  const w = window.innerWidth;
  if (w <= 860) return 'mobile';
  if (w <= 1180) return 'tablet';
  return 'pc';
}
let _deviceViewManualOverride = false;
function setDeviceView(mode, manual = false) {
  if (!DEVICE_VIEWS[mode]) mode = 'pc';
  if (manual) _deviceViewManualOverride = true;
  document.body.classList.remove('view-pc', 'view-tablet', 'view-mobile', 'sidebar-open');
  document.body.classList.add('view-' + mode);
  const icon = document.getElementById('device-icon');
  const label = document.getElementById('device-label');
  if (icon) icon.textContent = DEVICE_VIEWS[mode].icon;
  if (label) label.textContent = DEVICE_VIEWS[mode].label;
  // persist device view to user save (G) instead of localStorage
  if (G && G.name) { G.deviceView = mode; saveGame(); }
}
window.addEventListener('resize', () => {
  clearTimeout(window._deviceResizeTimer);
  window._deviceResizeTimer = setTimeout(() => {
    // só reage ao tamanho real da tela se o usuário não escolheu manualmente
    // uma visão diferente (ex: forçar visualização mobile num PC pra testar)
    if (!_deviceViewManualOverride && document.getElementById('app-body')?.style.display === 'flex') {
      setDeviceView(autoDetectDeviceView());
    }
  }, 200);
});
function toggleMobileSidebar() {
  document.body.classList.toggle('sidebar-open');
}

// ── BANNER UPLOAD (galeria / computador) ───
function handleBannerFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione um arquivo de imagem válido.'); e.target.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 5MB).'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(ev) {
    G.banner = ev.target.result;
    G.bannerPreset = '';
    saveGame();
    refreshProfile();
    notify('success', '🖼️ Banner atualizado a partir do seu dispositivo!');
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler a imagem selecionada.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ── CONVERSAS: COMUNIDADES, GRUPOS E MENSAGENS ────────────
// Estado local de navegação do chat (não é salvo, é só de UI)
let chatUI = { view: 'home', communityId: null, channelId: null, chatId: null, listTab: 'conversas' };

// ── Cache compartilhado de avatar/nome, usado no lugar das iniciais
// genéricas (D, Y, P...) na lista de conversas — antes nunca mostrava
// a foto real de ninguém, só a inicial do nome.
let _chatProfileCache = {};
async function ensureProfilesCached(userIds) {
  const missing = [...new Set(userIds)].filter(id => id && !_chatProfileCache[id]);
  if (!missing.length) return;
  try {
    const { data } = await supabase.from('profiles').select('id,name,avatar,avatar_photo').in('id', missing);
    (data || []).forEach(p => { _chatProfileCache[p.id] = p; });
  } catch (e) {
    console.error('Erro ao carregar avatares', e);
  }
}
function chatAvatarHtml(userId, fallbackName) {
  const p = userId ? _chatProfileCache[userId] : null;
  if (p && p.avatar_photo) return `<img src="${p.avatar_photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  if (p && p.avatar) return p.avatar;
  return initialsOf(fallbackName || '?');
}

let myGroupsCache = []; // grupos reais (Supabase) dos quais você é membro


// ── Comunidades — agora reais e compartilhadas entre contas ──────────
// Antes, G.communities só existia no SEU save — ninguém mais via nem
// podia entrar. Requer o arquivo communities-guilds-setup.sql.
let myCommunitiesCache = [];
let currentCommunityChannels = [];
let currentChannelMessages = [];
let currentCommunityIsOwner = false;

async function loadMyCommunities() {
  const me = myId();
  if (!me) { myCommunitiesCache = []; return; }
  try {
    const { data: memberships, error } = await supabase.from('community_members').select('community_id').eq('user_id', me);
    if (error) throw error;
    const ids = (memberships || []).map(m => m.community_id);
    if (!ids.length) { myCommunitiesCache = []; return; }
    const { data: comms, error: cerr } = await supabase.from('communities').select('*').in('id', ids);
    if (cerr) throw cerr;
    myCommunitiesCache = comms || [];
  } catch (e) {
    console.error('Erro ao carregar comunidades', e);
    myCommunitiesCache = [];
  }
}

async function renderConversas() {
  G.chats = G.chats || [];
  renderConversasSocialBar();
  await loadMyCommunities();
  if (chatUI.view === 'community' && !myCommunitiesCache.find(c => c.id === chatUI.communityId)) {
    chatUI = { view: 'home', communityId: null, channelId: null, chatId: null };
  }
  renderCommRail();
  renderChatListCol();
  renderChatMainCol();
}

function renderConversasSocialBar() {
  const el = document.getElementById('conversas-social-bar');
  if (!el) return;
  const links = getSocialLinks();
  el.innerHTML = `<div class="social-bar">
    <a class="social-pill wa" href="${links.waCommunity}" target="_blank" rel="noopener">💬 Comunidade no WhatsApp</a>
    <a class="social-pill wa" href="https://wa.me/${links.waNumber}" target="_blank" rel="noopener">📱 Fale comigo no WhatsApp</a>
    <a class="social-pill ig" href="https://instagram.com/${links.igCrydan}" target="_blank" rel="noopener">📸 @${links.igCrydan} (Crydan)</a>
    <a class="social-pill ig" href="https://instagram.com/${links.igPessoal}" target="_blank" rel="noopener">📸 @${links.igPessoal} (Pessoal)</a>
  </div>`;
}

function renderCommRail() {
  const rail = document.getElementById('comm-rail');
  if (!rail) return;
  let html = `<div class="comm-icon ${chatUI.view==='home'?'active':''}" title="Conversas privadas e grupos" onclick="openHome()">💬</div>`;
  html += myCommunitiesCache.map(c => `<div class="comm-icon ${chatUI.view==='community'&&chatUI.communityId===c.id?'active':''}" title="${escapeHtml(c.name)}" onclick="openCommunity('${c.id}')">${c.icon || '🏰'}</div>`).join('');
  html += `<div class="comm-icon" title="Descobrir comunidades" onclick="openCommunityBrowser()">🔍</div>`;
  html += `<div class="comm-icon add" title="Criar comunidade" onclick="openCreateCommunityModal()">➕</div>`;
  rail.innerHTML = html;
}

// Mostra TODAS as comunidades que existem (não só as suas) — é a tela
// de "descobrir e entrar", que antes simplesmente não existia.
async function openCommunityBrowser() {
  showModal('🔍 Descobrir Comunidades', '<div style="text-align:center;padding:20px;color:var(--text3)">Carregando...</div>');
  try {
    const { data: all, error } = await supabase.from('communities').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const myIds = new Set(myCommunitiesCache.map(c => c.id));
    const body = (all && all.length) ? `<div style="max-height:360px;overflow-y:auto">${all.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:20px">${c.icon || '🏰'}</span>
        <span style="flex:1">${escapeHtml(c.name)}</span>
        ${myIds.has(c.id) ? '<span class="badge badge-gold">Membro</span>' : `<button class="btn-sm btn-primary" onclick="joinCommunityAndOpen('${c.id}')">Entrar</button>`}
      </div>`).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🏰</div><div class="empty-title">Nenhuma comunidade ainda</div><div class="empty-sub">Seja o primeiro a criar uma!</div></div>`;
    showModal('🔍 Descobrir Comunidades', body);
  } catch (e) {
    console.error('Erro ao listar comunidades', e);
    const msg = (e.message || '').includes('relation "public.communities" does not exist')
      ? 'Comunidades ainda não foram configuradas no banco (rode communities-guilds-setup.sql no Supabase).'
      : 'Não foi possível carregar as comunidades agora.';
    showModal('Erro', `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">${msg}</div></div>`);
  }
}

async function joinCommunityAndOpen(id) {
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  try {
    const { error } = await supabase.from('community_members').insert([{ community_id: id, user_id: me }]);
    if (error && error.code !== '23505') throw error;
    closeModalDirect();
    await loadMyCommunities();
    renderCommRail();
    notify('success', '🏰 Você entrou na comunidade!');
    await openCommunity(id);
  } catch (e) {
    console.error('Erro ao entrar na comunidade', e);
    notify('error', 'Não foi possível entrar agora.');
  }
}

async function leaveCommunity(id) {
  if (!await confirmDialog('Sair desta comunidade?', { danger: true })) return;
  const me = myId();
  try {
    const { error } = await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', me);
    if (error) throw error;
    if (chatUI.communityId === id) chatUI = { view: 'home', communityId: null, channelId: null, chatId: null };
    notify('info', 'Você saiu da comunidade.');
    renderConversas();
  } catch (e) {
    console.error('Erro ao sair da comunidade', e);
    notify('error', 'Não foi possível sair agora.');
  }
}

async function renderChatListCol() {
  const col = document.getElementById('chat-list-col');
  if (!col) return;

  if (chatUI.view === 'community') {
    const comm = myCommunitiesCache.find(c => c.id === chatUI.communityId);
    if (!comm) { chatUI.view = 'home'; return renderConversas(); }
    currentCommunityIsOwner = comm.owner_id === myId();
    const myRole = await getCommunityRole(comm.id);
    const canManage = myRole === 'owner' || myRole === 'admin';
    col.innerHTML = `
      <div class="chat-list-header">
        <span>${communityIconHtml(comm)} ${escapeHtml(comm.name)}</span>
        <span style="display:flex;gap:10px">
          ${canManage ? `<span style="cursor:pointer;font-size:13px" title="Configurações da comunidade" onclick="openCommunitySettingsModal('${comm.id}')">⚙️</span>` : ''}
          <span style="cursor:pointer;color:var(--red);font-size:12px" title="${currentCommunityIsOwner?'Excluir comunidade':'Sair da comunidade'}" onclick="${currentCommunityIsOwner?`deleteCommunity('${comm.id}')`:`leaveCommunity('${comm.id}')`}">${currentCommunityIsOwner?'🗑️':'🚪'}</span>
        </span>
      </div>
      <div class="chat-list-items">
        ${currentCommunityChannels.map(ch => `
          <div class="chat-list-item ${chatUI.channelId===ch.id?'active':''}" onclick="openChannel('${comm.id}','${ch.id}')">
            <div class="chat-list-avatar">#</div>
            <div><div class="chat-list-name">${escapeHtml(ch.name)}</div></div>
          </div>`).join('') || '<div style="padding:14px;color:var(--text3);font-size:12px">Nenhum canal ainda.</div>'}
      </div>
      ${currentCommunityIsOwner ? `<div style="padding:10px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="width:100%" onclick="openCreateChannelModal('${comm.id}')">➕ Novo Canal</button>
      </div>` : ''}`;
    return;
  }

  // HOME: lista de conversas (DMs + grupos), estilo WhatsApp
  await ensureProfilesCached(G.chats.filter(c => c.friendId).map(c => c.friendId));
  let restrictedIds = [];
  try {
    const me = myId();
    const { data } = await supabase.from('restricted_users').select('restricted_id').eq('owner_id', me);
    restrictedIds = (data || []).map(r => r.restricted_id);
  } catch (e) { /* silencioso — restrição é só um filtro visual extra */ }

  const previewOf = (c) => {
    const last = (c.messages || []).slice(-1)[0];
    if (!last) return 'Nenhuma mensagem ainda';
    if (last.deletedAt) return (last.author === G.name ? 'Você apagou uma mensagem' : 'Mensagem apagada');
    if (last.audioUrl) return (last.author === G.name ? 'Você: 🎙️ Mensagem de voz' : '🎙️ Mensagem de voz');
    if (last.imageUrl) return (last.author === G.name ? 'Você enviou um GIF' : last.author + ' enviou um GIF');
    return `${last.author}: ${last.text}`;
  };
  const renderItem = (c) => {
    const last = (c.messages || []).slice(-1)[0];
    const grp = c.groupId ? myGroupsCache.find(g => g.id === c.groupId) : null;
    const avatarHtml = c.type === 'group' ? groupIconHtml(grp || { icon: '👥' }) : chatAvatarHtml(c.friendId, c.name);
    const tick = (c.friendId && last && last.author === G.name && !last.deletedAt) ? (last.readAt ? '<span class="msg-tick read">✓✓</span> ' : '<span class="msg-tick">✓</span> ') : '';
    return `<div class="chat-list-item ${chatUI.chatId===c.id?'active':''}" onclick="openChat('${c.id}')">
          <div class="chat-list-avatar">${avatarHtml}</div>
          <div style="min-width:0;flex:1">
            <div class="chat-list-name">${escapeHtml(c.name)} ${c.type==='group'?'<span style="color:var(--text3);font-size:10px">(grupo)</span>':''}</div>
            <div class="chat-list-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tick}${escapeHtml(previewOf(c))}</div>
          </div>
        </div>`;
  };
  const sortByLast = (arr) => arr.slice().sort((a,b) => {
    const la = (a.messages||[]).slice(-1)[0]?.ts || a.createdAt || 0;
    const lb = (b.messages||[]).slice(-1)[0]?.ts || b.createdAt || 0;
    return lb - la;
  });
  const mainItems = sortByLast(G.chats.filter(c => !restrictedIds.includes(c.friendId)));
  const restrictedItems = sortByLast(G.chats.filter(c => restrictedIds.includes(c.friendId)));
  col.innerHTML = `
    <div class="chat-list-header"><span>💬 Conversas</span></div>
    <div class="chat-list-items">
      ${mainItems.map(renderItem).join('') || `<div class="empty-state" style="padding:24px 14px">
        <div class="empty-icon">💬</div>
        <div class="empty-title">Nenhuma conversa ainda</div>
        <div class="empty-sub">Comece uma DM ou crie um grupo com os botões abaixo.</div>
      </div>`}
      ${restrictedItems.length ? `<div style="padding:8px 14px;font-size:10px;color:var(--text3);letter-spacing:.5px;border-top:1px solid var(--border);margin-top:6px">🙈 RESTRITAS</div>${restrictedItems.map(renderItem).join('')}` : ''}
    </div>
    <div style="padding:10px;border-top:1px solid var(--border);display:flex;gap:8px">
      <button class="btn btn-sm" style="flex:1" onclick="openCreateDMModal()">👤 Nova DM</button>
      <button class="btn btn-sm" style="flex:1" onclick="openCreateGroupModal()">👥 Novo Grupo</button>
    </div>`;
}

// Ícone de grupo/comunidade pode ser um emoji OU (agora) uma foto de
// verdade enviada pelo admin — o cliente decide como mostrar olhando
// se o valor parece uma URL/imagem em vez de forçar um formato fixo.

let _communityRoleCache = {};
async function getCommunityRole(communityId) {
  if (_communityRoleCache[communityId] !== undefined) return _communityRoleCache[communityId];
  try {
    const { data } = await supabase.rpc('community_role_of', { p_community_id: communityId });
    _communityRoleCache[communityId] = data || null;
    return data || null;
  } catch (e) { return null; }
}
let _groupRoleCache = {};
async function getGroupRole(groupId) {
  if (_groupRoleCache[groupId] !== undefined) return _groupRoleCache[groupId];
  try {
    const { data } = await supabase.rpc('group_role_of', { p_group_id: groupId });
    _groupRoleCache[groupId] = data || null;
    return data || null;
  } catch (e) { return null; }
}

function renderMessageContent(m) {
  let html = '';
  if (m.imageUrl) {
    html += `<img src="${m.imageUrl}" style="max-width:200px;max-height:200px;border-radius:8px;display:block;margin-bottom:4px" alt="GIF">`;
  }
  if (m.attachment) {
    const a = m.attachment;
    if (a.type === 'image') {
      html += `<img src="${a.data}" style="max-width:220px;max-height:220px;border-radius:8px;display:block;margin-bottom:4px;cursor:pointer" onclick="window.open('${a.data}','_blank')" alt="Imagem enviada na conversa">`;
    } else if (a.type === 'video') {
      html += `<video src="${a.data}" controls style="max-width:240px;border-radius:8px;display:block;margin-bottom:4px"></video>`;
    } else {
      html += `<a href="${a.data}" download="${escapeHtml(a.name)}" style="display:flex;align-items:center;gap:8px;background:var(--bg4);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;margin-bottom:4px;text-decoration:none;color:var(--text)">
        <span style="font-size:20px">📄</span>
        <span style="font-size:12px"><b>${escapeHtml(a.name)}</b><br><span style="color:var(--text3)">${(a.size/1024).toFixed(0)} KB — clique para baixar</span></span>
      </a>`;
    }
  }
  if (m.text) html += `<div>${escapeHtml(m.text)}</div>`;
  return html;
}

function renderMsgRow(m, ctx) {
  // ctx: { chatId, isDM, sendFnKind } — sendFnKind: 'chat' | 'group' | 'channel'
  const own = m.author === G.name;
  const deleted = !!m.deletedAt;
  let tickHtml = '';
  if (own && ctx.isDM && !deleted) {
    tickHtml = m.readAt ? `<span class="msg-tick read" title="Visto">✓✓</span>` : `<span class="msg-tick" title="Enviado">✓</span>`;
  }
  const editableWindowMs = 30 * 60 * 1000;
  const canEdit = own && !deleted && m.remoteId && !m.imageUrl && !m.audioUrl && (Date.now() - m.ts) < editableWindowMs;
  const canDelete = own && !deleted && m.remoteId;
  const canForward = !deleted && m.remoteId && (m.text || m.imageUrl || m.audioUrl);
  const bodyHtml = deleted
    ? `<div class="msg-bubble deleted">${own ? 'Você apagou esta mensagem' : 'Mensagem apagada'}</div>`
    : `<div class="msg-bubble">${m.audioUrl ? `<div class="msg-audio-bubble">🎙️<audio src="${m.audioUrl}" controls></audio></div>` : renderMessageContent(m)}</div>`;
  const menuId = 'msgmenu_' + (m.remoteId || m.ts);
  const menuItems = [
    canForward ? `<button onclick="forwardMessagePrompt('${m.remoteId}')">↪️ Encaminhar</button>` : '',
    canEdit ? `<button onclick="editMessagePrompt('${ctx.chatId}','${m.remoteId}')">✏️ Editar</button>` : '',
    canDelete ? `<button class="danger" onclick="deleteMessage('${ctx.chatId}','${m.remoteId}','${ctx.sendFnKind}')">🗑️ Apagar</button>` : '',
  ].filter(Boolean).join('');
  return `
        <div class="msg-row ${own?'own':''}" id="row_${menuId}">
          ${!own ? `<div class="msg-author">${escapeHtml(m.author)}</div>` : ''}
          ${bodyHtml}
          <div class="msg-meta">${fmtTime(m.ts)}${m.editedAt && !deleted ? '<span class="msg-edited-tag">editada</span>' : ''}${tickHtml}</div>
          ${menuItems ? `<span class="msg-actions-trigger" onclick="toggleMsgActions('${menuId}')">⋯</span>
          <div class="msg-actions-menu" id="${menuId}" style="display:none">${menuItems}</div>` : ''}
        </div>`;
}
function toggleMsgActions(menuId) {
  document.querySelectorAll('.msg-actions-menu').forEach(el => { if (el.id !== menuId) el.style.display = 'none'; });
  const el = document.getElementById(menuId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.msg-actions-trigger') && !e.target.closest('.msg-actions-menu')) {
    document.querySelectorAll('.msg-actions-menu').forEach(el => el.style.display = 'none');
  }
});

function renderChatMainCol() {
  const col = document.getElementById('chat-main-col');
  if (!col) return;

  let title = '', messages = [], sendFn = '', dmFriendId = null, dmChatId = null;
  if (chatUI.view === 'community' && chatUI.channelId) {
    const comm = myCommunitiesCache.find(c => c.id === chatUI.communityId);
    const ch = currentCommunityChannels.find(c => c.id === chatUI.channelId);
    if (comm && ch) {
      title = `${communityIconHtml(comm)} ${escapeHtml(comm.name)} <span style="color:var(--text3)">/ # ${escapeHtml(ch.name)}</span>`;
      messages = currentChannelMessages.map(m => ({
        author: (currentChannelAuthors[m.author_id] || {}).name || 'Aventureiro',
        text: m.text, imageUrl: m.image_url || null, ts: new Date(m.created_at).getTime(),
      }));
      sendFn = 'sendChannelMessage()';
    }
  } else if (chatUI.view === 'chat' && chatUI.chatId) {
    const c = G.chats.find(x => x.id === chatUI.chatId);
    if (c) {
      dmChatId = c.id;
      const nameHtml = escapeHtml(c.name);
      if (c.type === 'group') {
        const grp = myGroupsCache.find(g => g.id === c.groupId);
        title = `<span style="display:flex;align-items:center;gap:8px;flex:1">
          <span style="width:26px;height:26px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--purple),var(--cyan));font-size:13px">${groupIconHtml(grp || {icon:'👥'})}</span>
          ${nameHtml}
          <span style="cursor:pointer;margin-left:auto;font-size:14px" title="Configurações do grupo" onclick="openGroupSettingsModal('${c.groupId}')">⚙️</span>
        </span>`;
      } else {
        dmFriendId = c.friendId;
        title = `<span style="display:flex;align-items:center;gap:8px;flex:1">
          <span style="cursor:pointer" onclick="openPublicProfileById('${c.friendId}')">${initialsOf(c.name)} ${nameHtml}</span>
          <span style="cursor:pointer;margin-left:auto;font-size:16px;padding:2px 6px" title="Opções da conversa" onclick="openDMOptionsMenu('${c.id}','${c.friendId}')">⋮</span>
        </span>`;
      }
      messages = c.messages || []; sendFn = 'sendChatMessage()';
    }
  }

  if (!sendFn) {
    col.innerHTML = `<div class="chat-empty"><div style="font-size:32px">💬</div><div>Selecione uma comunidade, grupo ou conversa<br>à esquerda para começar a conversar.</div></div>`;
    return;
  }
  const sendKind = sendFn.startsWith('sendChannelMessage') ? 'channel' : 'chat';
  const ctx = { chatId: dmChatId, isDM: !!dmFriendId, sendFnKind: sendKind };

  col.innerHTML = `
    <div class="chat-main-header">
      <span style="flex:1">${title}</span>
      <span class="call-btn" onclick="startCall('voice')" title="Chamada de voz">🎤</span>
      <span class="call-btn" onclick="startCall('video')" title="Chamada de vídeo">📹</span>
    </div>
    <div class="chat-messages" id="chat-messages-box">
      ${messages.map(m => renderMsgRow(m, ctx)).join('') || '<div class="chat-empty">Nenhuma mensagem ainda. Diga olá! 👋</div>'}
    </div>
    <div id="chat-attach-preview"></div>
    <div id="chat-voice-preview"></div>
    <div class="chat-input-bar">
      <input type="file" id="chat-file-input" style="display:none" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" onchange="handleChatFileSelect(event)">
      <button class="btn-sm" onclick="document.getElementById('chat-file-input').click()" title="Anexar foto, vídeo ou documento">📎</button>
      <button class="btn-sm" onclick="openGifPicker('${sendKind==='channel'?'channel':'chat'}')" title="Enviar GIF">GIF</button>
      <button class="btn-sm" id="chat-voice-btn" onclick="toggleVoiceRecording('${sendKind}')" title="Gravar áudio">🎙️</button>
      <input class="form-input" id="chat-msg-input" placeholder="Escreva uma mensagem..." onkeydown="if(event.key==='Enter'){${sendFn}}">
      <button class="btn btn-primary" onclick="${sendFn}">Enviar</button>
    </div>`;
  renderAttachPreview();
  const box = document.getElementById('chat-messages-box');
  if (box) box.scrollTop = box.scrollHeight;
}

function openDMOptionsMenu(chatId, friendId) {
  const c = G.chats.find(x => x.id === chatId);
  showModal('Opções da conversa', `
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" onclick="closeModalDirect();openPublicProfileById('${friendId}')">👤 Ver perfil</button>
      <button class="btn" onclick="closeModalDirect();restrictUserPrompt('${friendId}', ${JSON.stringify(c?.name||'').replace(/"/g,'&quot;')})">🙈 Restringir</button>
      <button class="btn" onclick="closeModalDirect();blockUserPrompt('${friendId}', ${JSON.stringify(c?.name||'').replace(/"/g,'&quot;')})">🚫 Bloquear</button>
      <button class="btn" onclick="closeModalDirect();reportUserPrompt('${friendId}', ${JSON.stringify(c?.name||'').replace(/"/g,'&quot;')})">🚩 Denunciar</button>
      <button class="btn" style="color:var(--red)" onclick="deleteConversationPrompt('${chatId}')">🗑️ Apagar conversa</button>
    </div>
  `);
}

function openHome() { chatUI = { view: 'home', communityId: null, channelId: null, chatId: null }; renderConversas(); }

let currentChannelAuthors = {};
async function loadChannelMessages(chId) {
  if (!chId) { currentChannelMessages = []; return; }
  try {
    const { data, error } = await supabase.from('channel_messages').select('id,author_id,text,image_url,created_at').eq('channel_id', chId).order('created_at').limit(200);
    if (error) throw error;
    currentChannelMessages = data || [];
    const authorIds = [...new Set(currentChannelMessages.map(m => m.author_id))];
    if (authorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id,name,avatar_photo').in('id', authorIds);
      currentChannelAuthors = {};
      (profs || []).forEach(p => currentChannelAuthors[p.id] = p);
    }
  } catch (e) {
    console.error('Erro ao carregar mensagens do canal', e);
    currentChannelMessages = [];
  }
}
// chamado pelo polling da tela de conversas — só busca de novo se
// realmente tiver um canal de comunidade aberto no momento
function pollCurrentChannel() {
  if (chatUI.view === 'community' && chatUI.channelId) {
    loadChannelMessages(chatUI.channelId).then(renderChatMainCol);
  }
}

async function openCommunity(id) {
  chatUI.view = 'community'; chatUI.communityId = id; chatUI.chatId = null;
  currentCommunityChannels = [];
  try {
    const { data: channels, error } = await supabase.from('community_channels').select('*').eq('community_id', id).order('created_at');
    if (error) throw error;
    currentCommunityChannels = channels || [];
  } catch (e) { console.error('Erro ao carregar canais', e); }
  chatUI.channelId = currentCommunityChannels[0] ? currentCommunityChannels[0].id : null;
  renderCommRail();
  renderChatListCol();
  await loadChannelMessages(chatUI.channelId);
  renderChatMainCol();
}
async function openChannel(commId, chId) {
  chatUI.view = 'community'; chatUI.communityId = commId; chatUI.channelId = chId;
  renderChatListCol();
  await loadChannelMessages(chId);
  renderChatMainCol();
}
function openChat(chatId) {
  chatUI.view = 'chat'; chatUI.chatId = chatId; chatUI.communityId = null; chatUI.channelId = null;
  renderConversas();
  const c = G.chats.find(x => x.id === chatId);
  if (c && c.friendId) loadFriendMessages(c);
}

// ── ANEXOS (fotos, vídeos, documentos) ─────
let pendingChatAttachment = null;
function handleChatFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    notify('error', 'Arquivo muito grande (máx. 2MB — este chat salva tudo localmente no seu navegador).');
    e.target.value = '';
    return;
  }
  const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const reader = new FileReader();
  reader.onload = function(ev) {
    pendingChatAttachment = { type, name: file.name, mime: file.type, size: file.size, data: ev.target.result };
    renderAttachPreview();
  };
  reader.onerror = function() { notify('error', 'Não foi possível ler o arquivo selecionado.'); };
  reader.readAsDataURL(file);
  e.target.value = '';
}
function renderAttachPreview() {
  const el = document.getElementById('chat-attach-preview');
  if (!el) return;
  if (!pendingChatAttachment) { el.innerHTML = ''; return; }
  const a = pendingChatAttachment;
  const icon = a.type === 'image' ? '🖼️' : a.type === 'video' ? '🎬' : '📄';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:6px 10px;margin:0 10px 8px;font-size:12px">
    <span>${icon}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.name)}</span>
    <span onclick="clearPendingAttachment()" style="cursor:pointer;color:var(--red)" title="Remover anexo">✕</span>
  </div>`;
}
function clearPendingAttachment() { pendingChatAttachment = null; renderAttachPreview(); }

// ── GIFs (estilo WhatsApp/Discord/Instagram) — busca via GIPHY por
// trás de uma Edge Function (a chave nunca fica exposta no navegador).
let _gifPickerContext = 'chat'; // 'chat' ou 'channel'
let _gifSearchDebounce = null;
function openGifPicker(context) {
  _gifPickerContext = context;
  showModal('🎬 Enviar GIF', `
    <input class="form-input" id="gif-search-input" placeholder="Buscar GIFs..." oninput="debounceGifSearch()" autofocus>
    <div id="gif-results-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px;max-height:360px;overflow-y:auto">
      <div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:20px">Carregando GIFs em alta...</div>
    </div>
  `);
  searchGifs('');
}
function debounceGifSearch() {
  clearTimeout(_gifSearchDebounce);
  const q = document.getElementById('gif-search-input')?.value || '';
  _gifSearchDebounce = setTimeout(() => searchGifs(q), 400);
}
async function searchGifs(q) {
  const grid = document.getElementById('gif-results-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:20px">Buscando...</div>`;
  try {
    const { data, error } = await supabase.functions.invoke('gif-search', { body: { q } });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    const items = data && data.items ? data.items : [];
    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:20px">Nenhum GIF encontrado.</div>`;
      return;
    }
    grid.innerHTML = items.map(g => `
      <img src="${g.preview}" data-url="${g.url}" alt="${escapeHtml(g.title)}"
        style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer"
        onclick="sendGifMessage(this.dataset.url)" loading="lazy">
    `).join('');
  } catch (e) {
    console.error('Erro ao buscar GIFs', e);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:20px">Não foi possível buscar GIFs agora.</div>`;
  }
}
async function sendGifMessage(url) {
  closeModalDirect();
  if (_gifPickerContext === 'channel') return sendChannelMessage(url);
  return sendChatMessage(url);
}

async function sendChannelMessage(gifUrl) {
  const input = document.getElementById('chat-msg-input');
  const text = gifUrl ? '' : (input?.value.trim() || '');
  if (!text && !gifUrl) return;
  if (!gifUrl && pendingChatAttachment) { notify('info', 'Anexos ainda não são suportados em canais de comunidade — envie o texto separadamente.'); pendingChatAttachment = null; renderAttachPreview(); }
  if (!chatUI.channelId) return;
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  if (input) input.value = '';
  try {
    const { error } = await supabase.from('channel_messages').insert([{ channel_id: chatUI.channelId, author_id: me, text, image_url: gifUrl || null }]);
    if (error) throw error;
    await loadChannelMessages(chatUI.channelId);
    renderChatMainCol();
  } catch (e) {
    console.error('Erro ao enviar mensagem no canal', e);
    notify('error', 'Não foi possível enviar: ' + (e.message || 'erro desconhecido'));
  }
}
// Conversas privadas ligadas a um amigo real (chat.friendId) usam a
// ── Editar mensagem (só a própria, só até 30min depois de enviada) ──
async function editMessagePrompt(chatId, remoteId) {
  const c = G.chats.find(x => x.id === chatId);
  const m = c && (c.messages || []).find(x => x.remoteId === remoteId);
  if (!m) return;
  if (Date.now() - m.ts > 30 * 60 * 1000) return notify('error', 'Essa mensagem passou do prazo de 30 minutos para edição.');
  showModal('Editar mensagem', `
    <textarea class="form-input" id="edit-msg-text" rows="3" maxlength="2000">${escapeHtml(m.text || '')}</textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="confirmEditMessage('${chatId}','${remoteId}')">Salvar edição</button>
  `);
}
async function confirmEditMessage(chatId, remoteId) {
  const newText = document.getElementById('edit-msg-text')?.value.trim();
  if (!newText) return notify('error', 'A mensagem não pode ficar vazia.');
  const c = G.chats.find(x => x.id === chatId);
  const m = c && (c.messages || []).find(x => x.remoteId === remoteId);
  if (m && Date.now() - m.ts > 30 * 60 * 1000) { closeModalDirect(); return notify('error', 'Prazo de 30 minutos para editar já passou.'); }
  try {
    const { error } = await supabase.from('messages').update({ text: newText, edited_at: new Date().toISOString() }).eq('id', remoteId);
    if (error) throw error;
    closeModalDirect();
    await loadFriendMessages(c);
    notify('success', 'Mensagem editada.');
  } catch (e) { notify('error', 'Não foi possível editar: ' + (e.message || 'erro')); }
}

// ── Apagar mensagem (soft delete — some o conteúdo, mas mantém o traço "mensagem apagada", igual WhatsApp) ──
async function deleteMessage(chatId, remoteId, kind) {
  const ok = await confirmDialog('Apagar esta mensagem para todos? Essa ação não pode ser desfeita.', { danger: true, confirmText: 'Apagar' });
  if (!ok) return;
  const table = kind === 'group' ? 'group_messages' : 'messages';
  try {
    const { error } = await supabase.from(table).update({ text: '', image_url: null, audio_url: null, deleted_at: new Date().toISOString() }).eq('id', remoteId);
    if (error) throw error;
    const c = G.chats.find(x => x.id === chatId);
    if (c) { if (kind === 'group') await loadGroupMessages(c); else await loadFriendMessages(c); }
    notify('success', 'Mensagem apagada.');
  } catch (e) { notify('error', 'Não foi possível apagar: ' + (e.message || 'erro')); }
}

// ── Encaminhar mensagem pra outra conversa ──
function forwardMessagePrompt(remoteId) {
  let msg = null;
  for (const c of (G.chats || [])) { const f = (c.messages || []).find(x => x.remoteId === remoteId); if (f) { msg = f; break; } }
  if (!msg) return;
  const dmChats = (G.chats || []).filter(c => c.friendId);
  if (!dmChats.length) return notify('error', 'Você ainda não tem nenhuma DM pra encaminhar.');
  showModal('Encaminhar mensagem', `
    <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
      ${dmChats.map(c => `<button class="btn" style="text-align:left" onclick="doForwardMessage(${JSON.stringify(msg.text||'').replace(/"/g,'&quot;')}, ${JSON.stringify(msg.imageUrl||null)}, ${JSON.stringify(msg.audioUrl||null)}, '${c.friendId}')">${initialsOf(c.name)} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
  `);
}
async function doForwardMessage(text, imageUrl, audioUrl, toFriendId) {
  try {
    const me = myId();
    const { error } = await supabase.from('messages').insert([{ from_id: me, to_id: toFriendId, text: text || '', image_url: imageUrl || null, audio_url: audioUrl || null }]);
    if (error) throw error;
    closeModalDirect();
    notify('success', 'Mensagem encaminhada.');
    const c = G.chats.find(x => x.friendId === toFriendId);
    if (c) await loadFriendMessages(c);
  } catch (e) { notify('error', 'Não foi possível encaminhar: ' + (e.message || 'erro')); }
}

// ── Bloquear, Restringir, Denunciar ──
async function blockUserPrompt(friendId, name) {
  const ok = await confirmDialog(`Bloquear <b>${escapeHtml(name)}</b>? Vocês não vão mais poder se enviar mensagens, PIX ou desafios de PvP.`, { danger: true, confirmText: 'Bloquear' });
  if (!ok) return;
  try {
    const me = myId();
    const { error } = await supabase.from('blocked_users').insert([{ blocker_id: me, blocked_id: friendId }]);
    if (error) throw error;
    notify('success', `${name} foi bloqueado(a).`);
  } catch (e) { notify('error', 'Não foi possível bloquear: ' + (e.message || 'erro')); }
}
async function restrictUserPrompt(friendId, name) {
  const ok = await confirmDialog(`Restringir <b>${escapeHtml(name)}</b>? As mensagens dela(e) vão pra uma aba separada até você aprovar, e ela(e) não vê mais confirmação de leitura.`, { confirmText: 'Restringir' });
  if (!ok) return;
  try {
    const me = myId();
    const { error } = await supabase.from('restricted_users').insert([{ owner_id: me, restricted_id: friendId }]);
    if (error) throw error;
    notify('success', `${name} foi restringido(a).`);
  } catch (e) { notify('error', 'Não foi possível restringir: ' + (e.message || 'erro')); }
}
async function reportUserPrompt(friendId, name) {
  showModal('Denunciar ' + escapeHtml(name), `
    <select class="form-input" id="report-reason-select" style="margin-bottom:8px">
      <option value="Assédio ou bullying">Assédio ou bullying</option>
      <option value="Conteúdo impróprio">Conteúdo impróprio</option>
      <option value="Spam ou golpe">Spam ou golpe</option>
      <option value="Discurso de ódio">Discurso de ódio</option>
      <option value="Outro">Outro</option>
    </select>
    <textarea class="form-input" id="report-context-input" rows="3" placeholder="Descreva o que aconteceu (opcional)"></textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="confirmReportUser('${friendId}')">Enviar denúncia</button>
  `);
}
async function confirmReportUser(friendId) {
  const reason = document.getElementById('report-reason-select')?.value || 'Outro';
  const context = document.getElementById('report-context-input')?.value.trim() || null;
  try {
    const me = myId();
    const { error } = await supabase.from('user_reports').insert([{ reporter_id: me, reported_id: friendId, reason, context }]);
    if (error) throw error;
    closeModalDirect();
    notify('success', 'Denúncia enviada. A administração vai analisar.');
  } catch (e) { notify('error', 'Não foi possível denunciar: ' + (e.message || 'erro')); }
}
async function deleteConversationPrompt(chatId) {
  const c = G.chats.find(x => x.id === chatId);
  if (!c) return;
  const ok = await confirmDialog('Apagar esta conversa? As mensagens somem da sua lista (a outra pessoa continua com o histórico dela).', { danger: true, confirmText: 'Apagar conversa' });
  if (!ok) return;
  G.chats = G.chats.filter(x => x.id !== chatId);
  saveGame();
  openHome();
  renderChatListCol();
  notify('success', 'Conversa apagada.');
}

// ── Mensagem de voz (grava com MediaRecorder, sobe pro bucket chat-audio) ──
let _voiceRecorder = null, _voiceChunks = [], _voiceStream = null, _voiceRecordingKind = null;
async function toggleVoiceRecording(kind) {
  const btn = document.getElementById('chat-voice-btn');
  if (_voiceRecorder && _voiceRecorder.state === 'recording') {
    _voiceRecorder.stop();
    return;
  }
  try {
    _voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return notify('error', 'Não foi possível acessar o microfone. Verifique a permissão do navegador.');
  }
  _voiceChunks = [];
  _voiceRecordingKind = kind;
  _voiceRecorder = new MediaRecorder(_voiceStream);
  _voiceRecorder.ondataavailable = (e) => { if (e.data.size > 0) _voiceChunks.push(e.data); };
  _voiceRecorder.onstop = async () => {
    _voiceStream.getTracks().forEach(t => t.stop());
    if (btn) { btn.textContent = '🎙️'; btn.style.color = ''; }
    const blob = new Blob(_voiceChunks, { type: 'audio/webm' });
    if (blob.size < 500) return; // gravação vazia/cancelada rápido demais
    await uploadAndSendVoice(blob, _voiceRecordingKind);
  };
  _voiceRecorder.start();
  if (btn) { btn.textContent = '⏹️'; btn.style.color = 'var(--red)'; }
  notify('info', 'Gravando... clique de novo pra enviar.', 2000);
}
async function uploadAndSendVoice(blob, kind) {
  try {
    const me = myId();
    const path = `${me}/${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from('chat-audio').upload(path, blob, { contentType: 'audio/webm' });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('chat-audio').getPublicUrl(path);
    const audioUrl = pub?.publicUrl;
    if (!audioUrl) throw new Error('Falha ao gerar link do áudio');
    if (kind === 'group') {
      const c = G.chats.find(x => x.id === chatUI.chatId);
      if (!c) return;
      const { error } = await supabase.from('group_messages').insert([{ group_id: c.groupId, author_id: me, text: '.', audio_url: audioUrl }]);
      if (error) throw error;
      await loadGroupMessages(c);
    } else {
      const c = G.chats.find(x => x.id === chatUI.chatId);
      if (!c || !c.friendId) return;
      const { error } = await supabase.from('messages').insert([{ from_id: me, to_id: c.friendId, text: '', audio_url: audioUrl }]);
      if (error) throw error;
      await loadFriendMessages(c);
    }
    notify('success', 'Áudio enviado!');
  } catch (e) { notify('error', 'Não foi possível enviar o áudio: ' + (e.message || 'erro')); }
}


async function uploadPendingChatImage() {
  if (!pendingChatAttachment || pendingChatAttachment.type !== 'image') return null;
  try {
    const me = myId();
    const blob = await (await fetch(pendingChatAttachment.data)).blob();
    const ext = (pendingChatAttachment.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${me}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, blob, { contentType: pendingChatAttachment.mime || 'image/jpeg' });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
    return pub.publicUrl;
  } catch (e) {
    console.error('Erro ao enviar imagem do chat', e);
    notify('error', 'Não foi possível enviar a imagem: ' + (e.message || 'erro desconhecido'));
    return undefined; // undefined = falhou (diferente de null = sem imagem)
  }
}

async function sendChatMessage(gifUrl, audioUrl) {
  const input = document.getElementById('chat-msg-input');
  const text = gifUrl || audioUrl ? '' : (input?.value.trim() || '');
  if (!text && !pendingChatAttachment && !gifUrl && !audioUrl) return;
  const c = G.chats.find(x => x.id === chatUI.chatId);
  if (!c) return;

  if (c.friendId) {
    let imgUrl = gifUrl || null;
    if (!gifUrl && !audioUrl && pendingChatAttachment) {
      if (pendingChatAttachment.type === 'image') {
        imgUrl = await uploadPendingChatImage();
        if (imgUrl === undefined) return; // falha no upload, já avisado
      } else {
        notify('info', 'Por enquanto só fotos são enviadas de verdade — vídeos e documentos ainda não.');
      }
      pendingChatAttachment = null;
      renderAttachPreview();
    }
    if (!text && !imgUrl && !audioUrl) return;
    if (input) input.value = '';
    try {
      const me = myId();
      const { error } = await supabase.from('messages').insert([{ from_id: me, to_id: c.friendId, text, image_url: imgUrl || null, audio_url: audioUrl || null }]);
      if (error) throw error;
      await loadFriendMessages(c);
    } catch (e) {
      console.error('Erro ao enviar mensagem', e);
      const blocked = /blocked|bloque/i.test(e.message || '');
      notify('error', blocked ? 'Não foi possível enviar: vocês não podem trocar mensagens.' : 'Não foi possível enviar: ' + (e.message || 'sem conexão'));
    }
    return;
  }

  if (c.groupId) {
    let imgUrl = gifUrl || null;
    if (!gifUrl && !audioUrl && pendingChatAttachment) {
      if (pendingChatAttachment.type === 'image') {
        imgUrl = await uploadPendingChatImage();
        if (imgUrl === undefined) return;
      } else {
        notify('info', 'Por enquanto só fotos são enviadas de verdade — vídeos e documentos ainda não.');
      }
      pendingChatAttachment = null;
      renderAttachPreview();
    }
    if (!text && !imgUrl && !audioUrl) return;
    if (input) input.value = '';
    try {
      const me = myId();
      const { error } = await supabase.from('group_messages').insert([{ group_id: c.groupId, author_id: me, text: text || '.', image_url: imgUrl || null, audio_url: audioUrl || null }]);
      if (error) throw error;
      await loadGroupMessages(c);
    } catch (e) {
      console.error('Erro ao enviar mensagem no grupo', e);
      notify('error', 'Não foi possível enviar: ' + (e.message || 'sem conexão'));
    }
    return;
  }

  c.messages = c.messages || [];
  c.messages.push({ author: G.name, text, ts: Date.now(), attachment: pendingChatAttachment, imageUrl: gifUrl || null });
  pendingChatAttachment = null;
  if (input) input.value = '';
  saveGame();
  renderConversas();
}

// ══════════════════════════════════════════
//   CHAMADAS DE VOZ / VÍDEO REAIS (WebRTC)
//   Sinalização via Supabase Realtime (broadcast), sem servidor extra.
//   Usa câmera/microfone reais do navegador (getUserMedia) e conexão
//   peer-to-peer direta (RTCPeerConnection) — o mesmo tipo de tecnologia
//   usada pelo Google Meet, Discord, WhatsApp Web etc.
// ══════════════════════════════════════════

let callState = {
  active: false, mode: null, targetName: '', targetId: null,
  pc: null, localStream: null, remoteStream: null,
  timer: null, seconds: 0, muted: false, camOff: false,
  role: null, // 'caller' | 'callee'
};
let mySignalChannel = null;
let _pendingIncomingCall = null;

// Chamado uma vez, no boot do app — cada jogador escuta seu próprio
// "telefone" pra poder receber chamadas de qualquer amigo a qualquer momento.
function initCallSignaling() {
  if (!currentUserId || mySignalChannel) return;
  mySignalChannel = supabase.channel('call-signal-' + currentUserId);
  mySignalChannel
    .on('broadcast', { event: 'call-offer' }, ({ payload }) => handleIncomingOffer(payload))
    .on('broadcast', { event: 'call-answer' }, ({ payload }) => handleIncomingAnswer(payload))
    .on('broadcast', { event: 'call-ice' }, ({ payload }) => handleIncomingIce(payload))
    .on('broadcast', { event: 'call-end' }, () => { if (callState.active) { notify('info', '📞 A outra pessoa encerrou a chamada.'); teardownCall(); } })
    .on('broadcast', { event: 'call-decline' }, () => { notify('info', '📵 Chamada recusada.'); teardownCall(); })
    .subscribe();
}
function teardownCallSignaling() {
  if (mySignalChannel) { try { supabase.removeChannel(mySignalChannel); } catch (e) {} mySignalChannel = null; }
}
function sendSignal(targetId, event, payload) {
  supabase.channel('call-signal-' + targetId).send({ type: 'broadcast', event, payload: { ...payload, fromId: currentUserId, fromName: G.name || 'Aventureiro' } });
}

function currentChatTargetName() {
  if (chatUI.view === 'community' && chatUI.channelId) {
    const comm = myCommunitiesCache.find(c => c.id === chatUI.communityId);
    return comm ? `${comm.icon || '🏰'} ${comm.name}` : '';
  } else if (chatUI.view === 'chat' && chatUI.chatId) {
    const c = G.chats.find(x => x.id === chatUI.chatId);
    return c ? c.name : '';
  }
  return '';
}
function currentChatTargetFriendId() {
  if (chatUI.view === 'chat' && chatUI.chatId) {
    const c = G.chats.find(x => x.id === chatUI.chatId);
    return c ? c.friendId || null : null;
  }
  return null;
}

async function startCall(mode) {
  const targetName = currentChatTargetName();
  const targetId = currentChatTargetFriendId();
  if (!targetName) return;
  if (!targetId) return notify('error', 'Chamadas reais só funcionam em conversas com amigos de verdade (ainda não em grupos/comunidades).');

  callState = { active: true, mode, targetName, targetId, pc: null, localStream: null, remoteStream: null, timer: null, seconds: 0, muted: false, camOff: false, role: 'caller' };
  renderCallOverlay('calling');

  try {
    callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
  } catch (e) {
    notify('error', 'Não foi possível acessar ' + (mode === 'video' ? 'câmera/microfone' : 'microfone') + '. Verifique as permissões do navegador.');
    teardownCall();
    return;
  }
  const localVid = document.getElementById('call-video-local');
  if (localVid && mode === 'video') localVid.srcObject = callState.localStream;

  const pc = new RTCPeerConnection(RTC_CONFIG);
  callState.pc = pc;
  callState.localStream.getTracks().forEach(t => pc.addTrack(t, callState.localStream));
  pc.onicecandidate = (ev) => { if (ev.candidate) sendSignal(targetId, 'call-ice', { candidate: ev.candidate }); };
  pc.ontrack = (ev) => attachRemoteStream(ev.streams[0]);
  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState) && callState.active) teardownCall();
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(targetId, 'call-offer', { offer, mode });
}

function handleIncomingOffer(payload) {
  if (callState.active) {
    // Já em outra chamada — recusa automaticamente a nova.
    sendSignal(payload.fromId, 'call-decline', {});
    return;
  }
  _pendingIncomingCall = payload;
  callState = { active: true, mode: payload.mode, targetName: payload.fromName, targetId: payload.fromId, pc: null, localStream: null, remoteStream: null, timer: null, seconds: 0, muted: false, camOff: false, role: 'callee' };
  renderCallOverlay('incoming');
}
async function acceptIncomingCall() {
  const payload = _pendingIncomingCall;
  if (!payload) return;
  renderCallOverlay('calling');
  try {
    callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.mode === 'video' });
  } catch (e) {
    notify('error', 'Não foi possível acessar ' + (callState.mode === 'video' ? 'câmera/microfone' : 'microfone') + '. Verifique as permissões do navegador.');
    sendSignal(payload.fromId, 'call-decline', {});
    teardownCall();
    return;
  }
  const localVid = document.getElementById('call-video-local');
  if (localVid && callState.mode === 'video') localVid.srcObject = callState.localStream;

  const pc = new RTCPeerConnection(RTC_CONFIG);
  callState.pc = pc;
  callState.localStream.getTracks().forEach(t => pc.addTrack(t, callState.localStream));
  pc.onicecandidate = (ev) => { if (ev.candidate) sendSignal(payload.fromId, 'call-ice', { candidate: ev.candidate }); };
  pc.ontrack = (ev) => attachRemoteStream(ev.streams[0]);
  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState) && callState.active) teardownCall();
  };

  await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendSignal(payload.fromId, 'call-answer', { answer });
  renderCallOverlay('connected');
}
function declineIncomingCall() {
  if (_pendingIncomingCall) sendSignal(_pendingIncomingCall.fromId, 'call-decline', {});
  teardownCall();
}
async function handleIncomingAnswer(payload) {
  if (!callState.pc) return;
  await callState.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
  renderCallOverlay('connected');
}
async function handleIncomingIce(payload) {
  if (!callState.pc || !payload.candidate) return;
  try { await callState.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) {}
}
function attachRemoteStream(stream) {
  callState.remoteStream = stream;
  const remoteVid = document.getElementById('call-video-remote');
  const remoteAudio = document.getElementById('call-audio-remote');
  if (remoteVid) remoteVid.srcObject = stream;
  if (remoteAudio) remoteAudio.srcObject = stream;
}

function renderCallOverlay(state) {
  let overlay = document.getElementById('call-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'call-overlay';
    overlay.className = 'call-overlay';
    document.body.appendChild(overlay);
  }
  const icon = callState.mode === 'video' ? '📹' : '🎤';
  if (callState.timer) { clearInterval(callState.timer); callState.timer = null; }

  if (state === 'incoming') {
    overlay.innerHTML = `
      <div class="call-box">
        <div class="call-avatar pulse">${icon}</div>
        <div class="call-target">${escapeHtml(callState.targetName)}</div>
        <div class="call-status">Chamada${callState.mode === 'video' ? ' de vídeo' : ''} recebida...</div>
        <div class="call-incoming-actions">
          <button class="call-icon-btn call-accept" onclick="acceptIncomingCall()" title="Aceitar">✅</button>
          <button class="call-icon-btn call-end" onclick="declineIncomingCall()" title="Recusar">📵</button>
        </div>
      </div>`;
  } else if (state === 'calling') {
    overlay.innerHTML = `
      <div class="call-box">
        <div class="call-avatar pulse">${icon}</div>
        <div class="call-target">${escapeHtml(callState.targetName)}</div>
        <div class="call-status">${callState.role === 'caller' ? 'Chamando' : 'Conectando'}${callState.mode === 'video' ? ' (vídeo)' : ''}...</div>
        <div class="call-status-sub">🎥 Pedindo acesso à câmera/microfone...</div>
        ${callState.mode === 'video' ? `<video id="call-video-local" class="call-video-local" autoplay muted playsinline></video>` : ''}
        <button class="btn btn-danger" style="margin-top:20px" onclick="endCall()">📵 Cancelar</button>
      </div>`;
    const lv = document.getElementById('call-video-local');
    if (lv && callState.localStream) lv.srcObject = callState.localStream;
  } else {
    overlay.innerHTML = `
      <div class="call-box">
        ${callState.mode === 'video'
          ? `<video id="call-video-remote" class="call-video-remote" autoplay playsinline></video>
             <video id="call-video-local" class="call-video-local" autoplay muted playsinline></video>`
          : `<div class="call-avatar">${icon}</div><audio id="call-audio-remote" autoplay></audio>`}
        <div class="call-target" style="margin-top:14px">${escapeHtml(callState.targetName)}</div>
        <div class="call-status" id="call-timer">00:00</div>
        <div style="display:flex;gap:14px;margin-top:20px;justify-content:center">
          <button class="call-icon-btn" id="call-mute-btn" onclick="toggleCallMute()" title="Mudo">🎙️</button>
          ${callState.mode === 'video' ? `<button class="call-icon-btn" id="call-cam-btn" onclick="toggleCallCam()" title="Câmera">📷</button>` : ''}
          <button class="call-icon-btn call-end" onclick="endCall()" title="Encerrar">📵</button>
        </div>
      </div>`;
    const rv = document.getElementById('call-video-remote');
    const ra = document.getElementById('call-audio-remote');
    const lv = document.getElementById('call-video-local');
    if (rv && callState.remoteStream) rv.srcObject = callState.remoteStream;
    if (ra && callState.remoteStream) ra.srcObject = callState.remoteStream;
    if (lv && callState.localStream) lv.srcObject = callState.localStream;
    callState.timer = setInterval(() => {
      callState.seconds++;
      const m = String(Math.floor(callState.seconds / 60)).padStart(2, '0');
      const s = String(callState.seconds % 60).padStart(2, '0');
      const t = document.getElementById('call-timer');
      if (t) t.textContent = `${m}:${s}`;
    }, 1000);
  }
}

function toggleCallMute() {
  callState.muted = !callState.muted;
  if (callState.localStream) callState.localStream.getAudioTracks().forEach(t => t.enabled = !callState.muted);
  const btn = document.getElementById('call-mute-btn');
  if (btn) { btn.textContent = callState.muted ? '🔇' : '🎙️'; btn.classList.toggle('active-off', callState.muted); }
}
function toggleCallCam() {
  callState.camOff = !callState.camOff;
  if (callState.localStream) callState.localStream.getVideoTracks().forEach(t => t.enabled = !callState.camOff);
  const btn = document.getElementById('call-cam-btn');
  if (btn) { btn.textContent = callState.camOff ? '🚫' : '📷'; btn.classList.toggle('active-off', callState.camOff); }
}
function endCall() {
  if (callState.targetId && callState.active) sendSignal(callState.targetId, 'call-end', {});
  const hadDuration = callState.seconds > 0;
  const dur = callState.seconds;
  teardownCall();
  if (hadDuration) notify('info', `📞 Chamada encerrada — duração ${String(Math.floor(dur/60)).padStart(2,'0')}:${String(dur%60).padStart(2,'0')}`);
}
function teardownCall() {
  if (callState.timer) clearInterval(callState.timer);
  if (callState.localStream) callState.localStream.getTracks().forEach(t => t.stop());
  if (callState.pc) { try { callState.pc.close(); } catch (e) {} }
  const overlay = document.getElementById('call-overlay');
  if (overlay) overlay.remove();
  _pendingIncomingCall = null;
  callState = { active: false, mode: null, targetName: '', targetId: null, pc: null, localStream: null, remoteStream: null, timer: null, seconds: 0, muted: false, camOff: false, role: null };
}

function openCreateCommunityModal() {
  showModal('🏰 Criar Comunidade', `
    <div class="form-group"><label class="form-label">Nome da comunidade</label><input class="form-input" id="new-comm-name" maxlength="40" placeholder="Ex: Guilda dos Aventureiros"></div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px" id="new-comm-icons">
        ${['🏰','⚔️','🐉','🛡️','🏹','🔮','🎲','🌲'].map(i => `<div onclick="selectCommIcon('${i}')" id="ci-${i}" style="text-align:center;font-size:20px;cursor:pointer;padding:6px;border-radius:4px;border:1px solid var(--border);background:var(--bg3)">${i}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="createCommunity()">✦ Criar Comunidade</button>
  `);
  G._tempCommIcon = '🏰';
}
function selectCommIcon(i) {
  document.querySelectorAll('[id^="ci-"]').forEach(el => el.style.borderColor = 'var(--border)');
  document.getElementById('ci-' + i).style.borderColor = 'var(--gold)';
  G._tempCommIcon = i;
}
async function createCommunity() {
  const name = document.getElementById('new-comm-name')?.value.trim();
  if (!name) return notify('error', 'Digite um nome para a comunidade.');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  try {
    const { data: comm, error } = await supabase.from('communities').insert([{ name, icon: G._tempCommIcon || '🏰', owner_id: me }]).select().single();
    if (error) throw error;
    const { error: merr } = await supabase.from('community_members').insert([{ community_id: comm.id, user_id: me }]);
    if (merr) throw merr;
    const { error: cherr } = await supabase.from('community_channels').insert([
      { community_id: comm.id, name: 'geral' },
      { community_id: comm.id, name: 'anúncios' },
    ]);
    if (cherr) console.error('Erro ao criar canais padrão', cherr);
    delete G._tempCommIcon;
    closeModalDirect();
    notify('success', `🏰 Comunidade "${name}" criada!`);
    await loadMyCommunities();
    renderCommRail();
    await openCommunity(comm.id);
  } catch (e) {
    console.error('Erro ao criar comunidade', e);
    if ((e.message || '').includes('relation "public.communities" does not exist')) {
      notify('error', 'Comunidades ainda não configuradas no banco (rode communities-guilds-setup.sql no Supabase).');
    } else {
      notify('error', 'Não foi possível criar: ' + (e.message || 'erro desconhecido'));
    }
  }
}
async function deleteCommunity(id) {
  if (!await confirmDialog('Excluir esta comunidade e todas as suas mensagens?', { danger: true })) return;
  try {
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) throw error;
    openHome();
    notify('info', 'Comunidade excluída.');
  } catch (e) {
    console.error('Erro ao excluir comunidade', e);
    notify('error', 'Não foi possível excluir agora.');
  }
}

function openCreateChannelModal(commId) {
  showModal('➕ Novo Canal', `
    <div class="form-group"><label class="form-label">Nome do canal</label><input class="form-input" id="new-ch-name" maxlength="30" placeholder="Ex: estrategias"></div>
    <button class="btn btn-primary" style="width:100%" onclick="createChannel('${commId}')">✦ Criar Canal</button>
  `);
}
async function createChannel(commId) {
  const name = document.getElementById('new-ch-name')?.value.trim();
  if (!name) return notify('error', 'Digite um nome para o canal.');
  try {
    const { data: ch, error } = await supabase.from('community_channels').insert([{ community_id: commId, name }]).select().single();
    if (error) throw error;
    currentCommunityChannels.push(ch);
    closeModalDirect();
    notify('success', `# ${name} criado!`);
    await openChannel(commId, ch.id);
  } catch (e) {
    console.error('Erro ao criar canal', e);
    notify('error', 'Não foi possível criar o canal agora.');
  }
}

// A conversa privada só pode ser criada com um amigo de verdade (a
// lista vem da tabela friend_requests) — antes, qualquer nome digitado
// criava uma "conversa" que só existia no seu aparelho, sem chance de
// chegar a lugar nenhum.
async function openCreateDMModal() {
  const friends = await getFriendsList();
  if (!friends.length) { notify('warn', 'Adicione um amigo antes de iniciar uma conversa.'); return; }
  const options = friends.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  showModal('👤 Nova Conversa Privada', `
    <div class="form-group"><label class="form-label">Escolha um amigo</label>
      <select class="form-input" id="new-dm-friend">${options}</select>
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="createDM()">✦ Iniciar Conversa</button>
  `);
}
async function createDM() {
  const sel = document.getElementById('new-dm-friend');
  const friendId = sel?.value;
  const friendName = sel?.selectedOptions?.[0]?.textContent;
  if (!friendId) return notify('error', 'Escolha um amigo.');
  closeModalDirect();
  startDMWithFriend(friendId, friendName);
}

// Abre (ou cria, se ainda não existir) a conversa real com este amigo.
function startDMWithFriend(friendId, friendName) {
  navigate('conversas');
  let chat = G.chats.find(c => c.friendId === friendId);
  if (!chat) {
    chat = { id: uid('dm'), name: friendName, type: 'dm', friendId, createdAt: Date.now(), messages: [], remoteIds: [] };
    G.chats.push(chat);
    saveGame();
  }
  openChat(chat.id);
}

// Busca (e mescla, sem duplicar) as mensagens reais trocadas com este
// amigo. Chamado ao abrir a conversa e, em seguida, pelo polling do
// painel de Conversas — não existe realtime aqui de propósito (deixa
// o escopo desta correção menor e mais fácil de revisar).
async function loadFriendMessages(chat) {
  if (!chat || !chat.friendId) return;
  const me = myId();
  if (!me) return;
  try {
    const { data, error } = await supabase.from('messages')
      .select('id, from_id, to_id, text, image_url, audio_url, created_at, read_at, edited_at, deleted_at')
      .or(`and(from_id.eq.${me},to_id.eq.${chat.friendId}),and(from_id.eq.${chat.friendId},to_id.eq.${me})`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    chat.messages = chat.messages || [];
    const byId = Object.fromEntries(chat.messages.filter(m => m.remoteId).map(m => [m.remoteId, m]));
    let changed = false;
    (data || []).forEach(row => {
      const mine = row.from_id === me;
      const existing = byId[row.id];
      if (!existing) {
        chat.messages.push({ author: mine ? G.name : chat.name, mine, text: row.text, imageUrl: row.image_url || null, audioUrl: row.audio_url || null, ts: new Date(row.created_at).getTime(), remoteId: row.id, readAt: row.read_at, editedAt: row.edited_at, deletedAt: row.deleted_at });
        changed = true;
      } else if (existing.readAt !== row.read_at || existing.editedAt !== row.edited_at || existing.deletedAt !== row.deleted_at || existing.text !== row.text) {
        existing.readAt = row.read_at; existing.editedAt = row.edited_at; existing.deletedAt = row.deleted_at; existing.text = row.text;
        changed = true;
      }
    });
    if (changed) {
      chat.messages.sort((a, b) => a.ts - b.ts);
      saveGame();
      renderChatListCol();
      if (chatUI.view === 'chat' && chatUI.chatId === chat.id) renderChatMainCol();
    }
    // Marca como lida na hora, igual WhatsApp, só quando a conversa está aberta na tela
    if (chatUI.view === 'chat' && chatUI.chatId === chat.id) {
      const unreadIncoming = (data || []).filter(r => r.to_id === me && !r.read_at && !r.deleted_at);
      if (unreadIncoming.length) {
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIncoming.map(r => r.id));
      }
    }
  } catch (e) {
    console.error('Erro ao carregar mensagens', e);
  }
}

// pollAllFriendChats só atualiza conversas que JÁ existem no seu
// G.chats. Isso significa que se alguém te manda uma mensagem pela
// PRIMEIRA vez, ela nunca aparecia pra você — não existia conversa
// local pra receber. Essa função descobre remetentes novos (msgs onde
// to_id = você, mas sem chat local ainda) e cria a conversa na hora.
async function discoverIncomingDMs() {
  const me = myId();
  if (!me) return;
  try {
    const { data, error } = await supabase.from('messages')
      .select('from_id').eq('to_id', me).limit(500);
    if (error) throw error;
    const knownFriendIds = new Set((G.chats || []).filter(c => c.friendId).map(c => c.friendId));
    const newSenderIds = [...new Set((data || []).map(r => r.from_id))].filter(id => !knownFriendIds.has(id));
    if (!newSenderIds.length) return;
    const { data: profs } = await supabase.from('profiles').select('id,name').in('id', newSenderIds);
    const nameById = Object.fromEntries((profs || []).map(p => [p.id, p.name || 'Aventureiro']));
    G.chats = G.chats || [];
    let added = false;
    newSenderIds.forEach(id => {
      if (G.chats.find(c => c.friendId === id)) return;
      G.chats.push({ id: uid('dm'), name: nameById[id] || 'Aventureiro', type: 'dm', friendId: id, createdAt: Date.now(), messages: [], remoteIds: [] });
      added = true;
    });
    if (added) { saveGame(); await pollAllFriendChats(); renderChatListCol(); }
  } catch (e) {
    console.error('Erro ao descobrir novas mensagens', e);
  }
}

async function pollAllFriendChats() {
  const chats = (G.chats || []).filter(c => c.friendId);
  for (const c of chats) await loadFriendMessages(c);
}

// ── Grupos reais (agora no Supabase) — descobre grupos novos dos quais
// você faz parte e mantém sincronizados no G.chats local, igual às DMs.
async function discoverMyGroups() {
  const me = myId();
  if (!me) return;
  try {
    const { data: memberships, error } = await supabase.from('group_members').select('group_id,role').eq('user_id', me);
    if (error) throw error;
    const groupIds = (memberships || []).map(m => m.group_id);
    if (!groupIds.length) { myGroupsCache = []; return; }
    const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
    myGroupsCache = groups || [];
    G.chats = G.chats || [];
    let added = false;
    myGroupsCache.forEach(g => {
      if (G.chats.find(c => c.groupId === g.id)) return;
      G.chats.push({ id: uid('grp'), name: g.name, type: 'group', groupId: g.id, createdAt: Date.now(), messages: [], remoteIds: [] });
      added = true;
    });
    // remove localmente grupos dos quais você saiu/foi removido
    const beforeLen = G.chats.length;
    G.chats = G.chats.filter(c => c.type !== 'group' || groupIds.includes(c.groupId));
    if (added || G.chats.length !== beforeLen) { saveGame(); renderChatListCol(); }
  } catch (e) {
    console.error('Erro ao carregar grupos', e);
  }
}

async function loadGroupMessages(chat) {
  if (!chat || !chat.groupId) return;
  try {
    const { data, error } = await supabase.from('group_messages')
      .select('id, author_id, text, image_url, audio_url, created_at, edited_at, deleted_at')
      .eq('group_id', chat.groupId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    const me = myId();
    chat.messages = chat.messages || [];
    const byId = Object.fromEntries(chat.messages.filter(m => m.remoteId).map(m => [m.remoteId, m]));
    let changed = false;
    const authorIds = [...new Set((data || []).map(r => r.author_id))];
    await ensureProfilesCached(authorIds);
    (data || []).forEach(row => {
      const author = _chatProfileCache[row.author_id];
      const existing = byId[row.id];
      if (!existing) {
        chat.messages.push({ author: row.author_id === me ? G.name : (author?.name || 'Aventureiro'), text: row.text, imageUrl: row.image_url || null, audioUrl: row.audio_url || null, ts: new Date(row.created_at).getTime(), remoteId: row.id, editedAt: row.edited_at, deletedAt: row.deleted_at });
        changed = true;
      } else if (existing.editedAt !== row.edited_at || existing.deletedAt !== row.deleted_at || existing.text !== row.text) {
        existing.editedAt = row.edited_at; existing.deletedAt = row.deleted_at; existing.text = row.text;
        changed = true;
      }
    });
    if (changed) {
      chat.messages.sort((a, b) => a.ts - b.ts);
      saveGame();
      renderChatListCol();
      if (chatUI.view === 'chat' && chatUI.chatId === chat.id) renderChatMainCol();
    }
  } catch (e) {
    console.error('Erro ao carregar mensagens do grupo', e);
  }
}
async function pollAllGroupChats() {
  const groups = (G.chats || []).filter(c => c.groupId);
  for (const c of groups) await loadGroupMessages(c);
}

function openCreateGroupModal() {
  showModal('👥 Novo Grupo', `
    <div class="form-group"><label class="form-label">Nome do grupo</label><input class="form-input" id="new-grp-name" maxlength="30" placeholder="Ex: Amigos de Crydan"></div>
    <div class="form-group"><label class="form-label">Ícone (emoji)</label><input class="form-input" id="new-grp-icon" maxlength="4" placeholder="👥"></div>
    <div class="form-group"><label class="form-label">Descrição (opcional)</label><input class="form-input" id="new-grp-desc" maxlength="140" placeholder="Sobre o que é esse grupo?"></div>
    <button class="btn btn-primary" style="width:100%" onclick="createGroup()">✦ Criar Grupo</button>
    <div style="font-size:11px;color:var(--crydan-text-muted);margin-top:8px">Depois de criar, você pode adicionar pessoas nas configurações do grupo (⚙️).</div>
  `);
}
async function createGroup() {
  const name = document.getElementById('new-grp-name')?.value.trim();
  const icon = document.getElementById('new-grp-icon')?.value.trim() || '👥';
  const desc = document.getElementById('new-grp-desc')?.value.trim();
  if (!name) return notify('error', 'Digite um nome para o grupo.');
  try {
    const { data: groupId, error } = await supabase.rpc('group_create', { p_name: name, p_description: desc || null, p_icon: icon });
    if (error) throw error;
    const chat = { id: uid('grp'), name, type: 'group', groupId, createdAt: Date.now(), messages: [], remoteIds: [] };
    G.chats.push(chat);
    saveGame();
    closeModalDirect();
    await discoverMyGroups();
    openChat(chat.id);
    notify('success', `👥 Grupo "${name}" criado!`);
  } catch (e) {
    console.error('Erro ao criar grupo', e);
    notify('error', 'Não foi possível criar o grupo: ' + (e.message || 'erro desconhecido'));
  }
}

// ── Configurações do grupo (estilo WhatsApp) — só quem é admin/dono
// consegue abrir de verdade as ações de editar/adicionar/remover;
// membros comuns só veem a lista.
async function openGroupSettingsModal(groupId) {
  showModal('⚙️ Configurações do Grupo', `<div style="text-align:center;padding:24px;color:var(--text3)">Carregando...</div>`);
  try {
    const [{ data: group, error: gErr }, { data: members, error: mErr }, role] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id,role,joined_at').eq('group_id', groupId),
      getGroupRoleFresh(groupId),
    ]);
    if (gErr) throw gErr;
    if (mErr) throw mErr;
    const canManage = role === 'owner' || role === 'admin';
    const isOwner = role === 'owner';
    const memberIds = (members || []).map(m => m.user_id);
    await ensureProfilesCached(memberIds);

    let html = `<div style="text-align:center;margin-bottom:16px">
      <div style="width:64px;height:64px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(135deg,var(--purple),var(--cyan));overflow:hidden">${groupIconHtml(group)}</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold)">${escapeHtml(group.name)}</div>
      ${group.description ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(group.description)}</div>` : ''}
    </div>`;

    if (canManage) {
      html += `<div class="card" style="margin-bottom:12px">
        <div class="card-title" style="font-size:13px">✏️ Editar Grupo</div>
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="grp-edit-name" value="${escapeHtml(group.name)}" maxlength="30"></div>
        <div class="form-group"><label class="form-label">Descrição</label><input class="form-input" id="grp-edit-desc" value="${escapeHtml(group.description||'')}" maxlength="140"></div>
        <div class="form-group"><label class="form-label">Foto do grupo</label>
          <input type="file" id="grp-edit-photo-input" accept="image/*" style="display:none" onchange="handleGroupPhotoSelect(event,'${groupId}')">
          <button class="btn btn-sm" onclick="document.getElementById('grp-edit-photo-input').click()">🖼️ Enviar foto</button>
          <input class="form-input" id="grp-edit-icon" value="${(group.icon||'').startsWith('http')||(group.icon||'').startsWith('data:image')?'':escapeHtml(group.icon||'')}" placeholder="ou um emoji" maxlength="4" style="margin-top:6px">
        </div>
        <button class="btn btn-sm btn-primary" onclick="saveGroupSettings('${groupId}')">Salvar</button>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="font-size:13px">➕ Adicionar Pessoa</div>
        <div style="display:flex;gap:6px"><input class="form-input" id="grp-add-name" placeholder="Nome do jogador"><button class="btn btn-sm" onclick="addMemberToGroup('${groupId}')">Adicionar</button></div>
      </div>`;
    }

    html += `<div class="card"><div class="card-title" style="font-size:13px">👥 Membros (${members.length})</div>
      ${members.map(m => {
        const p = _chatProfileCache[m.user_id] || {};
        const roleLabel = m.role === 'owner' ? '👑 Dono' : m.role === 'admin' ? '⭐ Admin' : 'Membro';
        const canAct = isOwner && m.role !== 'owner';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--purple),var(--cyan));font-size:11px">${chatAvatarHtml(m.user_id, p.name)}</div>
          <span style="flex:1;font-size:13px">${escapeHtml(p.name || '?')}</span>
          <span class="badge badge-gray" style="font-size:10px">${roleLabel}</span>
          ${canAct ? `<button class="btn btn-sm" onclick="toggleGroupAdmin('${groupId}','${m.user_id}',${m.role!=='admin'})">${m.role==='admin'?'Remover admin':'Tornar admin'}</button>` : ''}
          ${canManage && m.role !== 'owner' ? `<button class="btn btn-sm btn-danger" onclick="removeMemberFromGroup('${groupId}','${m.user_id}')">Remover</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-danger" style="width:100%;margin-top:12px" onclick="leaveGroupConfirm('${groupId}')">Sair do Grupo</button>`;

    showModal('⚙️ Configurações do Grupo', html);
  } catch (e) {
    console.error('Erro ao abrir configurações do grupo', e);
    showModal('Erro', `<div class="empty-state"><div class="empty-sub">Não foi possível carregar as configurações do grupo.</div></div>`);
  }
}
async function getGroupRoleFresh(groupId) {
  delete _groupRoleCache[groupId];
  return await getGroupRole(groupId);
}
function handleGroupPhotoSelect(e, groupId) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione uma imagem.'); return; }
  if (file.size > 1.5 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 1.5MB).'); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const { error } = await supabase.rpc('group_update_settings', { p_group_id: groupId, p_icon: ev.target.result });
      if (error) throw error;
      notify('success', 'Foto do grupo atualizada!');
      openGroupSettingsModal(groupId);
      discoverMyGroups();
    } catch (err) {
      notify('error', err.message || 'Não foi possível atualizar a foto.');
    }
  };
  reader.readAsDataURL(file);
}
async function saveGroupSettings(groupId) {
  try {
    const name = document.getElementById('grp-edit-name')?.value.trim();
    const desc = document.getElementById('grp-edit-desc')?.value.trim();
    const iconInput = document.getElementById('grp-edit-icon')?.value.trim();
    const { error } = await supabase.rpc('group_update_settings', { p_group_id: groupId, p_name: name, p_description: desc, p_icon: iconInput || null });
    if (error) throw error;
    notify('success', 'Grupo atualizado!');
    await discoverMyGroups();
    renderChatListCol();
    if (chatUI.view === 'chat') renderChatMainCol();
  } catch (e) {
    notify('error', e.message || 'Não foi possível salvar.');
  }
}
async function addMemberToGroup(groupId) {
  const name = document.getElementById('grp-add-name')?.value.trim();
  if (!name) return;
  try {
    const found = await findProfileByNameOrUsername(name, 'id,name');
    if (!found) return notify('error', 'Jogador não encontrado.');
    const { error } = await supabase.rpc('group_add_member', { p_group_id: groupId, p_user_id: found.id });
    if (error) throw error;
    notify('success', `${found.name} adicionado ao grupo!`);
    openGroupSettingsModal(groupId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível adicionar.');
  }
}
async function removeMemberFromGroup(groupId, userId) {
  if (!await confirmDialog('Remover essa pessoa do grupo?', { danger: true })) return;
  try {
    const { error } = await supabase.rpc('group_remove_member', { p_group_id: groupId, p_user_id: userId });
    if (error) throw error;
    notify('info', 'Pessoa removida do grupo.');
    openGroupSettingsModal(groupId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível remover.');
  }
}
async function toggleGroupAdmin(groupId, userId, makeAdmin) {
  try {
    const { error } = await supabase.rpc('group_set_admin', { p_group_id: groupId, p_user_id: userId, p_is_admin: makeAdmin });
    if (error) throw error;
    openGroupSettingsModal(groupId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível alterar o cargo.');
  }
}
async function leaveGroupConfirm(groupId) {
  if (!await confirmDialog('Sair desse grupo?', { danger: true })) return;
  try {
    const { error } = await supabase.rpc('group_leave', { p_group_id: groupId });
    if (error) throw error;
    G.chats = G.chats.filter(c => c.groupId !== groupId);
    saveGame();
    closeModalDirect();
    openHome();
    notify('info', 'Você saiu do grupo.');
  } catch (e) {
    notify('error', e.message || 'Não foi possível sair do grupo.');
  }
}

// ── Configurações da comunidade (mesma ideia, pra quem é dono/admin) ──
async function openCommunitySettingsModal(communityId) {
  showModal('⚙️ Configurações da Comunidade', `<div style="text-align:center;padding:24px;color:var(--text3)">Carregando...</div>`);
  try {
    delete _communityRoleCache[communityId];
    const [{ data: comm, error: cErr }, { data: members, error: mErr }, role] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).single(),
      supabase.from('community_members').select('user_id,role,joined_at').eq('community_id', communityId),
      getCommunityRole(communityId),
    ]);
    if (cErr) throw cErr;
    if (mErr) throw mErr;
    const canManage = role === 'owner' || role === 'admin';
    const isOwner = role === 'owner';
    const memberIds = (members || []).map(m => m.user_id);
    await ensureProfilesCached(memberIds);

    let html = `<div style="text-align:center;margin-bottom:16px">
      <div style="width:64px;height:64px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(135deg,var(--purple),var(--cyan));overflow:hidden">${communityIconHtmlBig(comm)}</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold)">${escapeHtml(comm.name)}</div>
      ${comm.description ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">${escapeHtml(comm.description)}</div>` : ''}
    </div>`;

    if (canManage) {
      html += `<div class="card" style="margin-bottom:12px">
        <div class="card-title" style="font-size:13px">✏️ Editar Comunidade</div>
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="comm-edit-name" value="${escapeHtml(comm.name)}" maxlength="40"></div>
        <div class="form-group"><label class="form-label">Descrição</label><input class="form-input" id="comm-edit-desc" value="${escapeHtml(comm.description||'')}" maxlength="140"></div>
        <div class="form-group"><label class="form-label">Ícone da comunidade</label>
          <input type="file" id="comm-edit-photo-input" accept="image/*" style="display:none" onchange="handleCommunityPhotoSelect(event,'${communityId}')">
          <button class="btn btn-sm" onclick="document.getElementById('comm-edit-photo-input').click()">🖼️ Enviar foto</button>
          <input class="form-input" id="comm-edit-icon" value="${(comm.icon||'').startsWith('http')||(comm.icon||'').startsWith('data:image')?'':escapeHtml(comm.icon||'')}" placeholder="ou um emoji" maxlength="4" style="margin-top:6px">
        </div>
        <button class="btn btn-sm btn-primary" onclick="saveCommunitySettings('${communityId}')">Salvar</button>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="font-size:13px">➕ Adicionar Pessoa</div>
        <div style="display:flex;gap:6px"><input class="form-input" id="comm-add-name" placeholder="Nome do jogador"><button class="btn btn-sm" onclick="addMemberToCommunity('${communityId}')">Adicionar</button></div>
      </div>`;
    }

    html += `<div class="card"><div class="card-title" style="font-size:13px">👥 Membros (${members.length})</div>
      ${members.map(m => {
        const p = _chatProfileCache[m.user_id] || {};
        const roleLabel = m.role === 'owner' ? '👑 Dono' : m.role === 'admin' ? '⭐ Admin' : 'Membro';
        const canAct = isOwner && m.role !== 'owner';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--purple),var(--cyan));font-size:11px">${chatAvatarHtml(m.user_id, p.name)}</div>
          <span style="flex:1;font-size:13px">${escapeHtml(p.name || '?')}</span>
          <span class="badge badge-gray" style="font-size:10px">${roleLabel}</span>
          ${canAct ? `<button class="btn btn-sm" onclick="toggleCommunityAdmin('${communityId}','${m.user_id}',${m.role!=='admin'})">${m.role==='admin'?'Remover admin':'Tornar admin'}</button>` : ''}
          ${canManage && m.role !== 'owner' ? `<button class="btn btn-sm btn-danger" onclick="removeMemberFromCommunity('${communityId}','${m.user_id}')">Remover</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;

    showModal('⚙️ Configurações da Comunidade', html);
  } catch (e) {
    console.error('Erro ao abrir configurações da comunidade', e);
    showModal('Erro', `<div class="empty-state"><div class="empty-sub">Não foi possível carregar as configurações.</div></div>`);
  }
}
function handleCommunityPhotoSelect(e, communityId) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione uma imagem.'); return; }
  if (file.size > 1.5 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 1.5MB).'); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const { error } = await supabase.rpc('community_update_settings', { p_community_id: communityId, p_icon: ev.target.result });
      if (error) throw error;
      notify('success', 'Ícone da comunidade atualizado!');
      openCommunitySettingsModal(communityId);
    } catch (err) {
      notify('error', err.message || 'Não foi possível atualizar.');
    }
  };
  reader.readAsDataURL(file);
}
async function saveCommunitySettings(communityId) {
  try {
    const name = document.getElementById('comm-edit-name')?.value.trim();
    const desc = document.getElementById('comm-edit-desc')?.value.trim();
    const iconInput = document.getElementById('comm-edit-icon')?.value.trim();
    const { error } = await supabase.rpc('community_update_settings', { p_community_id: communityId, p_name: name, p_description: desc, p_icon: iconInput || null });
    if (error) throw error;
    notify('success', 'Comunidade atualizada!');
    await refreshMyCommunities();
    renderChatListCol();
  } catch (e) {
    notify('error', e.message || 'Não foi possível salvar.');
  }
}
async function addMemberToCommunity(communityId) {
  const name = document.getElementById('comm-add-name')?.value.trim();
  if (!name) return;
  try {
    const found = await findProfileByNameOrUsername(name, 'id,name');
    if (!found) return notify('error', 'Jogador não encontrado.');
    const { error } = await supabase.rpc('community_add_member', { p_community_id: communityId, p_user_id: found.id });
    if (error) throw error;
    notify('success', `${found.name} adicionado à comunidade!`);
    openCommunitySettingsModal(communityId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível adicionar.');
  }
}
async function removeMemberFromCommunity(communityId, userId) {
  if (!await confirmDialog('Remover essa pessoa da comunidade?', { danger: true })) return;
  try {
    const { error } = await supabase.rpc('community_remove_member', { p_community_id: communityId, p_user_id: userId });
    if (error) throw error;
    notify('info', 'Pessoa removida da comunidade.');
    openCommunitySettingsModal(communityId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível remover.');
  }
}
async function toggleCommunityAdmin(communityId, userId, makeAdmin) {
  try {
    const { error } = await supabase.rpc('community_set_admin', { p_community_id: communityId, p_user_id: userId, p_is_admin: makeAdmin });
    if (error) throw error;
    openCommunitySettingsModal(communityId);
  } catch (e) {
    notify('error', e.message || 'Não foi possível alterar o cargo.');
  }
}

async function deleteChat(id) {
  if (!await confirmDialog('Excluir esta conversa?', { danger: true })) return;
  G.chats = G.chats.filter(c => c.id !== id);
  saveGame();
  openHome();
}
// ══════════════════════════════════════════
//   MEU PERSONAGEM (ficha de RPG personalizada)
// ══════════════════════════════════════════
function renderCharacterSheet() {
  G.characterSheet = G.characterSheet || { customName:'', customClass:'', appearance:'', backstory:'', skills:[] };
  const cs = G.characterSheet;
  document.getElementById('cs-name').value = cs.customName || '';
  document.getElementById('cs-class').value = cs.customClass || '';
  document.getElementById('cs-appearance').value = cs.appearance || '';
  document.getElementById('cs-backstory').value = cs.backstory || '';
  renderCustomSkillsList();
  renderCharacterSheetPreview();
}

function renderCustomSkillsList() {
  const el = document.getElementById('cs-skills-list');
  if (!el) return;
  const skills = (G.characterSheet && G.characterSheet.skills) || [];
  if (!skills.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">Nenhuma habilidade adicionada ainda.</div>'; return; }
  el.innerHTML = skills.map(s => `<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
    <span style="flex:1"><b style="color:var(--gold2)">${escapeHtml(s.name)}</b> — <span style="color:var(--text2);font-size:13px">${escapeHtml(s.desc)}</span></span>
    <span onclick="removeCustomSkill('${s.id}')" style="cursor:pointer;color:var(--red)" title="Remover">✕</span>
  </div>`).join('');
}

function addCustomSkill() {
  const nameEl = document.getElementById('cs-skill-name');
  const descEl = document.getElementById('cs-skill-desc');
  const name = nameEl.value.trim();
  const desc = descEl.value.trim();
  if (!name) return notify('error', 'Dê um nome para a habilidade.');
  G.characterSheet = G.characterSheet || { customName:'', customClass:'', appearance:'', backstory:'', skills:[] };
  G.characterSheet.skills = G.characterSheet.skills || [];
  if (G.characterSheet.skills.length >= 12) return notify('error', 'Máximo de 12 habilidades por personagem.');
  G.characterSheet.skills.push({ id: uid('skill'), name, desc });
  nameEl.value = ''; descEl.value = '';
  saveGame();
  renderCustomSkillsList();
  renderCharacterSheetPreview();
  notify('success', '✨ Habilidade adicionada!');
}

function removeCustomSkill(id) {
  if (!G.characterSheet) return;
  G.characterSheet.skills = (G.characterSheet.skills || []).filter(s => s.id !== id);
  saveGame();
  renderCustomSkillsList();
  renderCharacterSheetPreview();
}

function saveCharacterSheet() {
  G.characterSheet = G.characterSheet || {};
  G.characterSheet.customName = document.getElementById('cs-name').value.trim();
  G.characterSheet.customClass = document.getElementById('cs-class').value.trim();
  G.characterSheet.appearance = document.getElementById('cs-appearance').value.trim();
  G.characterSheet.backstory = document.getElementById('cs-backstory').value.trim();
  saveGame();
  renderCharacterSheetPreview();
  addToFeed('📖 Atualizou a ficha do personagem');
  notify('success', '📖 Ficha de personagem salva!');
}

function renderCharacterSheetPreview() {
  const el = document.getElementById('cs-sheet-preview');
  if (!el) return;
  const cs = G.characterSheet || {};
  if (!cs.customName && !cs.backstory && !(cs.skills && cs.skills.length)) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card-title">📖 ${escapeHtml(cs.customName || G.name)}${cs.customClass ? ` <span style="color:var(--text3);font-size:12px">— ${escapeHtml(cs.customClass)}</span>` : ''}</div>
    ${cs.appearance ? `<div style="font-size:13px;color:var(--text2);margin-bottom:8px"><b>Aparência:</b> ${escapeHtml(cs.appearance)}</div>` : ''}
    ${cs.backstory ? `<div style="font-size:13px;color:var(--text);white-space:pre-wrap;margin-bottom:10px">${escapeHtml(cs.backstory)}</div>` : ''}
    ${(cs.skills && cs.skills.length) ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${cs.skills.map(s => `<span class="badge badge-purple" title="${escapeHtml(s.desc)}">✨ ${escapeHtml(s.name)}</span>`).join('')}</div>` : ''}
  `;
}

// ══════════════════════════════════════════
//   CENTRAL DE JOGOS
// ══════════════════════════════════════════

let currentGame = null;

function renderGamesHub() {
  const grid = document.getElementById('games-hub-grid');
  grid.innerHTML = GAMES_LIST.map(g => `
    <div class="frame-shop-card game-card" onclick="openGame('${g.id}')">
      <div class="game-card-icon">${g.icon}</div>
      <div class="game-card-name">${g.name}</div>
      <div class="game-card-desc">${g.desc}</div>
    </div>`).join('');
  document.getElementById('games-hub-view').style.display = 'block';
  document.getElementById('games-play-view').style.display = 'none';
}

function openGame(id) {
  currentGame = id;
  document.getElementById('games-hub-view').style.display = 'none';
  document.getElementById('games-play-view').style.display = 'block';
  const fn = window['initGame_' + id];
  if (fn) fn();
}

function closeGame() {
  currentGame = null;
  renderGamesHub();
}

function gameReward(cry, xp) {
  G.wallet += (cry || 0);
  G.totalEarned = (G.totalEarned || 0) + (cry || 0);
  if (xp) gainXP(xp);
  saveGame(); updateHeader();
}

/* ---------- 1. JOGO DA VELHA ---------- */
let tttBoard, tttTurn, tttMode, tttOver, tttDifficulty;
// ── Dificuldade do bot (compartilhada entre os jogos) ───────────────
// 4 níveis: fácil (bastante aleatório), médio, difícil (quase sempre
// joga a melhor jogada) e impossível (sempre joga perfeitamente).

function initGame_velha() {
  tttBoard = Array(9).fill(null); tttTurn = 'X'; tttMode = tttMode || 'ai'; tttOver = false;
  tttDifficulty = tttDifficulty || 'dificil';
  renderGame_velha();
}
function renderGame_velha() {
  const c = document.getElementById('game-container');
  c.innerHTML = `
    <div class="card-title">❌⭕ Jogo da Velha</div>
    <div class="game-mode-bar">
      <button class="btn-sm ${tttMode==='ai'?'btn-primary':''}" onclick="tttSetMode('ai')">Contra IA</button>
      <button class="btn-sm ${tttMode==='2p'?'btn-primary':''}" onclick="tttSetMode('2p')">2 Jogadores</button>
      <button class="btn-sm" onclick="initGame_velha()">🔄 Reiniciar</button>
    </div>
    ${tttMode==='ai' ? botDifficultyBar(tttDifficulty, 'tttSetDifficulty') : ''}
    <div id="ttt-status" style="text-align:center;margin-bottom:10px;font-size:14px;color:var(--gold2)">Vez de: ${tttTurn}</div>
    <div class="ttt-board">${tttBoard.map((v,i)=>`<div class="ttt-cell" onclick="tttPlay(${i})">${v||''}</div>`).join('')}</div>`;
}
function tttSetMode(m) { tttMode = m; initGame_velha(); }
function tttSetDifficulty(d) { tttDifficulty = d; renderGame_velha(); }
function tttPlay(i) {
  if (tttOver || tttBoard[i]) return;
  tttBoard[i] = tttTurn;
  const w = tttWinner(tttBoard);
  if (w) return tttEnd(w);
  tttTurn = tttTurn === 'X' ? 'O' : 'X';
  renderGame_velha();
  if (tttMode === 'ai' && tttTurn === 'O' && !tttOver) setTimeout(tttAiMove, 400);
}
function tttAiMove() {
  const diff = BOT_DIFFICULTIES[tttDifficulty] || BOT_DIFFICULTIES.dificil;
  const avail = tttBoard.map((v,i) => v ? null : i).filter(v => v !== null);
  let chosenIndex;
  if (Math.random() < diff.randomChance) {
    chosenIndex = avail[Math.floor(Math.random() * avail.length)];
  } else {
    chosenIndex = tttMinimax(tttBoard, 'O').index;
  }
  tttBoard[chosenIndex] = 'O';
  const w = tttWinner(tttBoard);
  if (w) return tttEnd(w);
  tttTurn = 'X';
  renderGame_velha();
}
function tttMinimax(board, player) {
  const avail = board.map((v,i) => v ? null : i).filter(v => v !== null);
  const winner = tttWinner(board);
  if (winner === 'X') return { score:-10 };
  if (winner === 'O') return { score:10 };
  if (winner === 'empate') return { score:0 };
  const moves = avail.map(i => {
    const nb = board.slice(); nb[i] = player;
    return { index:i, score: tttMinimax(nb, player === 'O' ? 'X' : 'O').score };
  });
  return player === 'O' ? moves.reduce((a,b) => b.score > a.score ? b : a) : moves.reduce((a,b) => b.score < a.score ? b : a);
}
function tttEnd(w) {
  tttOver = true; renderGame_velha();
  document.getElementById('ttt-status').textContent = w === 'empate' ? 'Empate!' : `${w} venceu!`;
  if (w === 'X') { gameReward(15, 5); notify('success', '🏆 Você venceu! +15 Cry'); }
  else if (w === 'O' && tttMode === 'ai') notify('info', 'A IA venceu dessa vez!');
}

/* ---------- 2. TERMO ---------- */
let termoWord, termoGuesses, termoRow, termoOver;
function initGame_termo() {
  termoWord = TERMO_WORDS[Math.floor(Math.random()*TERMO_WORDS.length)];
  termoGuesses = []; termoRow = ''; termoOver = false;
  renderGame_termo();
}
function renderGame_termo() {
  const c = document.getElementById('game-container');
  let rows = '';
  for (let i = 0; i < 6; i++) {
    const guess = termoGuesses[i];
    if (guess) {
      rows += `<div class="termo-row">${guess.letters.map(l => `<div class="termo-cell ${l.state}">${l.ch}</div>`).join('')}</div>`;
    } else if (i === termoGuesses.length) {
      const cur = (termoRow + '     ').slice(0,5).split('');
      rows += `<div class="termo-row">${cur.map(ch => `<div class="termo-cell">${ch.trim()}</div>`).join('')}</div>`;
    } else {
      rows += `<div class="termo-row">${'     '.split('').map(()=>`<div class="termo-cell"></div>`).join('')}</div>`;
    }
  }
  c.innerHTML = `
    <div class="card-title">🟩 Termo</div>
    <div style="font-size:12px;color:var(--text2);text-align:center;margin-bottom:10px">Adivinhe a palavra de 5 letras em até 6 tentativas.</div>
    ${rows}
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
      <input class="form-input" id="termo-input" maxlength="5" style="width:140px;text-transform:uppercase;text-align:center" ${termoOver?'disabled':''} onkeydown="if(event.key==='Enter'){termoSubmit();}">
      <button class="btn btn-primary" onclick="termoSubmit()" ${termoOver?'disabled':''}>Tentar</button>
      <button class="btn-sm" onclick="initGame_termo()">🔄 Nova Palavra</button>
    </div>`;
}
function termoSubmit() {
  const input = document.getElementById('termo-input');
  const guess = input.value.trim().toUpperCase();
  if (guess.length !== 5) return notify('error', 'A palavra precisa ter 5 letras.');
  const target = termoWord.split('');
  const guessArr = guess.split('');
  const states = Array(5).fill('absent');
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) if (guessArr[i] === target[i]) { states[i] = 'correct'; used[i] = true; }
  for (let i = 0; i < 5; i++) {
    if (states[i] === 'correct') continue;
    const idx = target.findIndex((ch,j) => ch === guessArr[i] && !used[j]);
    if (idx >= 0) { states[i] = 'present'; used[idx] = true; }
  }
  termoGuesses.push({ letters: guessArr.map((ch,i) => ({ ch, state: states[i] })) });
  input.value = '';
  if (guess === termoWord) {
    termoOver = true; renderGame_termo();
    gameReward(20, 6); notify('success', `🎉 Você acertou "${termoWord}"! +20 Cry`);
    return;
  }
  if (termoGuesses.length >= 6) {
    termoOver = true; renderGame_termo();
    notify('error', `Fim de tentativas! A palavra era "${termoWord}".`);
    return;
  }
  renderGame_termo();
}

/* ---------- 3. FORCA ---------- */
let forcaWord, forcaGuessed, forcaWrong;
function initGame_forca() {
  forcaWord = FORCA_WORDS[Math.floor(Math.random()*FORCA_WORDS.length)];
  forcaGuessed = []; forcaWrong = 0;
  renderGame_forca();
}
function renderGame_forca() {
  const c = document.getElementById('game-container');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const won = forcaWord.split('').every(ch => forcaGuessed.includes(ch));
  const lost = forcaWrong >= 6;
  c.innerHTML = `
    <div class="card-title">🪢 Forca</div>
    <div class="hangman-figure">${HANGMAN_STAGES[forcaWrong]}</div>
    <div class="word-blanks">${forcaWord.split('').map(ch => forcaGuessed.includes(ch) || lost ? `<span style="${!forcaGuessed.includes(ch)&&lost?'color:var(--red)':''}">${ch}</span>` : '_').join('')}</div>
    <div style="text-align:center;font-size:12px;color:var(--text3);margin-bottom:10px">Erros: ${forcaWrong}/6</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:400px;margin:0 auto">
      ${letters.map(l => `<button class="letter-btn" ${forcaGuessed.includes(l)||won||lost?'disabled':''} onclick="forcaGuess('${l}')">${l}</button>`).join('')}
    </div>
    <div style="text-align:center;margin-top:12px">
      ${won ? '<span class="badge badge-green">🎉 Você venceu!</span>' : ''}
      ${lost ? `<span class="badge badge-red">💀 Fim de jogo! Era "${forcaWord}"</span>` : ''}
      <button class="btn-sm" style="margin-left:8px" onclick="initGame_forca()">🔄 Nova Palavra</button>
    </div>`;
  if (won && !window._forcaRewarded) { window._forcaRewarded = true; gameReward(18, 5); notify('success', '🎉 +18 Cry'); }
  if (!won) window._forcaRewarded = false;
}
function forcaGuess(l) {
  if (forcaGuessed.includes(l)) return;
  forcaGuessed.push(l);
  if (!forcaWord.includes(l)) forcaWrong++;
  renderGame_forca();
}

/* ---------- 4. QUIZ ---------- */
let quizIndex, quizScore, quizOrder;
function initGame_quiz() {
  quizOrder = QUIZ_QUESTIONS.map((_,i) => i).sort(() => Math.random()-0.5).slice(0,10);
  quizIndex = 0; quizScore = 0;
  renderGame_quiz();
}
function renderGame_quiz() {
  const c = document.getElementById('game-container');
  if (quizIndex >= quizOrder.length) {
    const cry = quizScore * 5;
    gameReward(cry, quizScore);
    if (quizScore === quizOrder.length) celebrate('big');
    c.innerHTML = `
      <div class="card-title">❓ Quiz Crydan — Resultado</div>
      <div style="text-align:center;padding:30px">
        <div style="font-size:40px;margin-bottom:10px">🏆</div>
        <div style="font-size:18px;color:var(--gold2);margin-bottom:8px">Você acertou ${quizScore} de ${quizOrder.length}!</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:16px">+${cry} Cry</div>
        <button class="btn btn-primary" onclick="initGame_quiz()">🔄 Jogar Novamente</button>
      </div>`;
    return;
  }
  const q = QUIZ_QUESTIONS[quizOrder[quizIndex]];
  c.innerHTML = `
    <div class="card-title">❓ Quiz Crydan (${quizIndex+1}/${quizOrder.length}) — Pontos: ${quizScore}</div>
    <div style="font-size:15px;color:var(--text);margin-bottom:14px;text-align:center">${q.q}</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-width:400px;margin:0 auto">
      ${q.options.map((op,i) => `<button class="btn" onclick="quizAnswer(${i})">${op}</button>`).join('')}
    </div>`;
}
function quizAnswer(i) {
  const q = QUIZ_QUESTIONS[quizOrder[quizIndex]];
  if (i === q.a) { quizScore++; notify('success', '✅ Certa!', 1200); } else { notify('error', `❌ Errada — era "${q.options[q.a]}"`, 1800); }
  quizIndex++;
  renderGame_quiz();
}

/* ---------- 5. CONECTA 4 ---------- */
let c4Board, c4Turn, c4Mode, c4Over, c4Difficulty;
function initGame_conecta4() {
  c4Board = Array(7).fill(null).map(() => Array(6).fill(null));
  c4Turn = 1; c4Mode = c4Mode || 'ai'; c4Over = false;
  c4Difficulty = c4Difficulty || 'dificil';
  renderGame_conecta4();
}
function renderGame_conecta4() {
  const c = document.getElementById('game-container');
  let html = '';
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const v = c4Board[col][row];
      html += `<div class="c4-cell ${v===1?'p1':v===2?'p2':'empty'}" onclick="c4Play(${col})"></div>`;
    }
  }
  c.innerHTML = `
    <div class="card-title">🔴 Conecta 4</div>
    <div class="game-mode-bar">
      <button class="btn-sm ${c4Mode==='ai'?'btn-primary':''}" onclick="c4SetMode('ai')">Contra IA</button>
      <button class="btn-sm ${c4Mode==='2p'?'btn-primary':''}" onclick="c4SetMode('2p')">2 Jogadores</button>
      <button class="btn-sm" onclick="initGame_conecta4()">🔄 Reiniciar</button>
    </div>
    ${c4Mode==='ai' ? botDifficultyBar(c4Difficulty, 'c4SetDifficulty') : ''}
    <div id="c4-status" style="text-align:center;margin-bottom:8px;font-size:13px;color:var(--gold2)">Vez do jogador ${c4Turn} ${c4Turn===1?'🔴':'🟡'}</div>
    <div class="c4-board">${html}</div>`;
}
function c4SetMode(m) { c4Mode = m; initGame_conecta4(); }
function c4SetDifficulty(d) { c4Difficulty = d; renderGame_conecta4(); }
function c4LowestRow(col) {
  for (let row = 5; row >= 0; row--) if (!c4Board[col][row]) return row;
  return -1;
}
function c4CheckWin(board, player) {
  for (let col = 0; col < 7; col++) for (let row = 0; row < 6; row++) {
    if (board[col][row] !== player) continue;
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dx,dy] of dirs) {
      let count = 1;
      for (let s = 1; s < 4; s++) { const c2=col+dx*s, r2=row+dy*s; if (c2>=0&&c2<7&&r2>=0&&r2<6&&board[c2][r2]===player) count++; else break; }
      if (count >= 4) return true;
    }
  }
  return false;
}
function c4Play(col) {
  if (c4Over) return;
  const row = c4LowestRow(col);
  if (row < 0) return;
  c4Board[col][row] = c4Turn;
  if (c4CheckWin(c4Board, c4Turn)) return c4End(c4Turn);
  if (c4Board.every(colArr => colArr.every(v => v))) return c4End('empate');
  c4Turn = c4Turn === 1 ? 2 : 1;
  renderGame_conecta4();
  if (c4Mode === 'ai' && c4Turn === 2 && !c4Over) setTimeout(c4AiMove, 450);
}
function c4AiMove() {
  const diff = BOT_DIFFICULTIES[c4Difficulty] || BOT_DIFFICULTIES.dificil;
  const validCols = [0,1,2,3,4,5,6].filter(c2 => c4LowestRow(c2) >= 0);

  // dificuldade fácil: quase sempre joga aleatório, ignorando estratégia
  if (Math.random() < diff.randomChance) {
    const col = validCols[Math.floor(Math.random() * validCols.length)];
    const row = c4LowestRow(col);
    c4Board[col][row] = 2;
    if (c4CheckWin(c4Board, 2)) return c4End(2);
    if (c4Board.every(colArr => colArr.every(v => v))) return c4End('empate');
    c4Turn = 1;
    renderGame_conecta4();
    return;
  }

  let move = null;
  // 1) vence agora se puder
  for (const col of validCols) { const row = c4LowestRow(col); c4Board[col][row]=2; if (c4CheckWin(c4Board,2)) move=col; c4Board[col][row]=null; if (move!==null) break; }
  // 2) bloqueia vitória do adversário
  if (move === null) for (const col of validCols) { const row = c4LowestRow(col); c4Board[col][row]=1; if (c4CheckWin(c4Board,1)) move=col; c4Board[col][row]=null; if (move!==null) break; }
  // 3) difícil/impossível: evita jogar numa coluna que dá de bandeja a
  // vitória pro adversário na jogada seguinte (olha 1 jogada à frente)
  if (move === null && (c4Difficulty === 'dificil' || c4Difficulty === 'impossivel')) {
    const safeCols = validCols.filter(col => {
      const row = c4LowestRow(col);
      c4Board[col][row] = 2;
      const rowAbove = row - 1;
      let unsafe = false;
      if (rowAbove >= 0) { c4Board[col][rowAbove] = 1; if (c4CheckWin(c4Board, 1)) unsafe = true; c4Board[col][rowAbove] = null; }
      c4Board[col][row] = null;
      return !unsafe;
    });
    const pool = safeCols.length ? safeCols : validCols;
    // prefere colunas centrais (mais opções de conexão) como critério de desempate
    pool.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    move = pool[0];
  }
  if (move === null) {
    const pool = [...validCols].sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    move = pool[0];
  }
  const row = c4LowestRow(move);
  c4Board[move][row] = 2;
  if (c4CheckWin(c4Board, 2)) return c4End(2);
  if (c4Board.every(colArr => colArr.every(v => v))) return c4End('empate');
  c4Turn = 1;
  renderGame_conecta4();
}
function c4End(w) {
  c4Over = true; renderGame_conecta4();
  const status = document.getElementById('c4-status');
  status.textContent = w === 'empate' ? 'Empate!' : `Jogador ${w} venceu!`;
  if (w === 1) { gameReward(20, 6); notify('success', '🏆 Você venceu! +20 Cry'); }
}

/* ---------- 6. JOGO DA MEMÓRIA ---------- */
let memCards, memFlipped, memMatched, memMoves, memBusy;
function initGame_memoria() {
  const pairs = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS];
  memCards = pairs.sort(() => Math.random()-0.5);
  memFlipped = []; memMatched = []; memMoves = 0; memBusy = false;
  renderGame_memoria();
}
function renderGame_memoria() {
  const c = document.getElementById('game-container');
  c.innerHTML = `
    <div class="card-title">🃏 Jogo da Memória — Movimentos: ${memMoves}</div>
    <div class="memory-board">
      ${memCards.map((e,i) => `<div class="memory-card ${memFlipped.includes(i)||memMatched.includes(i)?'flipped':''}" onclick="memFlip(${i})">${memFlipped.includes(i)||memMatched.includes(i)?e:'❔'}</div>`).join('')}
    </div>
    <div style="text-align:center;margin-top:10px">
      ${memMatched.length === memCards.length ? '<span class="badge badge-green">🎉 Completou!</span>' : ''}
      <button class="btn-sm" style="margin-left:8px" onclick="initGame_memoria()">🔄 Reiniciar</button>
    </div>`;
}
function memFlip(i) {
  if (memBusy || memFlipped.includes(i) || memMatched.includes(i) || memFlipped.length >= 2) return;
  memFlipped.push(i);
  renderGame_memoria();
  if (memFlipped.length === 2) {
    memMoves++;
    memBusy = true;
    const [a,b] = memFlipped;
    if (memCards[a] === memCards[b]) {
      memMatched.push(a,b); memFlipped = []; memBusy = false;
      renderGame_memoria();
      if (memMatched.length === memCards.length) { gameReward(20, 6); notify('success', `🎉 Completou em ${memMoves} movimentos! +20 Cry`); }
    } else {
      setTimeout(() => { memFlipped = []; memBusy = false; renderGame_memoria(); }, 800);
    }
  }
}

/* ---------- 7. PEDRA, PAPEL, TESOURA ---------- */
let pptScore;
function initGame_ppt() {
  pptScore = pptScore || { win:0, lose:0, draw:0 };
  renderGame_ppt('', '', '');
}
function renderGame_ppt(playerChoice, aiChoice, result) {
  const c = document.getElementById('game-container');
  const icons = { pedra:'🪨', papel:'📄', tesoura:'✂️' };
  c.innerHTML = `
    <div class="card-title">✂️ Pedra, Papel e Tesoura</div>
    <div style="text-align:center;font-size:13px;color:var(--text3);margin-bottom:14px">Vitórias: ${pptScore.win} · Derrotas: ${pptScore.lose} · Empates: ${pptScore.draw}</div>
    ${playerChoice ? `<div style="text-align:center;font-size:40px;margin-bottom:10px">${icons[playerChoice]} vs ${icons[aiChoice]}</div><div style="text-align:center;font-size:16px;color:var(--gold2);margin-bottom:16px">${result}</div>` : ''}
    <div style="display:flex;gap:12px;justify-content:center">
      <button class="btn" style="font-size:24px;padding:16px" onclick="pptPlay('pedra')">🪨</button>
      <button class="btn" style="font-size:24px;padding:16px" onclick="pptPlay('papel')">📄</button>
      <button class="btn" style="font-size:24px;padding:16px" onclick="pptPlay('tesoura')">✂️</button>
    </div>`;
}
function pptPlay(choice) {
  const options = ['pedra','papel','tesoura'];
  const ai = options[Math.floor(Math.random()*3)];
  let result;
  if (choice === ai) { result = 'Empate!'; pptScore.draw++; }
  else if ((choice==='pedra'&&ai==='tesoura')||(choice==='papel'&&ai==='pedra')||(choice==='tesoura'&&ai==='papel')) { result = 'Você venceu!'; pptScore.win++; gameReward(8, 2); }
  else { result = 'A IA venceu!'; pptScore.lose++; }
  renderGame_ppt(choice, ai, result);
}

/* ---------- 8. ADIVINHE O NÚMERO ---------- */
let numTarget, numTries, numMin, numMax;
function initGame_numero() {
  numTarget = Math.floor(Math.random()*100)+1; numTries = 0; numMin = 1; numMax = 100;
  renderGame_numero('Pense em um número entre 1 e 100... já pensei no meu! Tente adivinhar.');
}
function renderGame_numero(msg) {
  const c = document.getElementById('game-container');
  c.innerHTML = `
    <div class="card-title">🔢 Adivinhe o Número</div>
    <div style="text-align:center;font-size:13px;color:var(--text2);margin-bottom:14px">${msg}</div>
    <div style="text-align:center;font-size:12px;color:var(--text3);margin-bottom:10px">Tentativas: ${numTries} · Intervalo atual: ${numMin} a ${numMax}</div>
    <div style="display:flex;gap:8px;justify-content:center">
      <input class="form-input" id="num-input" type="number" min="1" max="100" style="width:120px;text-align:center" onkeydown="if(event.key==='Enter'){numGuess();}">
      <button class="btn btn-primary" onclick="numGuess()">Tentar</button>
      <button class="btn-sm" onclick="initGame_numero()">🔄 Novo Jogo</button>
    </div>`;
}
function numGuess() {
  const input = document.getElementById('num-input');
  const g = parseInt(input.value);
  if (isNaN(g)) return;
  numTries++;
  if (g === numTarget) {
    const cry = Math.max(5, 30 - numTries*2);
    gameReward(cry, 4);
    renderGame_numero(`🎉 Acertou em ${numTries} tentativas! +${cry} Cry`);
  } else if (g < numTarget) {
    numMin = Math.max(numMin, g+1);
    renderGame_numero(`${g} é menor que o número secreto. Tente mais alto!`);
  } else {
    numMax = Math.min(numMax, g-1);
    renderGame_numero(`${g} é maior que o número secreto. Tente mais baixo!`);
  }
}

/* ---------- 9. 2048 ---------- */
let g2048Board, g2048Over, g2048Score, g2048KeyHandler;
function initGame_2048() {
  g2048Board = Array(4).fill(null).map(() => Array(4).fill(0));
  g2048Score = 0; g2048Over = false;
  g2048Spawn(); g2048Spawn();
  renderGame_2048();
  if (g2048KeyHandler) document.removeEventListener('keydown', g2048KeyHandler);
  g2048KeyHandler = (e) => {
    if (currentGame !== '2048') return;
    const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
    if (map[e.key]) { e.preventDefault(); g2048Move(map[e.key]); }
  };
  document.addEventListener('keydown', g2048KeyHandler);
}
function g2048Spawn() {
  const empty = [];
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) if (!g2048Board[r][c]) empty.push([r,c]);
  if (!empty.length) return;
  const [r,c] = empty[Math.floor(Math.random()*empty.length)];
  g2048Board[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function renderGame_2048() {
  const c = document.getElementById('game-container');
  const colors = { 2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e' };
  let html = '';
  for (let r=0;r<4;r++) for (let col=0;col<4;col++) {
    const v = g2048Board[r][col];
    html += `<div class="g2048-tile" style="background:${v?colors[v]||'#3c3a32':''};color:${v>4?'#fff':'#555'}">${v||''}</div>`;
  }
  c.innerHTML = `
    <div class="card-title">🎯 2048 — Pontos: ${g2048Score}</div>
    <div style="text-align:center;font-size:12px;color:var(--text3);margin-bottom:10px">Use as setas do teclado (⬆️⬇️⬅️➡️) para jogar</div>
    <div class="g2048-board">${html}</div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:12px">
      <button class="btn-sm" onclick="g2048Move('up')">⬆️</button>
      <button class="btn-sm" onclick="g2048Move('left')">⬅️</button>
      <button class="btn-sm" onclick="g2048Move('down')">⬇️</button>
      <button class="btn-sm" onclick="g2048Move('right')">➡️</button>
      <button class="btn-sm" onclick="initGame_2048()">🔄</button>
    </div>
    ${g2048Over ? '<div style="text-align:center;margin-top:10px"><span class="badge badge-red">Fim de jogo!</span></div>' : ''}`;
}
function g2048Slide(row) {
  let arr = row.filter(v => v);
  for (let i=0;i<arr.length-1;i++) if (arr[i]===arr[i+1]) { arr[i]*=2; g2048Score += arr[i]; arr.splice(i+1,1); }
  while (arr.length < 4) arr.push(0);
  return arr;
}
function g2048Move(dir) {
  if (g2048Over) return;
  const before = JSON.stringify(g2048Board);
  let b = g2048Board;
  const rotate = (board) => board[0].map((_,i) => board.map(row => row[i]).reverse());
  if (dir === 'left') b = b.map(row => g2048Slide(row));
  else if (dir === 'right') b = b.map(row => g2048Slide(row.slice().reverse()).reverse());
  else if (dir === 'up') { b = rotate(rotate(rotate(b))); b = b.map(row => g2048Slide(row)); b = rotate(b); }
  else if (dir === 'down') { b = rotate(b); b = b.map(row => g2048Slide(row)); b = rotate(rotate(rotate(b))); }
  g2048Board = b;
  if (JSON.stringify(g2048Board) !== before) {
    g2048Spawn();
    const hasMoves = g2048Board.some((row,r) => row.some((v,c) => !v || (c<3&&row[c+1]===v) || (r<3&&g2048Board[r+1][c]===v)));
    if (!hasMoves) { g2048Over = true; gameReward(Math.floor(g2048Score/20), 3); notify('info', `Fim de jogo! Pontuação: ${g2048Score}`); }
  }
  renderGame_2048();
}

/* ---------- 10. SEQUÊNCIA GENIUS (Simon) ---------- */
let simonSeq, simonPlayerStep, simonPlaying, simonBest;
function initGame_simon() {
  simonSeq = []; simonPlayerStep = 0; simonPlaying = false; simonBest = simonBest || 0;
  renderGame_simon();
}
function renderGame_simon() {
  const c = document.getElementById('game-container');
  c.innerHTML = `
    <div class="card-title">🎵 Sequência Genius — Recorde: ${simonBest}</div>
    <div style="text-align:center;font-size:13px;color:var(--text2);margin-bottom:10px">Rodada: ${simonSeq.length}</div>
    <div class="simon-board">
      ${SIMON_COLORS.map((col,i) => `<div class="simon-btn" id="simon-${i}" style="background:${col.c};color:${col.c}" onclick="simonPlayerClick(${i})"></div>`).join('')}
    </div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-primary" onclick="simonStart()" ${simonPlaying?'disabled':''}>${simonSeq.length?'▶️ Próxima Rodada':'▶️ Começar'}</button>
    </div>`;
}
function simonStart() {
  simonSeq.push(Math.floor(Math.random()*4));
  simonPlayerStep = 0;
  simonPlaying = true;
  renderGame_simon();
  simonPlaySequence();
}
async function simonPlaySequence() {
  for (let i = 0; i < simonSeq.length; i++) {
    await new Promise(r => setTimeout(r, 500));
    const btn = document.getElementById('simon-' + simonSeq[i]);
    if (btn) btn.classList.add('lit');
    await new Promise(r => setTimeout(r, 400));
    if (btn) btn.classList.remove('lit');
  }
  simonPlaying = false;
}
function simonPlayerClick(i) {
  if (simonPlaying) return;
  if (i === simonSeq[simonPlayerStep]) {
    simonPlayerStep++;
    if (simonPlayerStep === simonSeq.length) {
      if (simonSeq.length > simonBest) simonBest = simonSeq.length;
      gameReward(simonSeq.length * 3, 2);
      notify('success', `✅ Rodada ${simonSeq.length} completa!`);
      renderGame_simon();
    }
  } else {
    notify('error', `❌ Errou! Sua sequência foi até ${simonSeq.length-1}.`);
    simonSeq = []; simonPlayerStep = 0;
    renderGame_simon();
  }
}

/* ---------- 11. XADREZ (regras simplificadas) ---------- */
let chessBoard, chessTurn, chessSelected, chessOver;
function initGame_xadrez() {
  chessBoard = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖'],
  ];
  chessTurn = 'w'; chessSelected = null; chessOver = false;
  renderGame_xadrez();
}
function chessValidMove(piece, r1, c1, r2, c2) {
  const dr = r2-r1, dc = c2-c1;
  const target = chessBoard[r2][c2];
  const isWhite = chessIsWhite(piece);
  if (target && chessIsWhite(target) === isWhite) return false;
  const type = piece;
  const absdr = Math.abs(dr), absdc = Math.abs(dc);
  const pathClear = () => {
    const stepR = Math.sign(dr), stepC = Math.sign(dc);
    let r = r1+stepR, c = c1+stepC;
    while (r !== r2 || c !== c2) { if (chessBoard[r][c]) return false; r+=stepR; c+=stepC; }
    return true;
  };
  if (type === '♙') { if (dc===0 && !target && (dr===-1 || (r1===6 && dr===-2 && !chessBoard[r1-1][c1]))) return true; if (absdc===1 && dr===-1 && target && chessIsBlack(target)) return true; return false; }
  if (type === '♟') { if (dc===0 && !target && (dr===1 || (r1===1 && dr===2 && !chessBoard[r1+1][c1]))) return true; if (absdc===1 && dr===1 && target && chessIsWhite(target)) return true; return false; }
  if (type === '♖' || type === '♜') return (dr===0 || dc===0) && pathClear();
  if (type === '♗' || type === '♝') return absdr===absdc && pathClear();
  if (type === '♕' || type === '♛') return (dr===0 || dc===0 || absdr===absdc) && pathClear();
  if (type === '♘' || type === '♞') return (absdr===2 && absdc===1) || (absdr===1 && absdc===2);
  if (type === '♔' || type === '♚') return absdr<=1 && absdc<=1;
  return false;
}
function renderGame_xadrez() {
  const c = document.getElementById('game-container');
  let html = '';
  for (let r=0;r<8;r++) for (let col=0;col<8;col++) {
    const isLight = (r+col)%2===0;
    const sel = chessSelected && chessSelected[0]===r && chessSelected[1]===col;
    html += `<div class="chess-cell ${isLight?'light':'dark'} ${sel?'selected':''}" onclick="chessClick(${r},${col})">${chessBoard[r][col]}</div>`;
  }
  c.innerHTML = `
    <div class="card-title">♟️ Xadrez <span style="font-size:11px;color:var(--text3)">(regras simplificadas — sem xeque-mate, roque ou en passant)</span></div>
    <div style="text-align:center;margin-bottom:10px;font-size:13px;color:var(--gold2)">${chessOver ? 'Fim de jogo!' : `Vez das ${chessTurn==='w'?'Brancas':'Pretas'}`}</div>
    <div class="chess-board">${html}</div>
    <div style="text-align:center;margin-top:10px"><button class="btn-sm" onclick="initGame_xadrez()">🔄 Reiniciar</button></div>`;
}
function chessClick(r, c) {
  if (chessOver) return;
  const piece = chessBoard[r][c];
  if (chessSelected) {
    const [r1,c1] = chessSelected;
    const sel = chessBoard[r1][c1];
    if (r1===r && c1===c) { chessSelected = null; renderGame_xadrez(); return; }
    if (chessValidMove(sel, r1, c1, r, c)) {
      const captured = chessBoard[r][c];
      chessBoard[r][c] = sel; chessBoard[r1][c1] = '';
      chessSelected = null;
      if (captured === '♚' || captured === '♔') {
        chessOver = true; renderGame_xadrez();
        gameReward(30, 8); notify('success', `🏆 ${chessTurn==='w'?'Brancas':'Pretas'} venceram capturando o rei!`);
        return;
      }
      chessTurn = chessTurn === 'w' ? 'b' : 'w';
      renderGame_xadrez();
    } else {
      if (piece && ((chessTurn==='w'&&chessIsWhite(piece))||(chessTurn==='b'&&chessIsBlack(piece)))) { chessSelected = [r,c]; renderGame_xadrez(); }
      else { chessSelected = null; renderGame_xadrez(); }
    }
  } else {
    if (piece && ((chessTurn==='w'&&chessIsWhite(piece))||(chessTurn==='b'&&chessIsBlack(piece)))) { chessSelected = [r,c]; renderGame_xadrez(); }
  }
}

/* ---------- 12. DAMAS ---------- */
let checkersBoard, checkersTurn, checkersSelected, checkersOver;
function initGame_damas() {
  checkersBoard = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r=0;r<3;r++) for (let c=0;c<8;c++) if ((r+c)%2===1) checkersBoard[r][c] = { p:2, king:false };
  for (let r=5;r<8;r++) for (let c=0;c<8;c++) if ((r+c)%2===1) checkersBoard[r][c] = { p:1, king:false };
  checkersTurn = 1; checkersSelected = null; checkersOver = false;
  renderGame_damas();
}
function renderGame_damas() {
  const c = document.getElementById('game-container');
  let html = '';
  for (let r=0;r<8;r++) for (let col=0;col<8;col++) {
    const isLight = (r+col)%2===0;
    const piece = checkersBoard[r][col];
    const sel = checkersSelected && checkersSelected[0]===r && checkersSelected[1]===col;
    html += `<div class="checkers-cell ${isLight?'light':'dark'} ${sel?'selected':''}" onclick="checkersClick(${r},${col})">${piece ? `<div class="checkers-piece p${piece.p} ${piece.king?'king':''}"></div>` : ''}</div>`;
  }
  c.innerHTML = `
    <div class="card-title">⚫ Damas</div>
    <div style="text-align:center;margin-bottom:10px;font-size:13px;color:var(--gold2)">${checkersOver ? 'Fim de jogo!' : `Vez do jogador ${checkersTurn} ${checkersTurn===1?'🔴':'⚪'}`}</div>
    <div class="checkers-board">${html}</div>
    <div style="text-align:center;margin-top:10px"><button class="btn-sm" onclick="initGame_damas()">🔄 Reiniciar</button></div>`;
}
function checkersValidMove(piece, r1, c1, r2, c2) {
  if (checkersBoard[r2][c2]) return null;
  const dr = r2-r1, dc = c2-c1;
  if (Math.abs(dc) !== Math.abs(dr)) return null;
  const dir = piece.p === 1 ? -1 : 1;
  if (Math.abs(dr) === 1 && (piece.king || dr === dir)) return { capture:null };
  if (Math.abs(dr) === 2 && (piece.king || dr === dir*2)) {
    const midR = r1 + dr/2, midC = c1 + dc/2;
    const mid = checkersBoard[midR][midC];
    if (mid && mid.p !== piece.p) return { capture:[midR,midC] };
  }
  return null;
}
function checkersClick(r, c) {
  if (checkersOver) return;
  const piece = checkersBoard[r][c];
  if (checkersSelected) {
    const [r1,c1] = checkersSelected;
    const sel = checkersBoard[r1][c1];
    if (r1===r && c1===c) { checkersSelected = null; renderGame_damas(); return; }
    const move = checkersValidMove(sel, r1, c1, r, c);
    if (move) {
      checkersBoard[r][c] = sel; checkersBoard[r1][c1] = null;
      if (move.capture) checkersBoard[move.capture[0]][move.capture[1]] = null;
      if ((sel.p===1 && r===0) || (sel.p===2 && r===7)) sel.king = true;
      checkersSelected = null;
      const oppPieces = checkersBoard.flat().filter(p => p && p.p !== sel.p);
      if (!oppPieces.length) {
        checkersOver = true; renderGame_damas();
        gameReward(25, 7); notify('success', `🏆 Jogador ${sel.p} venceu!`);
        return;
      }
      checkersTurn = checkersTurn === 1 ? 2 : 1;
      renderGame_damas();
    } else {
      if (piece && piece.p === checkersTurn) { checkersSelected = [r,c]; renderGame_damas(); }
      else { checkersSelected = null; renderGame_damas(); }
    }
  } else {
    if (piece && piece.p === checkersTurn) { checkersSelected = [r,c]; renderGame_damas(); }
  }
}

/* ---------- 13. ROLAR DADOS ---------- */
let diceCount = 2;
function initGame_dados() { renderGame_dados(); }
function renderGame_dados() {
  const c = document.getElementById('game-container');
  let diceHtml = '';
  for (let i = 0; i < diceCount; i++) diceHtml += createDiceElement('dice-solo-' + i);
  c.innerHTML = `
    <div class="card-title">🎲 Rolar Dados</div>
    <div style="text-align:center;font-size:12px;color:var(--text2);margin-bottom:14px">Escolha quantos dados de 6 lados rolar e clique em rolar.</div>
    <div class="game-mode-bar" style="justify-content:center">
      ${[1,2,3,4].map(n => `<button class="btn-sm ${diceCount===n?'btn-primary':''}" onclick="diceSetCount(${n})">${n} dado${n>1?'s':''}</button>`).join('')}
    </div>
    <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin:20px 0">${diceHtml}</div>
    <div id="dice-solo-result" style="text-align:center;font-size:20px;color:var(--gold2);font-family:'Cinzel',serif;min-height:28px"></div>
    <div style="text-align:center;margin-top:14px"><button class="btn btn-primary" onclick="diceRollSolo()">🎲 Rolar!</button></div>`;
}
function diceSetCount(n) { diceCount = n; renderGame_dados(); }
async function diceRollSolo() {
  const promises = [];
  for (let i = 0; i < diceCount; i++) promises.push(rollDiceVisual('dice-solo-' + i));
  const results = await Promise.all(promises);
  const sum = results.reduce((a,b) => a+b, 0);
  document.getElementById('dice-solo-result').textContent = `Resultado: ${results.join(' + ')} = ${sum}`;
}

// ══════════════════════════════════════════
//   IA COMPANHEIRA (personalidade configurável + chat via Gemini)
// ══════════════════════════════════════════
// Chaves da Groq (API compatível com OpenAI, modelos Llama) já embutidas —
// não pedimos mais chave do usuário. Ficam num pool: se uma bater no
// limite de uso, a conversa troca sozinha pra próxima automaticamente.
// A IA agora roda por trás de uma Supabase Edge Function (ai-chat) —
// as chaves da Groq não ficam mais expostas no navegador.

function renderAiCompanion() {
  const avatarHolder = document.getElementById('ai-cfg-avatars');
  if (avatarHolder && !avatarHolder.dataset.built) {
    avatarHolder.innerHTML = AVATARS.map(a => `<div onclick="selectAiAvatar('${a}')" id="ai-av-${a}" style="text-align:center;font-size:18px;cursor:pointer;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg3)">${a}</div>`).join('');
    avatarHolder.dataset.built = '1';
  }

  const cfg = G.aiCompanion;
  if (cfg) {
    document.getElementById('ai-cfg-name').value = cfg.name || '';
    document.getElementById('ai-cfg-age').value = cfg.age || '';
    document.getElementById('ai-cfg-gender').value = cfg.gender || 'Feminino';
    document.getElementById('ai-cfg-personality').value = cfg.personality || '';
    document.getElementById('ai-cfg-info').value = cfg.info || '';
    G._tempAiAvatar = cfg.avatar || AVATARS[0];
    highlightAiAvatar(G._tempAiAvatar);
  } else {
    G._tempAiAvatar = AVATARS[0];
    highlightAiAvatar(G._tempAiAvatar);
  }

  if (cfg && cfg.name) {
    document.getElementById('ai-setup-card').style.display = 'none';
    document.getElementById('ai-chat-card').style.display = 'block';
    document.getElementById('ai-chat-avatar').textContent = cfg.avatar || '🤖';
    document.getElementById('ai-chat-name').textContent = cfg.name;
    document.getElementById('ai-chat-subtitle').textContent = `${cfg.age ? cfg.age + ' anos · ' : ''}${cfg.gender || ''}`;
    renderAiChatMessages();
  } else {
    document.getElementById('ai-setup-card').style.display = 'block';
    document.getElementById('ai-chat-card').style.display = 'none';
  }
}

function selectAiAvatar(a) { G._tempAiAvatar = a; highlightAiAvatar(a); }
function highlightAiAvatar(a) {
  AVATARS.forEach(x => { const el = document.getElementById('ai-av-' + x); if (el) el.style.borderColor = (x === a) ? 'var(--gold)' : 'var(--border)'; });
}

function switchAiTab(tab) {
  if (tab === 'config') {
    document.getElementById('ai-setup-card').style.display = 'block';
    document.getElementById('ai-chat-card').style.display = 'none';
  } else {
    document.getElementById('ai-setup-card').style.display = 'none';
    document.getElementById('ai-chat-card').style.display = 'block';
  }
}

function saveAiCompanionConfig() {
  const name = document.getElementById('ai-cfg-name').value.trim();
  if (!name) return notify('error', 'Dê um nome para sua IA.');
  const age = document.getElementById('ai-cfg-age').value.trim();
  const gender = document.getElementById('ai-cfg-gender').value;
  const personality = document.getElementById('ai-cfg-personality').value.trim();
  const info = document.getElementById('ai-cfg-info').value.trim();
  G.aiCompanion = { name, age, gender, personality, info, avatar: G._tempAiAvatar || AVATARS[0] };
  saveGame();
  notify('success', `${G.aiCompanion.avatar} ${name} está pronta pra conversar!`);
  renderAiCompanion();
  switchAiTab('chat');
}

function buildAiSystemPrompt() {
  const cfg = G.aiCompanion || {};
  return `Você é ${cfg.name || 'uma IA'}${cfg.age ? `, ${cfg.age} anos` : ''}${cfg.gender ? `, gênero ${cfg.gender}` : ''}.
Personalidade que você deve seguir sempre: ${cfg.personality || 'amigável, curiosa e prestativa'}.
Informações e histórico sobre você (use quando fizer sentido): ${cfg.info || 'nenhuma informação adicional'}.
Você está conversando com ${G.name || 'o jogador'}, um aventureiro do reino de Crydan.
Regras: converse sempre em português do Brasil, de forma natural, coerente com sua personalidade. Respostas curtas a médias (poucas frases), como uma conversa real, não uma redação. Nunca diga que é um modelo de linguagem ou IA genérica — assuma completamente a persona configurada.`;
}

function renderAiChatMessages() {
  const el = document.getElementById('ai-chat-messages');
  if (!el) return;
  const cfg = G.aiCompanion || {};
  const history = G.aiChatHistory || [];
  if (!history.length) {
    el.innerHTML = `<div class="chat-empty">Diga oi para ${escapeHtml(cfg.name || 'sua IA')}! 👋</div>`;
    return;
  }
  el.innerHTML = history.map(m => `
    <div class="msg-row ${m.role === 'user' ? 'own' : ''}">
      ${m.role !== 'user' ? `<div class="msg-author">${escapeHtml(cfg.avatar || '🤖')} ${escapeHtml(cfg.name || 'IA')}</div>` : ''}
      <div class="msg-bubble">${escapeHtml(m.text)}</div>
      <div class="msg-meta">${fmtTime(m.ts)}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

async function clearAiChatHistory() {
  if (!await confirmDialog('Apagar todo o histórico dessa conversa?', { danger: true })) return;
  G.aiChatHistory = [];
  saveGame();
  renderAiChatMessages();
}

// Trava simples pra impedir duplo-envio enquanto a IA ainda está
// respondendo. Antes essa variável era usada em sendAiMessage() sem
// nunca ter sido declarada em lugar nenhum — isso jogava um
// "ReferenceError: aiChatBusy is not defined" logo na primeira linha
// da função, e a mensagem nunca chegava a ser enviada.
let aiChatBusy = false;

async function sendAiMessage() {
  if (aiChatBusy) return;
  const input = document.getElementById('ai-chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!G.aiCompanion || !G.aiCompanion.name) return notify('error', 'Configure sua IA primeiro.');

  G.aiChatHistory = G.aiChatHistory || [];
  G.aiChatHistory.push({ role: 'user', text, ts: Date.now() });
  input.value = '';
  saveGame();
  renderAiChatMessages();

  aiChatBusy = true;
  const el = document.getElementById('ai-chat-messages');
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'chat-empty';
  thinkingEl.id = 'ai-thinking-indicator';
  thinkingEl.textContent = `${G.aiCompanion.avatar || '🤖'} ${G.aiCompanion.name} está digitando...`;
  el.appendChild(thinkingEl);
  el.scrollTop = el.scrollHeight;

  const groqMessages = [
    { role: 'system', content: buildAiSystemPrompt() },
    ...G.aiChatHistory.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
  ];

  // A chamada agora vai pra uma Edge Function do Supabase, que guarda as
  // chaves da Groq no servidor — o navegador nunca vê nenhuma chave.
  // Quando a função responde com erro (ex.: chaves Groq sem cota), o
  // cliente Supabase só dá um erro genérico "non-2xx status code" — o
  // motivo real vem no corpo da resposta (error.context), que é o que
  // lemos abaixo pra mostrar a mensagem verdadeira em vez da genérica.
  let reply = null, lastErrMsg = null;
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages: groqMessages } });
    if (error) {
      if (error.context && typeof error.context.json === 'function') {
        try {
          const body = await error.context.json();
          lastErrMsg = body?.error || error.message;
        } catch { lastErrMsg = error.message; }
      } else {
        lastErrMsg = error.message;
      }
    } else if (data && data.error) {
      lastErrMsg = data.error;
    } else {
      reply = data && data.reply;
    }
  } catch (e) {
    lastErrMsg = e.message;
  }

  const think = document.getElementById('ai-thinking-indicator');
  if (think) think.remove();

  if (!reply) {
    notify('error', `Erro na IA${lastErrMsg ? ': ' + lastErrMsg : ''}. Tente de novo em instantes.`);
    aiChatBusy = false;
    return;
  }

  G.aiChatHistory.push({ role: 'model', text: reply, ts: Date.now() });
  if (G.aiChatHistory.length > 60) G.aiChatHistory = G.aiChatHistory.slice(-60);
  saveGame();
  renderAiChatMessages();
  aiChatBusy = false;
}

// ══════════════════════════════════════════
//   PUBLICAÇÕES (feed de posts dos jogadores)
// ══════════════════════════════════════════
let pendingPostImage = null;
let pendingPostVideo = null; // File object (não base64 — vídeo vai pro Storage, não pro banco direto)

// ── Publicações (feed) — agora usa tabelas reais compartilhadas ────
// Antes, G.posts só existia dentro do SEU save (privado) — por isso
// suas publicações nunca apareciam pra mais ninguém. Requer o
// arquivo posts-setup.sql já executado no Supabase.
let postsCache = [];
let postLikesCache = {}; // { postId: Set(userId) }
let postCommentsCountCache = {}; // { postId: number }
let _openCommentsPostId = null;
let _lastProfById = {};

function renderPublicacoes() {
  const avEl = document.getElementById('post-compose-avatar');
  if (avEl) avEl.innerHTML = G.avatarPhoto ? `<img src="${G.avatarPhoto}" alt="Seu avatar">` : (G.avatar || '⚔️');
  loadPostsFeed();
}

// Botão único "Foto ou Vídeo" (estilo Instagram): o mesmo seletor serve
// pra tirar foto na hora (câmera, em celular) ou escolher da galeria —
// o navegador decide isso nativamente. Aqui só detectamos o tipo do
// arquivo escolhido e chamamos o tratamento certo.
function handlePostMediaSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) return handlePostImageSelect(e);
  if (file.type.startsWith('video/')) return handlePostVideoSelect(e);
  notify('error', 'Selecione uma foto ou um vídeo.');
  e.target.value = '';
}
function handlePostImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('error', 'Selecione um arquivo de imagem.'); e.target.value = ''; return; }
  if (file.size > 2 * 1024 * 1024) { notify('error', 'Imagem muito grande (máx. 2MB).'); e.target.value = ''; return; }
  clearPostVideo();
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingPostImage = ev.target.result;
    document.getElementById('post-image-preview').innerHTML = `<img src="${pendingPostImage}" style="max-height:180px;border-radius:8px;margin-top:6px;display:block" alt="Prévia da imagem da publicação">`;
    document.getElementById('post-image-clear').style.display = 'inline-block';
  };
  reader.onerror = () => notify('error', 'Não foi possível ler a imagem.');
  reader.readAsDataURL(file);
  e.target.value = '';
}

function clearPostImage() {
  pendingPostImage = null;
  const prev = document.getElementById('post-image-preview');
  if (prev) prev.innerHTML = '';
  const btn = document.getElementById('post-image-clear');
  if (btn) btn.style.display = 'none';
}

// Vídeo é grande demais pra guardar como texto/base64 no banco (igual a
// foto) — por isso só valida e guarda o arquivo aqui; o envio de verdade
// pro Supabase Storage acontece em createPost(), na hora de publicar.
function handlePostVideoSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { notify('error', 'Selecione um arquivo de vídeo.'); e.target.value = ''; return; }
  if (file.size > 50 * 1024 * 1024) { notify('error', 'Vídeo muito grande (máx. 50MB).'); e.target.value = ''; return; }
  clearPostImage();
  pendingPostVideo = file;
  const url = URL.createObjectURL(file);
  document.getElementById('post-video-preview').innerHTML = `<video src="${url}" controls style="max-height:220px;border-radius:8px;margin-top:6px;display:block;max-width:100%"></video>`;
  document.getElementById('post-video-clear').style.display = 'inline-block';
  e.target.value = '';
}

function clearPostVideo() {
  pendingPostVideo = null;
  const prev = document.getElementById('post-video-preview');
  if (prev) prev.innerHTML = '';
  const btn = document.getElementById('post-video-clear');
  if (btn) btn.style.display = 'none';
}

async function createPost() {
  const textEl = document.getElementById('post-text');
  const text = textEl.value.trim();
  if (!text && !pendingPostImage && !pendingPostVideo) return notify('error', 'Escreva algo, ou adicione uma foto ou vídeo antes de publicar.');
  const me = myId();
  if (!me) return notify('error', 'Você precisa estar logado.');
  const btn = document.getElementById('post-publish-btn');
  if (btn) btn.classList.add('is-loading');
  try {
    let videoUrl = '';
    if (pendingPostVideo) {
      const ext = (pendingPostVideo.name.split('.').pop() || 'mp4').toLowerCase();
      const path = `${me}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('post-media').upload(path, pendingPostVideo, {
        contentType: pendingPostVideo.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('post-media').getPublicUrl(path);
      videoUrl = pub.publicUrl;
    }
    const { error } = await supabase.from('posts').insert([{ author_id: me, text, image: pendingPostImage || '', video: videoUrl }]);
    if (error) throw error;
    clearPostImage();
    clearPostVideo();
    textEl.value = '';
    addToFeed(`📰 Nova publicação de ${G.name}`);
    notify('success', '📤 Publicado! Já está visível para todos.');
    await loadPostsFeed();
  } catch (e) {
    console.error('Erro ao publicar', e);
    if ((e.message || '').includes('relation "public.posts" does not exist')) {
      notify('error', 'O sistema de publicações ainda não foi configurado no banco (rode posts-setup.sql no Supabase).');
    } else if ((e.message || '').toLowerCase().includes('bucket not found')) {
      notify('error', 'Upload de vídeo ainda não foi configurado no banco.');
    } else {
      notify('error', 'Não foi possível publicar: ' + (e.message || 'erro desconhecido'));
    }
  } finally {
    if (btn) btn.classList.remove('is-loading');
  }
}

async function loadPostsFeed() {
  const el = document.getElementById('posts-feed');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--text3);padding:24px">Carregando publicações...</div>';
  try {
    const { data: posts, error } = await supabase.from('posts')
      .select('id, author_id, text, image, video, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    postsCache = posts || [];

    const authorIds = [...new Set(postsCache.map(p => p.author_id))];
    const { data: profs } = authorIds.length
      ? await supabase.from('profiles').select('id,name,avatar,avatar_photo,username').in('id', authorIds)
      : { data: [] };
    const profById = {};
    (profs || []).forEach(p => profById[p.id] = p);
    const tagsById = await fetchGuildTagsForUsers(authorIds);
    authorIds.forEach(id => { if (profById[id] && tagsById[id]) profById[id].guildTag = tagsById[id]; });

    const postIds = postsCache.map(p => p.id);
    postLikesCache = {};
    postCommentsCountCache = {};
    if (postIds.length) {
      const { data: likes } = await supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds);
      (likes || []).forEach(l => {
        if (!postLikesCache[l.post_id]) postLikesCache[l.post_id] = new Set();
        postLikesCache[l.post_id].add(l.user_id);
      });
      const { data: comments } = await supabase.from('post_comments').select('post_id').in('post_id', postIds);
      (comments || []).forEach(c => { postCommentsCountCache[c.post_id] = (postCommentsCountCache[c.post_id] || 0) + 1; });
    }
    renderPostsFeed(profById);
    _lastProfById = profById;
  } catch (e) {
    console.error('Erro ao carregar publicações', e);
    if ((e.message || '').includes('relation "public.posts" does not exist')) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚙️</div><div class="empty-title">Publicações ainda não configuradas</div><div class="empty-sub">Rode o arquivo posts-setup.sql no SQL Editor do Supabase para ativar o feed compartilhado.</div></div>`;
    } else {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-sub">Não foi possível carregar as publicações agora.</div></div>`;
    }
  }
}

function renderPostsFeed(profById) {
  const el = document.getElementById('posts-feed');
  if (!el) return;
  const me = myId();
  if (!postsCache.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">Nenhuma publicação ainda</div><div class="empty-sub">Seja o primeiro a postar algo para a comunidade Crydan!</div></div>`;
    return;
  }
  el.innerHTML = postsCache.map(p => {
    const author = (profById && profById[p.author_id]) || {};
    const likeSet = postLikesCache[p.id] || new Set();
    const liked = me && likeSet.has(me);
    return `<div class="card post-card">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <div class="user-avatar" style="width:36px;height:36px;font-size:15px;cursor:pointer" onclick="openPublicProfile(${JSON.stringify(author.username || author.name || '').replace(/"/g, '&quot;')})">${author.avatar_photo ? `<img src="${author.avatar_photo}" alt="">` : (author.avatar || '⚔️')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--text);font-weight:600;cursor:pointer" onclick="openPublicProfile(${JSON.stringify(author.username || author.name || '').replace(/"/g, '&quot;')})">${escapeHtml(author.name || 'Aventureiro')}${author.guildTag ? ` <span style="color:var(--text3);font-weight:400;font-size:11px;cursor:pointer" onclick="event.stopPropagation();openGuildProfileByTag('${author.guildTag}')">【${escapeHtml(author.guildTag)}】</span>` : ''}</div>
          <div style="font-size:11px;color:var(--text3)">${fmtTime(new Date(p.created_at).getTime())}</div>
        </div>
        ${p.author_id === me ? `<span class="post-del-btn" role="button" tabindex="0" onclick="deletePost('${p.id}')" title="Excluir publicação" aria-label="Excluir publicação">✕</span>` : ''}
      </div>
      ${p.text ? `<div style="font-size:14px;color:var(--text);margin-bottom:8px;white-space:pre-wrap;line-height:1.45">${escapeHtml(p.text)}</div>` : ''}
      ${p.image ? `<img src="${safeMediaUrl(p.image)}" style="max-width:100%;border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="window.open('${safeMediaUrl(p.image)}','_blank')" alt="Imagem da publicação">` : ''}
      ${p.video ? `<video src="${safeMediaUrl(p.video)}" controls preload="metadata" style="max-width:100%;border-radius:8px;margin-bottom:8px;display:block"></video>` : ''}
      <div class="post-divider"></div>
      <div class="post-actions">
        <span class="post-like-btn" role="button" tabindex="0" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? 'Descurtir' : 'Curtir'}" data-post="${p.id}" onclick="toggleLikePost('${p.id}')" style="color:${liked?'var(--red)':'var(--text3)'}">${liked ? '❤️' : '🤍'}</span>
        <span style="font-size:12px;color:var(--text3)">${likeSet.size}</span>
        <span class="post-like-btn" role="button" tabindex="0" onclick="toggleCommentsBox('${p.id}')" title="Comentar" aria-label="Comentar" style="margin-left:14px">💬</span>
        <span style="font-size:12px;color:var(--text3)">${postCommentsCountCache[p.id] || 0}</span>
        <span class="post-like-btn" role="button" tabindex="0" onclick="openSharePostModal('${p.id}')" title="Enviar para alguém" aria-label="Enviar para alguém" style="margin-left:14px">📤</span>
      </div>
      <div id="post-comments-${p.id}" style="display:none;margin-top:10px"></div>
    </div>`;
  }).join('');
}

// ── Comentários ──
async function toggleCommentsBox(postId) {
  const box = document.getElementById('post-comments-' + postId);
  if (!box) return;
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  // fecha qualquer outro comentário aberto, só um por vez fica limpo na tela
  if (_openCommentsPostId && _openCommentsPostId !== postId) {
    const prev = document.getElementById('post-comments-' + _openCommentsPostId);
    if (prev) prev.style.display = 'none';
  }
  _openCommentsPostId = postId;
  box.style.display = 'block';
  box.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:8px 0">Carregando comentários...</div>`;
  await renderCommentsBox(postId);
}
async function renderCommentsBox(postId) {
  const box = document.getElementById('post-comments-' + postId);
  if (!box) return;
  const me = myId();
  try {
    const { data, error } = await supabase.from('post_comments').select('id,author_id,text,created_at').eq('post_id', postId).order('created_at', { ascending: true });
    if (error) throw error;
    const authorIds = [...new Set((data || []).map(c => c.author_id))];
    await ensureProfilesCached(authorIds);
    const list = (data || []).map(c => {
      const author = _chatProfileCache[c.author_id] || {};
      const canDelete = c.author_id === me;
      return `<div style="display:flex;gap:8px;padding:6px 0">
        <div class="user-avatar" style="width:26px;height:26px;font-size:11px;flex-shrink:0;cursor:pointer" onclick="openPublicProfileById('${c.author_id}')">${author.avatar_photo ? `<img src="${author.avatar_photo}" alt="">` : (author.avatar || '⚔️')}</div>
        <div style="flex:1;min-width:0">
          <div style="background:var(--bg3);border-radius:10px;padding:6px 10px;font-size:12.5px">
            <span style="color:var(--gold2);font-weight:600;cursor:pointer" onclick="openPublicProfileById('${c.author_id}')">${escapeHtml(author.name || 'Aventureiro')}</span>
            <span style="color:var(--text2)"> ${escapeHtml(c.text)}</span>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;display:flex;gap:8px">
            <span>${fmtTime(new Date(c.created_at).getTime())}</span>
            ${canDelete ? `<span style="cursor:pointer" onclick="deletePostComment('${c.id}','${postId}')">Apagar</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('') || `<div style="color:var(--text3);font-size:12px;padding:6px 0">Nenhum comentário ainda — seja o primeiro!</div>`;

    box.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:8px">${list}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <input class="form-input" id="comment-input-${postId}" placeholder="Escreva um comentário..." style="flex:1;font-size:12.5px" onkeydown="if(event.key==='Enter'){submitPostComment('${postId}')}">
        <button class="btn-sm btn-primary" onclick="submitPostComment('${postId}')">Enviar</button>
      </div>`;
  } catch (e) { box.innerHTML = `<div style="color:var(--red);font-size:12px;padding:6px 0">Não foi possível carregar os comentários.</div>`; }
}
async function submitPostComment(postId) {
  const input = document.getElementById('comment-input-' + postId);
  const text = input?.value.trim();
  if (!text) return;
  const me = myId();
  if (!me) return;
  try {
    const { error } = await supabase.from('post_comments').insert([{ post_id: postId, author_id: me, text }]);
    if (error) throw error;
    input.value = '';
    postCommentsCountCache[postId] = (postCommentsCountCache[postId] || 0) + 1;
    await renderCommentsBox(postId);
  } catch (e) { notify('error', 'Não foi possível comentar: ' + (e.message || 'erro')); }
}
async function deletePostComment(commentId, postId) {
  const ok = await confirmDialog('Apagar este comentário?', { danger: true, confirmText: 'Apagar' });
  if (!ok) return;
  try {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) throw error;
    postCommentsCountCache[postId] = Math.max(0, (postCommentsCountCache[postId] || 1) - 1);
    await renderCommentsBox(postId);
  } catch (e) { notify('error', 'Não foi possível apagar: ' + (e.message || 'erro')); }
}

// ── Enviar publicação pra alguém (DM) ──
function openSharePostModal(postId) {
  const post = postsCache.find(p => p.id === postId);
  if (!post) return;
  const dmChats = (G.chats || []).filter(c => c.friendId);
  if (!dmChats.length) return notify('error', 'Você ainda não tem nenhuma DM pra enviar.');
  showModal('Enviar publicação', `
    <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
      ${dmChats.map(c => `<button class="btn" style="text-align:left" onclick="doSharePost('${postId}','${c.friendId}')">${initialsOf(c.name)} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
  `);
}
async function doSharePost(postId, toFriendId) {
  const post = postsCache.find(p => p.id === postId);
  if (!post) return;
  const author = (_lastProfById && _lastProfById[post.author_id]) || {};
  const preview = post.text ? post.text.slice(0, 140) : (post.image ? '📷 Foto' : '📎 Publicação');
  const text = `📰 Publicação de ${author.name || 'um aventureiro'}: "${preview}"`;
  try {
    const me = myId();
    const { error } = await supabase.from('messages').insert([{ from_id: me, to_id: toFriendId, text, image_url: post.image || null }]);
    if (error) throw error;
    closeModalDirect();
    notify('success', 'Publicação enviada!');
    const c = G.chats.find(x => x.friendId === toFriendId);
    if (c) await loadFriendMessages(c);
  } catch (e) { notify('error', 'Não foi possível enviar: ' + (e.message || 'erro')); }
}

async function toggleLikePost(id) {
  const me = myId();
  if (!me) return;
  const liking = !likeSet.has(me);
  // otimista: atualiza a tela na hora, sem esperar a rede
  if (liking) likeSet.add(me); else likeSet.delete(me);
  renderPostsFeed(_lastProfById);
  uiSound(liking ? 'success' : 'info');
  try {
    if (liking) {
      const { error } = await supabase.from('post_likes').insert([{ post_id: id, user_id: me }]);
      if (error && error.code !== '23505') throw error;
    } else {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', me);
      if (error) throw error;
    }
  } catch (e) {
    console.error('Erro ao curtir publicação', e);
    // desfaz a atualização otimista se a rede falhar
    if (liking) likeSet.delete(me); else likeSet.add(me);
    renderPostsFeed(_lastProfById);
    notify('error', 'Não foi possível registrar a curtida agora.');
  }
}

async function deletePost(id) {
  if (!await confirmDialog('Excluir esta publicação?', { danger: true })) return;
  try {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
    postsCache = postsCache.filter(p => p.id !== id);
    renderPostsFeed(_lastProfById);
    notify('success', 'Publicação excluída.');
  } catch (e) {
    console.error('Erro ao excluir publicação', e);
    notify('error', 'Não foi possível excluir agora.');
  }
}

// ══════════════════════════════════════════
//   MÚSICAS (busca via YouTube Data API + player embutido no app)
// ══════════════════════════════════════════
let ytPlayer = null;
let ytApiReady = false;
let ytApiLoading = false;
let musicTab = 'search';
let musicSearchResults = [];
let currentSong = null;

// Chaves da YouTube Data API v3 já embutidas no projeto (não pedimos mais
// chave do usuário). Ficam num pool porque a cota gratuita é por chave —
// se uma bater no limite do dia, a busca troca sozinha pra próxima.
// A busca de música agora roda por trás de uma Supabase Edge Function
// (music-search) — as chaves do YouTube não ficam mais expostas no navegador.

function loadYoutubeIframeApi(cb) {
  if (ytApiReady && window.YT && window.YT.Player) { cb(); return; }
  window._ytApiCallbacks = window._ytApiCallbacks || [];
  window._ytApiCallbacks.push(cb);
  if (ytApiLoading) return;
  ytApiLoading = true;
  window.onYouTubeIframeAPIReady = function() {
    ytApiReady = true;
    (window._ytApiCallbacks || []).forEach(f => f());
    window._ytApiCallbacks = [];
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function ensureYtPlayer(videoId, cb) {
  loadYoutubeIframeApi(() => {
    if (!ytPlayer) {
      ytPlayer = new YT.Player('yt-player', {
        height: '44', width: '64', videoId,
        playerVars: { autoplay: 1, controls: 0, rel: 0 },
        events: {
          onReady: (e) => {
            e.target.unMute();
            e.target.setVolume(100);
            e.target.playVideo();
            cb && cb();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) setPlayPauseIcon(true);
            if (e.data === YT.PlayerState.PAUSED) setPlayPauseIcon(false);
            if (e.data === YT.PlayerState.ENDED) setPlayPauseIcon(false);
          }
        }
      });
    } else {
      ytPlayer.loadVideoById(videoId);
      ytPlayer.unMute();
      ytPlayer.setVolume(100);
      ytPlayer.playVideo();
      cb && cb();
    }
  });
}

function renderMusicPanel() {
  const setupCard = document.getElementById('music-setup-card');
  if (setupCard) setupCard.style.display = 'none';
  renderMusicResults();
}

function switchMusicTab(tab) {
  musicTab = tab;
  const st = document.getElementById('music-tab-search');
  const ft = document.getElementById('music-tab-fav');
  if (st) st.classList.toggle('active', tab === 'search');
  if (ft) ft.classList.toggle('active', tab === 'fav');
  renderMusicResults();
}

async function searchMusic() {
  const input = document.getElementById('music-search-input');
  const q = input ? input.value.trim() : '';
  if (!q) return;
  switchMusicTab('search');
  const results = document.getElementById('music-results');
  results.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">🔎 Buscando...</div>';
  // A chamada agora vai pra uma Edge Function do Supabase, que guarda as
  // chaves do YouTube no servidor — o navegador nunca vê nenhuma chave.
  try {
    const { data, error } = await supabase.functions.invoke('music-search', { body: { q } });
    if (error) throw error;
    if (data && data.error) {
      results.innerHTML = `<div style="color:var(--red);padding:14px;text-align:center">Erro na busca: ${escapeHtml(data.error)}</div>`;
      return;
    }
    musicSearchResults = data && data.items ? data.items : [];
    renderMusicResults();
  } catch (e) {
    results.innerHTML = `<div style="color:var(--red);padding:14px;text-align:center">Não foi possível buscar agora: ${escapeHtml(e.message || 'erro desconhecido')}</div>`;
  }
}

function renderMusicResults() {
  const el = document.getElementById('music-results');
  if (!el) return;
  const list = musicTab === 'fav' ? (G.favoriteSongs || []) : musicSearchResults;
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">${musicTab==='fav' ? 'Você ainda não curtiu nenhuma música.<br>Busque uma música e clique no 🤍!' : 'Busque uma música, artista ou banda ali em cima para começar.'}</div>`;
    return;
  }
  el.innerHTML = list.map(song => {
    const isFav = (G.favoriteSongs || []).some(s => s.id === song.id);
    return `<div class="music-result-item" style="display:flex;align-items:center;gap:12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px">
      <img src="${song.thumb}" style="width:64px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0" alt="Capa da música">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(song.title)}</div>
        <div style="font-size:11px;color:var(--text3)">${escapeHtml(song.channel)}</div>
      </div>
      <button class="call-icon-btn" style="width:38px;height:38px;font-size:15px" onclick="playSongById('${song.id}')" title="Tocar">▶️</button>
      <button class="call-icon-btn ${isFav?'active-off':''}" style="width:38px;height:38px;font-size:15px" onclick="toggleFavoriteSong('${song.id}')" title="Curtir">${isFav?'❤️':'🤍'}</button>
    </div>`;
  }).join('');
}

function playSongById(id) {
  const song = musicSearchResults.find(s => s.id === id) || (G.favoriteSongs || []).find(s => s.id === id);
  if (!song) return;
  playSong(song);
}

function playSong(song) {
  currentSong = song;
  document.body.classList.add('music-playing');
  document.getElementById('music-player-bar').style.display = 'flex';
  document.getElementById('mp-title').textContent = song.title;
  document.getElementById('mp-channel').textContent = song.channel;
  ensureYtPlayer(song.id, () => setPlayPauseIcon(true));
  updateMpLikeIcon();
}

function setPlayPauseIcon(playing) {
  const btn = document.getElementById('mp-playpause');
  if (btn) btn.textContent = playing ? '⏸️' : '▶️';
}

function toggleMusicPlayPause() {
  if (!ytPlayer || !ytPlayer.getPlayerState) return;
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) { ytPlayer.pauseVideo(); setPlayPauseIcon(false); }
  else { ytPlayer.playVideo(); setPlayPauseIcon(true); }
}

function setMusicVolume(val) {
  if (ytPlayer && ytPlayer.setVolume) {
    ytPlayer.setVolume(val);
    if (val > 0 && ytPlayer.isMuted && ytPlayer.isMuted()) ytPlayer.unMute();
    const btn = document.getElementById('mp-mute');
    if (btn) btn.textContent = val == 0 ? '🔇' : '🔊';
  }
}
function toggleMusicMute() {
  if (!ytPlayer || !ytPlayer.isMuted) return;
  const btn = document.getElementById('mp-mute');
  const slider = document.getElementById('mp-volume');
  if (ytPlayer.isMuted()) { ytPlayer.unMute(); ytPlayer.setVolume(slider ? slider.value || 100 : 100); if (btn) btn.textContent = '🔊'; }
  else { ytPlayer.mute(); if (btn) btn.textContent = '🔇'; }
}

function toggleFavoriteCurrentSong() {
  if (!currentSong) return;
  toggleFavoriteSong(currentSong.id);
}

function toggleFavoriteSong(id) {
  G.favoriteSongs = G.favoriteSongs || [];
  const idx = G.favoriteSongs.findIndex(s => s.id === id);
  if (idx >= 0) {
    G.favoriteSongs.splice(idx, 1);
    notify('info', '💔 Removida das Minhas Músicas.');
  } else {
    const song = musicSearchResults.find(s => s.id === id) || (currentSong && currentSong.id === id ? currentSong : null);
    if (song) { G.favoriteSongs.push(song); notify('success', '❤️ Adicionada às Minhas Músicas!'); }
  }
  saveGame();
  renderMusicResults();
  updateMpLikeIcon();
}

function updateMpLikeIcon() {
  const btn = document.getElementById('mp-like');
  if (!btn || !currentSong) return;
  const isFav = (G.favoriteSongs || []).some(s => s.id === currentSong.id);
  btn.textContent = isFav ? '❤️' : '🤍';
}

function closeMusicPlayer() {
  if (ytPlayer && ytPlayer.stopVideo) { try { ytPlayer.stopVideo(); } catch (e) {} }
  document.getElementById('music-player-bar').style.display = 'none';
  document.body.classList.remove('music-playing');
  currentSong = null;
}

// ── FEED ───────────────────────────────────
function addToFeed(msg) {
  G.activityFeed = G.activityFeed || [];
  G.activityFeed.push(msg);
  if (G.activityFeed.length > 30) G.activityFeed = G.activityFeed.slice(-30);
  sysLog(msg);
  renderActivityRail();
}

function toggleActivityRail() {
  document.getElementById('activity-rail').classList.toggle('open');
}
function activityIconFor(text) {
  if (text.includes('⚔️') || text.includes('Derrotou')) return '⚔️';
  if (text.includes('💀')) return '💀';
  if (text.includes('🏆') || text.includes('venceu') || text.includes('Comprad')) return '🏆';
  if (text.includes('📰') || text.includes('publicaç')) return '📰';
  if (text.includes('💬')) return '💬';
  if (text.includes('🎁') || text.includes('bônus')) return '🎁';
  if (text.includes('🎭') || text.includes('moldura')) return '🎭';
  if (text.includes('💼') || text.includes('emprego')) return '💼';
  return '✨';
}
function renderActivityRail() {
  const list = document.getElementById('activity-rail-list');
  if (!list) return;
  const feed = (G.activityFeed || []).slice().reverse().slice(0, 20);
  if (!feed.length) { list.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px">Nenhuma atividade ainda.</div>'; return; }
  list.innerHTML = feed.map(text => `<div class="activity-item">
      <div class="activity-item-icon">${activityIconFor(text)}</div>
      <div class="activity-item-text">${escapeHtml(text)}</div>
    </div>`).join('');
}

// ── TABS ───────────────────────────────────
function switchTab(btn, group, targetId) {
  const parent = btn.closest('.card') || btn.closest('.panel');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById(targetId);
  if (target) target.classList.add('active');
}

// ── START ──────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-overlay');
    if (modal && modal.classList.contains('open')) { closeModalDirect(); return; }
    const callOverlay = document.getElementById('call-overlay');
    if (callOverlay) { endCall(); }
  }
  // Itens de navegação e ações de post (curtir/comentar/compartilhar/excluir)
  // agora são focáveis (role="button" tabindex="0") — isso os ativa por teclado.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.nav-item[role="button"], .mobile-cat-item[role="button"], .post-like-btn[role="button"], .post-del-btn[role="button"]')) {
    e.preventDefault();
    e.target.click();
  }
});

// ══════════════════════════════════════════════════════════════
// (fronteira do antigo 3º bloco <script> do index.html)
// ══════════════════════════════════════════════════════════════
// --- LOGIN / CADASTRO / RECUPERAÇÃO DE SENHA REAL VIA SUPABASE ---
// authMode: 'login' | 'signup' | 'forgot'
let authMode = 'login';

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  authMode = 'login';
  applyAuthModeUI();
  document.getElementById('login-msg').innerText = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-password-confirm').value = '';
  modal.style.display = 'flex';
}
function closeLoginModalToGate() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('access-gate').classList.remove('hidden');
}

function applyAuthModeUI() {
  const title = document.getElementById('login-modal-title');
  const btn = document.getElementById('btn-auth-action');
  const toggleText = document.getElementById('toggle-text');
  const msg = document.getElementById('login-msg');
  const passwordInput = document.getElementById('login-password');
  const confirmWrap = document.getElementById('login-password-confirm-wrap');
  const forgotHint = document.getElementById('login-forgot-hint');
  const forgotRow = document.getElementById('forgot-password-row');
  const signupRow = document.getElementById('toggle-signup-row');
  msg.innerText = '';

  if (authMode === 'login') {
    title.innerText = 'Entrar no Crydan';
    btn.innerText = 'ENTRAR';
    toggleText.innerText = 'Não tem conta?';
    passwordInput.parentElement.style.display = '';
    confirmWrap.style.display = 'none';
    forgotHint.style.display = 'none';
    forgotRow.style.display = 'block';
    signupRow.style.display = 'block';
  } else if (authMode === 'signup') {
    title.innerText = 'Criar Nova Conta';
    btn.innerText = 'CADASTRAR';
    toggleText.innerText = 'Já tem conta?';
    passwordInput.parentElement.style.display = '';
    confirmWrap.style.display = '';
    forgotHint.style.display = 'none';
    forgotRow.style.display = 'none';
    signupRow.style.display = 'block';
  } else {
    title.innerText = 'Recuperar Senha';
    btn.innerText = 'ENVIAR LINK DE RECUPERAÇÃO';
    passwordInput.parentElement.style.display = 'none';
    confirmWrap.style.display = 'none';
    forgotHint.style.display = 'block';
    forgotRow.style.display = 'none';
    signupRow.style.display = 'none';
  }
}

// Alterna a visibilidade de um campo de senha (mostrar/ocultar) e o ícone do olho
function togglePwVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.textContent = showing ? '👁️' : '🙈';
  btn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
}

function toggleMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  applyAuthModeUI();
}

function toggleForgotMode() {
  authMode = authMode === 'forgot' ? 'login' : 'forgot';
  applyAuthModeUI();
}

// ── Login social (Google / Discord) — precisa que o provedor esteja
// ativado em Supabase → Authentication → Providers, com as credenciais
// OAuth do Google Cloud Console / Discord Developer Portal configuradas
// lá. Sem isso, o Supabase recusa a tentativa com um erro claro.
async function signInWithOAuth(provider) {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  } catch (e) {
    console.error(`Erro no login com ${provider}`, e);
    const msg = document.getElementById('login-msg');
    if (msg) msg.textContent = `Não foi possível entrar com ${provider === 'google' ? 'Google' : 'Discord'} agora.`;
  }
}

async function handleAuth() {
  if (authMode === 'forgot') { return handleForgotPassword(); }

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');

  if (!email || !password) { msg.style.color = 'var(--red)'; msg.innerText = 'Preencha e-mail e senha!'; return; }
  if (password.length < 6) { msg.style.color = 'var(--red)'; msg.innerText = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  if (authMode === 'signup') {
    const passwordConfirm = document.getElementById('login-password-confirm').value;
    if (!passwordConfirm) { msg.style.color = 'var(--red)'; msg.innerText = 'Confirme sua senha.'; return; }
    if (password !== passwordConfirm) { msg.style.color = 'var(--red)'; msg.innerText = 'As senhas não coincidem.'; return; }
    // Cadastro não finaliza direto — primeiro precisa aceitar os
    // Termos de Uso e a Política de Privacidade (etapa obrigatória).
    openTermsAcceptanceModal(email, password);
    return;
  }

  msg.style.color = 'var(--text2)';
  msg.innerText = 'Carregando...';

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (e) {
    console.error('Erro de conexão no login', e);
    msg.style.color = 'var(--red)';
    msg.innerText = '⚠️ Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
    return;
  }

  if (result.error) {
    msg.style.color = 'var(--red)';
    msg.innerText = 'Erro: ' + result.error.message;
    return;
  }

  msg.style.color = '#00ff88';
  msg.innerText = 'Logado com sucesso!';
  setTimeout(() => { postLoginRoute(); }, 700);
}

// ── Termos de Uso / Política de Privacidade — etapa obrigatória antes
// de criar a conta. O aceite é gravado no Supabase (não é só uma
// checagem visual) pelo trigger on_auth_user_created, que BLOQUEIA a
// criação da conta no banco se o aceite não vier junto no cadastro.
let _legalVersionsCache = null;
async function getLegalVersions() {
  if (_legalVersionsCache) return _legalVersionsCache;
  try {
    const { data } = await supabase.from('legal_document_versions').select('doc_key,version');
    const map = Object.fromEntries((data || []).map(d => [d.doc_key, d.version]));
    _legalVersionsCache = { terms: map.terms || '1.0', privacy: map.privacy || '1.0' };
  } catch (e) {
    console.error('Erro ao buscar versão dos termos', e);
    _legalVersionsCache = { terms: '1.0', privacy: '1.0' };
  }
  return _legalVersionsCache;
}

async function openTermsAcceptanceModal(email, password) {
  const v = await getLegalVersions();
  showModal('📜 Termos de Uso e Privacidade', `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:8px">🛡️</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold)">Antes de continuar</div>
      <div style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.6">
        Ao criar sua conta no Crydan, você concorda com os
        <a href="/terms" target="_blank" style="color:var(--gold2);text-decoration:underline">Termos de Uso</a>
        e a
        <a href="/privacy" target="_blank" style="color:var(--gold2);text-decoration:underline">Política de Privacidade</a>
        do Crydan.
      </div>
    </div>
    <label style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;margin-bottom:14px">
      <input type="checkbox" id="terms-accept-checkbox" style="margin-top:2px;width:16px;height:16px;flex-shrink:0" onchange="updateTermsAcceptButtonState()">
      <span style="font-size:13px;color:var(--text)">Li e concordo com os <a href="/terms" target="_blank" style="color:var(--gold2);text-decoration:underline">Termos de Uso</a> e a <a href="/privacy" target="_blank" style="color:var(--gold2);text-decoration:underline">Política de Privacidade</a> do Crydan.</span>
    </label>
    <div id="terms-accept-msg" style="font-size:12px;color:var(--red);min-height:16px;margin-bottom:8px;text-align:center"></div>
    <div style="display:flex;justify-content:center;margin-bottom:14px">
      <div id="turnstile-container"></div>
    </div>
    <button class="btn btn-primary" id="terms-accept-btn" style="width:100%" disabled onclick="confirmSignupWithTerms(${JSON.stringify(email).replace(/"/g,'&quot;')}, ${JSON.stringify(password).replace(/"/g,'&quot;')})">✦ Concordo e Criar Conta</button>
  `);
  // O script do Cloudflare só desenha automaticamente o captcha que já existe
  // na página quando ela carrega — como esse modal é criado depois (na hora
  // do clique), precisamos mandar ele desenhar aqui manualmente.
  turnstileToken = null;
  turnstileWidgetId = null;
  const renderTurnstile = () => {
    if (typeof turnstile === 'undefined' || !turnstile.render) { setTimeout(renderTurnstile, 200); return; }
    const container = document.getElementById('turnstile-container');
    if (!container) return;
    turnstileWidgetId = turnstile.render(container, {
      sitekey: '0x4AAAAAAEeRvHEV0CA5h4jn',
      callback: onTurnstileVerified,
      'error-callback': onTurnstileError,
      'expired-callback': onTurnstileExpired,
    });
  };
  renderTurnstile();
}

let turnstileWidgetId = null;

let turnstileToken = null;
function onTurnstileVerified(token) {
  turnstileToken = token;
  updateTermsAcceptButtonState();
}
function onTurnstileError() {
  turnstileToken = null;
  const m = document.getElementById('terms-accept-msg');
  if (m) m.textContent = 'Não foi possível carregar a verificação de segurança. Recarregue a página e tente de novo.';
}
function onTurnstileExpired() {
  turnstileToken = null;
  updateTermsAcceptButtonState();
}
function updateTermsAcceptButtonState() {
  const checkbox = document.getElementById('terms-accept-checkbox');
  const btn = document.getElementById('terms-accept-btn');
  if (btn) btn.disabled = !(checkbox && checkbox.checked && turnstileToken);
}

async function confirmSignupWithTerms(email, password) {
  const checkbox = document.getElementById('terms-accept-checkbox');
  const msgEl = document.getElementById('terms-accept-msg');
  if (!checkbox || !checkbox.checked) {
    if (msgEl) msgEl.textContent = 'É necessário aceitar os Termos de Uso e a Política de Privacidade para continuar.';
    return;
  }
  if (!turnstileToken) {
    if (msgEl) msgEl.textContent = 'Complete a verificação de segurança para continuar.';
    return;
  }
  const btn = document.getElementById('terms-accept-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando conta...'; }
  const v = await getLegalVersions();

  let result;
  try {
    result = await supabase.auth.signUp({
      email, password,
      options: { data: { terms_accepted: true, terms_version: v.terms, privacy_version: v.privacy }, captchaToken: turnstileToken },
    });
  } catch (e) {
    console.error('Erro de conexão no cadastro', e);
    if (msgEl) msgEl.textContent = '⚠️ Não foi possível conectar ao servidor. Tente de novo.';
    if (btn) { btn.disabled = false; btn.textContent = '✦ Concordo e Criar Conta'; }
    if (window.turnstile && turnstileWidgetId) turnstile.reset(turnstileWidgetId);
    turnstileToken = null;
    return;
  }

  if (result.error) {
    if (msgEl) msgEl.textContent = 'Erro: ' + result.error.message;
    if (btn) { btn.disabled = false; btn.textContent = '✦ Concordo e Criar Conta'; }
    if (window.turnstile && turnstileWidgetId) turnstile.reset(turnstileWidgetId);
    turnstileToken = null;
    return;
  }

  closeModalDirect();
  const msg = document.getElementById('login-msg');
  if (result.data && result.data.session) {
    if (msg) { msg.style.color = '#00ff88'; msg.innerText = 'Conta criada com sucesso!'; }
    setTimeout(() => { postLoginRoute(); }, 700);
  } else {
    if (msg) { msg.style.color = '#00ff88'; msg.innerText = 'Conta criada! Verifique seu e-mail para confirmar antes de entrar.'; }
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  const msg = document.getElementById('login-msg');

  if (!email) { msg.style.color = 'var(--red)'; msg.innerText = 'Digite seu e-mail primeiro!'; return; }

  msg.style.color = 'var(--text2)';
  msg.innerText = 'Enviando...';

  const redirectTo = window.location.origin + window.location.pathname;
  let error;
  try {
    ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }));
  } catch (e) {
    console.error('Erro de conexão ao pedir recuperação de senha', e);
    msg.style.color = 'var(--red)';
    msg.innerText = '⚠️ Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
    return;
  }

  if (error) {
    msg.style.color = 'var(--red)';
    msg.innerText = 'Erro: ' + error.message;
    return;
  }

  msg.style.color = '#00ff88';
  msg.innerText = 'Link enviado! Verifique seu e-mail (e a caixa de spam) e clique no link para criar uma nova senha.';
}

// Quando a pessoa clica no link do e-mail de recuperação, o Supabase a traz de
// volta pra cá com um token especial na URL. O SDK detecta isso sozinho e
// dispara o evento PASSWORD_RECOVERY — é aí que mostramos o modal de nova senha.
if (supabase && supabase.auth) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      document.getElementById('login-modal').style.display = 'none';
      document.getElementById('access-gate').classList.add('hidden');
      document.getElementById('newpass-1').value = '';
      document.getElementById('newpass-2').value = '';
      document.getElementById('newpass-msg').innerText = '';
      document.getElementById('newpass-modal').style.display = 'flex';
    }
  });
}

async function handleSetNewPassword() {
  const p1 = document.getElementById('newpass-1').value;
  const p2 = document.getElementById('newpass-2').value;
  const msg = document.getElementById('newpass-msg');

  if (!p1 || p1.length < 6) { msg.style.color = 'var(--red)'; msg.innerText = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  if (p1 !== p2) { msg.style.color = 'var(--red)'; msg.innerText = 'As senhas não coincidem.'; return; }

  msg.style.color = 'var(--text2)';
  msg.innerText = 'Salvando...';

  let error;
  try {
    ({ error } = await supabase.auth.updateUser({ password: p1 }));
  } catch (e) {
    console.error('Erro de conexão ao salvar nova senha', e);
    msg.style.color = 'var(--red)';
    msg.innerText = '⚠️ Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
    return;
  }

  if (error) {
    msg.style.color = 'var(--red)';
    msg.innerText = 'Erro: ' + error.message;
    return;
  }

  msg.style.color = '#00ff88';
  msg.innerText = 'Senha alterada com sucesso! Entrando...';
  setTimeout(() => {
    document.getElementById('newpass-modal').style.display = 'none';
    init();
  }, 900);
}


// ══════════════════════════════════════════════════════════════
// Compatibilidade com atributos onclick="..." inline no HTML (~520
// ocorrências) -- eles só enxergam window, não o escopo deste módulo.
// Gerado automaticamente a partir de toda função top-level encontrada
// nos 3 blocos <script> originais (667 no total).
// ══════════════════════════════════════════════════════════════
window._admReopenModal = _admReopenModal;
window._animPreviewHtml = _animPreviewHtml;
window._stripAt = _stripAt;
window.acceptIncomingCall = acceptIncomingCall;
window.acceptQuest = acceptQuest;
window.activityIconFor = activityIconFor;
window.addBankHistory = addBankHistory;
window.addCustomSkill = addCustomSkill;
window.addFriend = addFriend;
window.addMemberToCommunity = addMemberToCommunity;
window.addMemberToGroup = addMemberToGroup;
window.addToFeed = addToFeed;
window.addToInventory = addToInventory;
window.admAddClass = admAddClass;
window.admAddLottie = admAddLottie;
window.admAdjustWallet = admAdjustWallet;
window.admAnnounce = admAnnounce;
window.admApproveCrystal = admApproveCrystal;
window.admApproveGuildRequest = admApproveGuildRequest;
window.admAudit = admAudit;
window.admBanById = admBanById;
window.admBanPlayer = admBanPlayer;
window.admClearChats = admClearChats;
window.admClearCommunities = admClearCommunities;
window.admClearFeedback = admClearFeedback;
window.admClearLogs = admClearLogs;
window.admClearMotd = admClearMotd;
window.admClearPosts = admClearPosts;
window.admDeclineGuildRequest = admDeclineGuildRequest;
window.admDeleteAccount = admDeleteAccount;
window.admDeleteAccountCore = admDeleteAccountCore;
window.admDeleteAnyPost = admDeleteAnyPost;
window.admDeleteChatItem = admDeleteChatItem;
window.admDeleteComment = admDeleteComment;
window.admDeleteCommunityItem = admDeleteCommunityItem;
window.admDeleteFeedback = admDeleteFeedback;
window.admDemoteAdmin = admDemoteAdmin;
window.admEditLottie = admEditLottie;
window.admExportData = admExportData;
window.admGiveCry = admGiveCry;
window.admGiveCrystals = admGiveCrystals;
window.admGiveXP = admGiveXP;
window.admImportData = admImportData;
window.admLiftSuspension = admLiftSuspension;
window.admLoadPlayerForEdit = admLoadPlayerForEdit;
window.admLookupPlayer = admLookupPlayer;
window.admPromoteAdmin = admPromoteAdmin;
window.admQuickBadge = admQuickBadge;
window.admQuickBan = admQuickBan;
window.admQuickCry = admQuickCry;
window.admQuickCrystals = admQuickCrystals;
window.admQuickDelete = admQuickDelete;
window.admQuickLiftSuspension = admQuickLiftSuspension;
window.admQuickReset = admQuickReset;
window.admQuickSaveEdit = admQuickSaveEdit;
window.admQuickSuspend = admQuickSuspend;
window.admQuickTarget = admQuickTarget;
window.admQuickXP = admQuickXP;
window.admRejectCrystal = admRejectCrystal;
window.admRemoveAsset = admRemoveAsset;
window.admRemoveBadge = admRemoveBadge;
window.admRemoveClass = admRemoveClass;
window.admRemoveLottie = admRemoveLottie;
window.admRenameGuild = admRenameGuild;
window.admReplyFeedback = admReplyFeedback;
window.admResetOwnSessionAccount = admResetOwnSessionAccount;
window.admResetPlayerAccount = admResetPlayerAccount;
window.admResetPlayerAccountCore = admResetPlayerAccountCore;
window.admSaveCrystarPixKey = admSaveCrystarPixKey;
window.admSaveMotd = admSaveMotd;
window.admSavePlayerEdit = admSavePlayerEdit;
window.admSaveSocialLinks = admSaveSocialLinks;
window.admSearchPlayers = admSearchPlayers;
window.admSetBadge = admSetBadge;
window.admSetBanned = admSetBanned;
window.admStartEvent = admStartEvent;
window.admSuspendPlayer = admSuspendPlayer;
window.admTakeCry = admTakeCry;
window.admToggleBlockSignups = admToggleBlockSignups;
window.admToggleCommentsMod = admToggleCommentsMod;
window.admUnbanById = admUnbanById;
window.admUnbanPlayer = admUnbanPlayer;
window.admUploadAnimFile = admUploadAnimFile;
window.adminLogout = adminLogout;
window.adminNavigate = adminNavigate;
window.applyAccentColor = applyAccentColor;
window.applyAuthModeUI = applyAuthModeUI;
window.applyAvatarFrame = applyAvatarFrame;
window.applyBackgroundPalette = applyBackgroundPalette;
window.applyBannerAnim = applyBannerAnim;
window.applyCustomBgImage = applyCustomBgImage;
window.applyFont = applyFont;
window.applyFrameToWrap = applyFrameToWrap;
window.applyInterfacePrefs = applyInterfacePrefs;
window.applyJob = applyJob;
window.applyTheme = applyTheme;
window.attachRemoteStream = attachRemoteStream;
window.autoDetectDeviceView = autoDetectDeviceView;
window.backToGateSelect = backToGateSelect;
window.bankDeposit = bankDeposit;
window.bankWithdraw = bankWithdraw;
window.battleCooldownRemaining = battleCooldownRemaining;
window.blockUserPrompt = blockUserPrompt;
window.boot = boot;
window.botDifficultyBar = botDifficultyBar;
window.buildAiSystemPrompt = buildAiSystemPrompt;
window.buildLinkHref = buildLinkHref;
window.buyAvatarFrame = buyAvatarFrame;
window.buyCompany = buyCompany;
window.buyHouse = buyHouse;
window.buyItem = buyItem;
window.buyQuick = buyQuick;
window.c4AiMove = c4AiMove;
window.c4CheckWin = c4CheckWin;
window.c4End = c4End;
window.c4LowestRow = c4LowestRow;
window.c4Play = c4Play;
window.c4SetDifficulty = c4SetDifficulty;
window.c4SetMode = c4SetMode;
window.celebrate = celebrate;
window.changeGuildRankingPage = changeGuildRankingPage;
window.chatAvatarHtml = chatAvatarHtml;
window.checkAchievements = checkAchievements;
window.checkAdminAndEnter = checkAdminAndEnter;
window.checkDailyLoginBonus = checkDailyLoginBonus;
window.checkLegalReAcceptance = checkLegalReAcceptance;
window.checkModerationStatus = checkModerationStatus;
window.checkMyGuildRequest = checkMyGuildRequest;
window.checkMyStory = checkMyStory;
window.checkUsernameAvailability = checkUsernameAvailability;
window.checkersClick = checkersClick;
window.checkersValidMove = checkersValidMove;
window.chessClick = chessClick;
window.chessIsBlack = chessIsBlack;
window.chessIsWhite = chessIsWhite;
window.chessValidMove = chessValidMove;
window.chooseAccessMode = chooseAccessMode;
window.claimCompletedPvpChallenges = claimCompletedPvpChallenges;
window.claimQuest = claimQuest;
window.clearAiChatHistory = clearAiChatHistory;
window.clearPendingAttachment = clearPendingAttachment;
window.clearPostImage = clearPostImage;
window.clearPostVideo = clearPostVideo;
window.closeBannerPreview = closeBannerPreview;
window.closeFramePreview = closeFramePreview;
window.closeGame = closeGame;
window.closeLoginModalToGate = closeLoginModalToGate;
window.closeMobileCategorySheet = closeMobileCategorySheet;
window.closeModal = closeModal;
window.closeModalDirect = closeModalDirect;
window.closeMusicPlayer = closeMusicPlayer;
window.closeOnboardingTour = closeOnboardingTour;
window.closeStoryViewer = closeStoryViewer;
window.collect = collect;
window.communityIconHtml = communityIconHtml;
window.communityIconHtmlBig = communityIconHtmlBig;
window.confirmCrystalPurchase = confirmCrystalPurchase;
window.confirmDialog = confirmDialog;
window.confirmEditMessage = confirmEditMessage;
window.confirmEquipPreviewedBanner = confirmEquipPreviewedBanner;
window.confirmEquipPreviewedFrame = confirmEquipPreviewedFrame;
window.confirmReacceptance = confirmReacceptance;
window.confirmReportUser = confirmReportUser;
window.confirmSignupWithTerms = confirmSignupWithTerms;
window.connectLoginProvider = connectLoginProvider;
window.consumeFood = consumeFood;
window.copyReferralCode = copyReferralCode;
window.createChannel = createChannel;
window.createCommunity = createCommunity;
window.createDM = createDM;
window.createDiceElement = createDiceElement;
window.createGroup = createGroup;
window.createPost = createPost;
window.currentChatTargetFriendId = currentChatTargetFriendId;
window.currentChatTargetName = currentChatTargetName;
window.debounceGifSearch = debounceGifSearch;
window.declineIncomingCall = declineIncomingCall;
window.deleteChat = deleteChat;
window.deleteCommunity = deleteCommunity;
window.deleteConversationPrompt = deleteConversationPrompt;
window.deleteFeedback = deleteFeedback;
window.deleteMessage = deleteMessage;
window.deleteMyStory = deleteMyStory;
window.deletePost = deletePost;
window.deletePostComment = deletePostComment;
window.diagnoseOnclickHandlers = diagnoseOnclickHandlers;
window.diceRollSolo = diceRollSolo;
window.diceSetCount = diceSetCount;
window.disconnectLoginProvider = disconnectLoginProvider;
window.discoverIncomingDMs = discoverIncomingDMs;
window.discoverMyGroups = discoverMyGroups;
window.dismissNotif = dismissNotif;
window.divorce = divorce;
window.doForwardMessage = doForwardMessage;
window.doSharePost = doSharePost;
window.editMessagePrompt = editMessagePrompt;
window.enablePushNotifications = enablePushNotifications;
window.encounterChanceFor = encounterChanceFor;
window.endCall = endCall;
window.enhanceClickableAccessibility = enhanceClickableAccessibility;
window.ensureProfilesCached = ensureProfilesCached;
window.ensureYtPlayer = ensureYtPlayer;
window.equipAvatar = equipAvatar;
window.equipBannerAnim = equipBannerAnim;
window.equipOwnedFrame = equipOwnedFrame;
window.escapeHtml = escapeHtml;
window.fetchGuildTagsForUsers = fetchGuildTagsForUsers;
window.fightBoss = fightBoss;
window.findProfileByNameOrUsername = findProfileByNameOrUsername;
window.fmtTime = fmtTime;
window.forcaGuess = forcaGuess;
window.formatCry = formatCry;
window.formatLastSeen = formatLastSeen;
window.forwardMessagePrompt = forwardMessagePrompt;
window.g2048Move = g2048Move;
window.g2048Slide = g2048Slide;
window.g2048Spawn = g2048Spawn;
window.gainXP = gainXP;
window.gameReward = gameReward;
window.getBlockSignups = getBlockSignups;
window.getCommunityRole = getCommunityRole;
window.getCurrentBannerCss = getCurrentBannerCss;
window.getFriendsList = getFriendsList;
window.getGlobalAnnouncement = getGlobalAnnouncement;
window.getGreeting = getGreeting;
window.getGroupRole = getGroupRole;
window.getGroupRoleFresh = getGroupRoleFresh;
window.getLegalVersions = getLegalVersions;
window.getLottieCatalog = getLottieCatalog;
window.getMotd = getMotd;
window.getPixKey = getPixKey;
window.getRank = getRank;
window.getSocialLinks = getSocialLinks;
window.groupIconHtml = groupIconHtml;
window.gsapPanelEnter = gsapPanelEnter;
window.gsapStagger = gsapStagger;
window.guildChangeRole = guildChangeRole;
window.guildContributeMission = guildContributeMission;
window.guildDisbandConfirm = guildDisbandConfirm;
window.guildInviteByName = guildInviteByName;
window.guildJoinOpen = guildJoinOpen;
window.guildKickConfirm = guildKickConfirm;
window.guildRequestJoin = guildRequestJoin;
window.guildRespondInvite = guildRespondInvite;
window.guildRespondJoinRequest = guildRespondJoinRequest;
window.guildSaveSettings = guildSaveSettings;
window.guildTagHtml = guildTagHtml;
window.guildTransferLeadershipConfirm = guildTransferLeadershipConfirm;
window.guildVaultDeposit = guildVaultDeposit;
window.guildVaultWithdraw = guildVaultWithdraw;
window.guildXpForLevel = guildXpForLevel;
window.handleAuth = handleAuth;
window.handleAvatarFileSelect = handleAvatarFileSelect;
window.handleBannerFileSelect = handleBannerFileSelect;
window.handleBannerVideoFileSelect = handleBannerVideoFileSelect;
window.handleBgImageFileSelect = handleBgImageFileSelect;
window.handleChatFileSelect = handleChatFileSelect;
window.handleCommunityPhotoSelect = handleCommunityPhotoSelect;
window.handleCustomFrameImageSelect = handleCustomFrameImageSelect;
window.handleForgotPassword = handleForgotPassword;
window.handleGroupPhotoSelect = handleGroupPhotoSelect;
window.handleIncomingAnswer = handleIncomingAnswer;
window.handleIncomingIce = handleIncomingIce;
window.handleIncomingOffer = handleIncomingOffer;
window.handleMyAvatarClick = handleMyAvatarClick;
window.handlePostImageSelect = handlePostImageSelect;
window.handlePostMediaSelect = handlePostMediaSelect;
window.handlePostVideoSelect = handlePostVideoSelect;
window.handleSetNewPassword = handleSetNewPassword;
window.hexToHsl = hexToHsl;
window.highlightAiAvatar = highlightAiAvatar;
window.hslToHex = hslToHex;
window.impactFlash = impactFlash;
window.init = init;
window.initCallSignaling = initCallSignaling;
window.initGame_2048 = initGame_2048;
window.initGame_conecta4 = initGame_conecta4;
window.initGame_dados = initGame_dados;
window.initGame_damas = initGame_damas;
window.initGame_forca = initGame_forca;
window.initGame_memoria = initGame_memoria;
window.initGame_numero = initGame_numero;
window.initGame_ppt = initGame_ppt;
window.initGame_quiz = initGame_quiz;
window.initGame_simon = initGame_simon;
window.initGame_termo = initGame_termo;
window.initGame_velha = initGame_velha;
window.initGame_xadrez = initGame_xadrez;
window.initNotifications = initNotifications;
window.initThemeLottie = initThemeLottie;
window.initialsOf = initialsOf;
window.isFrameOwned = isFrameOwned;
window.joinCommunityAndOpen = joinCommunityAndOpen;
window.leaveCommunity = leaveCommunity;
window.leaveGroupConfirm = leaveGroupConfirm;
window.leaveGuild = leaveGuild;
window.loadAppSettings = loadAppSettings;
window.loadChannelMessages = loadChannelMessages;
window.loadFollowState = loadFollowState;
window.loadFriendMessages = loadFriendMessages;
window.loadGame = loadGame;
window.loadGroupMessages = loadGroupMessages;
window.loadLoginSecurity = loadLoginSecurity;
window.loadMyCommunities = loadMyCommunities;
window.loadNotifications = loadNotifications;
window.loadOwnFollowCounts = loadOwnFollowCounts;
window.loadPostsFeed = loadPostsFeed;
window.loadProfilePosts = loadProfilePosts;
window.loadReferralInfo = loadReferralInfo;
window.loadYoutubeIframeApi = loadYoutubeIframeApi;
window.logout = logout;
window.lottieEntryFor = lottieEntryFor;
window.lottieUrlFor = lottieUrlFor;
window.markAllNotificationsRead = markAllNotificationsRead;
window.markNotificationRead = markNotificationRead;
window.maybeTriggerEncounter = maybeTriggerEncounter;
window.memFlip = memFlip;
window.monsterForDanger = monsterForDanger;
window.mountAvatarParticles = mountAvatarParticles;
window.mountBannerFx = mountBannerFx;
window.moveOnMap = moveOnMap;
window.myId = myId;
window.navigate = navigate;
window.normalizeUsernameInput = normalizeUsernameInput;
window.notify = notify;
window.numGuess = numGuess;
window.onTurnstileError = onTurnstileError;
window.onTurnstileExpired = onTurnstileExpired;
window.onTurnstileVerified = onTurnstileVerified;
window.openAdminPlayerModal = openAdminPlayerModal;
window.openBannerAdjustModal = openBannerAdjustModal;
window.openBannerVideoModal = openBannerVideoModal;
window.openBuyCrystalModal = openBuyCrystalModal;
window.openChannel = openChannel;
window.openChat = openChat;
window.openCloseFriendsManager = openCloseFriendsManager;
window.openCommunity = openCommunity;
window.openCommunityBrowser = openCommunityBrowser;
window.openCommunitySettingsModal = openCommunitySettingsModal;
window.openCreateChannelModal = openCreateChannelModal;
window.openCreateCommunityModal = openCreateCommunityModal;
window.openCreateDMModal = openCreateDMModal;
window.openCreateGroupModal = openCreateGroupModal;
window.openDMOptionsMenu = openDMOptionsMenu;
window.openEditProfile = openEditProfile;
window.openGame = openGame;
window.openGifPicker = openGifPicker;
window.openGlobalProfileSearch = openGlobalProfileSearch;
window.openGroupSettingsModal = openGroupSettingsModal;
window.openGuildMemberActions = openGuildMemberActions;
window.openGuildProfile = openGuildProfile;
window.openGuildProfileByTag = openGuildProfileByTag;
window.openHome = openHome;
window.openLoginModal = openLoginModal;
window.openMobileCategorySheet = openMobileCategorySheet;
window.openNotification = openNotification;
window.openPostLightbox = openPostLightbox;
window.openPublicProfile = openPublicProfile;
window.openPublicProfileById = openPublicProfileById;
window.openSharePostModal = openSharePostModal;
window.openStoryComposer = openStoryComposer;
window.openStoryViewersList = openStoryViewersList;
window.openTermsAcceptanceModal = openTermsAcceptanceModal;
window.paintStars = paintStars;
window.persistThemeSilently = persistThemeSilently;
window.playSong = playSong;
window.playSongById = playSongById;
window.pollAllFriendChats = pollAllFriendChats;
window.pollAllGroupChats = pollAllGroupChats;
window.pollCurrentChannel = pollCurrentChannel;
window.positionPlayerToken = positionPlayerToken;
window.postLoginRoute = postLoginRoute;
window.postStory = postStory;
window.pptPlay = pptPlay;
window.previewAvatarFrame = previewAvatarFrame;
window.previewBannerAnim = previewBannerAnim;
window.proposeMarriage = proposeMarriage;
window.pulseEl = pulseEl;
window.pvpPower = pvpPower;
window.quickAddFriendFromProfile = quickAddFriendFromProfile;
window.quickChallengeFromProfile = quickChallengeFromProfile;
window.quickSetAccent = quickSetAccent;
window.quickSetBannerAnim = quickSetBannerAnim;
window.quickSetBgPalette = quickSetBgPalette;
window.quickSetFont = quickSetFont;
window.quitJob = quitJob;
window.quizAnswer = quizAnswer;
window.rarityColor = rarityColor;
window.reactToStory = reactToStory;
window.redeemReferralCode = redeemReferralCode;
window.refreshAdmPlayersList = refreshAdmPlayersList;
window.refreshAdmStats = refreshAdmStats;
window.refreshAll = refreshAll;
window.refreshBank = refreshBank;
window.refreshDashboard = refreshDashboard;
window.refreshMyCrystals = refreshMyCrystals;
window.refreshMyGuildMembership = refreshMyGuildMembership;
window.refreshPanel = refreshPanel;
window.refreshProfile = refreshProfile;
window.regCheckUsername = regCheckUsername;
window.regFinish = regFinish;
window.regGetAudioCtx = regGetAudioCtx;
window.regGoStep = regGoStep;
window.regHandleAvatarUpload = regHandleAvatarUpload;
window.regHandleBannerUpload = regHandleBannerUpload;
window.regHandleNextClick = regHandleNextClick;
window.regInit = regInit;
window.regRemoveAvatarPhoto = regRemoveAvatarPhoto;
window.regRemoveBannerImage = regRemoveBannerImage;
window.regRenderBannerAnims = regRenderBannerAnims;
window.regRenderBannerPresets = regRenderBannerPresets;
window.regRenderClassGrid = regRenderClassGrid;
window.regRenderFrameCats = regRenderFrameCats;
window.regRenderFrameGrid = regRenderFrameGrid;
window.regSelectBannerAnim = regSelectBannerAnim;
window.regSelectClass = regSelectClass;
window.regSelectFrame = regSelectFrame;
window.regSelectPreset = regSelectPreset;
window.regSetFrameCat = regSetFrameCat;
window.regSoundClick = regSoundClick;
window.regSoundError = regSoundError;
window.regSoundStep = regSoundStep;
window.regSoundSuccess = regSoundSuccess;
window.regTone = regTone;
window.regUpdateBannerAdjust = regUpdateBannerAdjust;
window.regUpdateIdentity = regUpdateIdentity;
window.regUpdatePreview = regUpdatePreview;
window.removeAvatarPhoto = removeAvatarPhoto;
window.removeBannerVideo = removeBannerVideo;
window.removeCustomBgImage = removeCustomBgImage;
window.removeCustomSkill = removeCustomSkill;
window.removeFriend = removeFriend;
window.removeFromInventory = removeFromInventory;
window.removeMemberFromCommunity = removeMemberFromCommunity;
window.removeMemberFromGroup = removeMemberFromGroup;
window.renderAchievements = renderAchievements;
window.renderActivityRail = renderActivityRail;
window.renderAdm = renderAdm;
window.renderAdmClasses = renderAdmClasses;
window.renderAdmCrystarPurchases = renderAdmCrystarPurchases;
window.renderAdmFeedback = renderAdmFeedback;
window.renderAdmGuildRequests = renderAdmGuildRequests;
window.renderAdmLottie = renderAdmLottie;
window.renderAdmPosts = renderAdmPosts;
window.renderAdmTools = renderAdmTools;
window.renderAdminsList = renderAdminsList;
window.renderAiChatMessages = renderAiChatMessages;
window.renderAiCompanion = renderAiCompanion;
window.renderAnimHtml = renderAnimHtml;
window.renderAttachPreview = renderAttachPreview;
window.renderAuditLog = renderAuditLog;
window.renderAvatarFrameShop = renderAvatarFrameShop;
window.renderBannerAnimShop = renderBannerAnimShop;
window.renderBosses = renderBosses;
window.renderCallOverlay = renderCallOverlay;
window.renderCharacterSheet = renderCharacterSheet;
window.renderCharacterSheetPreview = renderCharacterSheetPreview;
window.renderChatListCol = renderChatListCol;
window.renderChatMainCol = renderChatMainCol;
window.renderCommRail = renderCommRail;
window.renderCommentsBox = renderCommentsBox;
window.renderCompanies = renderCompanies;
window.renderConfig = renderConfig;
window.renderConversas = renderConversas;
window.renderConversasSocialBar = renderConversasSocialBar;
window.renderCrystarPanel = renderCrystarPanel;
window.renderCustomSkillsList = renderCustomSkillsList;
window.renderEvents = renderEvents;
window.renderFeedback = renderFeedback;
window.renderFrameShopTabs = renderFrameShopTabs;
window.renderFriendsPanel = renderFriendsPanel;
window.renderGallery = renderGallery;
window.renderGame_2048 = renderGame_2048;
window.renderGame_conecta4 = renderGame_conecta4;
window.renderGame_dados = renderGame_dados;
window.renderGame_damas = renderGame_damas;
window.renderGame_forca = renderGame_forca;
window.renderGame_memoria = renderGame_memoria;
window.renderGame_numero = renderGame_numero;
window.renderGame_ppt = renderGame_ppt;
window.renderGame_quiz = renderGame_quiz;
window.renderGame_simon = renderGame_simon;
window.renderGame_termo = renderGame_termo;
window.renderGame_velha = renderGame_velha;
window.renderGame_xadrez = renderGame_xadrez;
window.renderGamesHub = renderGamesHub;
window.renderGuildInvites = renderGuildInvites;
window.renderGuildRanking = renderGuildRanking;
window.renderGuilds = renderGuilds;
window.renderHouses = renderHouses;
window.renderInvGrid = renderInvGrid;
window.renderInventory = renderInventory;
window.renderJobs = renderJobs;
window.renderLogs = renderLogs;
window.renderMap = renderMap;
window.renderMessageContent = renderMessageContent;
window.renderMsgRow = renderMsgRow;
window.renderMusicPanel = renderMusicPanel;
window.renderMusicResults = renderMusicResults;
window.renderMyGuild = renderMyGuild;
window.renderNavIcons = renderNavIcons;
window.renderNotifBell = renderNotifBell;
window.renderOnboardingTour = renderOnboardingTour;
window.renderPostsFeed = renderPostsFeed;
window.renderProfileLinks = renderProfileLinks;
window.renderPublicProfileModal = renderPublicProfileModal;
window.renderPublicacoes = renderPublicacoes;
window.renderPvpChallenges = renderPvpChallenges;
window.renderQuests = renderQuests;
window.renderRanking = renderRanking;
window.renderSeasonalShop = renderSeasonalShop;
window.renderShop = renderShop;
window.renderSocialModList = renderSocialModList;
window.renderStoriesBar = renderStoriesBar;
window.renderStoryViewer = renderStoryViewer;
window.renderSupportThread = renderSupportThread;
window.rentHouse = rentHouse;
window.replayTour = replayTour;
window.reportUserPrompt = reportUserPrompt;
window.requestCreateGuild = requestCreateGuild;
window.requestEmailChange = requestEmailChange;
window.resetGame = resetGame;
window.respondFriendRequest = respondFriendRequest;
window.respondPvpChallenge = respondPvpChallenge;
window.restrictUserPrompt = restrictUserPrompt;
window.rollDiceVisual = rollDiceVisual;
window.safeMediaUrl = safeMediaUrl;
window.saveAiCompanionConfig = saveAiCompanionConfig;
window.saveBannerAdjust = saveBannerAdjust;
window.saveBannerVideoUrl = saveBannerVideoUrl;
window.saveCharacterSheet = saveCharacterSheet;
window.saveCommunitySettings = saveCommunitySettings;
window.saveConfig = saveConfig;
window.saveGame = saveGame;
window.saveGroupSettings = saveGroupSettings;
window.saveProfile = saveProfile;
window.saveProfileLinks = saveProfileLinks;
window.searchGifs = searchGifs;
window.searchMusic = searchMusic;
window.selectAccent = selectAccent;
window.selectAiAvatar = selectAiAvatar;
window.selectAvatar = selectAvatar;
window.selectBanner = selectBanner;
window.selectCommIcon = selectCommIcon;
window.selectMobileNavItem = selectMobileNavItem;
window.selectStoryColor = selectStoryColor;
window.sellCompany = sellCompany;
window.sellHouse = sellHouse;
window.sellItem = sellItem;
window.sendAiMessage = sendAiMessage;
window.sendChannelMessage = sendChannelMessage;
window.sendChatMessage = sendChatMessage;
window.sendGifMessage = sendGifMessage;
window.sendMoneyTo = sendMoneyTo;
window.sendPix = sendPix;
window.sendSignal = sendSignal;
window.sendTransfer = sendTransfer;
window.setBar = setBar;
window.setCustomRingColor = setCustomRingColor;
window.setDeviceView = setDeviceView;
window.setFrameShopCategory = setFrameShopCategory;
window.setMusicVolume = setMusicVolume;
window.setPlayPauseIcon = setPlayPauseIcon;
window.setTheme = setTheme;
window.setVal = setVal;
window.setupKeyboardAccessibility = setupKeyboardAccessibility;
window.setupStarPicker = setupStarPicker;
window.shakeArena = shakeArena;
window.showAdminApp = showAdminApp;
window.showApp = showApp;
window.showBattleResultOverlay = showBattleResultOverlay;
window.showFollowList = showFollowList;
window.showGateConnectionError = showGateConnectionError;
window.showModal = showModal;
window.showZoneInfo = showZoneInfo;
window.signInWithOAuth = signInWithOAuth;
window.simonPlaySequence = simonPlaySequence;
window.simonPlayerClick = simonPlayerClick;
window.simonStart = simonStart;
window.simulateGainXP = simulateGainXP;
window.sleep = sleep;
window.socialLinksDefaults = socialLinksDefaults;
window.spawnFloatingText = spawnFloatingText;
window.startBattle = startBattle;
window.startCall = startCall;
window.startDMWithFriend = startDMWithFriend;
window.startOnboardingTour = startOnboardingTour;
window.startPanelPolling = startPanelPolling;
window.startPvP = startPvP;
window.startTimers = startTimers;
window.stopPanelPolling = stopPanelPolling;
window.stopTimers = stopTimers;
window.submitFeedback = submitFeedback;
window.submitPostComment = submitPostComment;
window.submitSupportMessage = submitSupportMessage;
window.subscribeNotifications = subscribeNotifications;
window.svgIcon = svgIcon;
window.switchAiTab = switchAiTab;
window.switchMusicTab = switchMusicTab;
window.switchTab = switchTab;
window.syncOtherThemeWidgets = syncOtherThemeWidgets;
window.syncProfile = syncProfile;
window.sysLog = sysLog;
window.teardownCall = teardownCall;
window.teardownCallSignaling = teardownCallSignaling;
window.teardownNotifications = teardownNotifications;
window.termoSubmit = termoSubmit;
window.terrainClassFor = terrainClassFor;
window.timeAgo = timeAgo;
window.toggleActivityRail = toggleActivityRail;
window.toggleCallCam = toggleCallCam;
window.toggleCallMute = toggleCallMute;
window.toggleCloseFriend = toggleCloseFriend;
window.toggleCommentsBox = toggleCommentsBox;
window.toggleCommunityAdmin = toggleCommunityAdmin;
window.toggleCompactMode = toggleCompactMode;
window.toggleFavoriteCurrentSong = toggleFavoriteCurrentSong;
window.toggleFavoriteSong = toggleFavoriteSong;
window.toggleFollow = toggleFollow;
window.toggleForgotMode = toggleForgotMode;
window.toggleGroupAdmin = toggleGroupAdmin;
window.toggleLikePost = toggleLikePost;
window.toggleMobileSidebar = toggleMobileSidebar;
window.toggleMode = toggleMode;
window.toggleMsgActions = toggleMsgActions;
window.toggleMusicMute = toggleMusicMute;
window.toggleMusicPlayPause = toggleMusicPlayPause;
window.toggleNotifDropdown = toggleNotifDropdown;
window.togglePwVisibility = togglePwVisibility;
window.toggleReduceMotion = toggleReduceMotion;
window.toggleSidebarSection = toggleSidebarSection;
window.toggleTheme = toggleTheme;
window.toggleVoiceRecording = toggleVoiceRecording;
window.touchLastSeen = touchLastSeen;
window.tourNext = tourNext;
window.tourPrev = tourPrev;
window.tttAiMove = tttAiMove;
window.tttEnd = tttEnd;
window.tttMinimax = tttMinimax;
window.tttPlay = tttPlay;
window.tttSetDifficulty = tttSetDifficulty;
window.tttSetMode = tttSetMode;
window.tttWinner = tttWinner;
window.uiSound = uiSound;
window.uid = uid;
window.updateAvatarPreviewEl = updateAvatarPreviewEl;
window.updateBannerAdjustPreview = updateBannerAdjustPreview;
window.updateBattleCooldown = updateBattleCooldown;
window.updateHeader = updateHeader;
window.updateMpLikeIcon = updateMpLikeIcon;
window.updatePushToggleLabel = updatePushToggleLabel;
window.updateQuestProgress = updateQuestProgress;
window.updateStoryPreview = updateStoryPreview;
window.updateTermsAcceptButtonState = updateTermsAcceptButtonState;
window.updateWorkCooldown = updateWorkCooldown;
window.uploadAndSendVoice = uploadAndSendVoice;
window.uploadPendingChatImage = uploadPendingChatImage;
window.urlBase64ToUint8Array = urlBase64ToUint8Array;
window.useItem = useItem;
window.userSearchBlur = userSearchBlur;
window.userSearchInput = userSearchInput;
window.userSearchPick = userSearchPick;
window.verifiedBadgeHtml = verifiedBadgeHtml;
window.viewUserStory = viewUserStory;
window.walkToZone = walkToZone;
window.workShift = workShift;
window.zoneAt = zoneAt;
