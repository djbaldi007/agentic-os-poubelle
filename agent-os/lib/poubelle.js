/**
 * POUBELLE — ce qui peut disparaître sans rien casser.
 *
 * Une fois une vidéo terminée (et publiée), ses fichiers de fabrication dorment dans
 * `output/machines/<run>/` et finissent par peser des dizaines de Go. Cette page les montre et
 * laisse l'utilisateur décider. Deux sections, et seulement deux :
 *   1. FICHIERS DE TRAVAIL d'un run TERMINÉ (segments, images sources, voix, assemblages) ;
 *   2. VIDÉO FINALE d'un run DÉJÀ PUBLIÉ sur YouTube (retéléchargeable depuis YouTube Studio).
 *
 * ⚠ CE MODULE NE SUPPRIME JAMAIS DE SON PROPRE CHEF. Il inventorie, chiffre, et attend un ordre
 *   explicite portant sur des identifiants qu'il a lui-même proposés. Une suppression est
 *   irréversible : elle ne doit pas pouvoir arriver par effet de bord d'un rafraîchissement.
 *
 * ═══ CE QUI N'EST JAMAIS PROPOSÉ ═══
 *   - tout run qui n'est pas TERMINÉ (status "done") : on ne touche jamais à un travail en cours,
 *     ni à un run échoué ou annulé qu'on pourrait vouloir relancer ;
 *   - la vidéo finale d'un run JAMAIS publié : c'est le seul exemplaire qui existe ;
 *   - la MINIATURE et les sous-titres (.srt) : légers, et ce sont eux qu'on regrette ;
 *   - tout fichier que le run DÉSIGNE lui-même comme visuel (thumbRel, pack.thumbRel…) ;
 *   - tout dossier de `output/machines/` qui ne correspond à aucun run connu (voir plus bas) ;
 *   - tout ce qui est hors de `output/machines/` (génériques, musiques, miniatures, data/…).
 */
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const MACHINES = path.join(RACINE, "output", "machines");
const RUNS = path.join(RACINE, "data", "machines", "runs");

/**
 * Ce qu'on garde TOUJOURS dans un dossier de run.
 *
 * ⚠ Cette liste de noms n'est qu'un FILET DE SÉCURITÉ. Une machine peut nommer sa miniature
 *   autrement (`visuel.png`, `cover.jpg`…) : un filtre par nom de fichier est un pari sur des
 *   conventions qu'on n'a pas vérifiées. La source de vérité est le RUN LUI-MÊME — voir
 *   visuelsDeclares(). Si une de tes machines produit un autre fichier à garder, ajoute-le ici.
 */
const GARDER = [/^miniature\./i, /^thumbnail\./i, /^pochette\./i, /^visuel\./i, /^cover\./i, /\.srt$/i];

/** Sous-dossiers d'un run à ne jamais proposer (livrables). Vide par défaut : à compléter. */
const DOSSIERS_GARDES = new Set([]);

const estGarde = (f) => GARDER.some((re) => re.test(f));

/** La vidéo finale, celle qui part sur YouTube. */
const estFinale = (f) => /^final\.mp4$/i.test(f) || /^video\.mp4$/i.test(f);

/** Fichiers qu'un run désigne lui-même comme visuels (on ne garde que le nom du fichier). */
function visuelsDeclares(run) {
  const out = new Set();
  const prendre = (rel) => { if (rel) out.add(String(rel).split(/[\\/]/).pop()); };
  for (const k of ["visuel", "miniature", "thumb", "thumbnail", "pochette", "cover"]) {
    if (run[k] && run[k].rel) prendre(run[k].rel);
    if (run[k] && run[k].file) prendre(run[k].file);
  }
  prendre(run.thumbRel);
  if (run.pack) { prendre(run.pack.thumbRel); prendre(run.pack.coverRel); }
  return out;
}

const octets = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };

function pesee(dir) {
  let total = 0;
  const pile = [dir];
  while (pile.length) {
    const d = pile.pop();
    let e = [];
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const x of e) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) pile.push(p); else total += octets(p);
    }
  }
  return total;
}

function lireRun(fichier, machine) {
  try {
    const r = JSON.parse(fs.readFileSync(fichier, "utf8"));
    if (!r || !r.id) return null;
    const pub = r.published || {};
    return {
      id: r.id, machine, status: String(r.status || ""),
      titre: (r.pack && r.pack.title) || r.title || r.theme || r.id,
      // un `published` qui ne contient qu'une erreur n'est PAS une publication
      publie: !!(pub.id || pub.url || pub.videoId),
      url: pub.url || (pub.videoId ? `https://youtube.com/watch?v=${pub.videoId}` : null),
      visuels: visuelsDeclares(r),
    };
  } catch { return null; }
}

