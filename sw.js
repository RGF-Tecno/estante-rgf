/* Estante RGF: service worker (uso offline e recebimento de PDF compartilhado) */
const VERSAO = "estante-rgf-v3";
const ARQUIVOS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./lib/pdf.min.js", "./lib/pdf.worker.min.js", "./lib/jspdf.umd.min.js",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/icone-maskable-512.png",
  "./icones/apple-touch-icon.png", "./icones/favicon.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== VERSAO && k !== "estante-compartilhado").map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  /* PDF recebido pelo menu Compartilhar do Android */
  if (e.request.method === "POST" && url.pathname.endsWith("/compartilhar")) {
    e.respondWith((async () => {
      try {
        const dados = await e.request.formData();
        const f = dados.get("pdf");
        if (f && f.size) {
          const c = await caches.open("estante-compartilhado");
          await c.put("/__compartilhado__", new Response(f, {
            headers: { "Content-Type": "application/pdf", "X-Nome": encodeURIComponent(f.name || "livro.pdf") }
          }));
        }
      } catch (err) {}
      return Response.redirect(new URL("./?compartilhado=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET") return;
  /* fontes do Google: guardadas após o primeiro uso */
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(caches.open(VERSAO).then(async c => {
      const r = await c.match(e.request);
      if (r) return r;
      try { const n = await fetch(e.request); c.put(e.request, n.clone()); return n; } catch (err) { return new Response("", { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  /* app: rede primeiro para receber atualizações, cache quando offline */
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
});
