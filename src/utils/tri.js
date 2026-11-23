// Fonctions pures de tri de la liste des clients pour MiniGest.
// Aucune fonction de ce fichier ne modifie le tableau d'origine :
// on travaille toujours sur une copie avant d'utiliser .sort().

// Tri par défaut au démarrage (identique aux versions précédentes : Nom croissant)
export const TRI_PAR_DEFAUT = {
  colonne: 'nom',
  ordre: 'asc',
};

// Liste des colonnes qui peuvent être triées
export const COLONNES_TRIABLES = [
  'nom',
  'prenom',
  'statut',
  'ville',
  'dateAjout',
];

// Ordre métier des statuts (croissant : Prospect -> Client -> Inactif)
const ORDRE_STATUT = {
  Prospect: 0,
  Client: 1,
  Inactif: 2,
};

// Options affichées dans la liste déroulante "Trier par" sur mobile (sous 600 px)
export const OPTIONS_TRI_MOBILE = [
  { valeur: 'nom:asc', colonne: 'nom', ordre: 'asc', libelle: 'Nom (A → Z)' },
  { valeur: 'nom:desc', colonne: 'nom', ordre: 'desc', libelle: 'Nom (Z → A)' },
  {
    valeur: 'prenom:asc',
    colonne: 'prenom',
    ordre: 'asc',
    libelle: 'Prénom (A → Z)',
  },
  {
    valeur: 'prenom:desc',
    colonne: 'prenom',
    ordre: 'desc',
    libelle: 'Prénom (Z → A)',
  },
  {
    valeur: 'statut:asc',
    colonne: 'statut',
    ordre: 'asc',
    libelle: 'Statut (Prospect → Inactif)',
  },
  {
    valeur: 'statut:desc',
    colonne: 'statut',
    ordre: 'desc',
    libelle: 'Statut (Inactif → Prospect)',
  },
  {
    valeur: 'ville:asc',
    colonne: 'ville',
    ordre: 'asc',
    libelle: 'Ville (A → Z)',
  },
  {
    valeur: 'ville:desc',
    colonne: 'ville',
    ordre: 'desc',
    libelle: 'Ville (Z → A)',
  },
  {
    valeur: 'dateAjout:desc',
    colonne: 'dateAjout',
    ordre: 'desc',
    libelle: "Date d'ajout (plus récent)",
  },
  {
    valeur: 'dateAjout:asc',
    colonne: 'dateAjout',
    ordre: 'asc',
    libelle: "Date d'ajout (plus ancien)",
  },
];

// Vérifie qu'un objet de tri est valide ; renvoie le tri par défaut sinon
export function normaliserTri(tri) {
  if (
    tri &&
    typeof tri === 'object' &&
    COLONNES_TRIABLES.includes(tri.colonne) &&
    (tri.ordre === 'asc' || tri.ordre === 'desc')
  ) {
    return {
      colonne: tri.colonne,
      ordre: tri.ordre,
    };
  }

  return { ...TRI_PAR_DEFAUT };
}

// Calcule le nouveau tri lorsqu'on clique sur un en-tête de colonne :
// - Si on clique sur la colonne déjà active, on inverse le sens (asc <-> desc).
// - Si on clique sur une nouvelle colonne :
//   * pour "dateAjout", le 1er clic trie du plus récent au plus ancien ("desc")
//   * pour toutes les autres colonnes, le 1er clic trie en ordre croissant ("asc")
export function calculerProchainTri(triActuel, colonne) {
  const triPropre = normaliserTri(triActuel);

  if (!COLONNES_TRIABLES.includes(colonne)) {
    return triPropre;
  }

  if (triPropre.colonne === colonne) {
    return {
      colonne,
      ordre: triPropre.ordre === 'asc' ? 'desc' : 'asc',
    };
  }

  return {
    colonne,
    ordre: colonne === 'dateAjout' ? 'desc' : 'asc',
  };
}

