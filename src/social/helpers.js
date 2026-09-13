// src/social/helpers.js
// Pequenos geradores de HTML pra icones de grupos/comunidades -- so
// olham pro objeto que recebem, nao dependem de nada externo.

export function groupIconHtml(g) {
  const icon = g && g.icon;
  if (icon && (icon.startsWith('http') || icon.startsWith('data:image'))) {
    return `<img src="${icon}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  }
  return icon || '👥';
}

export function communityIconHtml(c) {
  const icon = c && c.icon;
  if (icon && (icon.startsWith('http') || icon.startsWith('data:image'))) {
    return `<img src="${icon}" alt="" style="width:20px;height:20px;object-fit:cover;border-radius:50%;vertical-align:middle">`;
  }
  return icon || '🏰';
}

export function communityIconHtmlBig(c) {
  const icon = c && c.icon;
  if (icon && (icon.startsWith('http') || icon.startsWith('data:image'))) {
    return `<img src="${icon}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  }
  return icon || '🏰';
}
