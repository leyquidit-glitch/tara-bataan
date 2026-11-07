// Owner dashboard: list my businesses with stats and messages, and add/edit a listing.
let me, cats = [], editing = null, coverFile = null;
const qs = new URLSearchParams(location.search);
const STATUS = { pending: ["b-pending","Waiting for review"], approved: ["b-approved","Live"], rejected: ["b-rejected","Needs changes"], paused: ["b-pending","Paused"] };

(async function init(){
  me = await requireLogin(); if (!me) return;
  renderHeader("account");
  const c = await sb.from("categories").select("*").order("sort_order");
  cats = c.data || [];
  if (qs.get("new") || qs.get("edit")) return showForm(qs.get("edit"));
  showList();
})();

/* ---------- my listings ---------- */
async function showList(){
  $("#listView").hidden = false; $("#formView").hidden = true;
  $("#hello").textContent = `Logged in as ${me.email}`;
  const { data: biz, error } = await sb.from("businesses").select("*, categories(name, slug)").eq("owner_id", me.id).order("created_at", { ascending: false });
  if (error){ $("#myBiz").innerHTML = `<div class="error">We couldn't load your listings. Please refresh.</div>`; console.error(error); return; }
  if (!biz.length){ $("#myBiz").innerHTML = `<div class="panel"><p style="margin:0">You haven't added a business yet.</p><div class="actions"><a class="btn primary" href="?new=1">Add my business</a></div></div>`; return; }
  const ids = biz.map(b => b.id);
  const [stats, inq] = await Promise.all([
    sb.from("listing_stats").select("*").in("business_id", ids),
    sb.from("inquiries").select("*").in("business_id", ids).order("created_at", { ascending: false }).limit(50)
  ]);
  const today = new Date().toISOString().slice(0,10);
  $("#myBiz").innerHTML = biz.map(b => {
    const s = (stats.data || []).find(x => x.business_id === b.id) || { views_30d: 0, clicks_30d: 0, inquiries_30d: 0 };
    const msgs = (inq.data || []).filter(m => m.business_id === b.id);
    const [cls, label] = STATUS[b.status];
    const paidActive = b.plan_id !== "basic" && b.featured_until && b.featured_until >= today;
    const planLine = paidActive ? `${PLANS[b.plan_id].name} until ${new Date(b.featured_until + "T00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`
      : b.requested_plan && b.requested_plan !== "basic" ? `Basic · ${PLANS[b.requested_plan].name} requested, waiting for payment` : "Basic (free)";
    return `<div class="panel">
      <div class="actions" style="justify-content:space-between">
        <div><h2 style="font-size:22px">${esc(b.name)}</h2><div class="meta">${esc(b.categories?.name || "")} · ${esc(b.town)}</div></div>
        <span class="badge ${cls}">${label}</span>
      </div>
      ${b.status === "rejected" && b.admin_note ? `<div class="error"><b>What to fix:</b> ${esc(b.admin_note)}. Edit your listing and it goes back for review.</div>` : ""}
      <div class="meta">Plan: ${esc(planLine)}</div>
      ${b.status === "approved" ? `<div class="stats">
        <div class="stat"><b>${s.views_30d}</b><span>Page views, last 30 days</span></div>
        <div class="stat"><b>${s.clicks_30d}</b><span>Calls, map and link clicks</span></div>
        <div class="stat"><b>${s.inquiries_30d}</b><span>Messages</span></div></div>` : ""}
      ${msgs.length ? `<details><summary><b>Messages from visitors (${msgs.length})</b></summary>
        <div style="display:grid;gap:10px;margin-top:10px">${msgs.map(m => `<div class="note"><b>${esc(m.name)}</b> · ${esc(m.contact)} · <span>${new Date(m.created_at).toLocaleString("en-PH")}</span><br>${esc(m.message)}</div>`).join("")}</div></details>` : ""}
      <div class="actions">
        <a class="btn" href="?edit=${b.id}">Edit listing</a>
        ${b.status === "approved" ? `<a class="btn" href="/b/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">View public page</a>` : ""}
        ${!paidActive ? `<a class="btn primary" href="?edit=${b.id}&upgrade=1">Upgrade</a>` : ""}
      </div>
    </div>`;
  }).join("");
}

