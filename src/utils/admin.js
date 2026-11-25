// Fonctions pures de calcul, validation et formatage pour le tableau de bord Super admin (/admin).
// Aucune fonction de ce fichier ne modifie les tableaux ou objets reçus en paramètre.

// Liste des pays proposés pour les entreprises (création et modification)
export const PAYS = [
  'Sénégal',
  "Côte d'Ivoire",
  'Cameroun',
  'Mali',
  'Burkina Faso',
  'Bénin',
  'Togo',
  'Guinée',
  'Niger',
  'Gabon',
  'Congo',
  'Autre',
];

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

// Rôles autorisés à la création depuis l'interface Super admin (jamais super_admin)
export const ROLES_UTILISATEUR_CREABLES = [
  { valeur: 'gerant', libelle: 'Gérant' },
  { valeur: 'employe', libelle: 'Employé' },
];

export const LIBELLES_ROLE = {
  super_admin: 'Super admin',
  gerant: 'Gérant',
  employe: 'Employé',
};

export const LONGUEUR_MIN_MOT_DE_PASSE = 12;

// Seuil d'alerte (en jours) avant la date de fin d'un abonnement
export const SEUIL_ALERTE_JOURS = 7;

const MS_PAR_JOUR = 86_400_000;

// Libellés lisibles pour les actions enregistrées dans public.journal
export const LIBELLES_ACTION_JOURNAL = {
  creation_entreprise: 'Création entreprise',
  modification_entreprise: 'Modification entreprise',
  suspension_entreprise: 'Suspension entreprise',
  reactivation_entreprise: 'Réactivation entreprise',
  creation_abonnement: 'Ajout abonnement',
  modification_abonnement: 'Modification abonnement',
  creation_utilisateur: 'Création utilisateur',
  activation_utilisateur: 'Réactivation utilisateur',
  desactivation_utilisateur: 'Désactivation utilisateur',
  creation_employe: 'Création employé',
  desactivation_employe: 'Désactivation employé',
  reactivation_employe: 'Réactivation employé',
};

const FORMATEUR_NOMBRE_FR = new Intl.NumberFormat('fr-FR');
const REGEX_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_EMAIL_UTILISATEUR =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

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

// Convertit une date de référence (chaîne 'YYYY-MM-DD' ou objet Date) en date locale 'YYYY-MM-DD'
function normaliserDateReference(dateReference) {
  if (dateReference === undefined || dateReference === null) {
    return obtenirDateLocaleAujourdhui();
  }
  if (dateReference instanceof Date) {
    return Number.isNaN(dateReference.getTime())
      ? ''
      : obtenirDateLocaleAujourdhui(dateReference);
  }
  return normaliserDateIso(dateReference);
}

// Convertit une date 'YYYY-MM-DD' valide en timestamp UTC minuit (sans utiliser new Date('YYYY-MM-DD'))
function dateIsoEnUtcMs(dateIso) {
  const iso = normaliserDateIso(dateIso);
  if (!iso) {
    return null;
  }

  const [annee, mois, jour] = iso.split('-').map(Number);
  return Date.UTC(annee, mois - 1, jour);
}

// Calcule le nombre entier de jours calendaires entre aujourdhui et date_fin
// en dates locales 'YYYY-MM-DD' (< 0 si dépassée, 0 si aujourd'hui, > 0 si future).
export function joursAvantEcheance(
  date_fin,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  const finMs = dateIsoEnUtcMs(date_fin);
  const aujourdhuiIso = normaliserDateReference(aujourdhui);
  const aujourdhuiMs = dateIsoEnUtcMs(aujourdhuiIso);

  if (finMs === null || aujourdhuiMs === null) {
    return null;
  }

  return (finMs - aujourdhuiMs) / MS_PAR_JOUR;
}

