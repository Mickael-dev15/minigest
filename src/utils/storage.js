// Utilitaires pour mémoriser uniquement les préférences d'affichage dans localStorage
// (les clients sont désormais stockés dans Supabase, plus dans localStorage).
import { normaliserTri, TRI_PAR_DEFAUT } from './tri.js';
import { normaliserParPage, PAR_PAGE_PAR_DEFAUT } from './pagination.js';

// Clé utilisée pour mémoriser si le tableau de bord est affiché ou masqué
const CLE_DASHBOARD_VISIBLE = 'minigest_dashboard_visible';

// Clé utilisée pour mémoriser le choix de tri de la liste des clients
const CLE_TRI = 'minigest_tri';

// Clé utilisée pour mémoriser le nombre de clients affichés par page
const CLE_PAR_PAGE = 'minigest_par_page';

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

// Lit le nombre de clients par page sauvegardé dans localStorage (10 par défaut)
export function chargerParPage() {
  try {
    const valeur = localStorage.getItem(CLE_PAR_PAGE);
    if (!valeur) {
      return PAR_PAGE_PAR_DEFAUT;
    }
    return normaliserParPage(valeur);
  } catch {
    return PAR_PAGE_PAR_DEFAUT;
  }
}

// Enregistre le nombre de clients par page dans localStorage
export function sauvegarderParPage(parPage) {
  try {
    localStorage.setItem(CLE_PAR_PAGE, String(normaliserParPage(parPage)));
  } catch {
    // Évite un plantage si le stockage du navigateur est bloqué
  }
}
