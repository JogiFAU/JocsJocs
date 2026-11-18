// Keep navigation constrained to actual exported image assets on the app origin.
export function safeViewerUrl(value, origin) {
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol) && url.origin===origin ? url.href : null; }
  catch { return null; }
}
export function viewerPage(source, page, origin) {
  const cited = page===source.pdfPage;
  const own = cited ? source.addresses?.find(a=>safeViewerUrl(a.pageUrl,origin))?.pageUrl : null;
  const exported = source.documentPages?.find(p=>p.pdfPage===page)?.pageUrl;
  return {page, cited, url:safeViewerUrl(own || exported, origin)};
}
export function adjacentPage(source, page, delta, origin) {
  if (![-1,1].includes(delta)) return null;
  const target=viewerPage(source,page+delta,origin);
  return target.url ? target : null;
}
