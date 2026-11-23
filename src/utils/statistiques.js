// Fonctions pures de calcul des statistiques pour le tableau de bord MiniGest.
// Aucune fonction de ce fichier ne modifie le tableau "clients" reçu en paramètre.

// Abréviations françaises des 12 mois de l'année (index 0 = janvier, 11 = décembre)
const MOIS_COURTS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

// Libellé utilisé lorsqu'un client n'a pas de ville renseignée
const LIBELLE_VILLE_NON_RENSEIGNEE = 'Non renseignée';

// Clé interne dédiée aux clients sans ville pour éviter toute confusion
const CLE_VILLE_NON_RENSEIGNEE = '__non_renseignee__';

// Convertit une date (chaîne ISO ou objet Date) en objet Date valide, sinon renvoie null
function convertirEnDate(valeurDate) {
  if (!valeurDate) {
    return null;
  }

  const date = valeurDate instanceof Date ? valeurDate : new Date(valeurDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// Nettoie les espaces superflus d'un texte (début, fin et espaces multiples)
function nettoyerEspaces(texte) {
  return String(texte ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Supprime les accents et passe en minuscules pour comparer deux noms de ville
// Exemple : "THIES", "Thies" et "Thiès" donnent tous la même clé "thies"
function normaliserCleVille(ville) {
  return nettoyerEspaces(ville)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Compte le nombre d'accents (signes diacritiques) présents dans un texte
function compterAccents(texte) {
  const correspondances = texte.normalize('NFD').match(/[\u0300-\u036f]/g);
  return correspondances ? correspondances.length : 0;
}

// Met en forme un nom de ville avec une majuscule initiale et le reste en minuscules
// Exemple : "THIÈS" -> "Thiès", "dakar" -> "Dakar"
function formaterNomVille(ville) {
  const propre = nettoyerEspaces(ville);
  if (propre === '') {
    return LIBELLE_VILLE_NON_RENSEIGNEE;
  }

  return (
    propre.charAt(0).toLocaleUpperCase('fr-FR') +
    propre.slice(1).toLocaleLowerCase('fr-FR')
  );
}

// Calcule les 4 indicateurs principaux du tableau de bord à partir de tous les clients.
// Les dates sont comparées en heure LOCALE (getMonth / getFullYear).
export function calculerIndicateurs(clients, dateReference = new Date()) {
  const liste = Array.isArray(clients) ? clients : [];
  const anneeCourante = dateReference.getFullYear();
  const moisCourant = dateReference.getMonth();

  let nouveauxCeMois = 0;
  let prospects = 0;
  let inactifs = 0;

  for (const client of liste) {
    if (client.statut === 'Prospect') {
      prospects += 1;
    } else if (client.statut === 'Inactif') {
      inactifs += 1;
    }

    const dateAjout = convertirEnDate(client.dateAjout);
    if (
      dateAjout &&
      dateAjout.getFullYear() === anneeCourante &&
      dateAjout.getMonth() === moisCourant
    ) {
      nouveauxCeMois += 1;
    }
  }

  return {
    totalClients: liste.length,
    nouveauxCeMois,
    prospects,
    inactifs,
  };
}

// Calcule la répartition des clients par statut (Prospect, Client, Inactif)
// avec le nombre et le pourcentage correspondant à chaque statut.
export function calculerRepartitionStatuts(clients) {
  const liste = Array.isArray(clients) ? clients : [];
  const total = liste.length;

  const compteurs = {
    Prospect: 0,
    Client: 0,
    Inactif: 0,
  };

  for (const client of liste) {
    if (client.statut === 'Prospect') {
      compteurs.Prospect += 1;
    } else if (client.statut === 'Inactif') {
      compteurs.Inactif += 1;
    } else {
      compteurs.Client += 1;
    }
  }

  const ordreStatuts = [
    { statut: 'Prospect', cleCss: 'prospect' },
    { statut: 'Client', cleCss: 'client' },
    { statut: 'Inactif', cleCss: 'inactif' },
  ];

  return ordreStatuts.map(({ statut, cleCss }) => {
    const nombre = compteurs[statut];
    const largeurPourcent = total > 0 ? (nombre / total) * 100 : 0;
    const pourcentage = total > 0 ? Math.round(largeurPourcent) : 0;

    return {
      statut,
      cleCss,
      nombre,
      pourcentage,
      largeurPourcent,
    };
  });
}

// Calcule le Top N des villes les plus représentées (Top 5 par défaut).
// - Regroupe les villes sans tenir compte des majuscules ni des accents.
// - Conserve une écriture avec accent si au moins une saisie en contient un ("Thiès").
// - Classe les clients sans ville dans "Non renseignée".
// - Trie par nombre décroissant, puis par ordre alphabétique en cas d'égalité.
export function calculerTopVilles(clients, limite = 5) {
  const liste = Array.isArray(clients) ? clients : [];
  const groupes = {};

  for (const client of liste) {
    const villePropre = nettoyerEspaces(client.ville);

    if (villePropre === '') {
      if (!groupes[CLE_VILLE_NON_RENSEIGNEE]) {
        groupes[CLE_VILLE_NON_RENSEIGNEE] = {
          cle: CLE_VILLE_NON_RENSEIGNEE,
          ville: LIBELLE_VILLE_NON_RENSEIGNEE,
          nombre: 0,
          nbAccents: 0,
        };
      }
      groupes[CLE_VILLE_NON_RENSEIGNEE].nombre += 1;
      continue;
    }

    const cle = normaliserCleVille(villePropre);
    const nomFormate = formaterNomVille(villePropre);
    const nbAccents = compterAccents(nomFormate);

    if (!groupes[cle]) {
      groupes[cle] = {
        cle,
        ville: nomFormate,
        nombre: 1,
        nbAccents,
      };
    } else {
      groupes[cle].nombre += 1;
      // Si cette saisie contient plus d'accents (ex. "Thiès" après "THIES"), on la préfère pour l'affichage
      if (nbAccents > groupes[cle].nbAccents) {
        groupes[cle].ville = nomFormate;
        groupes[cle].nbAccents = nbAccents;
      }
    }
  }

  // On crée un nouveau tableau trié sans modifier les données d'origine
  const villesTriees = Object.values(groupes)
    .sort((a, b) => {
      if (b.nombre !== a.nombre) {
        return b.nombre - a.nombre;
      }
      return a.ville.localeCompare(b.ville, 'fr', { sensitivity: 'base' });
    })
    .slice(0, limite);

  const maxNombre = villesTriees.length > 0 ? villesTriees[0].nombre : 0;

  return villesTriees.map((item) => ({
    cle: item.cle,
    ville: item.ville,
    nombre: item.nombre,
    largeurPourcent: maxNombre > 0 ? (item.nombre / maxNombre) * 100 : 0,
  }));
}

// Calcule le nombre de nouveaux clients pour chacun des 6 derniers mois calendaires
// (en heure LOCALE, du plus ancien au mois en cours). Les mois sans client sont à 0.
export function calculerNouveauxClients6DerniersMois(
  clients,
  dateReference = new Date()
) {
  const liste = Array.isArray(clients) ? clients : [];
  const anneeRef = dateReference.getFullYear();
  const moisRef = dateReference.getMonth();

  // Prépare les 6 mois (en utilisant le 1er du mois pour éviter tout décalage de date)
  const moisListe = [];
  const indexParCle = {};

  for (let decalage = 5; decalage >= 0; decalage -= 1) {
    const dateMois = new Date(anneeRef, moisRef - decalage, 1);
    const annee = dateMois.getFullYear();
    const mois = dateMois.getMonth();
    const cle = `${annee}-${mois}`;

    indexParCle[cle] = moisListe.length;
    moisListe.push({
      cle,
      annee,
      mois,
      libelle: MOIS_COURTS_FR[mois],
      nombre: 0,
    });
  }

  // Compte chaque client dans son mois local d'ajout s'il fait partie des 6 derniers mois
  for (const client of liste) {
    const dateAjout = convertirEnDate(client.dateAjout);
    if (!dateAjout) {
      continue;
    }

    const cleClient = `${dateAjout.getFullYear()}-${dateAjout.getMonth()}`;
    const index = indexParCle[cleClient];
    if (index !== undefined) {
      moisListe[index].nombre += 1;
    }
  }

  const maxNombre = moisListe.reduce(
    (max, item) => (item.nombre > max ? item.nombre : max),
    0
  );

  return moisListe.map((item) => ({
    ...item,
    hauteurPourcent: maxNombre > 0 ? (item.nombre / maxNombre) * 100 : 0,
  }));
}
