// Fonctions pures de calcul, validation et formatage pour le tableau de bord Super admin (/admin).
// Aucune fonction de ce fichier ne modifie les tableaux ou objets reçus en paramètre.

// Liste des statuts de paiement autorisés par la base (contrainte CHECK sur public.abonnements)
export const STATUTS_PAIEMENT = [
  { valeur: 'paye', libelle: 'Payé', cleCss: 'paye' },
  { valeur: 'en_attente', libelle: 'En attente', cleCss: 'en-attente' },
  { valeur: 'en_retard', libelle: 'En retard', cleCss: 'en-retard' },
];

export const LIBELLES_STATUT_PAIEMENT = {
  paye: 'Payé',
  en_attente: 'En attente',
  en_retard: 'En retard',
};

// Libellés lisibles pour les actions enregistrées dans public.journal
export const LIBELLES_ACTION_JOURNAL = {
  creation_entreprise: 'Création entreprise',
  suspension_entreprise: 'Suspension entreprise',
  reactivation_entreprise: 'Réactivation entreprise',
  creation_abonnement: 'Ajout abonnement',
  modification_abonnement: 'Modification abonnement',
};

const FORMATEUR_NOMBRE_FR = new Intl.NumberFormat('fr-FR');
const REGEX_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Renvoie la date locale du jour au format 'YYYY-MM-DD' (sans utiliser toISOString() qui est en UTC)
export function obtenirDateLocaleAujourdhui(dateReference = new Date()) {
  const annee = dateReference.getFullYear();
  const mois = String(dateReference.getMonth() + 1).padStart(2, '0');
  const jour = String(dateReference.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

// Vérifie qu'une chaîne correspond bien à une date calendrier valide au format 'YYYY-MM-DD'
export function estDateIsoValide(valeur) {
  if (typeof valeur !== 'string' || !REGEX_DATE_ISO.test(valeur)) {
    return false;
  }

  const [anneeStr, moisStr, jourStr] = valeur.split('-');
  const annee = Number(anneeStr);
  const mois = Number(moisStr);
  const jour = Number(jourStr);

  const dateLocale = new Date(annee, mois - 1, jour);
  return (
    dateLocale.getFullYear() === annee &&
    dateLocale.getMonth() === mois - 1 &&
    dateLocale.getDate() === jour
  );
}

// Extrait la partie 'YYYY-MM-DD' d'une date SQL si elle est valide, sinon renvoie ''
export function normaliserDateIso(valeur) {
  const texte = String(valeur ?? '').trim().slice(0, 10);
  return estDateIsoValide(texte) ? texte : '';
}

// Formate une date SQL 'YYYY-MM-DD' au format français 'JJ/MM/AAAA' sans décalage UTC
export function formaterDateFr(valeurDate) {
  const dateIso = normaliserDateIso(valeurDate);
  if (!dateIso) {
    return '—';
  }

  const [annee, mois, jour] = dateIso.split('-');
  return `${jour}/${mois}/${annee}`;
}

// Formate un horodatage ISO (timestamptz comme journal.cree_le) en heure locale française
export function formaterDateHeureFr(valeurHorodatage) {
  if (!valeurHorodatage) {
    return '—';
  }

  const date = new Date(valeurHorodatage);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const annee = date.getFullYear();
  const heures = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${jour}/${mois}/${annee} ${heures}:${minutes}`;
}

// Formate un montant entier en FCFA avec séparateur de milliers (fr-FR)
export function formaterMontantFcfa(montant) {
  const valeur = Number(montant);
  if (!Number.isFinite(valeur)) {
    return '—';
  }
  return `${FORMATEUR_NOMBRE_FR.format(Math.trunc(valeur))} FCFA`;
}

// Construit un dictionnaire { [entreprise_id]: nb_clients } à partir du RPC nb_clients_par_entreprise
export function construireCarteNbClients(lignesRpc) {
  const liste = Array.isArray(lignesRpc) ? lignesRpc : [];
  const carte = {};

  for (const ligne of liste) {
    if (!ligne || !ligne.entreprise_id) {
      continue;
    }
    const nombre = Number(ligne.nb_clients);
    carte[ligne.entreprise_id] = Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
  }

  return carte;
}

// Retourne le nombre de clients d'une entreprise (0 si absente du résultat RPC)
export function obtenirNbClientsEntreprise(carteNbClients, entrepriseId) {
  if (!carteNbClients || !entrepriseId) {
    return 0;
  }
  const valeur = carteNbClients[entrepriseId];
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : 0;
}

// Calcule le total global des clients en sommant les lignes renvoyées par le RPC
export function calculerTotalClients(lignesRpc) {
  const liste = Array.isArray(lignesRpc) ? lignesRpc : [];
  return liste.reduce((somme, ligne) => {
    const nombre = Number(ligne?.nb_clients);
    return somme + (Number.isFinite(nombre) && nombre > 0 ? nombre : 0);
  }, 0);
}

// Détermine si un abonnement est en retard :
// - statut_paiement === 'en_retard'
// - OU statut_paiement === 'en_attente' avec date_fin < aujourd'hui (en date locale)
export function estAbonnementEnRetard(abonnement, dateReference = new Date()) {
  if (!abonnement) {
    return false;
  }

  if (abonnement.statut_paiement === 'en_retard') {
    return true;
  }

  if (abonnement.statut_paiement === 'en_attente') {
    const dateFin = normaliserDateIso(abonnement.date_fin);
    const aujourdhui = obtenirDateLocaleAujourdhui(dateReference);
    return dateFin !== '' && dateFin < aujourdhui;
  }

  return false;
}

// Compare deux abonnements du plus récent au plus ancien (date_fin desc, puis date_debut desc)
function comparerAbonnementsRecents(a, b) {
  const finA = normaliserDateIso(a?.date_fin);
  const finB = normaliserDateIso(b?.date_fin);
  if (finA !== finB) {
    return finB.localeCompare(finA);
  }

  const debutA = normaliserDateIso(a?.date_debut);
  const debutB = normaliserDateIso(b?.date_debut);
  if (debutA !== debutB) {
    return debutB.localeCompare(debutA);
  }

  return String(b?.id ?? '').localeCompare(String(a?.id ?? ''));
}

// Regroupe les abonnements par entreprise_id, triés du plus récent au plus ancien
export function regrouperAbonnementsParEntreprise(abonnements) {
  const liste = Array.isArray(abonnements) ? abonnements : [];
  const groupes = {};

  for (const abonnement of liste) {
    if (!abonnement || !abonnement.entreprise_id) {
      continue;
    }
    if (!groupes[abonnement.entreprise_id]) {
      groupes[abonnement.entreprise_id] = [];
    }
    groupes[abonnement.entreprise_id].push(abonnement);
  }

  for (const entrepriseId of Object.keys(groupes)) {
    groupes[entrepriseId] = [...groupes[entrepriseId]].sort(
      comparerAbonnementsRecents
    );
  }

  return groupes;
}

// Détermine l'abonnement en cours d'une entreprise à une date locale de référence :
// 1. S'il existe un ou plusieurs abonnements couvrant aujourd'hui (date_debut <= aujourd'hui <= date_fin),
//    renvoie celui dont la date_fin est la plus récente.
// 2. Sinon, renvoie le dernier abonnement connu (date_fin la plus récente), ou null s'il n'y en a aucun.
export function determinerAbonnementEnCours(
  abonnementsEntreprise,
  dateReference = new Date()
) {
  const liste = Array.isArray(abonnementsEntreprise)
    ? abonnementsEntreprise
    : [];

  if (liste.length === 0) {
    return null;
  }

  const aujourdhui = obtenirDateLocaleAujourdhui(dateReference);

  const actifsAujourdhui = liste.filter((abonnement) => {
    const debut = normaliserDateIso(abonnement?.date_debut);
    const fin = normaliserDateIso(abonnement?.date_fin);
    return debut !== '' && fin !== '' && debut <= aujourdhui && aujourdhui <= fin;
  });

  if (actifsAujourdhui.length > 0) {
    return [...actifsAujourdhui].sort(comparerAbonnementsRecents)[0];
  }

  return [...liste].sort(comparerAbonnementsRecents)[0];
}

// Calcule les 5 indicateurs affichés en haut de la page /admin
export function calculerIndicateursAdmin(
  entreprises,
  abonnements,
  lignesRpc,
  dateReference = new Date()
) {
  const listeEntreprises = Array.isArray(entreprises) ? entreprises : [];
  const listeAbonnements = Array.isArray(abonnements) ? abonnements : [];

  let entreprisesActives = 0;
  let entreprisesSuspendues = 0;

  for (const entreprise of listeEntreprises) {
    if (entreprise?.statut === 'suspendue') {
      entreprisesSuspendues += 1;
    } else if (entreprise?.statut === 'active') {
      entreprisesActives += 1;
    }
  }

  let abonnementsEnRetard = 0;
  for (const abonnement of listeAbonnements) {
    if (estAbonnementEnRetard(abonnement, dateReference)) {
      abonnementsEnRetard += 1;
    }
  }

  return {
    totalEntreprises: listeEntreprises.length,
    entreprisesActives,
    entreprisesSuspendues,
    totalClients: calculerTotalClients(lignesRpc),
    abonnementsEnRetard,
  };
}

// Valide les champs du formulaire de création d'entreprise
export function validerEntreprise(donnees) {
  const nom = String(donnees?.nom ?? '').trim();
  const ville = String(donnees?.ville ?? '').trim();
  const pays = String(donnees?.pays ?? '').trim();

  const erreurs = {};
  if (nom === '') {
    erreurs.nom = "Le nom de l'entreprise est obligatoire.";
  }

  return {
    erreurs,
    donneesPropres: {
      nom,
      ville: ville === '' ? null : ville,
      pays: pays === '' ? null : pays,
    },
  };
}

// Valide le motif de suspension obligatoire
export function validerMotifSuspension(motif) {
  const motifPropre = String(motif ?? '').trim();
  if (motifPropre === '') {
    return {
      erreur: 'Le motif de suspension est obligatoire.',
      motifPropre: '',
    };
  }

  return {
    erreur: '',
    motifPropre,
  };
}

// Valide le formulaire d'ajout ou de modification d'un abonnement
export function validerAbonnement(donnees) {
  const formule = String(donnees?.formule ?? '').trim();
  const dateDebut = String(donnees?.date_debut ?? '').trim();
  const dateFin = String(donnees?.date_fin ?? '').trim();
  const montantBrut = String(donnees?.montant_fcfa ?? '').trim();
  const statutPaiement = String(donnees?.statut_paiement ?? '').trim();
  const reference = String(donnees?.reference ?? '').trim();

  const erreurs = {};

  if (formule === '') {
    erreurs.formule = 'La formule est obligatoire.';
  }

  const debutValide = estDateIsoValide(dateDebut);
  if (!debutValide) {
    erreurs.date_debut = 'La date de début est obligatoire.';
  }

  const finValide = estDateIsoValide(dateFin);
  if (!finValide) {
    erreurs.date_fin = 'La date de fin est obligatoire.';
  } else if (debutValide && dateFin < dateDebut) {
    erreurs.date_fin =
      'La date de fin doit être postérieure ou égale à la date de début.';
  }

  let montantEntier = null;
  if (montantBrut === '') {
    erreurs.montant_fcfa = 'Le montant en FCFA est obligatoire.';
  } else if (!/^\d+$/.test(montantBrut)) {
    erreurs.montant_fcfa =
      'Le montant doit être un nombre entier positif ou nul (sans décimales).';
  } else {
    montantEntier = Number.parseInt(montantBrut, 10);
    if (!Number.isSafeInteger(montantEntier) || montantEntier < 0) {
      erreurs.montant_fcfa = 'Le montant en FCFA est invalide.';
    }
  }

  const statutsAutorises = STATUTS_PAIEMENT.map((s) => s.valeur);
  if (!statutsAutorises.includes(statutPaiement)) {
    erreurs.statut_paiement = 'Choisissez un statut de paiement valide.';
  }

  return {
    erreurs,
    donneesPropres: {
      formule,
      date_debut: dateDebut,
      date_fin: dateFin,
      montant_fcfa: montantEntier ?? 0,
      statut_paiement: statutPaiement,
      reference: reference === '' ? null : reference,
    },
  };
}

// Formate les détails JSON d'une entrée du journal en un résumé lisible en français
export function formaterDetailsJournal(details) {
  if (!details || typeof details !== 'object') {
    return '—';
  }

  const segments = [];

  if (details.motif) {
    segments.push(`Motif : ${details.motif}`);
  }
  if (details.formule) {
    segments.push(`Formule : ${details.formule}`);
  }
  if (details.date_debut && details.date_fin) {
    segments.push(
      `Période : ${formaterDateFr(details.date_debut)} → ${formaterDateFr(details.date_fin)}`
    );
  }
  if (typeof details.montant_fcfa === 'number') {
    segments.push(`Montant : ${formaterMontantFcfa(details.montant_fcfa)}`);
  }
  if (details.statut_paiement) {
    const libelleStatut =
      LIBELLES_STATUT_PAIEMENT[details.statut_paiement] ??
      details.statut_paiement;
    segments.push(`Paiement : ${libelleStatut}`);
  }
  if (details.reference) {
    segments.push(`Réf. : ${details.reference}`);
  }
  if (details.ville || details.pays) {
    const localisation = [details.ville, details.pays]
      .filter(Boolean)
      .join(', ');
    if (localisation) {
      segments.push(localisation);
    }
  }
  if (details.ancien_motif) {
    segments.push(`Ancien motif : ${details.ancien_motif}`);
  }

  if (segments.length > 0) {
    return segments.join(' • ');
  }

  const cles = Object.keys(details);
  if (cles.length === 0) {
    return '—';
  }

  return JSON.stringify(details);
}
