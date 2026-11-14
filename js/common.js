// Shared helpers for every page.
const CFG = window.TB_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

const TOWNS = ["Abucay","Bagac","Balanga","Dinalupihan","Hermosa","Limay","Mariveles","Morong","Orani","Orion","Pilar","Samal"];
const PLANS = {
  basic:    {name:"Basic",    price:0,    perks:["Your own business page","Contact details, hours and map link","1 cover photo","Shows up in search"]},
  featured: {name:"Featured", price:999,  perks:["Shown above Basic listings in your category","Featured badge","Monthly views and clicks report","Everything in Basic"]},
  premium:  {name:"Premium",  price:2499, perks:["Homepage Spotlight","A written feature article about your business","Shared on Tara Bataan's social pages","Everything in Featured"]}
};
const HUES = {stay:["#0f8b8d","#3fb8b0"], tours:["#4f8a22","#8cbf4f"], food:["#d9661a","#f6a04d"], pasalubong:["#c9184a","#e8577c"],
              beauty:["#b5446e","#e07aa0"], fitness:["#2f7d5b","#5fb38a"], services:["#6b4a35","#a07a5c"], events:["#7b3fa0","#b47fd6"]};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const peso = n => n === 0 ? "Free" : "₱" + Number(n).toLocaleString("en-PH");
const initials = n => String(n).split(/\s+/).filter(w => /[A-Za-z]/.test(w[0] || "")).slice(0,2).map(w => w[0]).join("").toUpperCase() || "TB";
const slugify = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ñ/g,"n")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70);
const safeUrl = u => { try { const x = new URL(u.startsWith("http") ? u : "https://" + u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };

function coverStyle(b){
  const [a,c] = HUES[b.category_slug] || ["#555","#999"];
  return b.cover_url ? `background:#ddd url('${esc(b.cover_url)}') center/cover` : `background:linear-gradient(135deg,${a},${c})`;
}
function badge(plan){
  return plan === "premium" ? `<span class="badge b-premium">★ Premium</span>` : plan === "featured" ? `<span class="badge b-featured">Featured</span>` : "";
}
function card(b){
  return `<a class="card ${b.plan !== "basic" ? "featured" : ""}" href="/b/${encodeURIComponent(b.slug)}">
    <div class="cover" style="${coverStyle(b)}">${b.cover_url ? "" : esc(initials(b.name))}</div>
    <div class="txt">${badge(b.plan)}<div class="name">${esc(b.name)}</div>
      <div class="meta">${esc(b.tagline || "")}</div><div class="meta">${esc(b.category_name)} · ${esc(b.town)}</div></div></a>`;
}

let toastTimer;
function toast(msg){
  let t = $("#toast");
  if (!t){ t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block"; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = "none", 3500);
}

async function currentProfile(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  return data || { id: session.user.id, email: session.user.email, role: "owner" };
}

async function renderHeader(active){
  const me = await currentProfile();
  const link = (href, label, key, cls="") => `<a href="${href}" class="${cls}" ${active===key ? 'aria-current="page"' : ""}>${label}</a>`;
  $("#nav").innerHTML = [
    link("/", "Explore", "home"),
    me ? link("/account.html", "My listings", "account") : "",
    me && me.role === "admin" ? link("/admin.html", "Admin", "admin") : "",
    me ? `<button type="button" class="linkish" id="logout">Log out</button>` : link("/login.html", "Log in", "login"),
    link("/list-your-business.html", "List your business", "list", "cta")
  ].join("");
  const lo = $("#logout");
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); location.href = "/"; };
  return me;
}

async function requireLogin(){
  const me = await currentProfile();
  if (!me){ location.href = "/login.html?next=" + encodeURIComponent(location.pathname + location.search); return null; }
  return me;
}
