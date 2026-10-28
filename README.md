# 🗑 Poubelle pour Agentic OS

Une page **Poubelle** pour ton Agentic OS. Elle te montre ce qui prend de la place sur ton disque **sans servir à rien**, et tu choisis ce que tu supprimes.

Elle contient deux sections, pas plus :

1. **🧰 Fichiers de travail** : tout ce qui a servi à fabriquer une vidéo terminée (segments, images sources, voix, assemblages). Une fois la vidéo finie, tu n'en as plus besoin.
2. **📤 Vidéos déjà publiées** : la vidéo finale d'un run publié sur YouTube. Tu peux toujours la retélécharger depuis YouTube Studio.

En haut de la page, tu vois combien de Go tu peux récupérer.

## Ce qui est protégé (jamais proposé)

- **Les runs pas terminés** : en cours, en attente, échoués ou annulés. Tu pourrais vouloir les relancer.
- **Les vidéos jamais publiées** : c'est le seul exemplaire qui existe.
- **Les miniatures** (`thumbnail.*`, `miniature.*`, `visuel.*`, `cover.*`, plus celle que le run déclare lui-même) et **les sous-titres** (`.srt`).
- **Les dossiers inconnus** de `output/machines/` : images de référence des personnages, bibliothèques… La page les affiche, mais ne propose jamais de les supprimer.
- **Tout ce qui est en dehors de `output/machines/`** : génériques, musiques, miniatures, `data/`.

Rien n'est coché par défaut. Une confirmation est toujours demandée avant de supprimer. Et pendant qu'une génération tourne, la suppression est bloquée.

---

## Installation

### Le plus simple : demande-le à Claude

Ouvre Claude Code dans ton projet Agentic OS et colle-lui ce message :

> Installe la poubelle depuis https://github.com/djbaldi007/agentic-os-poubelle en suivant son README.

> **Note pour Claude** : récupère les deux fichiers de `agent-os/` depuis ce dépôt (clone dans un dossier temporaire, ou téléchargement des fichiers bruts), copie-les aux mêmes chemins dans le projet de l'utilisateur, fais les ajouts des étapes 2 et 3 ci-dessous, puis demande à l'utilisateur de redémarrer Agent OS. Ne supprime rien toi-même : la page sert à ce que l'utilisateur choisisse.

### À la main (5 minutes)

**1. Copie les 2 fichiers** dans ton projet, au même endroit :

| Fichier du dossier | À copier dans ton projet |
|---|---|
| `agent-os/lib/poubelle.js` | `agent-os/lib/poubelle.js` |
| `agent-os/public/js/pages/poubelle.js` | `agent-os/public/js/pages/poubelle.js` |

**2. Dans `agent-os/server.js`**

a) Tout en haut, avec les autres `require(...)`, ajoute :

```js
const poubelle = require("./lib/poubelle");
```

b) Cherche la ligne `// ===== Santé globale =====` et colle ce bloc **juste au-dessus** :

```js
    // ===== Poubelle =====
    // L'inventaire est en lecture seule ; seule la route "vider" supprime, et uniquement des
    // identifiants que l'inventaire a lui-même proposés.
    if (p === "/api/poubelle" && req.method === "GET") {
      try { return json(res, 200, poubelle.inventaire()); }
      catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (p === "/api/poubelle/vider" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, poubelle.vider(Array.isArray(b.ids) ? b.ids : [])); }
      catch (e) { return json(res, 400, { error: e.message }); }
    }
```

**3. Dans `agent-os/public/index.html`**

a) Dans le menu, sous `Mes fichiers`, ajoute :

```html
        <a href="#/poubelle" data-page="poubelle"><i>🗑</i>Poubelle</a>
```

b) En bas, avec les autres `<script src="js/pages/...">`, ajoute :

```html
  <script src="js/pages/poubelle.js"></script>
```

**4. Redémarre Agent OS** : ferme le serveur, puis `cd agent-os && npm start`. La page **🗑 Poubelle** apparaît dans le menu.

### Vérifier que ça marche

Ouvre http://localhost:4100/api/poubelle. Tu dois voir du texte qui commence par `{"enCours":[...`. Si ton Agentic OS est tout neuf, la page affichera « Rien à jeter pour l'instant » : c'est normal.

---

## Adapter à tes machines

- **Ta vidéo finale ne s'appelle pas `final.mp4` ?** Ouvre `agent-os/lib/poubelle.js` et ajoute son nom dans la fonction `estFinale`. Sinon, elle sera rangée avec les fichiers de travail.
- **Une machine produit un fichier à garder absolument** (une pochette, un livrable) ? Ajoute son nom dans la liste `GARDER`. S'il s'agit d'un sous-dossier, ajoute-le dans `DOSSIERS_GARDES`.

Dans le doute, **regarde la liste avant de cocher**. Une suppression est définitive.