// Évalue l'état d'échéance d'un abonnement par rapport à aujourdhui ('YYYY-MM-DD' locale) :
// - 'expire'  : date_fin strictement passée (< 0 jour)
// - 'bientot' : date_fin aujourd'hui ou dans SEUIL_ALERTE_JOURS jours ou moins (0..7)
// - 'ok'      : au-delà de SEUIL_ALERTE_JOURS jours (ou date absente / invalide)
export function etatEcheance(
  abonnement,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  if (!abonnement) {
    return 'ok';
  }

  const jours = joursAvantEcheance(abonnement.date_fin, aujourdhui);
  if (jours === null) {
    return 'ok';
  }

  if (jours < 0) {
    return 'expire';
  }

  if (jours <= SEUIL_ALERTE_JOURS) {
    return 'bientot';
  }

  return 'ok';
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
    const aujourdhui = normaliserDateReference(dateReference);
    return dateFin !== '' && aujourdhui !== '' && dateFin < aujourdhui;
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

  const aujourdhui = normaliserDateReference(dateReference);

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

// Vérifie si l'entreprise dispose déjà d'un abonnement suivant après l'abonnement en cours :
// date_debut strictement postérieure à aujourd'hui ET >= date_fin de l'abonnement en cours.
export function aAbonnementSuivant(
  abonnementEnCours,
  abonnementsEntreprise,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  if (!abonnementEnCours) {
    return false;
  }

  const finEnCours = normaliserDateIso(abonnementEnCours.date_fin);
  const dateJour = normaliserDateReference(aujourdhui);
  if (!finEnCours || !dateJour) {
    return false;
  }

  const liste = Array.isArray(abonnementsEntreprise)
    ? abonnementsEntreprise
    : [];

  return liste.some((abonnement) => {
    if (
      !abonnement ||
      abonnement === abonnementEnCours ||
      (abonnementEnCours.id && abonnement.id === abonnementEnCours.id)
    ) {
      return false;
    }

    const debut = normaliserDateIso(abonnement.date_debut);
    return debut !== '' && debut > dateJour && debut >= finEnCours;
  });
}

// Analyse l'échéance de l'abonnement en cours d'une entreprise en tenant compte d'un
// éventuel renouvellement déjà enregistré (aucune alerte si un abonnement suivant existe).
export function analyserEcheanceEntreprise(
  abonnementsEntreprise,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  const dateJour = normaliserDateReference(aujourdhui);
  const abonnementEnCours = determinerAbonnementEnCours(
    abonnementsEntreprise,
    dateJour
  );

  if (!abonnementEnCours) {
    return {
      abonnementEnCours: null,
      etat: 'ok',
      joursRestants: null,
      estRenouvele: false,
      alerteEcheance: false,
    };
  }

  const estRenouvele = aAbonnementSuivant(
    abonnementEnCours,
    abonnementsEntreprise,
    dateJour
  );
  const joursRestants = joursAvantEcheance(abonnementEnCours.date_fin, dateJour);
  const etatBrut = etatEcheance(abonnementEnCours, dateJour);

  // Si un abonnement suivant est déjà prévu, aucune alerte d'échéance ne doit être levée
  const etat = estRenouvele ? 'ok' : etatBrut;
  const alerteEcheance =
    !estRenouvele && (etatBrut === 'bientot' || etatBrut === 'expire');

  return {
    abonnementEnCours,
    etat,
    joursRestants,
    estRenouvele,
    alerteEcheance,
  };
}

// Construit le badge d'échéance à afficher dans le tableau des entreprises (/admin)
export function formaterBadgeEcheance(analyseEcheance) {
  if (!analyseEcheance?.abonnementEnCours) {
    return null;
  }

  if (analyseEcheance.estRenouvele) {
    return { type: 'renouvele', libelle: 'Renouvelé' };
  }

  if (analyseEcheance.etat === 'expire') {
    return { type: 'expire', libelle: 'Expiré' };
  }

  if (analyseEcheance.etat === 'bientot') {
    const jours = analyseEcheance.joursRestants;
    if (jours === 0) {
      return { type: 'bientot', libelle: "Expire aujourd'hui" };
    }
    if (jours === 1) {
      return { type: 'bientot', libelle: 'Expire dans 1 jour' };
    }
    return { type: 'bientot', libelle: `Expire dans ${jours} jours` };
  }

  return null;
}

// Construit la liste ordonnée des badges à afficher pour l'abonnement en cours (/admin).
// Si l'abonnement est expiré ET non payé (sans renouvellement prévu), renvoie un seul
// badge rouge "Expiré – non payé" à la place de "En attente (échu)" / "En retard" + "Expiré".
export function construireBadgesAbonnement(
  analyseEcheance,
  dateReference = new Date()
) {
  const abonnementEnCours = analyseEcheance?.abonnementEnCours;
  if (!abonnementEnCours) {
    return [];
  }

  const statutPaiement = abonnementEnCours.statut_paiement;
  const estExpire = analyseEcheance.etat === 'expire';
  const estNonPaye = statutPaiement !== 'paye';

  if (estExpire && estNonPaye) {
    return [
      {
        cle: 'expire-non-paye',
        classeCss: 'badge-echeance-expire',
        libelle: 'Expiré – non payé',
      },
    ];
  }

  const badges = [];
  const enRetard = estAbonnementEnRetard(abonnementEnCours, dateReference);
  const classeBadgePaiement =
    statutPaiement === 'paye'
      ? 'badge-paiement-paye'
      : statutPaiement === 'en_retard' || enRetard
        ? 'badge-paiement-retard'
        : 'badge-paiement-attente';

  const libelleBase = LIBELLES_STATUT_PAIEMENT[statutPaiement] ?? statutPaiement;
  const libellePaiement =
    statutPaiement === 'en_attente' && enRetard
      ? `${libelleBase} (échu)`
      : libelleBase;

  badges.push({
    cle: 'paiement',
    classeCss: classeBadgePaiement,
    libelle: libellePaiement,
  });

  const badgeEcheance = formaterBadgeEcheance(analyseEcheance);
  if (badgeEcheance) {
    badges.push({
      cle: `echeance-${badgeEcheance.type}`,
      classeCss: `badge-echeance-${badgeEcheance.type}`,
      libelle: badgeEcheance.libelle,
    });
  }

  return badges;
}

// Indique si une entreprise doit apparaître dans le filtre "À surveiller" sur /admin :
// abonnement en retard de paiement OU échéance expirée / proche (sans renouvellement déjà prévu).
export function estEntrepriseASurveiller(
  abonnementsEntreprise,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  const liste = Array.isArray(abonnementsEntreprise)
    ? abonnementsEntreprise
    : [];
  const dateJour = normaliserDateReference(aujourdhui);

  const aUnAbonnementEnRetard = liste.some((abonnement) =>
    estAbonnementEnRetard(abonnement, dateJour)
  );
  if (aUnAbonnementEnRetard) {
    return true;
  }

  const analyse = analyserEcheanceEntreprise(liste, dateJour);
  return analyse.alerteEcheance;
}

// Construit le message du bandeau d'information sur /app pour le gérant.
// Renvoie null si aucun abonnement, si déjà renouvelé ou si l'échéance dépasse SEUIL_ALERTE_JOURS.
export function construireMessageBandeauAbonnement(
  abonnementsEntreprise,
  aujourdhui = obtenirDateLocaleAujourdhui()
) {
  const analyse = analyserEcheanceEntreprise(abonnementsEntreprise, aujourdhui);

  if (!analyse.abonnementEnCours || !analyse.alerteEcheance) {
    return null;
  }

  const dateFinFr = formaterDateFr(analyse.abonnementEnCours.date_fin);

  if (analyse.etat === 'expire') {
    return {
      etat: 'expire',
      message: `Votre abonnement a expiré le ${dateFinFr}. Contactez l'administrateur MiniGest.`,
    };
  }

  const detailJours =
    analyse.joursRestants === 0
      ? "aujourd'hui"
      : analyse.joursRestants === 1
        ? 'dans 1 jour'
        : `dans ${analyse.joursRestants} jours`;

  return {
    etat: 'bientot',
    message: `Votre abonnement expire le ${dateFinFr} (${detailJours}). Contactez l'administrateur MiniGest.`,
  };
}

// Calcule les 6 indicateurs affichés en haut de la page /admin
export function calculerIndicateursAdmin(
  entreprises,
  abonnements,
  lignesRpc,
  dateReference = new Date()
) {
  const listeEntreprises = Array.isArray(entreprises) ? entreprises : [];
  const listeAbonnements = Array.isArray(abonnements) ? abonnements : [];
  const dateJour = normaliserDateReference(dateReference);

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
    if (estAbonnementEnRetard(abonnement, dateJour)) {
      abonnementsEnRetard += 1;
    }
  }

  const abonnementsParEntreprise =
    regrouperAbonnementsParEntreprise(listeAbonnements);
  let echeancesSous7Jours = 0;

  for (const entreprise of listeEntreprises) {
    const analyse = analyserEcheanceEntreprise(
      abonnementsParEntreprise[entreprise.id] ?? [],
      dateJour
    );
    if (!analyse.estRenouvele && analyse.etat === 'bientot') {
      echeancesSous7Jours += 1;
    }
  }

  return {
    totalEntreprises: listeEntreprises.length,
    entreprisesActives,
    entreprisesSuspendues,
    totalClients: calculerTotalClients(lignesRpc),
    abonnementsEnRetard,
    echeancesSous7Jours,
  };
}

