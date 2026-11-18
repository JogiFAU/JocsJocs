const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function sourceReferencesHtml(references, limit) {
  const rows = (references || []).slice(0, limit);
  if (!rows.length) return '<p class="checkedSources__empty">Keine geprüften Quellen zugeordnet.</p>';
  return `<div class="checkedSources" data-source-references="${escapeHtml(JSON.stringify(rows))}"><strong>Geprüfte Quellen</strong><ul>${rows.map((row,index) =>
    `<li><button type="button" class="checkedSources__link" data-source-index="${index}" aria-label="${escapeHtml(row.pdfName)} · PDF-Seite ${row.pdfPage} im Quellenfenster öffnen">${escapeHtml(row.pdfName)} · PDF-Seite ${row.pdfPage}</button></li>`).join('')}</ul></div>`;
}

export function wireSourceViewer() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-source-index]');
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    try {
      const sources = JSON.parse(button.closest('[data-source-references]').dataset.sourceReferences);
      const token = 'source-viewer-' + crypto.randomUUID();
      // Short-lived local handoff works with noopener and multiple app tabs.
      for (let i=localStorage.length-1;i>=0;i--) {
        const key=localStorage.key(i);
        if (key?.startsWith('source-viewer-')) {
          try { if (Date.now()-JSON.parse(localStorage.getItem(key)).created>3600000) localStorage.removeItem(key); } catch {}
        }
      }
      localStorage.setItem(token, JSON.stringify({created:Date.now(),sources,selected:Number(button.dataset.sourceIndex)}));
      const url = new URL('../../source-viewer.html', import.meta.url);
      url.hash = token;
      button.dataset.viewerTarget = url.href;
      const viewer = window.open(url.href, '_blank', 'popup,width=1280,height=850');
      if (viewer) viewer.opener = null;
      else {
        const group=button.closest('[data-source-references]');
        group.querySelector('.checkedSources__fallback')?.remove();
        const fallback=document.createElement('a');fallback.className='checkedSources__fallback';
        fallback.href=url.href;fallback.target='_blank';fallback.rel='noopener';
        fallback.textContent='Fenster blockiert? Quellenviewer in neuem Tab öffnen';
        group.append(fallback);
      }
    } catch {
      window.alert('Quellenfenster konnte nicht geöffnet werden. Bitte lokalen Browserspeicher und Pop-up-Freigabe prüfen.');
    }
  }, true);
}
