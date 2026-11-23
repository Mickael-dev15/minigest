# MiniGest

**MiniGest** est une application web simple et responsive de gestion de clients, conçue pour une petite entreprise. Elle fonctionne entièrement dans le navigateur, sans serveur back-end, et conserve automatiquement les données localement.

---

## Fonctionnalités

- **Ajout d'un client** : formulaire contrôlé avec les champs *Nom*, *Prénom*, *Téléphone*, *Email*, *Ville*, *Statut* (`Prospect`, `Client`, `Inactif` — `Client` par défaut) et *Note* (texte libre facultatif avec compteur `X / 500`), génération automatique d'un identifiant unique (`crypto.randomUUID`) et de la date d'ajout.
- **Modification d'un client** : bouton bleu marine **Modifier** sur chaque ligne pour pré-remplir le formulaire (y compris le statut et la note), surligner le client en cours d'édition, modifier ses informations (tout en conservant son identifiant, sa date d'ajout et en l'autorisant à garder son propre numéro de téléphone) ou annuler l'édition. Après un ajout ou une modification, si le client ne correspond pas au filtre de statut actif, le filtre revient automatiquement sur **Tous** pour qu'il reste visible.
- **Validation et normalisation des données** :
  - Nom et prénom obligatoires (2 à 50 caractères, espaces superflus supprimés).
  - Téléphone obligatoire, automatiquement **normalisé** au format international unique (`+` suivi uniquement de chiffres) avant validation et contrôle d'unicité :
    - Suppression des espaces, points, tirets et parenthèses ; `00` au début remplacé par `+`.
    - Ajout automatique de `+` devant `221`, `237` ou `225` (contrôle strict : 9 chiffres après `221`/`237`, 10 chiffres après `225`).
    - Formats locaux reconnus : Sénégal (`7...` / `3...` sur 9 chiffres → `+221`), Cameroun (`6...` sur 9 chiffres → `+237`), Côte d'Ivoire (`0...` sur 10 chiffres → `+225`).
    - Autres indicatifs internationaux acceptés avec `+` (8 à 15 chiffres).
    - Affichage lisible dans le tableau et les cartes (`+221 77 123 45 67`, `+237 650 55 39 27`, `+225 07 01 02 03 04`).
  - Email facultatif avec vérification du format s'il est renseigné.
  - Statut parmi `Prospect`, `Client` ou `Inactif` (`Client` par défaut).
  - Note facultative de 500 caractères maximum (au-delà, message d'erreur rouge et blocage de l'enregistrement).
  - Mise en forme automatique : **NOM** en majuscules et **Prénom** avec une majuscule initiale.
  - Affichage des erreurs en rouge sous chaque champ concerné.
- **Liste des clients** : affichage sous forme de tableau trié par ordre alphabétique sur le nom (dimensionné pour tenir sans défilement horizontal sur un écran de `1366 px`), avec :
  - Badge coloré dans la colonne **Statut** : `Prospect` (bleu cyan), `Client` (vert), `Inactif` (gris).
  - Colonne **Note** affichée uniquement en texte via JSX (jamais de HTML) : aperçu des 40 premiers caractères suivis de `…` dans le tableau avec la note complète au survol (`title`), et note complète dans les cartes mobiles.
  - Date d'ajout au format `jj/mm/aaaa`.
  - En dessous de `600 px` (mobile), le formulaire passe sur une colonne et le tableau s'affiche sous forme de cartes.
- **Filtre par statut et recherche en temps réel** :
  - Boutons **Tous (X)**, **Prospects (Y)**, **Clients (Z)** et **Inactifs (W)** au-dessus de la liste avec compteurs calculés automatiquement.
  - Filtrage combinable avec la recherche instantanée par nom, prénom, téléphone (avec ou sans espaces, séparateurs ou indicatif, ex. `77 123` ou `771234567`) ou contenu des **notes**, sans tenir compte des majuscules ni des accents, avec compteur de résultats (`X résultat(s) sur Y client(s)`) et bouton **Effacer**.