// Compare deux textes en français sans tenir compte des majuscules ni des accents
// (exemple : "Thiès" et "THIES" sont considérés comme égaux)
function comparerTexteFr(texteA, texteB) {
  const a = String(texteA ?? '').trim();
  const b = String(texteB ?? '').trim();
  return a.localeCompare(b, 'fr', { sensitivity: 'base' });
}

// Départage deux clients à égalité par Nom croissant, puis par Prénom croissant
function departagerParNomPrenom(clientA, clientB) {
  const diffNom = comparerTexteFr(clientA?.nom, clientB?.nom);
  if (diffNom !== 0) {
    return diffNom;
  }

  return comparerTexteFr(clientA?.prenom, clientB?.prenom);
}

// Convertit la date d'ajout en nombre de millisecondes (timestamp), ou null si vide/invalide
function extraireTimestamp(dateAjout) {
  if (!dateAjout) {
    return null;
  }

  const timestamp = new Date(dateAjout).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

// Retourne le rang numérique d'un statut selon l'ordre métier, ou null si vide/inconnu
function obtenirRangStatut(statut) {
  if (Object.prototype.hasOwnProperty.call(ORDRE_STATUT, statut)) {
    return ORDRE_STATUT[statut];
  }
  return null;
}

// Trie une liste de clients selon la colonne et le sens demandés.
// Renvoie toujours un NOUVEAU tableau sans modifier la liste d'origine.
export function trierClients(clients, tri = TRI_PAR_DEFAUT) {
  if (!Array.isArray(clients)) {
    return [];
  }

  const { colonne, ordre } = normaliserTri(tri);
  const multiplicateur = ordre === 'desc' ? -1 : 1;

  // On crée une copie avec [...clients] car .sort() modifie le tableau sur place
  return [...clients].sort((clientA, clientB) => {
    // 1. Tri métier sur le statut : Prospect -> Client -> Inactif
    if (colonne === 'statut') {
      const rangA = obtenirRangStatut(clientA?.statut);
      const rangB = obtenirRangStatut(clientB?.statut);

      // Les valeurs vides ou inconnues vont toujours à la fin
      if (rangA === null && rangB === null) {
        return departagerParNomPrenom(clientA, clientB);
      }
      if (rangA === null) {
        return 1;
      }
      if (rangB === null) {
        return -1;
      }

      if (rangA !== rangB) {
        return (rangA - rangB) * multiplicateur;
      }

      return departagerParNomPrenom(clientA, clientB);
    }

    // 2. Tri chronologique sur la date d'ajout
    if (colonne === 'dateAjout') {
      const tsA = extraireTimestamp(clientA?.dateAjout);
      const tsB = extraireTimestamp(clientB?.dateAjout);

      // Les dates absentes ou invalides vont toujours à la fin
      if (tsA === null && tsB === null) {
        return departagerParNomPrenom(clientA, clientB);
      }
      if (tsA === null) {
        return 1;
      }
      if (tsB === null) {
        return -1;
      }

      if (tsA !== tsB) {
        return (tsA - tsB) * multiplicateur;
      }

      return departagerParNomPrenom(clientA, clientB);
    }

    // 3. Tri alphabétique français sur les colonnes texte (Nom, Prénom, Ville)
    const valeurA = String(clientA?.[colonne] ?? '').trim();
    const valeurB = String(clientB?.[colonne] ?? '').trim();
    const estVideA = valeurA === '';
    const estVideB = valeurB === '';

    // Les valeurs vides (ex. ville non renseignée) restent toujours à la fin, quel que soit le sens
    if (estVideA && estVideB) {
      return departagerParNomPrenom(clientA, clientB);
    }
    if (estVideA) {
      return 1;
    }
    if (estVideB) {
      return -1;
    }

    const diffTexte = comparerTexteFr(valeurA, valeurB);
    if (diffTexte !== 0) {
      return diffTexte * multiplicateur;
    }

    // En cas d'égalité, on départage par Nom puis Prénom
    return departagerParNomPrenom(clientA, clientB);
  });
}
