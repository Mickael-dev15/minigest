// Fonctions pures de pagination pour la liste des clients de MiniGest.
// Aucune fonction de ce fichier ne modifie la liste d'origine :
// .slice() crée toujours un nouveau tableau contenant uniquement la page voulue.

// Choix proposés à l'utilisateur pour le nombre de clients par page
export const OPTIONS_PAR_PAGE = [10, 25, 50];

// Nombre de clients affichés par page par défaut
export const PAR_PAGE_PAR_DEFAUT = 10;

// Vérifie que le nombre par page choisi fait bien partie des options autorisées (10, 25 ou 50)
export function normaliserParPage(valeur) {
  const nombre = Number(valeur);
  if (OPTIONS_PAR_PAGE.includes(nombre)) {
    return nombre;
  }
  return PAR_PAGE_PAR_DEFAUT;
}

// Découpe une liste pour n'en garder que les éléments de la page demandée.
// Renvoie un objet contenant :
// - elements : les éléments à afficher sur la page courante
// - pageCourante : le numéro de page réellement affiché (toujours entre 1 et totalPages)
// - totalPages : le nombre total de pages (au moins 1)
// - debut : le numéro (à partir de 1) du premier élément affiché (0 si la liste est vide)
// - fin : le numéro (à partir de 1) du dernier élément affiché (0 si la liste est vide)
export function paginer(liste, page = 1, parPage = PAR_PAGE_PAR_DEFAUT) {
  const listePropre = Array.isArray(liste) ? liste : [];

  // S'assure que le nombre d'éléments par page est un entier strictement positif
  const taillePage =
    Number.isInteger(Number(parPage)) && Number(parPage) > 0
      ? Number(parPage)
      : PAR_PAGE_PAR_DEFAUT;

  const totalElements = listePropre.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / taillePage));

  // Si la page demandée est trop petite (< 1) ou n'existe plus (> totalPages),
  // on la ramène automatiquement dans les bornes [1, totalPages]
  const pageNumerique = Number.isFinite(Number(page))
    ? Math.floor(Number(page))
    : 1;
  const pageCourante = Math.min(Math.max(1, pageNumerique), totalPages);

  // Cas d'une liste vide : aucun élément à découper
  if (totalElements === 0) {
    return {
      elements: [],
      pageCourante: 1,
      totalPages: 1,
      debut: 0,
      fin: 0,
    };
  }

  // En JavaScript, les index commencent à 0 :
  // page 1 -> index 0 à 9, page 2 -> index 10 à 19, page 3 -> index 20 à 29...
  const indexDebut = (pageCourante - 1) * taillePage;
  const indexFin = indexDebut + taillePage;

  // .slice(indexDebut, indexFin) inclut indexDebut et s'arrête juste avant indexFin
  const elements = listePropre.slice(indexDebut, indexFin);

  return {
    elements,
    pageCourante,
    totalPages,
    debut: indexDebut + 1,
    fin: Math.min(indexFin, totalElements),
  };
}

// Calcule la suite de boutons de pages à afficher sous la liste.
// - Jusqu'à 7 pages : affiche tous les numéros (1 2 3 4 5 6 7).
// - Au-delà de 7 pages : affiche la première page, la dernière et les pages
//   autour de la page courante avec des points de suspension "…"
//   (exemple pour la page 5 sur 12 : [1, '…', 4, 5, 6, '…', 12]).
export function calculerPagesVisibles(pageCourante, totalPages) {
  if (totalPages <= 7) {
    const toutesLesPages = [];
    for (let numero = 1; numero <= totalPages; numero += 1) {
      toutesLesPages.push(numero);
    }
    return toutesLesPages;
  }

  // Ensemble des numéros à conserver (sans doublons)
  const pagesAGarder = new Set([1, totalPages]);

  // Ajoute la page courante ainsi que sa page précédente et sa page suivante
  for (let numero = pageCourante - 1; numero <= pageCourante + 1; numero += 1) {
    if (numero >= 1 && numero <= totalPages) {
      pagesAGarder.add(numero);
    }
  }

  // Près du début ou de la fin, garde un groupe confortable de 4 pages consécutives
  if (pageCourante <= 3) {
    pagesAGarder.add(2);
    pagesAGarder.add(3);
    pagesAGarder.add(4);
  } else if (pageCourante >= totalPages - 2) {
    pagesAGarder.add(totalPages - 3);
    pagesAGarder.add(totalPages - 2);
    pagesAGarder.add(totalPages - 1);
  }

  const pagesTriees = [...pagesAGarder].sort((a, b) => a - b);
  const resultat = [];

  for (let i = 0; i < pagesTriees.length; i += 1) {
    const numero = pagesTriees[i];
    const precedent = pagesTriees[i - 1];

    if (i > 0) {
      const ecart = numero - precedent;
      // Si un seul numéro manque entre deux pages, on l'affiche plutôt que "…"
      if (ecart === 2) {
        resultat.push(precedent + 1);
      } else if (ecart > 2) {
        resultat.push('…');
      }
    }

    resultat.push(numero);
  }

  return resultat;
}
