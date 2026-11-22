# Règles du projet MiniGest

## Contexte
MiniGest est une application web de gestion de clients pour une petite entreprise.
Fonctionnalités : ajouter un client, afficher la liste, rechercher, supprimer, afficher le nombre total de clients.
Le développeur est débutant en React : explique chaque étape simplement, en français.

## Technique
- React 19 + Vite, JavaScript (pas de TypeScript).
- Composants fonctionnels et Hooks uniquement (useState, useEffect).
- Pas de back-end, pas de bibliothèque d'interface externe.
- Stockage des données : localStorage, clé "minigest_clients".

## Organisation des fichiers (à respecter)
- src/main.jsx, src/App.jsx, src/App.css
- src/components/Header.jsx, ClientForm.jsx, SearchBar.jsx, ClientList.jsx, ClientRow.jsx
- src/utils/storage.js, src/utils/validation.js

## Données d'un client
id (crypto.randomUUID), nom, prenom, telephone, email, ville, dateAjout (format ISO).

## Méthode de travail
- Avant de coder, présente un plan court et attends ma validation.
- Travaille une fonctionnalité à la fois.
- Interface et messages en français.
- Code commenté en français, simple, adapté à un débutant.
- Ne modifie jamais le state directement (utilise ..., filter, map).
- Après chaque étape, dis-moi comment tester dans le navigateur.
