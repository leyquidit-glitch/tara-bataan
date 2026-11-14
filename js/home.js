// Homepage: tourism rows when browsing, a results grid when searching or filtering.

// Add your published travel guides here. The section stays hidden while this is empty.
// Example: { kicker: "Stay", title: "Bagac beach resorts under ₱3,000", href: "/guides/bagac-beach-resorts.html" }
const GUIDES = [];

const TILE_INFO = {
  stay: ["Stay", "Beach resorts & hotels"],
  tours: ["Things to do", "Tours, hikes, island hopping"],
  food: ["Eat", "Seafood, cafés, merienda"],
  pasalubong: ["Pasalubong", "Take-home treats"]
};
const ROW_TITLES = { stay: "Where to stay", tours: "Things to do", food: "Where to eat", pasalubong: "Pasalubong" };

let all = [], cats = [];
const params = new URLSearchParams(location.search);
let state = { q: params.get("q") || "", town: params.get("town") || "", cat: params.get("cat") || "" };

function sync(){
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q); if (state.town) p.set("town", state.town); if (state.cat) p.set("cat", state.cat);
  history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
}

function renderControls(){
  $("#town").innerHTML = `<option value="">All towns</option>` + TOWNS.map(t => `<option ${t===state.town?"selected":""}>${t}</option>`).join("");
  $("#q").value = state.q;
  $("#tiles").innerHTML = cats.filter(c => c.tourism).map(c => {
    const [a,b] = HUES[c.slug] || ["#555","#999"]; const [label, sub] = TILE_INFO[c.slug] || [c.name, ""];
    return `<button class="tile" type="button" data-cat="${esc(c.slug)}" style="background:linear-gradient(135deg,${a},${b})"><b>${esc(label)}</b><span>${esc(sub)}</span></button>`;
  }).join("");
  $("#cats").innerHTML = [{slug:"", name:"All"}, ...cats].map(c =>
    `<button class="chip" type="button" data-cat="${esc(c.slug)}" aria-pressed="${c.slug === state.cat}">${esc(c.name)}</button>`).join("");
}

function render(){
  sync(); renderControls();
  const browsing = !state.q && !state.town && !state.cat;
  $("#curated").hidden = !browsing; $("#results").hidden = browsing;
  if (browsing) return renderCurated();

  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter(b =>
    (!state.cat || b.category_slug === state.cat) && (!state.town || b.town === state.town) &&
    words.every(w => [b.name, b.tagline, b.town, b.category_name, b.description].join(" ").toLowerCase().includes(w)));
  const cat = cats.find(c => c.slug === state.cat);
  $("#resTitle").textContent = [cat ? cat.name : "All businesses", state.town ? "in " + state.town : ""].filter(Boolean).join(" ");
  $("#resCount").textContent = `${list.length} ${list.length === 1 ? "listing" : "listings"}`;
  $("#resGrid").innerHTML = list.length ? list.map(card).join("")
    : `<p class="empty">Nothing here yet. Try another town or category, or <a href="/list-your-business.html">list your business</a>.</p>`;
}

function renderCurated(){
  const premium = all.filter(b => b.plan === "premium");
  $("#spotWrap").hidden = !premium.length;
  $("#spot").innerHTML = premium.map(card).join("");
  $("#rows").innerHTML = cats.filter(c => c.tourism).map(c => {
    const items = all.filter(b => b.category_slug === c.slug);
    if (!items.length) return "";
    return `<div class="section-h"><h2>${esc(ROW_TITLES[c.slug] || c.name)}</h2><button class="seeall" type="button" data-cat="${esc(c.slug)}">See all ${items.length} →</button></div>
      <div class="rowscroll">${items.slice(0,12).map(card).join("")}</div>`;
  }).join("");
  $("#guidesWrap").hidden = !GUIDES.length;
  $("#guides").innerHTML = GUIDES.map(g => `<a class="guide" href="${esc(g.href)}"><span class="kicker">${esc(g.kicker)}</span><b>${esc(g.title)}</b></a>`).join("");
  const local = all.filter(b => !b.tourism);
  $("#localWrap").hidden = !local.length;
  $("#local").innerHTML = local.map(card).join("");
  if (!all.length) $("#rows").innerHTML = `<p class="empty">No businesses are listed yet. <a href="/list-your-business.html">Be the first to list yours.</a></p>`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-cat]"); if (!t) return;
  state.cat = t.dataset.cat; render();
  if (state.cat) $("#results").scrollIntoView({ block: "start" });
});
let typing;
$("#q").addEventListener("input", e => { clearTimeout(typing); typing = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 200); });
$("#town").addEventListener("change", e => { state.town = e.target.value; render(); });
$("#searchForm").addEventListener("submit", e => { e.preventDefault(); state.q = $("#q").value.trim(); render(); });

(async function init(){
  renderHeader("home");
  if (CFG.FREE_MODE) $("#paidNote").remove();
  const [d, c] = await Promise.all([
    sb.from("directory").select("*").order("plan_rank", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("categories").select("*").order("sort_order")
  ]);
  $("#loading").hidden = true;
  if (d.error || c.error){
    $("#loadError").hidden = false;
    $("#loadError").textContent = "We couldn't load the directory right now. Please refresh in a moment.";
    console.error(d.error || c.error); return;
  }
  all = d.data; cats = c.data;
  render();
})();
