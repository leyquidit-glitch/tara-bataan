// Runs on each business page: counts the visit, counts button clicks, sends inquiries.
(function(){
  const biz = window.TB_BIZ;
  if (!biz) return;
  renderHeader().then(async me => {
    if (!me || !biz.missing || !biz.missing.length) return;
    let canEdit = me.role === "admin";
    if (!canEdit){
      const { data } = await sb.from("businesses").select("id").eq("id", biz.id).eq("owner_id", me.id).maybeSingle();
      canEdit = !!data;
    }
    if (!canEdit) return;
    const list = biz.missing.length > 1 ? biz.missing.slice(0, -1).join(", ") + " and " + biz.missing.slice(-1) : biz.missing[0];
    $("#ownerNudge").innerHTML = `<div class="note"><b>Only you can see this.</b> Your page would get more calls with ${esc(list)}.
      <a href="/account.html?edit=${encodeURIComponent(biz.id)}">Edit listing</a></div>`;
  });

  // Count one view per visitor per day, so refreshes don't inflate the numbers
  const key = "tb_view_" + biz.id + "_" + new Date().toISOString().slice(0,10);
  let seen = false;
  try { seen = !!localStorage.getItem(key); localStorage.setItem(key, "1"); } catch {}
  if (!seen) sb.from("listing_events").insert({ business_id: biz.id, kind: "view" }).then(() => {});

  document.addEventListener("click", e => {
    const a = e.target.closest("[data-track]"); if (!a) return;
    sb.from("listing_events").insert({ business_id: biz.id, kind: a.dataset.track }).then(() => {});
  });

  const form = $("#inquiry");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#iq-name").value.trim(), contact = $("#iq-contact").value.trim(), message = $("#iq-msg").value.trim();
    if (!name || !contact || !message){ toast("Please fill in your name, contact and message."); return; }
    const btn = form.querySelector("button"); btn.disabled = true; btn.textContent = "Sending…";
    const { error } = await sb.from("inquiries").insert({ business_id: biz.id, name, contact, message });
    btn.disabled = false; btn.textContent = "Send message";
    if (error){ toast("Your message didn't go through. Please try again."); console.error(error); return; }
    sb.from("listing_events").insert({ business_id: biz.id, kind: "inquiry" }).then(() => {});
    form.innerHTML = `<h2 style="font-size:18px">Message sent</h2><p class="meta" style="margin:0">${esc(biz.name)} will get back to you at ${esc(contact)}.</p>`;
  });
})();