- **Suppression sécurisée** : bouton rouge **Supprimer** avec demande de confirmation avant effacement.
- **Compteur total** : badge mis à jour automatiquement dans l'en-tête indiquant toujours le nombre total de clients enregistrés.
- **Sauvegarde locale (`localStorage`) et migration automatique** : chargement automatique au démarrage, normalisation des numéros déjà enregistrés et attribution automatique du statut `Client` et d'une note vide aux anciens clients qui n'en ont pas (sans jamais supprimer de client), puis sauvegarde à chaque modification sous la clé `minigest_clients`. Si la normalisation révèle des doublons, un bandeau orange signale les fiches concernées pour laisser l'utilisateur décider.
- **Contacter un client en un clic** : boutons **WhatsApp** et **Appeler** directement sur chaque fiche :
  - Sur bureau, regroupés en petits boutons compacts sous le numéro dans la colonne **Téléphone** (les boutons **Modifier** et **Supprimer** restent dans la colonne **Action**).
  - Sur mobile (cartes), les 4 boutons (**WhatsApp**, **Appeler**, **Modifier**, **Supprimer**) restent dans la zone d'action avec une hauteur minimale de `40 px`.
  - **WhatsApp** (vert `#25D366`) : ouvre `https://wa.me/NUMERO?text=MESSAGE` dans un nouvel onglet avec le numéro international sans le `+` et un message pré-rempli (`Bonjour Prénom, `) encodé avec `encodeURIComponent`.
  - **Appeler** : ouvre l'application d'appel via un lien `tel:+...` avec le numéro normalisé.
  - Si le numéro d'un client n'est pas au format normalisé (ex. ancien numéro incomplet), les deux boutons sont remplacés par des `<button disabled>` grisés avec l'infobulle `Numéro à corriger avant de contacter ce client`.
- **Export CSV compatible Excel (français)** : bouton **Exporter (CSV)** au-dessus de la liste (désactivé si la liste est vide) téléchargeant un fichier `minigest_clients_AAAA-MM-JJ.csv` en UTF-8 avec BOM, séparateur point-virgule (`;`), 8 colonnes (`Nom;Prénom;Téléphone;Email;Ville;Date d'ajout;Statut;Note`), échappement des valeurs contenant `;`, `"` ou des retours à la ligne, dates au format `jj/mm/aaaa` et téléphones protégés sous la forme `="+221771234567"` pour éviter leur conversion en notation scientifique dans Excel.
- **Import CSV sécurisé** : bouton **Importer (CSV)** acceptant le séparateur `;` ou `,`, les anciens fichiers à **6 colonnes** (statut `Client` et note vide par défaut) comme les nouveaux à **8 colonnes**, et les deux formats de téléphone (`="..."` ou texte simple), ajoutant les clients valides sans jamais remplacer la liste existante. Le statut est lu sans tenir compte des majuscules ni des accents ; si une valeur est inconnue, `Client` est appliqué par défaut et signalé dans le bilan (`Ligne X : statut inconnu, Client par défaut`). Chaque ligne passe par `validerClient` (nouvel identifiant généré, conservation de la date d'ajout si valide sinon date du jour, mise en forme **NOM** / **Prénom**, limite de 500 caractères sur la note), avec détection des numéros abîmés par Excel (`E+`) et affichage d'un bilan détaillé.

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
    │   └── ClientRow.jsx        # Ligne (ou carte mobile) d'un client + contact, édition, suppression
    └── utils/
        ├── csv.js               # Export et import CSV compatibles Excel (sans bibliothèque externe)
        ├── storage.js           # Lecture, migration et écriture dans localStorage
        ├── telephone.js         # Normalisation, formatage et lien WhatsApp des numéros de téléphone
        └── validation.js        # Validation et mise en forme des champs client
```

---

## Auteur

**Patrick Kassi** — *MiniGest v1.5*