/* ---------- add / edit ---------- */
async function showForm(id){
  $("#listView").hidden = true; $("#formView").hidden = false;
  $("#f-cat").innerHTML = `<option value="">Choose…</option>` + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#f-town").innerHTML = `<option value="">Choose…</option>` + TOWNS.map(t => `<option>${t}</option>`).join("");
  $("#f-plan").innerHTML = Object.entries(PLANS).map(([k,p]) => `<option value="${k}">${p.name} · ${peso(p.price)}${p.price ? "/month" : ""}</option>`).join("");
  $("#f-plan").value = PLANS[qs.get("plan")] ? qs.get("plan") : "basic";

  if (id){
    const { data, error } = await sb.from("businesses").select("*").eq("id", id).maybeSingle();
    if (error || !data){ toast("We couldn't find that listing."); return showList(); }
    editing = data;
    $("#formTitle").textContent = `Edit ${data.name}`;
    $("#saveBtn").textContent = data.status === "approved" ? "Save changes" : "Save and submit for review";
    const map = { "f-name":"name","f-cat":"category_id","f-town":"town","f-address":"address","f-tagline":"tagline","f-desc":"description","f-phone":"phone",
      "f-email":"email","f-hours":"hours","f-price":"price_range","f-fb":"facebook","f-web":"website","f-ig":"instagram","f-tt":"tiktok","f-map":"map_url" };
    Object.entries(map).forEach(([el,k]) => { $("#"+el).value = data[k] ?? ""; });
    $("#f-plan").value = qs.get("upgrade") ? (data.requested_plan && data.requested_plan !== "basic" ? data.requested_plan : "featured") : (data.requested_plan || data.plan_id);
    if (data.cover_url){ $("#coverPreview").src = data.cover_url; $("#coverPreview").hidden = false; }
    if (data.plan_id !== "basic") { $("#galleryField").hidden = false; loadGallery(); }
  }
  syncPayNote();
}
function syncPayNote(){
  const p = PLANS[$("#f-plan").value];
  const n = $("#payNote");
  n.hidden = !p.price;
  n.innerHTML = p.price ? `To activate <b>${p.name}</b>, send <b>${peso(p.price)}</b> for your first month by GCash to <b>${esc(CFG.GCASH_NAME)}</b>, <b>${esc(CFG.GCASH_NUMBER)}</b>. Put your business name in the message and email the receipt to ${esc(CFG.CONTACT_EMAIL)}. We'll switch it on once your listing is approved and payment is confirmed.` : "";
}
$("#f-plan").addEventListener("change", syncPayNote);
$("#f-cover").addEventListener("change", e => {
  const f = e.target.files[0]; coverFile = null;
  if (!f) return;
  if (f.size > 5 * 1024 * 1024){ toast("That photo is over 5 MB. Please pick a smaller one."); e.target.value = ""; return; }
  coverFile = f; $("#coverPreview").src = URL.createObjectURL(f); $("#coverPreview").hidden = false;
});

async function upload(file){
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from("listing-photos").upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return sb.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
}

$("#bizForm").addEventListener("submit", async e => {
  e.preventDefault();
  const v = id => $("#"+id).value.trim();
  if (!v("f-name") || !v("f-cat") || !v("f-town")){ toast("Please fill in the business name, category and town."); return; }
  const btn = $("#saveBtn"); btn.disabled = true; const label = btn.textContent; btn.textContent = "Saving…";
  try {
    const row = {
      name: v("f-name"), category_id: Number(v("f-cat")), town: v("f-town"), address: v("f-address") || null,
      tagline: v("f-tagline") || null, description: v("f-desc") || null, phone: v("f-phone") || null, email: v("f-email") || null,
      hours: v("f-hours") || null, price_range: v("f-price") || null, facebook: v("f-fb") || null, website: v("f-web") || null,
      instagram: v("f-ig") || null, tiktok: v("f-tt") || null, map_url: v("f-map") || null, requested_plan: v("f-plan")
    };
    if (coverFile) row.cover_url = await upload(coverFile);
    let res;
    if (editing) res = await sb.from("businesses").update(row).eq("id", editing.id).select().single();
    else {
      const base = slugify(`${row.name} ${row.town}`) || "business";
      res = await sb.from("businesses").insert({ ...row, slug: base }).select().single();
      if (res.error && res.error.code === "23505") res = await sb.from("businesses").insert({ ...row, slug: `${base}-${Math.random().toString(36).slice(2,6)}` }).select().single();
    }
    if (res.error) throw res.error;
    toast(editing ? "Changes saved." : "Submitted! We'll review your listing, usually within a day.");
    setTimeout(() => location.href = "/account.html", 900);
  } catch (err) {
    console.error(err);
    toast(err.message && err.message.includes("mime") ? "That file type isn't supported. Use JPG, PNG or WebP." : "Something went wrong saving. Please try again.");
    btn.disabled = false; btn.textContent = label;
  }
});

/* ---------- gallery (paid plans) ---------- */
async function loadGallery(){
  const { data } = await sb.from("business_photos").select("*").eq("business_id", editing.id).order("sort_order");
  $("#gallery").innerHTML = (data || []).map(p => `<div style="display:grid;gap:4px"><img src="${esc(p.url)}" alt=""><button class="btn small" type="button" data-delphoto="${p.id}">Remove</button></div>`).join("");
  $("#f-photos").disabled = (data || []).length >= 10;
}
$("#f-photos").addEventListener("change", async e => {
  const files = [...e.target.files].filter(f => f.size <= 5 * 1024 * 1024);
  const { count } = await sb.from("business_photos").select("id", { count: "exact", head: true }).eq("business_id", editing.id);
  const room = Math.max(0, 10 - (count || 0));
  if (!room){ toast("You already have 10 photos. Remove one first."); return; }
  toast("Uploading photos…");
  try {
    for (const [i, f] of files.slice(0, room).entries()){
      const url = await upload(f);
      const { error } = await sb.from("business_photos").insert({ business_id: editing.id, url, sort_order: (count || 0) + i });
      if (error) throw error;
    }
    toast("Photos added."); e.target.value = ""; loadGallery();
  } catch (err) { console.error(err); toast("Some photos didn't upload. Please try again."); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-delphoto]"); if (!b) return;
  const { error } = await sb.from("business_photos").delete().eq("id", b.dataset.delphoto);
  if (error) toast("Couldn't remove that photo."); else loadGallery();
});
