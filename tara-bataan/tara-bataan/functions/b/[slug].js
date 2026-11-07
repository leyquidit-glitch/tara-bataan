// Business page at /b/<slug>. Built on Cloudflare's server so Google sees the full page.
import { esc, supa, safeUrl, HEAD, HEADER, FOOTER, SCRIPTS } from "../../server/shared.js";

const SCHEMA_TYPE = { stay: "LodgingBusiness", food: "Restaurant", tours: "TouristAttraction", pasalubong: "Store",
                      beauty: "BeautySalon", fitness: "ExerciseGym", services: "LocalBusiness" };
const HUES = {stay:["#0f8b8d","#3fb8b0"], tours:["#4f8a22","#8cbf4f"], food:["#d9661a","#f6a04d"], pasalubong:["#c9184a","#e8577c"],
              beauty:["#b5446e","#e07aa0"], fitness:["#2f7d5b","#5fb38a"], services:["#6b4a35","#a07a5c"]};

export async function onRequestGet({ params, env, request }){
  const slug = String(params.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return notFound();
  let b, photos = [];
  try {
    const rows = await supa(env, `directory?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
    b = rows[0];
    if (b) photos = await supa(env, `business_photos?business_id=eq.${b.id}&select=url&order=sort_order`);
  } catch (err) {
    console.error(err);
    return new Response("Something went wrong loading this page. Please try again.", { status: 502 });
  }
  if (!b) return notFound();

  const url = new URL(request.url);
  const canonical = `${url.origin}/b/${slug}`;
  const title = `${b.name}, ${b.town} | Tara Bataan`;
  const desc = (b.tagline || b.description || `${b.category_name} in ${b.town}, Bataan`).slice(0, 155);
  const [h1, h2] = HUES[b.category_slug] || ["#555", "#999"];
  const cover = b.cover_url ? `background:#ddd url('${esc(b.cover_url)}') center/cover` : `background:linear-gradient(135deg,${h1},${h2})`;
  const initials = b.name.split(/\s+/).filter(w => /[A-Za-z]/.test(w[0] || "")).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const badge = b.plan === "premium" ? `<span class="badge b-premium">★ Premium</span>` : b.plan === "featured" ? `<span class="badge b-featured">Featured</span>` : "";

  const links = [
    b.phone && `<a class="btn primary" data-track="call" href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">Call ${esc(b.phone)}</a>`,
    safeUrl(b.map_url) && `<a class="btn" data-track="map" href="${esc(safeUrl(b.map_url))}" target="_blank" rel="noopener">Directions</a>`,
    safeUrl(b.facebook) && `<a class="btn" data-track="facebook" href="${esc(safeUrl(b.facebook))}" target="_blank" rel="noopener">Facebook</a>`,
    safeUrl(b.website) && `<a class="btn" data-track="website" href="${esc(safeUrl(b.website))}" target="_blank" rel="noopener">Website</a>`
  ].filter(Boolean).join("");

  const facts = [
    ["Category", b.category_name], ["Town", `${b.town}, Bataan`], ["Address", b.address], ["Hours", b.hours],
    ["Price range", b.price_range], ["Phone", b.phone], ["Email", b.email],
    ["Instagram", b.instagram], ["TikTok", b.tiktok]
  ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");

  const ld = {
    "@context": "https://schema.org", "@type": SCHEMA_TYPE[b.category_slug] || "LocalBusiness",
    name: b.name, description: desc, url: canonical, telephone: b.phone || undefined, image: b.cover_url || undefined,
    address: { "@type": "PostalAddress", streetAddress: b.address || undefined, addressLocality: b.town, addressRegion: "Bataan", addressCountry: "PH" }
  };

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="business.business">
${b.cover_url ? `<meta property="og:image" content="${esc(b.cover_url)}">` : ""}
${HEAD}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head><body>
${HEADER}
<main>
  <div class="wrap"><div class="biz-cover" style="${cover}" role="img" aria-label="${esc(b.name)}">${b.cover_url ? "" : esc(initials)}</div></div>
  <div class="wrap biz">
    <article style="display:grid;gap:14px;align-content:start">
      <a href="/?cat=${esc(b.category_slug)}" class="meta">← ${esc(b.category_name)} in Bataan</a>
      ${badge}
      <h1>${esc(b.name)}</h1>
      ${b.tagline ? `<p class="meta" style="margin:0;font-size:18px">${esc(b.tagline)}</p>` : ""}
      ${links ? `<div class="actions">${links}</div>` : ""}
      ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ""}
      ${photos.length ? `<div class="photos">${photos.map(p => `<img src="${esc(p.url)}" alt="${esc(b.name)}" loading="lazy">`).join("")}</div>` : ""}
    </article>
    <aside style="display:grid;gap:16px;align-content:start">
      <div class="panel"><h2 style="font-size:18px">Details</h2><dl class="facts">${facts}</dl></div>
      <form class="panel" id="inquiry" novalidate>
        <h2 style="font-size:18px">Send ${esc(b.name)} a message</h2>
        <div class="field"><label for="iq-name">Your name</label><input id="iq-name" required maxlength="80"></div>
        <div class="field"><label for="iq-contact">Mobile number or email</label><input id="iq-contact" required maxlength="120"></div>
        <div class="field"><label for="iq-msg">Message</label><textarea id="iq-msg" required maxlength="1000" placeholder="e.g. Do you have a room for 4 adults on Dec 20?"></textarea></div>
        <button class="btn primary" type="submit">Send message</button>
        <p class="meta" style="margin:0">The business owner will reply to you directly.</p>
      </form>
    </aside>
  </div>
</main>
${FOOTER}
${SCRIPTS}
<script>window.TB_BIZ = ${JSON.stringify({ id: b.id, name: b.name }).replace(/</g, "\\u003c")};</script>
<script src="/js/listing.js"></script>
</body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
}

function notFound(){
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found | Tara Bataan</title>${HEAD}</head><body>${HEADER}
<main class="wrap"><div class="hero"><h1>We couldn't find that business</h1><p>It may have moved or isn't listed anymore.</p>
<p><a class="btn primary" href="/">Explore Bataan</a></p></div></main>${FOOTER}</body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}
