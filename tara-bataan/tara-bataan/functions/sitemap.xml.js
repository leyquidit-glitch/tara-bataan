// /sitemap.xml lists every approved business page so Google can find them.
import { supa } from "../server/shared.js";

export async function onRequestGet({ env, request }){
  const origin = new URL(request.url).origin;
  let rows = [];
  try { rows = await supa(env, "directory?select=slug,created_at&order=created_at.desc"); } catch (e) { console.error(e); }
  const urls = [
    `<url><loc>${origin}/</loc><changefreq>daily</changefreq></url>`,
    `<url><loc>${origin}/list-your-business.html</loc></url>`,
    ...rows.map(r => `<url><loc>${origin}/b/${r.slug}</loc><lastmod>${String(r.created_at).slice(0,10)}</lastmod></url>`)
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
    { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
