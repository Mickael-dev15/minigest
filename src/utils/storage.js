// Utilitaires pour charger, migrer et sauvegarder la liste des clients dans localStorage
import { normaliserTelephone } from './telephone.js';
import {
  normaliserStatut,
  STATUT_PAR_DEFAUT,
  STATUTS_CLIENT,
} from './validation.js';
import { normaliserTri, TRI_PAR_DEFAUT } from './tri.js';

// Clé unique utilisée dans le navigateur pour MiniGest
const CLE_STOCKAGE = 'minigest_clients';

// Clé utilisée pour mémoriser si le tableau de bord est affiché ou masqué
const CLE_DASHBOARD_VISIBLE = 'minigest_dashboard_visible';

// Clé utilisée pour mémoriser le choix de tri de la liste des clients
const CLE_TRI = 'minigest_tri';

// Migre les clients déjà enregistrés sans jamais en supprimer un seul :
// - normalise le numéro de téléphone si possible (sinon conservé tel quel)
// - ajoute le statut "Client" et une note vide aux anciens clients sans ces champs
export function migrerClients(clients) {
  let aEteModifie = false;

  const clientsMigres = clients.map((client) => {
    if (!client || typeof client !== 'object') {
      return client;
    }

    let clientModifie = client;

    // 1. Normalisation du numéro de téléphone
    const { numero, erreur } = normaliserTelephone(client.telephone);
    if (!erreur && numero !== client.telephone) {
      aEteModifie = true;
      clientModifie = {
        ...clientModifie,
        telephone: numero,
      };
    }

    // 2. Migration du statut (les clients existants sans statut reçoivent "Client")
    const statutValide = STATUTS_CLIENT.includes(client.statut);
    if (!statutValide) {
      const statutMigre = normaliserStatut(client.statut) || STATUT_PAR_DEFAUT;
      aEteModifie = true;
      clientModifie = {
        ...clientModifie,
        statut: statutMigre,
      };
    }

    // 3. Migration de la note (note vide si absente)
    if (typeof client.note !== 'string') {
      aEteModifie = true;
      clientModifie = {
        ...clientModifie,
        note: '',
      };
    }

    return clientModifie;
  });

  return { clientsMigres, aEteModifie };
}

// Lit la liste des clients sauvegardée dans localStorage et applique les migrations si nécessaire
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

    // Migration automatique des téléphones, statuts et notes sans jamais supprimer de client
    const { clientsMigres, aEteModifie } = migrerClients(clients);
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

// Lit la préférence d'affichage du tableau de bord dans localStorage (affiché par défaut)
export function chargerVisibiliteDashboard() {
  try {
    const valeur = localStorage.getItem(CLE_DASHBOARD_VISIBLE);
    if (valeur === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

// Enregistre la préférence d'affichage du tableau de bord dans localStorage
export function sauvegarderVisibiliteDashboard(estVisible) {
  try {
    localStorage.setItem(CLE_DASHBOARD_VISIBLE, String(Boolean(estVisible)));
  } catch {
    // Évite un plantage si le stockage du navigateur est bloqué
  }
}

// Lit le choix de tri sauvegardé dans localStorage (Nom croissant par défaut)
export function chargerTri() {
  try {
    const donneesBrutes = localStorage.getItem(CLE_TRI);
    if (!donneesBrutes) {
      return { ...TRI_PAR_DEFAUT };
    }

    const triLu = JSON.parse(donneesBrutes);
    return normaliserTri(triLu);
  } catch {
    return { ...TRI_PAR_DEFAUT };
  }
}

// Enregistre le choix de tri dans localStorage sous forme de texte JSON
export function sauvegarderTri(tri) {
  try {
    localStorage.setItem(CLE_TRI, JSON.stringify(normaliserTri(tri)));
  } catch {
    // Évite un plantage si le stockage du navigateur est bloqué
  }
}
