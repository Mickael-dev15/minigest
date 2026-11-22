// Utilitaires pour valider et nettoyer les informations d'un client avant enregistrement

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
// Renvoie un objet contenant :
// - erreurs : un objet avec un message par champ invalide (vide si tout est bon)
// - donneesPropres : les champs nettoyés et mis en forme
export function validerClient(donnees, clients = []) {
  const erreurs = {};

  // 1. Nettoyage des espaces superflus
  const nom = nettoyerEspaces(donnees.nom);
  const prenom = nettoyerEspaces(donnees.prenom);
  const telephone = String(donnees.telephone ?? '').trim();
  const email = String(donnees.email ?? '').trim();
  const ville = nettoyerEspaces(donnees.ville);

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

  // 4. Validation du téléphone (obligatoire, "+" facultatif au début, 8 à 15 chiffres uniquement, unique)
  const regexTelephone = /^\+?\d{8,15}$/;
  if (telephone === '') {
    erreurs.telephone = 'Le téléphone est obligatoire';
  } else if (!regexTelephone.test(telephone)) {
    erreurs.telephone =
      'Chiffres uniquement (8 à 15 chiffres, "+" facultatif au début)';
  } else {
    const numeroExisteDeja = clients.some(
      (client) => client.telephone === telephone
    );
    if (numeroExisteDeja) {
      erreurs.telephone = 'Ce numéro existe déjà';
    }
  }

  // 5. Validation de l'email (facultatif, mais format valide s'il est rempli)
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email !== '' && !regexEmail.test(email)) {
    erreurs.email = "Le format de l'email n'est pas valide";
  }

  // 6. Mise en forme finale des données propres
  const donneesPropres = {
    nom: nom.toUpperCase(),
    prenom: formaterPrenom(prenom),
    telephone,
    email,
    ville,
  };

  return { erreurs, donneesPropres };
}
