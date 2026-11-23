# MiniGest

**MiniGest** est une application web simple et responsive de gestion de clients, conçue pour une petite entreprise. Elle fonctionne entièrement dans le navigateur, sans serveur back-end, et conserve automatiquement les données localement.

---

## Fonctionnalités

- **Ajout d'un client** : formulaire contrôlé avec les champs *Nom*, *Prénom*, *Téléphone*, *Email* et *Ville*, génération automatique d'un identifiant unique (`crypto.randomUUID`) et de la date d'ajout.
- **Modification d'un client** : bouton bleu marine **Modifier** sur chaque ligne pour pré-remplir le formulaire, surligner le client en cours d'édition, modifier ses informations (tout en conservant son identifiant, sa date d'ajout et en l'autorisant à garder son propre numéro de téléphone) ou annuler l'édition.
- **Validation des données** :
  - Nom et prénom obligatoires (2 à 50 caractères, espaces superflus supprimés).
  - Téléphone obligatoire (8 à 15 chiffres, `+` facultatif au début) et **unique** (refus des doublons).
  - Email facultatif avec vérification du format s'il est renseigné.
  - Mise en forme automatique : **NOM** en majuscules et **Prénom** avec une majuscule initiale.
  - Affichage des erreurs en rouge sous chaque champ concerné.
- **Liste des clients** : affichage sous forme de tableau trié par ordre alphabétique sur le nom, avec date d'ajout au format `jj/mm/aaaa`. En dessous de `600 px` (mobile), le formulaire passe sur une colonne et le tableau s'affiche sous forme de cartes.
- **Recherche en temps réel** : filtrage instantané par nom, prénom ou téléphone, sans tenir compte des majuscules ni des accents, avec compteur de résultats (`X résultat(s) sur Y client(s)`) et bouton **Effacer**.
- **Suppression sécurisée** : bouton rouge **Supprimer** avec demande de confirmation avant effacement.
- **Compteur total** : badge mis à jour automatiquement dans l'en-tête indiquant le nombre total de clients enregistrés.
- **Sauvegarde locale (`localStorage`)** : chargement automatique au démarrage et sauvegarde à chaque modification sous la clé `minigest_clients`, avec protection `try/catch` en cas de données corrompues.

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
        ├── storage.js           # Lecture et écriture dans localStorage
        └── validation.js        # Validation et mise en forme des champs client
```

---

## Auteur

**Patrick Kassi** — *MiniGest v1.1*
