/**
 * PAGE POUBELLE — voir ce qui peut disparaître, et le décider soi-même.
 *
 * ⚠ RIEN N'EST COCHÉ PAR DÉFAUT et rien ne part sans confirmation. Une suppression est
 *   irréversible : elle ne doit jamais pouvoir arriver par un clic distrait ou un
 *   rafraîchissement. Le bouton dit toujours combien de gigaoctets et combien de lots.
 *
 * La page n'invente aucune règle : elle affiche l'inventaire de lib/poubelle.js.
 */
AgentOS.register("poubelle", {
  title: "Poubelle",
  async render(el) {
    const { api, esc, toast } = AgentOS;
    const go = (o) => (o / 1073741824).toFixed(2);
    const taille = (o) => (o >= 1073741824 ? `${go(o)} Go` : `${(o / 1048576).toFixed(0)} Mo`);
    const TYPES = [
      ["fichiers-de-travail", "🧰", "Fichiers de travail", "segments, images sources, voix, assemblages — servaient à fabriquer une vidéo terminée"],
      ["video-publiee", "📤", "Vidéos déjà publiées", "elles sont sur YouTube — retéléchargeables à tout moment depuis YouTube Studio"],
    ];
    let inv = null;
    const choisis = new Set();

    async function draw() {
      el.innerHTML = `<div class="card"><div class="small muted">Inventaire en cours…</div></div>`;
      try { inv = await api("/api/poubelle"); }
      catch (e) { el.innerHTML = `<div class="card"><div class="small" style="color:var(--err)">Inventaire impossible : ${esc(e.message)}</div></div>`; return; }
      paint();
    }

    function paint() {
      const selOctets = inv.lots.filter((l) => choisis.has(l.id)).reduce((s, l) => s + l.octets, 0);

      el.innerHTML = `
        <div class="card">
          <div class="row between" style="align-items:flex-start">
            <div>
              <h2 style="margin:0">🗑 Poubelle</h2>
              <p class="small muted" style="margin:6px 0 0;line-height:1.65;max-width:720px">
                Ce qui peut disparaître <b>sans rien casser</b>. Les runs en cours, les vidéos jamais
                publiées, les miniatures et les sous-titres sont <b>protégés</b> et n'apparaissent
                jamais ici. Rien n'est coché au départ : tu choisis.
              </p>
            </div>
            <div style="text-align:right">
              <div style="font-size:30px;font-weight:800;color:#e8913a;line-height:1">${go(inv.total)} Go</div>
              <div class="small muted">récupérables · ${inv.lots.length} lots</div>
            </div>
          </div>
          ${inv.enCours.length ? `<div class="empty small" style="margin:14px 0 0;color:var(--err);border-color:rgba(248,113,113,.4)">
            ⚠ <b>Génération en cours</b> (${inv.enCours.map(esc).join(", ")}) — la suppression est bloquée tant qu'elle tourne.</div>` : ""}
          ${!inv.lots.length ? `<div class="empty small" style="margin:14px 0 0">Rien à jeter pour l'instant.</div>` : ""}
        </div>

        ${TYPES.map(([t, ico, nom, quoi]) => {
          const lots = inv.lots.filter((l) => l.type === t);
          if (!lots.length) return "";
          const somme = lots.reduce((s, l) => s + l.octets, 0);
          return `<div class="card">
            <div class="row between" style="align-items:center">
              <div><h3 style="margin:0">${ico} ${nom} <span class="muted" style="font-weight:400">— ${taille(somme)}</span></h3>
                <div class="small muted" style="margin-top:3px">${quoi}</div></div>
              <button class="btn btn-sm" data-tout="${esc(t)}">Tout cocher</button>
            </div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:5px">
              ${lots.map((l) => `
                <label class="row" style="gap:10px;align-items:center;padding:7px 10px;border-radius:8px;background:var(--card-2,#12151b);cursor:pointer">
                  <input type="checkbox" data-lot="${esc(l.id)}" ${choisis.has(l.id) ? "checked" : ""}>
                  <span class="mono small" style="width:88px;text-align:right;color:#e8913a">${taille(l.octets)}</span>
                  <span class="grow small" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(l.titre))}</span>
                  ${l.url ? `<a class="small" href="${esc(l.url)}" target="_blank" style="flex:none">▶ YouTube</a>` : ""}
                </label>`).join("")}
            </div>
          </div>`;
        }).join("")}

        ${(inv.inconnus || []).length ? `<div class="card">
          <h3 style="margin:0">🔒 Dossiers non identifiés — jamais proposés</h3>
          <div class="small muted" style="margin:6px 0 10px;max-width:760px;line-height:1.65">
            Ces dossiers vivent dans <code>output/machines/</code> sans correspondre à aucun run.
            Ce sont souvent des <b>magasins partagés</b> (images de référence des personnages,
            bibliothèques) dont les prochaines vidéos ont besoin. Ils sont <b>signalés, jamais
            supprimables</b> d'ici. Si l'un d'eux est vraiment inutile, supprime-le à la main.
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${inv.inconnus.map((x) => `<span class="badge" style="font-family:ui-monospace,monospace">${esc(x.nom)} · ${taille(x.octets)}</span>`).join("")}
          </div>
        </div>` : ""}

        <div class="card" style="position:sticky;bottom:12px">
          <div class="row between" style="align-items:center">
            <div class="small muted">${choisis.size
              ? `<b>${choisis.size}</b> lot(s) cochés — <b style="color:#e8913a">${taille(selOctets)}</b> seront supprimés définitivement.`
              : "Coche ce que tu veux supprimer."}</div>
            <button class="btn btn-accent" id="pb-go" ${choisis.size && !inv.enCours.length ? "" : "disabled"}>🗑 Supprimer ${choisis.size ? taille(selOctets) : ""}</button>
          </div>
        </div>`;

      el.querySelectorAll("[data-lot]").forEach((c) => c.addEventListener("change", () => {
        c.checked ? choisis.add(c.dataset.lot) : choisis.delete(c.dataset.lot);
        paint();
      }));
      el.querySelectorAll("[data-tout]").forEach((b) => b.addEventListener("click", () => {
        const lots = inv.lots.filter((l) => l.type === b.dataset.tout);
        const tousCoches = lots.every((l) => choisis.has(l.id));
        lots.forEach((l) => (tousCoches ? choisis.delete(l.id) : choisis.add(l.id)));
        paint();
      }));
      const bouton = el.querySelector("#pb-go");
      if (bouton) bouton.addEventListener("click", async () => {
        const n = choisis.size, poids = taille(selOctets);
        // ⚠ Confirmation explicite : irréversible, et on redit ce qui part.
        if (!confirm(`Supprimer définitivement ${n} lot(s), soit ${poids} ?\n\nLes miniatures, les sous-titres, les runs en cours et les vidéos jamais publiées ne sont PAS touchés.`)) return;
        bouton.disabled = true; bouton.textContent = "Suppression…";
        try {
          const r = await api("/api/poubelle/vider", { method: "POST", body: { ids: [...choisis] } });
          toast(`${taille(r.octets)} libérés (${r.fichiers} fichiers)`, "ok");
          choisis.clear();
          await draw();
        } catch (e) { toast(e.message, "err"); bouton.disabled = false; bouton.textContent = "🗑 Supprimer"; }
      });
    }

    await draw();
  },
});
