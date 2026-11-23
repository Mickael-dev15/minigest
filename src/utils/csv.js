// Utilitaires pour exporter et importer la liste des clients au format CSV (sans bibliothèque externe)

// Caractère invisible (BOM UTF-8) qui indique à Excel d'ouvrir le fichier en UTF-8 avec les bons accents
const BOM_UTF8 = '\uFEFF';

// En-têtes attendus dans le fichier CSV
const ENTETES_CSV = [
  'Nom',
  'Prénom',
  'Téléphone',
  'Email',
  'Ville',
  "Date d'ajout",
];

// En-têtes normalisés (sans accents, en minuscules) pour faciliter la vérification à l'import
const ENTETES_NORMALISES = [
  'nom',
  'prenom',
  'telephone',
  'email',
  'ville',
  "date d'ajout",
];

// Transforme un texte en minuscules sans accents ni apostrophe typographique pour comparer les titres de colonnes
function normaliserEntete(texte) {
  return String(texte ?? '')
    .trim()
    .replace(/’/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Formate une date ISO en format français jj/mm/aaaa
function formaterDateFR(dateISO) {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const annee = date.getFullYear();

  return `${jour}/${mois}/${annee}`;
}

// Protège une cellule CSV si elle contient un point-virgule, un guillemet ou un retour à la ligne
function echapperCelluleCSV(valeur) {
  const texte = String(valeur ?? '');

  if (
    texte.includes(';') ||
    texte.includes('"') ||
    texte.includes('\n') ||
    texte.includes('\r')
  ) {
    // Règle CSV : on double les guillemets internes et on entoure toute la valeur de guillemets
    return `"${texte.replace(/"/g, '""')}"`;
  }

  return texte;
}

// Met le téléphone sous la forme ="+221771234567" pour éviter qu'Excel le transforme en nombre scientifique
function formaterTelephoneExport(telephone) {
  const valeur = String(telephone ?? '').trim();
  if (!valeur) {
    return '';
  }

  // On retire d'éventuels guillemets pour garder une formule Excel propre
  const propre = valeur.replace(/"/g, '');
  return `="${propre}"`;
}

// Construit le nom du fichier d'export avec la date du jour au format minigest_clients_AAAA-MM-JJ.csv
export function obtenirNomFichierExport(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `minigest_clients_${annee}-${mois}-${jour}.csv`;
}

// Génère le contenu texte CSV (encodé UTF-8 avec BOM, séparateur point-virgule) à partir de la liste des clients
export function exporterCSV(clients) {
  // On travaille sur une copie triée par nom pour ne jamais modifier le state d'origine
  const clientsTries = [...clients].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
  );

  const lignes = [ENTETES_CSV.join(';')];

  for (const client of clientsTries) {
    const colonnes = [
      echapperCelluleCSV(client.nom),
      echapperCelluleCSV(client.prenom),
      formaterTelephoneExport(client.telephone),
      echapperCelluleCSV(client.email),
      echapperCelluleCSV(client.ville),
      echapperCelluleCSV(formaterDateFR(client.dateAjout)),
    ];

    lignes.push(colonnes.join(';'));
  }

  // On utilise \r\n (retour à la ligne Windows/Excel) et on ajoute le BOM UTF-8 au tout début
  return BOM_UTF8 + lignes.join('\r\n');
}

// Détecte automatiquement si la première ligne utilise le point-virgule (;) ou la virgule (,)
function detecterSeparateur(texte) {
  let nbPointsVirgules = 0;
  let nbVirgules = 0;
  let dansGuillemets = false;

  for (let i = 0; i < texte.length; i += 1) {
    const caractere = texte[i];

    if (caractere === '"') {
      dansGuillemets = !dansGuillemets;
    } else if (!dansGuillemets && (caractere === '\n' || caractere === '\r')) {
      break;
    } else if (!dansGuillemets && caractere === ';') {
      nbPointsVirgules += 1;
    } else if (!dansGuillemets && caractere === ',') {
      nbVirgules += 1;
    }
  }

  if (nbPointsVirgules === 0 && nbVirgules === 0) {
    return null;
  }

  // On privilégie le point-virgule s'il y en a au moins autant que de virgules
  return nbPointsVirgules >= nbVirgules ? ';' : ',';
}

// Découpe le contenu texte d'un fichier CSV en lignes et colonnes, en gérant les guillemets et les numéros de ligne
function decouperCSV(texte, separateur) {
  const enregistrements = [];
  let cellules = [];
  let celluleCourante = '';
  let dansGuillemets = false;
  let debutCellule = true;
  let numeroLigneCourante = 1;
  let numeroLigneDebutEnregistrement = 1;

  for (let i = 0; i < texte.length; i += 1) {
    const caractere = texte[i];
    const suivant = texte[i + 1];

    if (dansGuillemets) {
      if (caractere === '"' && suivant === '"') {
        // Deux guillemets consécutifs dans une cellule protégée représentent un vrai guillemet
        celluleCourante += '"';
        i += 1;
      } else if (caractere === '"') {
        dansGuillemets = false;
      } else {
        if (caractere === '\n') {
          numeroLigneCourante += 1;
        }
        celluleCourante += caractere;
      }
    } else if (caractere === '"' && debutCellule) {
      // Un guillemet au tout début d'une cellule ouvre une valeur protégée
      dansGuillemets = true;
      debutCellule = false;
    } else if (caractere === separateur) {
      cellules.push(celluleCourante);
      celluleCourante = '';
      debutCellule = true;
    } else if (caractere === '\r' || caractere === '\n') {
      // Fin de ligne (\r\n sous Windows ou \n sous macOS/Linux)
      if (caractere === '\r' && suivant === '\n') {
        i += 1;
      }

      cellules.push(celluleCourante);
      enregistrements.push({
        numeroLigne: numeroLigneDebutEnregistrement,
        cellules,
      });

      cellules = [];
      celluleCourante = '';
      debutCellule = true;
      numeroLigneCourante += 1;
      numeroLigneDebutEnregistrement = numeroLigneCourante;
    } else {
      celluleCourante += caractere;
      debutCellule = false;
    }
  }

  // Si un guillemet n'a jamais été refermé, le fichier est mal formé
  if (dansGuillemets) {
    return { erreur: 'Le fichier CSV est mal formé (guillemet non fermé).' };
  }

  // Ajoute la dernière ligne si le fichier ne se termine pas par un retour à la ligne
  if (cellules.length > 0 || celluleCourante !== '') {
    cellules.push(celluleCourante);
    enregistrements.push({
      numeroLigne: numeroLigneDebutEnregistrement,
      cellules,
    });
  }

  // On ignore les lignes totalement vides tout en gardant le vrai numéro de ligne des autres
  const enregistrementsNonVides = enregistrements.filter((ligne) =>
    ligne.cellules.some((cellule) => cellule.trim() !== '')
  );

  return { erreur: null, enregistrements: enregistrementsNonVides };
}

// Nettoie un téléphone importé : accepte ="+221771234567" comme +221771234567
function nettoyerTelephoneImport(valeur) {
  const texte = String(valeur ?? '').trim();
  const formuleExcel = texte.match(/^=\s*"(.*)"$/);

  if (formuleExcel) {
    return formuleExcel[1].trim();
  }

  return texte;
}

// Vérifie si Excel a converti le téléphone en notation scientifique (ex. 2,21772E+11)
function estNotationScientifique(valeur) {
  return /e\+/i.test(String(valeur ?? ''));
}

// Convertit une date jj/mm/aaaa (ou ISO) en date ISO valide ; sinon renvoie la date du jour
function analyserDateAjout(valeur) {
  const texte = String(valeur ?? '').trim();

  if (texte !== '') {
    // 1. Format français jj/mm/aaaa (celui produit par l'export)
    const matchFR = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (matchFR) {
      const jour = Number(matchFR[1]);
      const mois = Number(matchFR[2]);
      const annee = Number(matchFR[3]);

      // On fixe l'heure à midi pour éviter tout décalage de jour lié au fuseau horaire
      const date = new Date(annee, mois - 1, jour, 12, 0, 0);

      // Vérifie que la date existe réellement (ex. refuse le 31/02/2026)
      if (
        date.getFullYear() === annee &&
        date.getMonth() === mois - 1 &&
        date.getDate() === jour
      ) {
        return date.toISOString();
      }
    }

    // 2. Format ISO court AAAA-MM-JJ
    const matchISOCourt = texte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchISOCourt) {
      const annee = Number(matchISOCourt[1]);
      const mois = Number(matchISOCourt[2]);
      const jour = Number(matchISOCourt[3]);
      const date = new Date(annee, mois - 1, jour, 12, 0, 0);

      if (
        date.getFullYear() === annee &&
        date.getMonth() === mois - 1 &&
        date.getDate() === jour
      ) {
        return date.toISOString();
      }
    }

    // 3. Format ISO complet (ex. 2026-11-23T08:30:00.000Z)
    if (/^\d{4}-\d{2}-\d{2}T/.test(texte)) {
      const date = new Date(texte);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  // Date absente ou invalide : on utilise la date du jour
  return new Date().toISOString();
}

// Analyse le texte d'un fichier CSV et renvoie soit une erreur claire, soit la liste des lignes prêtes à être validées
export function importerCSV(texte) {
  if (typeof texte !== 'string') {
    return {
      erreur: 'Le fichier est illisible.',
      lignes: [],
    };
  }

  // Détecte les fichiers binaires (ex. un fichier Excel .xlsx renommé en .csv)
  if (texte.includes('\u0000')) {
    return {
      erreur:
        'Le fichier est illisible. Assurez-vous de choisir un fichier texte au format CSV (.csv).',
      lignes: [],
    };
  }

  // Retire le BOM UTF-8 s'il est présent au début du fichier
  const contenuPropre = texte.replace(/^\uFEFF/, '');

  if (contenuPropre.trim() === '') {
    return {
      erreur: 'Le fichier CSV est vide.',
      lignes: [],
    };
  }

  const separateur = detecterSeparateur(contenuPropre);
  if (!separateur) {
    return {
      erreur:
        "Format CSV non reconnu. Utilisez le séparateur point-virgule (;) ou virgule (,) avec les colonnes : Nom ; Prénom ; Téléphone ; Email ; Ville ; Date d'ajout.",
      lignes: [],
    };
  }

  const resultatDecoupage = decouperCSV(contenuPropre, separateur);
  if (resultatDecoupage.erreur) {
    return {
      erreur: resultatDecoupage.erreur,
      lignes: [],
    };
  }

  const { enregistrements } = resultatDecoupage;
  if (enregistrements.length === 0) {
    return {
      erreur: 'Le fichier CSV est vide.',
      lignes: [],
    };
  }

  // Vérification de la ligne d'en-tête (première ligne non vide)
  const enteteLu = enregistrements[0].cellules.map(normaliserEntete);
  const enteteValide =
    enteteLu.length === ENTETES_NORMALISES.length &&
    ENTETES_NORMALISES.every((colonne, index) => enteteLu[index] === colonne);

  if (!enteteValide) {
    return {
      erreur:
        "Les colonnes du fichier CSV ne correspondent pas. Colonnes attendues : Nom ; Prénom ; Téléphone ; Email ; Ville ; Date d'ajout.",
      lignes: [],
    };
  }

  if (enregistrements.length === 1) {
    return {
      erreur: 'Le fichier CSV ne contient aucune ligne client à importer.',
      lignes: [],
    };
  }

  // Transformation de chaque ligne de données en objet client prêt à passer dans validerClient
  const lignes = enregistrements.slice(1).map((enregistrement) => {
    const { numeroLigne, cellules } = enregistrement;

    if (cellules.length > ENTETES_CSV.length) {
      return {
        numeroLigne,
        tropDeColonnes: true,
      };
    }

    const telephone = nettoyerTelephoneImport(cellules[2]);

    return {
      numeroLigne,
      tropDeColonnes: false,
      telephoneAbimeExcel: estNotationScientifique(telephone),
      nom: cellules[0] ?? '',
      prenom: cellules[1] ?? '',
      telephone,
      email: cellules[3] ?? '',
      ville: cellules[4] ?? '',
      dateAjout: analyserDateAjout(cellules[5]),
    };
  });

  return {
    erreur: null,
    lignes,
  };
}
