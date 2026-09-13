import { escapeHtml } from '../utils/escapeHtml.js';

// src/guild/constants.js
// "Constantes" são valores que NUNCA mudam sozinhos durante o jogo -- são
// mais como uma tabela de regras fixas (ex: o nome de cada cargo da
// guilda) do que "dados do jogador" (que mudam toda hora, tipo o saldo).
// Por isso são seguras de tirar do main.js primeiro: nada aqui depende
// de G, de supabase, nem de nenhuma outra parte do jogo.

export const GUILD_ROLE_LABELS = { leader: '👑 Líder', vice_leader: '⚜️ Vice-líder', officer: '🛡️ Oficial', member: '⚔️ Membro' };
export const GUILD_ROLE_RANK = { leader: 4, vice_leader: 3, officer: 2, member: 1 };
export const GUILD_PRIVACY_LABELS = { open: '🔓 Aberta', request: '📝 Solicitação', closed: '🔒 Fechada' };
export const GUILD_ACHIEVEMENTS_INFO = {
  foundation: { icon: '🏰', name: 'Fundação', desc: 'Guilda fundada' },
  family: { icon: '👥', name: 'Família', desc: 'Alcançou 25 membros' },
  legend: { icon: '🌑', name: 'Lenda', desc: 'Alcançou nível 50' },
};
export const GUILD_PAGE_SIZE = 20;

export const GUILDS_DEFAULT = [
  { id:'g1', name:'Ordem da Chama', emblem:'🔥', desc:'Guerreiros do fogo sagrado', members:['Sistema'], level:5 },
  { id:'g2', name:'Sombras Arcanas',emblem:'🌙', desc:'Magos das trevas eternas',  members:['Sistema'], level:3 },
  { id:'g3', name:'Escudo Dourado', emblem:'🛡️', desc:'Defensores do reino',       members:['Sistema'], level:4 },
];

export function guildTagHtml(g) {
  if (!g || !g.tag) return '';
  return ` <span class="badge badge-gray" style="cursor:pointer" onclick="event.stopPropagation();openGuildProfile('${g.id}')" title="${escapeHtml(g.name)}">【${escapeHtml(g.tag)}】</span>`;
}
