// Fonctions pures dédiées à la gestion de l'équipe par le gérant (Lot 4).
// Aucune fonction de ce fichier ne modifie les tableaux ou objets reçus en paramètre.
import { LONGUEUR_MIN_MOT_DE_PASSE } from './admin.js';

const REGEX_EMAIL_EMPLOYE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

const ORDRE_ROLE_EQUIPE = {
  gerant: 0,
  employe: 1,
};

// Valide les champs du formulaire d'ajout d'un employé (sans rôle ni entreprise_id :
// ces deux valeurs sont toujours forcées côté serveur dans gerer-equipe).
export function validerNouvelEmploye(donnees) {
  const nomComplet = String(donnees?.nom_complet ?? '').trim();
  const email = String(donnees?.email ?? '').trim().toLowerCase();
  const motDePasseTemporaire = String(donnees?.mot_de_passe_temporaire ?? '');

  const erreurs = {};

  if (nomComplet === '') {
    erreurs.nom_complet = 'Le nom complet est obligatoire.';
  }

  if (email === '') {
    erreurs.email = "L'adresse email est obligatoire.";
  } else if (!REGEX_EMAIL_EMPLOYE.test(email)) {
    erreurs.email = "L'adresse email n'est pas valide.";
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
      nom_complet: nomComplet,
      email,
      mot_de_passe_temporaire: motDePasseTemporaire,
    },
  };
}

// Trie les membres d'une équipe (gérants d'abord, puis employés, par nom complet).
// Retourne un nouveau tableau sans modifier le tableau reçu.
export function trierMembresEquipe(membres) {
  const liste = Array.isArray(membres) ? membres : [];

  return [...liste].sort((a, b) => {
    const rangA = ORDRE_ROLE_EQUIPE[a?.role] ?? 99;
    const rangB = ORDRE_ROLE_EQUIPE[b?.role] ?? 99;
    if (rangA !== rangB) {
      return rangA - rangB;
    }

    return String(a?.nom_complet ?? '').localeCompare(
      String(b?.nom_complet ?? ''),
      'fr',
      { sensitivity: 'base' }
    );
  });
}

// Lit le message d'erreur JSON renvoyé par une Edge Function (FunctionsHttpError).
// Avec supabase.functions.invoke, les réponses 4xx/5xx placent la Response HTTP dans error.context.
export async function extraireMessageErreurEdgeFunction(
  erreur,
  messageParDefaut
) {
  if (!erreur) {
    return messageParDefaut;
  }

  const contexte = erreur.context;
  if (contexte && typeof contexte.json === 'function') {
    try {
      const reponseALire =
        typeof contexte.clone === 'function' ? contexte.clone() : contexte;
      const corps = await reponseALire.json();
      if (typeof corps?.error === 'string' && corps.error.trim() !== '') {
        return corps.error.trim();
      }
      if (typeof corps?.message === 'string' && corps.message.trim() !== '') {
        return corps.message.trim();
      }
    } catch {
      // Si le corps n'est pas du JSON exploitable, on renvoie le message de repli
    }
  }

  if (erreur.name === 'FunctionsFetchError') {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion ou le déploiement de la fonction.';
  }

  return messageParDefaut;
}