/** Tous les runs de toutes les machines : à plat dans runs/ ET dans runs/<machine>/. */
function runs() {
  const out = new Map();
  let entrees = [];
  try { entrees = fs.readdirSync(RUNS, { withFileTypes: true }); } catch { return out; }
  for (const e of entrees) {
    if (e.isFile() && e.name.endsWith(".json")) {
      const r = lireRun(path.join(RUNS, e.name), "timetravel");
      if (r && !out.has(r.id)) out.set(r.id, r);
    } else if (e.isDirectory()) {
      let f = [];
      try { f = fs.readdirSync(path.join(RUNS, e.name)).filter((x) => x.endsWith(".json")); } catch { continue; }
      for (const j of f) {
        const r = lireRun(path.join(RUNS, e.name, j), e.name);
        if (r) out.set(r.id, r);
      }
    }
  }
  return out;
}

/**
 * Inventaire complet. Ne touche à rien.
 * @returns { enCours, lots, total, inconnus }
 */
function inventaire() {
  const R = runs();
  const enCours = [...R.values()].filter((r) => /_running$/.test(r.status)).map((r) => r.id);
  const lots = [];
  const inconnus = [];

  let dirs = [];
  try { dirs = fs.readdirSync(MACHINES, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch {}
  for (const d of dirs) {
    const dossier = path.join(MACHINES, d.name);
    const r = R.get(d.name);
    /**
     * ⚠ UN DOSSIER SANS RUN CONNU N'EST PAS UN RUN ABANDONNÉ — IL PEUT ÊTRE UN MAGASIN PARTAGÉ.
     *   `output/machines/` peut contenir autre chose que des runs : images de référence des
     *   personnages, bibliothèques, banques d'images. Les prendre pour des runs « orphelins »
     *   et les vider casse les vidéos suivantes. On n'expose donc RIEN dont on n'a pas la
     *   preuve que c'est un run terminé : l'inconnu se signale, il ne se jette pas.
     */
    if (!r) { inconnus.push({ nom: d.name, octets: pesee(dossier) }); continue; }
    if (r.status !== "done") continue;

    let fichiers = [];
    try { fichiers = fs.readdirSync(dossier, { withFileTypes: true }); } catch { continue; }
    const finale = [], travail = [];
    for (const x of fichiers) {
      const p = path.join(dossier, x.name);
      if (x.isDirectory()) { if (!DOSSIERS_GARDES.has(x.name)) travail.push({ f: x.name + "/", o: pesee(p) }); continue; }
      // ⚠ Deux filets : ce que le RUN déclare (source de vérité), puis la liste de noms.
      if (r.visuels.has(x.name) || estGarde(x.name)) continue;
      (estFinale(x.name) ? finale : travail).push({ f: x.name, o: octets(p) });
    }
    const somme = (a) => a.reduce((s, x) => s + x.o, 0);

    // Une finale jamais publiée n'est PAS proposée : elle n'existe nulle part ailleurs.
    if (r.publie && finale.length) {
      lots.push({ id: `${d.name}:finale`, type: "video-publiee", run: d.name, machine: r.machine,
        titre: r.titre, url: r.url, octets: somme(finale), fichiers: finale.map((x) => x.f) });
    }
    if (travail.length) {
      lots.push({ id: `${d.name}:travail`, type: "fichiers-de-travail", run: d.name, machine: r.machine,
        titre: r.titre, octets: somme(travail), fichiers: travail.map((x) => x.f) });
    }
  }

  lots.sort((a, b) => b.octets - a.octets);
  const total = lots.reduce((s, l) => s + l.octets, 0);
  return { enCours, lots, total, inconnus };
}

/**
 * Supprime les lots DÉSIGNÉS, et rien d'autre.
 * ⚠ Refuse en bloc si une génération tourne : un fichier lu au même instant donnerait une
 *   vidéo corrompue sans que personne ne comprenne pourquoi.
 */
function vider(ids) {
  const inv = inventaire();
  if (inv.enCours.length) throw new Error(`Génération en cours (${inv.enCours.join(", ")}) — rien n'a été supprimé.`);
  const choisis = inv.lots.filter((l) => ids.includes(l.id));
  if (!choisis.length) throw new Error("Aucun lot reconnu — rien n'a été supprimé.");
  let libere = 0, n = 0;
  for (const l of choisis) {
    const dossier = path.join(MACHINES, l.run);
    // ⚠ Garde-fou : on ne sort JAMAIS de output/machines/, quoi qu'on nous passe.
    if (!path.resolve(dossier).startsWith(path.resolve(MACHINES) + path.sep)) continue;
    for (const f of l.fichiers) {
      const p = path.join(dossier, f.replace(/\/$/, ""));
      if (!path.resolve(p).startsWith(path.resolve(dossier) + path.sep)) continue;
      try { fs.rmSync(p, { recursive: true, force: true }); n++; } catch {}
    }
    libere += l.octets;
  }
  return { lots: choisis.length, fichiers: n, octets: libere };
}

module.exports = { inventaire, vider };
