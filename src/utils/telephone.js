// Utilitaires de normalisation et d'affichage des numéros de téléphone pour MiniGest

// Message d'erreur affiché quand le format du numéro ne correspond à aucune règle connue
const ERREUR_NON_RECONNU =
  "Numéro non reconnu : ajoutez l'indicatif pays (ex. +33...)";

// Message d'erreur affiché quand un numéro 221, 237 ou 225 n'a pas la bonne longueur
const ERREUR_INCOMPLET_PAYS = 'Numéro incomplet pour ce pays';

// Supprime espaces, points, tirets et parenthèses d'une saisie téléphonique
function nettoyerSeparateurs(texte) {
  return String(texte ?? '').replace(/[\s.\-()]/g, '');
}

// Normalise un numéro de téléphone vers le format international unique (+ suivi uniquement de chiffres)
// Renvoie toujours un objet { numero, erreur }
export function normaliserTelephone(saisie) {
  const nettoye = nettoyerSeparateurs(saisie);

  // 1. Champ vide
  if (nettoye === '') {
    return { numero: '', erreur: 'Le téléphone est obligatoire' };
  }

  // 2. Caractères autorisés uniquement : un "+" facultatif au début puis des chiffres
  if (!/^\+?\d+$/.test(nettoye)) {
    return { numero: '', erreur: ERREUR_NON_RECONNU };
  }

  // 3. Remplace "00" en début de numéro par "+" (ex. 00221... -> +221...)
  let candidat = nettoye.startsWith('00') ? `+${nettoye.slice(2)}` : nettoye;

  // 4. Ajout de l'indicatif pays selon les règles du projet
  if (candidat.startsWith('+')) {
    // On garde tel quel pour le contrôle de longueur ci-dessous
  } else if (
    candidat.startsWith('221') ||
    candidat.startsWith('237') ||
    candidat.startsWith('225')
  ) {
    // Indicatif Sénégal, Cameroun ou Côte d'Ivoire saisi sans le "+"
    candidat = `+${candidat}`;
  } else if (/^[73]\d{8}$/.test(candidat)) {
    // 9 chiffres commençant par 7 ou 3 -> Sénégal (+221)
    candidat = `+221${candidat}`;
  } else if (/^6\d{8}$/.test(candidat)) {
    // 9 chiffres commençant par 6 -> Cameroun (+237)
    candidat = `+237${candidat}`;
  } else if (/^0\d{9}$/.test(candidat)) {
    // 10 chiffres commençant par 0 -> Côte d'Ivoire (+225)
    candidat = `+225${candidat}`;
  } else {
    return { numero: '', erreur: ERREUR_NON_RECONNU };
  }

  // 5. Contrôle précis de la longueur pour les 3 pays pris en charge en priorité
  if (candidat.startsWith('+221') || candidat.startsWith('+237')) {
    const numeroLocal = candidat.slice(4);
    if (numeroLocal.length !== 9) {
      return { numero: '', erreur: ERREUR_INCOMPLET_PAYS };
    }
    return { numero: candidat, erreur: '' };
  }

  if (candidat.startsWith('+225')) {
    const numeroLocal = candidat.slice(4);
    if (numeroLocal.length !== 10) {
      return { numero: '', erreur: ERREUR_INCOMPLET_PAYS };
    }
    return { numero: candidat, erreur: '' };
  }

  // 6. Autres indicatifs internationaux : entre 8 et 15 chiffres après le "+"
  if (!/^\+\d{8,15}$/.test(candidat)) {
    return { numero: '', erreur: ERREUR_NON_RECONNU };
  }

  return { numero: candidat, erreur: '' };
}

// Met en forme un numéro normalisé pour une lecture confortable dans le tableau et les cartes
export function formaterTelephone(numero) {
  const texte = String(numero ?? '').trim();

  // Sénégal : +221 77 123 45 67
  const matchSenegal = texte.match(/^(\+221)(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (matchSenegal) {
    return `${matchSenegal[1]} ${matchSenegal[2]} ${matchSenegal[3]} ${matchSenegal[4]} ${matchSenegal[5]}`;
  }

  // Cameroun : +237 650 55 39 27
  const matchCameroun = texte.match(/^(\+237)(\d{3})(\d{2})(\d{2})(\d{2})$/);
  if (matchCameroun) {
    return `${matchCameroun[1]} ${matchCameroun[2]} ${matchCameroun[3]} ${matchCameroun[4]} ${matchCameroun[5]}`;
  }

  // Côte d'Ivoire : +225 07 01 02 03 04
  const matchCoteIvoire = texte.match(
    /^(\+225)(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/
  );
  if (matchCoteIvoire) {
    return `${matchCoteIvoire[1]} ${matchCoteIvoire[2]} ${matchCoteIvoire[3]} ${matchCoteIvoire[4]} ${matchCoteIvoire[5]} ${matchCoteIvoire[6]}`;
  }

  // Pour les autres indicatifs (ou anciens numéros non normalisés), on affiche tel quel
  return texte;
}

// Nettoie une saisie de recherche pour comparer facilement les numéros avec ou sans espaces/indicatif
export function nettoyerRechercheTelephone(saisie) {
  const nettoye = nettoyerSeparateurs(saisie);
  if (!/^\+?\d+$/.test(nettoye)) {
    return '';
  }

  return nettoye.startsWith('00') ? `+${nettoye.slice(2)}` : nettoye;
}
