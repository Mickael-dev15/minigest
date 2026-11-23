# MiniGest

**MiniGest** est une application web simple et responsive de gestion de clients, conçue pour une petite entreprise. Elle fonctionne entièrement dans le navigateur, sans serveur back-end, et conserve automatiquement les données localement.

---

## Fonctionnalités

- **Ajout d'un client** : formulaire contrôlé avec les champs *Nom*, *Prénom*, *Téléphone*, *Email* et *Ville*, génération automatique d'un identifiant unique (`crypto.randomUUID`) et de la date d'ajout.
- **Modification d'un client** : bouton bleu marine **Modifier** sur chaque ligne pour pré-remplir le formulaire, surligner le client en cours d'édition, modifier ses informations (tout en conservant son identifiant, sa date d'ajout et en l'autorisant à garder son propre numéro de téléphone) ou annuler l'édition.
- **Validation et normalisation des données** :
  - Nom et prénom obligatoires (2 à 50 caractères, espaces superflus supprimés).
  - Téléphone obligatoire, automatiquement **normalisé** au format international unique (`+` suivi uniquement de chiffres) avant validation et contrôle d'unicité :
    - Suppression des espaces, points, tirets et parenthèses ; `00` au début remplacé par `+`.
    - Ajout automatique de `+` devant `221`, `237` ou `225` (contrôle strict : 9 chiffres après `221`/`237`, 10 chiffres après `225`).
    - Formats locaux reconnus : Sénégal (`7...` / `3...` sur 9 chiffres → `+221`), Cameroun (`6...` sur 9 chiffres → `+237`), Côte d'Ivoire (`0...` sur 10 chiffres → `+225`).
    - Autres indicatifs internationaux acceptés avec `+` (8 à 15 chiffres).
    - Affichage lisible dans le tableau et les cartes (`+221 77 123 45 67`, `+237 650 55 39 27`, `+225 07 01 02 03 04`).
  - Email facultatif avec vérification du format s'il est renseigné.
  - Mise en forme automatique : **NOM** en majuscules et **Prénom** avec une majuscule initiale.
  - Affichage des erreurs en rouge sous chaque champ concerné.
- **Liste des clients** : affichage sous forme de tableau trié par ordre alphabétique sur le nom, avec date d'ajout au format `jj/mm/aaaa`. En dessous de `600 px` (mobile), le formulaire passe sur une colonne et le tableau s'affiche sous forme de cartes.
- **Recherche en temps réel** : filtrage instantané par nom, prénom ou téléphone (avec ou sans espaces, séparateurs ou indicatif, ex. `77 123` ou `771234567`), sans tenir compte des majuscules ni des accents, avec compteur de résultats (`X résultat(s) sur Y client(s)`) et bouton **Effacer**.
- **Suppression sécurisée** : bouton rouge **Supprimer** avec demande de confirmation avant effacement.
- **Compteur total** : badge mis à jour automatiquement dans l'en-tête indiquant le nombre total de clients enregistrés.
- **Sauvegarde locale (`localStorage`) et migration automatique** : chargement automatique au démarrage, normalisation des numéros déjà enregistrés (sans jamais supprimer de client si un numéro ne peut pas être normalisé) et sauvegarde à chaque modification sous la clé `minigest_clients`. Si la normalisation révèle des doublons, un bandeau orange signale les fiches concernées pour laisser l'utilisateur décider.
- **Export CSV compatible Excel (français)** : bouton **Exporter (CSV)** au-dessus de la liste (désactivé si la liste est vide) téléchargeant un fichier `minigest_clients_AAAA-MM-JJ.csv` en UTF-8 avec BOM, séparateur point-virgule (`;`), échappement des valeurs contenant `;` ou `"`, dates au format `jj/mm/aaaa` et téléphones protégés sous la forme `="+221771234567"` pour éviter leur conversion en notation scientifique dans Excel.
- **Import CSV sécurisé** : bouton **Importer (CSV)** acceptant le séparateur `;` ou `,` et les deux formats de téléphone (`="..."` ou texte simple), ajoutant les clients valides sans jamais remplacer la liste existante. Chaque ligne passe par `validerClient` (nouvel identifiant généré, conservation de la date d'ajout si valide sinon date du jour, mise en forme **NOM** / **Prénom**), avec détection des numéros abîmés par Excel (`E+`) et affichage d'un bilan détaillé (`X client(s) importé(s), Y ligne(s) ignorée(s)` avec numéro de ligne et raison).

---

## Technologies utilisées

- **React 19** (composants fonctionnels et Hooks `useState`, `useEffect`)
- **Vite** (serveur de développement et build)
- **JavaScript** (sans TypeScript)
- **CSS** natif (sans bibliothèque d'interface externe)
- **localStorage** du navigateur

---

## Installation et lancement

### Prérequis
- [Node.js](https://nodejs.org/) installé sur votre machine.

### 1. Installer les dépendances
```bash
npm install
```

### 2. Lancer l'application en développement
```bash
npm run dev
```
Ouvrez ensuite l'adresse affichée dans le terminal (par défaut **http://localhost:5173/**).

### Autres commandes utiles
- Vérifier le code (linter) :
  ```bash
  npm run lint
  ```
- Générer la version de production :
  ```bash
  npm run build
  ```

---

## Structure des fichiers

```text
minigest/
├── index.html                   # Page HTML principale (lang="fr", titre MiniGest)
├── package.json                 # Dépendances et scripts npm
├── vite.config.js               # Configuration de Vite
├── README.md                    # Documentation du projet
├── REGLES_PROJET.md             # Règles et cahier des charges du projet
└── src/
    ├── main.jsx                 # Point d'entrée React
    ├── App.jsx                  # Composant racine (state, filtrage, sauvegarde)
    ├── App.css                  # Styles globaux et affichage responsive
    ├── components/
    │   ├── Header.jsx           # En-tête avec titre et compteur total de clients
    │   ├── ClientForm.jsx       # Formulaire contrôlé d'ajout avec validation
    │   ├── SearchBar.jsx        # Barre de recherche et compteur de résultats
    │   ├── ClientList.jsx       # Tableau trié des clients (ou message si vide)
    │   └── ClientRow.jsx        # Ligne (ou carte mobile) d'un client + suppression
    └── utils/
        ├── csv.js               # Export et import CSV compatibles Excel (sans bibliothèque externe)
        ├── storage.js           # Lecture, migration et écriture dans localStorage
        ├── telephone.js         # Normalisation et formatage des numéros de téléphone
        └── validation.js        # Validation et mise en forme des champs client
```

---

## Auteur

**Patrick Kassi** — *MiniGest v1.3*
