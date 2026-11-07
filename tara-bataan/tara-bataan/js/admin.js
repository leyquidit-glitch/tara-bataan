// Admin panel: review listings, switch on paid plans, log payments.
let biz = [], payments = [], tab = "pending";
const todayStr = () => new Date().toISOString().slice(0,10);
const addMonths = (dateStr, m) => { const d = new Date(dateStr + "T00:00"); d.setMonth(d.getMonth() + m); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); };
const nice = d => d ? new Date(d + "T00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "";
const paidActive = b => b.plan_id !== "basic" && b.featured_until && b.featured_until >= todayStr();

(async function init(){
  const me = await requireLogin(); if (!me) return;
  renderHeader("admin");
  if (me.role !== "admin"){ $("#denied").hidden = false; return; }
  $("#admin").hidden = false;
  await load();
})();

async function load(){
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [b, p] = await Promise.all([
    sb.from("businesses").select("*, categories(name), profiles(email)").order("created_at", { ascending: false }),
    sb.from("payments").select("*").gte("created_at", since)
  ]);
  if (b.error){ toast("Couldn't load listings."); console.error(b.error); return; }
  biz = b.data; payments = p.data || [];
  render();
}

function render(){
  const live = biz.filter(b => b.status === "approved");
  const pending = biz.filter(b => b.status === "pending");
  const paying = biz.filter(paidActive);
  const weekAhead = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
  const expiring = paying.filter(b => b.featured_until <= weekAhead);
  const revenue = payments.reduce((s, x) => s + x.amount_php, 0);
  $("#stats").innerHTML = [
    [peso(revenue).replace("Free","₱0"), "Payments, last 30 days"], [live.length, "Live listings"],
    [paying.length, "Paying businesses"], [pending.length, "Waiting for review"], [expiring.length, "Paid plans ending within 7 days"]
  ].map(([v,l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");

  const TABS = [["pending","Waiting for review",pending.length],["live","Live",live.length],["paying","Paying",paying.length],["upgrade","Asked to upgrade",biz.filter(b => b.requested_plan && b.requested_plan !== "basic" && !paidActive(b)).length],["all","All",biz.length]];
  $("#tabs").innerHTML = TABS.map(([k,l,n]) => `<button class="chip" type="button" data-tab="${k}" aria-pressed="${tab===k}">${l} (${n})</button>`).join("");

  const list = biz.filter(b => tab === "all" ? true : tab === "pending" ? b.status === "pending" : tab === "live" ? b.status === "approved"
    : tab === "paying" ? paidActive(b) : (b.requested_plan && b.requested_plan !== "basic" && !paidActive(b)));
  $("#rows").innerHTML = list.length ? list.map(b => {
    const plan = paidActive(b) ? `${badge(b.plan_id)}<div class="meta">until ${nice(b.featured_until)}</div>` : `Basic${b.requested_plan && b.requested_plan !== "basic" ? `<div class="meta">wants ${PLANS[b.requested_plan].name}</div>` : ""}`;
    const st = { pending:"b-pending", approved:"b-approved", rejected:"b-rejected", paused:"b-pending" }[b.status];
    return `<tr>
      <td><b>${esc(b.name)}</b><div class="meta">${esc(b.categories?.name || "")} · ${esc(b.town)}</div>${b.tagline ? `<div class="meta">${esc(b.tagline)}</div>` : ""}</td>
      <td class="meta">${esc(b.profiles?.email || "—")}${b.phone ? `<br>${esc(b.phone)}` : ""}</td>
      <td>${plan}</td>
      <td><span class="badge ${st}">${esc(b.status)}</span></td>
      <td><div class="actions">
        ${b.status !== "approved" ? `<button class="btn small primary" type="button" data-act="approve" data-id="${b.id}">Approve</button>` : `<a class="btn small" href="/b/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">View</a>`}
        ${b.status === "pending" ? `<button class="btn small" type="button" data-act="reject" data-id="${b.id}">Needs changes</button>` : ""}
        ${b.status === "approved" ? `<button class="btn small" type="button" data-act="pause" data-id="${b.id}">Pause</button>` : ""}
        <button class="btn small" type="button" data-act="plan" data-id="${b.id}">Plan & payment</button>
      </div></td></tr>`;
  }).join("") : `<tr><td colspan="5" class="meta">Nothing here.</td></tr>`;
}

async function setStatus(b, status, note){
  const { error } = await sb.from("businesses").update({ status, admin_note: note ?? null }).eq("id", b.id);
  if (error){ toast("Couldn't update. " + error.message); return; }
  toast(status === "approved" ? `${b.name} is live.` : status === "paused" ? `${b.name} is hidden from the site.` : `${b.name} was sent back to the owner.`);
  load();
}

const dlg = $("#dlg");
function rejectDialog(b){
  dlg.innerHTML = `<form class="panel" id="rejForm" style="border:none"><h2 style="font-size:20px">What should ${esc(b.name)} fix?</h2>
    <div class="field"><label for="rj">Note to the owner</label><textarea id="rj" required placeholder="e.g. Please add a real photo of your resort and a working phone number"></textarea></div>
    <div class="actions"><button class="btn primary" type="submit">Send back</button><button class="btn" type="button" data-close>Cancel</button></div></form>`;
  dlg.showModal();
  $("#rejForm").onsubmit = e => { e.preventDefault(); const n = $("#rj").value.trim(); if (!n) return toast("Add a short note so they know what to fix."); dlg.close(); setStatus(b, "rejected", n); };
}
function planDialog(b){
  const start = paidActive(b) ? new Date(new Date(b.featured_until + "T00:00").getTime() + 86400000).toISOString().slice(0,10) : todayStr();
  const want = b.requested_plan && b.requested_plan !== "basic" ? b.requested_plan : (b.plan_id !== "basic" ? b.plan_id : "featured");
  dlg.innerHTML = `<form class="panel" id="planForm" style="border:none">
    <h2 style="font-size:20px">Plan for ${esc(b.name)}</h2>
    <div class="note">Currently: ${paidActive(b) ? `${PLANS[b.plan_id].name} until ${nice(b.featured_until)}` : "Basic"}${b.status !== "approved" ? ". It also needs to be approved before it shows on the site." : ""}</div>
    <div class="two">
      <div class="field"><label for="pl">Plan</label><select id="pl">${["featured","premium"].map(k => `<option value="${k}" ${k===want?"selected":""}>${PLANS[k].name} · ${peso(PLANS[k].price)}/mo</option>`).join("")}</select></div>
      <div class="field"><label for="mo">Months</label><select id="mo">${[1,3,6,12].map(m => `<option>${m}</option>`).join("")}</select></div>
    </div>
    <div class="two">
      <div class="field"><label for="st">Starts</label><input id="st" type="date" value="${start}"></div>
      <div class="field"><label for="amt">Amount received (₱)</label><input id="amt" inputmode="numeric"></div>
    </div>
    <div class="two">
      <div class="field"><label for="pm">Paid by</label><select id="pm"><option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="free">Free / promo (no payment)</option></select></div>
      <div class="field"><label for="ref">Reference number</label><input id="ref" placeholder="GCash ref no."></div>
    </div>
    <p class="meta" id="ends" style="margin:0"></p>
    <div class="actions"><button class="btn primary" type="submit">Save plan</button>
      ${paidActive(b) ? `<button class="btn" type="button" id="endNow">End paid plan now</button>` : ""}
      <button class="btn" type="button" data-close>Cancel</button></div></form>`;
  dlg.showModal();
  const upd = () => {
    const m = +$("#mo").value; $("#amt").value = $("#pm").value === "free" ? 0 : PLANS[$("#pl").value].price * m;
    $("#ends").textContent = `Paid placement runs ${nice($("#st").value)} to ${nice(addMonths($("#st").value, m))}.`;
  };
  ["#pl","#mo","#st","#pm"].forEach(s => $(s).addEventListener("change", upd)); upd();
  const end = $("#endNow");
  if (end) end.onclick = async () => {
    const { error } = await sb.from("businesses").update({ plan_id: "basic", featured_until: null }).eq("id", b.id);
    if (error) return toast("Couldn't end the plan."); dlg.close(); toast("Back to Basic."); load();
  };
  $("#planForm").onsubmit = async e => {
    e.preventDefault();
    const plan = $("#pl").value, m = +$("#mo").value, startD = $("#st").value, endD = addMonths(startD, m), method = $("#pm").value;
    if (!startD) return toast("Pick a start date.");
    if (method !== "free"){
      const amt = parseInt($("#amt").value, 10);
      if (!(amt > 0)) return toast("Enter the amount you received.");
      const pay = await sb.from("payments").insert({ business_id: b.id, plan_id: plan, amount_php: amt, method, reference: $("#ref").value.trim() || null, period_start: startD, period_end: endD });
      if (pay.error){ console.error(pay.error); return toast("Couldn't save the payment."); }
    }
    const { error } = await sb.from("businesses").update({ plan_id: plan, featured_until: endD, requested_plan: plan }).eq("id", b.id);
    if (error){ console.error(error); return toast("Payment saved, but the plan didn't update. Try again."); }
    dlg.close(); toast(`${b.name} is ${PLANS[plan].name} until ${nice(endD)}.`); load();
  };
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-close]")) return dlg.close();
  const t = e.target.closest("[data-tab]"); if (t){ tab = t.dataset.tab; return render(); }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const b = biz.find(x => x.id === a.dataset.id); if (!b) return;
  if (a.dataset.act === "approve") setStatus(b, "approved");
  if (a.dataset.act === "reject") rejectDialog(b);
  if (a.dataset.act === "pause") setStatus(b, "paused");
  if (a.dataset.act === "plan") planDialog(b);
});
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
