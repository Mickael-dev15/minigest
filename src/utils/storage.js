// Utilitaires pour charger, migrer et sauvegarder la liste des clients dans localStorage
import { normaliserTelephone } from './telephone.js';

// Clé unique utilisée dans le navigateur pour MiniGest
const CLE_STOCKAGE = 'minigest_clients';

// Normalise les numéros de téléphone des clients déjà enregistrés sans jamais en supprimer un seul
// Si un numéro ne peut pas être normalisé, il est conservé tel quel
export function migrerTelephonesClients(clients) {
  let aEteModifie = false;

  const clientsMigres = clients.map((client) => {
    if (!client || typeof client !== 'object') {
      return client;
    }

    const { numero, erreur } = normaliserTelephone(client.telephone);
    if (!erreur && numero !== client.telephone) {
      aEteModifie = true;
      return {
        ...client,
        telephone: numero,
      };
    }

    return client;
  });

  return { clientsMigres, aEteModifie };
}

// Lit la liste des clients sauvegardée dans localStorage et migre les téléphones si nécessaire
// Si rien n'est enregistré ou si les données sont corrompues, renvoie une liste vide []
export function chargerClients() {
  try {
    const donneesBrutes = localStorage.getItem(CLE_STOCKAGE);

    if (!donneesBrutes) {
      return [];
    }

    const clients = JSON.parse(donneesBrutes);

    // Vérifie que les données lues forment bien un tableau
    if (!Array.isArray(clients)) {
      return [];
    }

    // Migration automatique des téléphones existants vers le format normalisé
    const { clientsMigres, aEteModifie } = migrerTelephonesClients(clients);
    if (aEteModifie) {
      sauvegarderClients(clientsMigres);
    }

    return clientsMigres;
  } catch {
    // En cas de JSON invalide ou d'erreur de lecture, l'application ne plante pas
    return [];
  }
}

// Enregistre la liste des clients dans localStorage sous forme de texte JSON
export function sauvegarderClients(clients) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(clients));
  } catch {
    // Évite un plantage si le stockage du navigateur est plein ou bloqué
  }
}
