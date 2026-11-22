// Utilitaires pour charger et sauvegarder la liste des clients dans localStorage

// Clé unique utilisée dans le navigateur pour MiniGest
const CLE_STOCKAGE = 'minigest_clients';

// Lit la liste des clients sauvegardée dans localStorage
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

    return clients;
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
