// Utilitaire unique de correspondance entre la table PostgreSQL public.clients (snake_case)
// et le format utilisé par l'interface React et les fonctions pures existantes (camelCase).
import { normaliserTelephone } from './telephone.js';
import { STATUT_PAR_DEFAUT } from './validation.js';

// Colonnes explicites lues depuis public.clients (évite select('*'))
export const COLONNES_CLIENT_SUPABASE =
  'id, entreprise_id, nom, prenom, telephone, email, ville, statut, note, date_ajout, cree_par';

// Normalise le téléphone au format international unique avant tout envoi vers Supabase
// afin que la contrainte unique (entreprise_id, telephone) compare toujours le même format.
function normaliserTelephonePourBase(telephone) {
  const { numero, erreur } = normaliserTelephone(telephone);
  return erreur ? String(telephone ?? '').trim() : numero;
}

// Convertit une chaîne vide (ou composée uniquement d'espaces) en null pour les colonnes facultatives
function texteFacultatifPourBase(valeur) {
  const texte = String(valeur ?? '').trim();
  return texte === '' ? null : texte;
}

// Convertit une ligne renvoyée par Supabase (date_ajout en snake_case, champs nullables)
// vers le format client attendu par les composants React et les fonctions pures (dateAjout en camelCase).
export function clientDepuisSupabase(ligne) {
  return {
    id: ligne.id,
    entrepriseId: ligne.entreprise_id ?? null,
    nom: ligne.nom ?? '',
    prenom: ligne.prenom ?? '',
    telephone: ligne.telephone ?? '',
    email: ligne.email ?? '',
    ville: ligne.ville ?? '',
    statut: ligne.statut || STATUT_PAR_DEFAUT,
    note: ligne.note ?? '',
    dateAjout: ligne.date_ajout,
    creePar: ligne.cree_par ?? null,
  };
}

// Prépare les données d'un nouveau client pour un INSERT dans public.clients.
// Règles :
// - ne jamais envoyer id ni date_ajout (générés par défaut par PostgreSQL) ;
// - toujours normaliser le téléphone avant l'envoi ;
// - renseigner entreprise_id et cree_par à partir du profil et de la session connectée.
export function clientVersInsertSupabase(donneesClient, entrepriseId, creePar) {
  return {
    entreprise_id: entrepriseId,
    nom: String(donneesClient.nom ?? '').trim(),
    prenom: String(donneesClient.prenom ?? '').trim(),
    telephone: normaliserTelephonePourBase(donneesClient.telephone),
    email: texteFacultatifPourBase(donneesClient.email),
    ville: texteFacultatifPourBase(donneesClient.ville),
    statut: donneesClient.statut || STATUT_PAR_DEFAUT,
    note: texteFacultatifPourBase(donneesClient.note),
    cree_par: creePar,
  };
}

// Prépare uniquement les champs modifiables pour un UPDATE dans public.clients.
// Ne renvoie jamais id, entreprise_id, cree_par ni date_ajout (colonnes protégées par trigger en base).
export function clientVersUpdateSupabase(donneesClient) {
  return {
    nom: String(donneesClient.nom ?? '').trim(),
    prenom: String(donneesClient.prenom ?? '').trim(),
    telephone: normaliserTelephonePourBase(donneesClient.telephone),
    email: texteFacultatifPourBase(donneesClient.email),
    ville: texteFacultatifPourBase(donneesClient.ville),
    statut: donneesClient.statut || STATUT_PAR_DEFAUT,
    note: texteFacultatifPourBase(donneesClient.note),
  };
}
