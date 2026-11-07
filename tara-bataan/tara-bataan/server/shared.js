// Shared helpers for Cloudflare Pages Functions (run on Cloudflare's servers, not in the browser).
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

export async function supa(env, path){
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 120, cacheEverything: true }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

export function safeUrl(u){
  if (!u) return "";
  try { const x = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); return /^https?:$/.test(x.protocol) ? x.href : ""; }
  catch { return ""; }
}

export const HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">`;

export const HEADER = `<header class="bar"><div class="wrap">
  <a class="logo" href="/">Tara <span>Bataan</span></a>
  <nav class="nav" id="nav"><a href="/">Explore</a><a href="/list-your-business.html" class="cta">List your business</a></nav>
</div></header>`;

export const FOOTER = `<footer><div class="wrap">
  <span>© Tara Bataan</span>
  <span><a href="/list-your-business.html">List your business</a> · <a href="/login.html">Owner login</a></span>
</div></footer>`;

export const SCRIPTS = `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/js/config.js"></script>
<script src="/js/common.js"></script>`;