// Valide les champs du formulaire de création ou modification d'entreprise
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

// Compare les champs éditables d'une entreprise (nom, ville, pays uniquement) et renvoie
// un objet contenant uniquement les champs réellement modifiés : { champ: { avant, apres } }.
export function calculerChangementsEntreprise(
  entrepriseExistante,
  donneesPropres
) {
  const champsEditables = ['nom', 'ville', 'pays'];
  const changements = {};

  for (const champ of champsEditables) {
    const valeurAvant = String(entrepriseExistante?.[champ] ?? '').trim() || null;
    const valeurApres = String(donneesPropres?.[champ] ?? '').trim() || null;

    if (valeurAvant !== valeurApres) {
      changements[champ] = {
        avant: valeurAvant,
        apres: valeurApres,
      };
    }
  }

  return changements;
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

// Ordre d'affichage des rôles au sein d'une même entreprise
const ORDRE_ROLE = {
  super_admin: 0,
  gerant: 1,
  employe: 2,
};

// Valide les champs du formulaire de création d'utilisateur (Lot 2b)
// Normalise l'email (trim + minuscules) et interdit le rôle super_admin.
export function validerNouvelUtilisateur(donnees) {
  const email = String(donnees?.email ?? '').trim().toLowerCase();
  const nomComplet = String(donnees?.nom_complet ?? '').trim();
  const role = String(donnees?.role ?? '').trim();
  const entrepriseId = String(donnees?.entreprise_id ?? '').trim();
  const motDePasseTemporaire = String(donnees?.mot_de_passe_temporaire ?? '');

  const erreurs = {};

  if (entrepriseId === '') {
    erreurs.entreprise_id = 'Veuillez choisir une entreprise active.';
  }

  if (nomComplet === '') {
    erreurs.nom_complet = 'Le nom complet est obligatoire.';
  }

  if (email === '') {
    erreurs.email = "L'adresse email est obligatoire.";
  } else if (!REGEX_EMAIL_UTILISATEUR.test(email)) {
    erreurs.email = "L'adresse email n'est pas valide.";
  }

  const rolesAutorises = ROLES_UTILISATEUR_CREABLES.map((r) => r.valeur);
  if (!rolesAutorises.includes(role)) {
    erreurs.role = 'Le rôle doit être Gérant ou Employé.';
  }

  if (motDePasseTemporaire.trim() === '') {
    erreurs.mot_de_passe_temporaire =
      'Le mot de passe temporaire est obligatoire.';
  } else if (motDePasseTemporaire.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    erreurs.mot_de_passe_temporaire = `Le mot de passe temporaire doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  }

  return {
    erreurs,
    donneesPropres: {
      email,
      nom_complet: nomComplet,
      role,
      entreprise_id: entrepriseId,
      mot_de_passe_temporaire: motDePasseTemporaire,
    },
  };
}

// Trie une liste de profils par rôle (gérant avant employé) puis par nom complet
function comparerProfils(a, b) {
  const rangA = ORDRE_ROLE[a?.role] ?? 99;
  const rangB = ORDRE_ROLE[b?.role] ?? 99;
  if (rangA !== rangB) {
    return rangA - rangB;
  }

  return String(a?.nom_complet ?? '').localeCompare(
    String(b?.nom_complet ?? ''),
    'fr',
    { sensitivity: 'base' }
  );
}

// Regroupe les profils par entreprise pour la section Utilisateurs de /admin.
// Ne modifie jamais les tableaux reçus en paramètre.
export function regrouperProfilsParEntreprise(profils, entreprises) {
  const listeProfils = Array.isArray(profils) ? profils : [];
  const listeEntreprises = Array.isArray(entreprises) ? entreprises : [];

  const profilsParEntrepriseId = {};
  const profilsSuperAdmin = [];

  for (const profil of listeProfils) {
    if (!profil) {
      continue;
    }
    if (!profil.entreprise_id) {
      profilsSuperAdmin.push(profil);
      continue;
    }
    if (!profilsParEntrepriseId[profil.entreprise_id]) {
      profilsParEntrepriseId[profil.entreprise_id] = [];
    }
    profilsParEntrepriseId[profil.entreprise_id].push(profil);
  }

  const idsEntreprisesConnues = new Set();
  const groupes = listeEntreprises.map((entreprise) => {
    idsEntreprisesConnues.add(entreprise.id);
    const membres = profilsParEntrepriseId[entreprise.id] ?? [];
    return {
      id: entreprise.id,
      nom: entreprise.nom,
      statut: entreprise.statut,
      estPlateforme: false,
      profils: [...membres].sort(comparerProfils),
    };
  });

  // Filet de sécurité si un profil pointe vers une entreprise non présente dans la liste
  for (const entrepriseId of Object.keys(profilsParEntrepriseId)) {
    if (!idsEntreprisesConnues.has(entrepriseId)) {
      groupes.push({
        id: entrepriseId,
        nom: 'Entreprise rattachée',
        statut: 'active',
        estPlateforme: false,
        profils: [...profilsParEntrepriseId[entrepriseId]].sort(comparerProfils),
      });
    }
  }

  if (profilsSuperAdmin.length > 0) {
    groupes.push({
      id: 'plateforme',
      nom: 'Administration plateforme',
      statut: 'active',
      estPlateforme: true,
      profils: [...profilsSuperAdmin].sort(comparerProfils),
    });
  }

  return groupes;
}

const LIBELLES_CHAMP_ENTREPRISE = {
  nom: 'Nom',
  ville: 'Ville',
  pays: 'Pays',
};

// Formate les détails JSON d'une entrée du journal en un résumé lisible en français
export function formaterDetailsJournal(details) {
  if (!details || typeof details !== 'object') {
    return '—';
  }

  const segments = [];

  if (details.changements && typeof details.changements === 'object') {
    for (const [champ, diff] of Object.entries(details.changements)) {
      if (!diff || typeof diff !== 'object') {
        continue;
      }
      const libelleChamp = LIBELLES_CHAMP_ENTREPRISE[champ] ?? champ;
      const avant = diff.avant ?? '—';
      const apres = diff.apres ?? '—';
      segments.push(`${libelleChamp} : ${avant} → ${apres}`);
    }
  }

  if (details.entreprise_nom) {
    segments.push(`Entreprise : ${details.entreprise_nom}`);
  }
  if (details.role) {
    const libelleRole = LIBELLES_ROLE[details.role] ?? details.role;
    segments.push(`Rôle : ${libelleRole}`);
  }
  if (details.email) {
    segments.push(`Email : ${details.email}`);
  }
  if (typeof details.actif === 'boolean') {
    segments.push(`Statut : ${details.actif ? 'Actif' : 'Désactivé'}`);
  }
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
