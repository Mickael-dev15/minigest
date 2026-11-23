// Utilitaires pour valider et nettoyer les informations d'un client avant enregistrement
import { normaliserTelephone } from './telephone.js';

// Liste officielle des statuts possibles pour un client
export const STATUTS_CLIENT = ['Prospect', 'Client', 'Inactif'];

// Statut appliqué par défaut (nouveau client, migration, import 6 colonnes ou statut inconnu)
export const STATUT_PAR_DEFAUT = 'Client';

// Nombre maximal de caractères autorisés dans la note d'un client
export const NOTE_LONGUEUR_MAX = 500;

// Reconnaît un statut sans tenir compte des majuscules ni des accents
// Renvoie "Prospect", "Client", "Inactif", ou null si la valeur est inconnue
export function normaliserStatut(valeur) {
  const propre = String(valeur ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (propre === 'prospect') {
    return 'Prospect';
  }
  if (propre === 'client') {
    return 'Client';
  }
  if (propre === 'inactif') {
    return 'Inactif';
  }

  return null;
}

// Supprime les espaces au début, à la fin, et remplace les espaces multiples par un seul espace
function nettoyerEspaces(texte) {
  return String(texte ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Met la première lettre en majuscule et le reste en minuscules (ex. "marie" -> "Marie")
function formaterPrenom(prenom) {
  if (!prenom) {
    return '';
  }
  return prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
}

// Valide les données saisies dans le formulaire par rapport aux règles du projet
// idIgnore : identifiant du client en cours de modification (ignoré lors du contrôle d'unicité du téléphone)
// Renvoie un objet contenant :
// - erreurs : un objet avec un message par champ invalide (vide si tout est bon)
// - donneesPropres : les champs nettoyés et mis en forme
export function validerClient(donnees, clients = [], idIgnore = null) {
  const erreurs = {};

  // 1. Nettoyage des espaces superflus
  const nom = nettoyerEspaces(donnees.nom);
  const prenom = nettoyerEspaces(donnees.prenom);
  const telephone = String(donnees.telephone ?? '').trim();
  const email = String(donnees.email ?? '').trim();
  const ville = nettoyerEspaces(donnees.ville);
  const statutBrut = String(donnees.statut ?? '').trim();
  const noteBrute =
    typeof donnees.note === 'string' ? donnees.note : String(donnees.note ?? '');

  // 2. Validation du nom (obligatoire, entre 2 et 50 caractères)
  if (nom === '') {
    erreurs.nom = 'Le nom est obligatoire';
  } else if (nom.length < 2 || nom.length > 50) {
    erreurs.nom = 'Le nom doit contenir entre 2 et 50 caractères';
  }

  // 3. Validation du prénom (obligatoire, entre 2 et 50 caractères)
  if (prenom === '') {
    erreurs.prenom = 'Le prénom est obligatoire';
  } else if (prenom.length < 2 || prenom.length > 50) {
    erreurs.prenom = 'Le prénom doit contenir entre 2 et 50 caractères';
  }

  // 4. Normalisation puis validation du téléphone (format international unique + unicité)
  const { numero: telephoneNormalise, erreur: erreurTelephone } =
    normaliserTelephone(telephone);

  if (erreurTelephone) {
    erreurs.telephone = erreurTelephone;
  } else {
    // On compare les numéros normalisés et on ignore le client en cours de modification
    const numeroExisteDeja = clients.some((client) => {
      if (client.id === idIgnore) {
        return false;
      }
      const resultatExistant = normaliserTelephone(client.telephone);
      const telephoneExistant = resultatExistant.erreur
        ? String(client.telephone ?? '').trim()
        : resultatExistant.numero;
      return telephoneExistant === telephoneNormalise;
    });

    if (numeroExisteDeja) {
      erreurs.telephone = 'Ce numéro existe déjà';
    }
  }

  // 5. Validation de l'email (facultatif, mais format valide s'il est rempli)
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email !== '' && !regexEmail.test(email)) {
    erreurs.email = "Le format de l'email n'est pas valide";
  }

  // 6. Validation du statut (Prospect, Client ou Inactif ; Client par défaut si absent)
  let statutFinal = STATUT_PAR_DEFAUT;
  if (statutBrut !== '') {
    const statutReconnu = normaliserStatut(statutBrut);
    if (statutReconnu) {
      statutFinal = statutReconnu;
    } else {
      erreurs.statut = 'Le statut doit être Prospect, Client ou Inactif';
    }
  }

  // 7. Validation de la note (facultative, 500 caractères maximum)
  if (noteBrute.length > NOTE_LONGUEUR_MAX) {
    erreurs.note = `La note ne doit pas dépasser ${NOTE_LONGUEUR_MAX} caractères`;
  }

  // 8. Mise en forme finale des données propres
  const donneesPropres = {
    nom: nom.toUpperCase(),
    prenom: formaterPrenom(prenom),
    telephone: telephoneNormalise || telephone,
    email,
    ville,
    statut: statutFinal,
    note: noteBrute.trim(),
  };

  return { erreurs, donneesPropres };
}
