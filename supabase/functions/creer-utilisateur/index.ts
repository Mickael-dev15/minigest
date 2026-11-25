// Edge Function Supabase : creer-utilisateur (Lot 2b)
// Rôle : créer un compte utilisateur (gérant ou employé) rattaché à une entreprise active,
// exclusivement à la demande d'un Super admin actif authentifié.
//
// Sécurité :
// - La clé service_role est lue UNIQUEMENT via Deno.env.get (jamais écrite dans le code).
// - Le JWT de l'appelant est vérifié explicitement dans cette fonction via auth.getUser(token).
// - Le mot de passe temporaire n'est JAMAIS journalisé, JAMAIS affiché dans console.log
//   et JAMAIS renvoyé dans la réponse HTTP.

import { createClient } from 'npm:@supabase/supabase-js@2';

// En-têtes CORS nécessaires pour les appels depuis l'application React
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES_AUTORISES = new Set(['gerant', 'employe']);
const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const REGEX_EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Construit une réponse JSON homogène avec les en-têtes CORS
function reponseJson(
  corps: Record<string, unknown>,
  statut: number
): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

// Traduit les erreurs courantes de Supabase Auth en messages clairs en français
function traduireErreurCreationAuth(erreur: {
  code?: string;
  message?: string;
  status?: number;
}): { message: string; statut: number } {
  const code = (erreur.code ?? '').toLowerCase();
  const messageBrut = (erreur.message ?? '').toLowerCase();

  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    messageBrut.includes('already been registered') ||
    messageBrut.includes('already exists') ||
    messageBrut.includes('duplicate')
  ) {
    return {
      message: 'Email déjà utilisé par un autre compte.',
      statut: 409,
    };
  }

  if (
    code === 'email_address_invalid' ||
    code === 'invalid_email' ||
    messageBrut.includes('unable to validate email') ||
    messageBrut.includes('invalid email')
  ) {
    return {
      message: "L'adresse email fournie n'est pas valide.",
      statut: 400,
    };
  }

  if (code === 'weak_password' || messageBrut.includes('password')) {
    return {
      message:
        'Le mot de passe temporaire ne respecte pas les règles de sécurité.',
      statut: 400,
    };
  }

  return {
    message: "Impossible de créer le compte d'authentification.",
    statut: 500,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Gestion de la requête CORS preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  // Seule la méthode POST est acceptée
  if (req.method !== 'POST') {
    return reponseJson({ error: 'Méthode HTTP non autorisée.' }, 405);
  }

  // 2. Lecture stricte des variables d'environnement serveur (jamais en dur)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return reponseJson({ error: 'Configuration serveur manquante' }, 500);
  }

  // Client administrateur utilisé uniquement côté serveur dans cette Edge Function
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 3. Vérification explicite du JWT de l'appelant via getUser(token)
  const enTeteAuthorization = req.headers.get('Authorization') ?? '';
  const correspondanceBearer = enTeteAuthorization.match(/^Bearer\s+(.+)$/i);
  const jetonJwt = correspondanceBearer?.[1]?.trim() ?? '';

  if (!jetonJwt) {
    return reponseJson(
      { error: 'Accès refusé : authentification requise.' },
      403
    );
  }

  const { data: donneesAppelant, error: erreurJwt } =
    await supabaseAdmin.auth.getUser(jetonJwt);

  if (erreurJwt || !donneesAppelant?.user?.id) {
    return reponseJson(
      { error: 'Accès refusé : session invalide ou expirée.' },
      403
    );
  }

  const appelantId = donneesAppelant.user.id;

  // Vérification que l'appelant possède un profil super_admin ET actif
  const { data: profilAppelant, error: erreurProfilAppelant } =
    await supabaseAdmin
      .from('profils')
      .select('id, role, actif')
      .eq('id', appelantId)
      .maybeSingle();

  if (
    erreurProfilAppelant ||
    !profilAppelant ||
    profilAppelant.role !== 'super_admin' ||
    profilAppelant.actif !== true
  ) {
    return reponseJson(
      { error: 'Accès refusé : action réservée au Super admin actif.' },
      403
    );
  }

  // 4. Lecture et validation du corps JSON
  let corps: Record<string, unknown>;
  try {
    const brut = await req.json();
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
      return reponseJson({ error: 'Corps de requête JSON invalide.' }, 400);
    }
    corps = brut as Record<string, unknown>;
  } catch {
    return reponseJson({ error: 'Corps de requête JSON invalide.' }, 400);
  }

  // Normalisation de l'email (suppression des espaces + minuscules)
  const email =
    typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
  const nomComplet =
    typeof corps.nom_complet === 'string' ? corps.nom_complet.trim() : '';
  const role = typeof corps.role === 'string' ? corps.role.trim() : '';
  const entrepriseId =
    typeof corps.entreprise_id === 'string' ? corps.entreprise_id.trim() : '';
  const motDePasseTemporaire =
    typeof corps.mot_de_passe_temporaire === 'string'
      ? corps.mot_de_passe_temporaire
      : '';

  if (!email || !REGEX_EMAIL.test(email)) {
    return reponseJson(
      { error: 'Veuillez fournir une adresse email valide.' },
      400
    );
  }

  if (!nomComplet) {
    return reponseJson({ error: 'Le nom complet est obligatoire.' }, 400);
  }

  if (role === 'super_admin') {
    return reponseJson(
      {
        error:
          'Création interdite : le rôle super_admin ne peut pas être attribué ici.',
      },
      400
    );
  }

  if (!ROLES_AUTORISES.has(role)) {
    return reponseJson(
      { error: 'Le rôle doit être « gerant » ou « employe ».' },
      400
    );
  }

  if (!entrepriseId || !REGEX_UUID.test(entrepriseId)) {
    return reponseJson(
      { error: "L'identifiant d'entreprise fourni est invalide." },
      400
    );
  }

  if (
    motDePasseTemporaire.trim().length === 0 ||
    motDePasseTemporaire.length < LONGUEUR_MIN_MOT_DE_PASSE
  ) {
    return reponseJson(
      {
        error: `Le mot de passe temporaire doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`,
      },
      400
    );
  }

  // 5. Vérification que l'entreprise existe et est active
  const { data: entreprise, error: erreurEntreprise } = await supabaseAdmin
    .from('entreprises')
    .select('id, nom, statut')
    .eq('id', entrepriseId)
    .maybeSingle();

  if (erreurEntreprise) {
    return reponseJson(
      { error: "Impossible de vérifier l'entreprise sélectionnée." },
      500
    );
  }

  if (!entreprise) {
    return reponseJson(
      { error: "L'entreprise sélectionnée est introuvable." },
      404
    );
  }

  if (entreprise.statut !== 'active') {
    return reponseJson(
      {
        error:
          'Impossible de créer un utilisateur pour une entreprise suspendue.',
      },
      400
    );
  }

  // 6. Création du compte Auth (email confirmé immédiatement)
  const { data: creationAuth, error: erreurCreationAuth } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: motDePasseTemporaire,
      email_confirm: true,
      user_metadata: {
        nom_complet: nomComplet,
      },
    });

  if (erreurCreationAuth || !creationAuth?.user?.id) {
    const { message, statut } = traduireErreurCreationAuth(
      erreurCreationAuth ?? {}
    );
    return reponseJson({ error: message }, statut);
  }

  const nouvelUtilisateurId = creationAuth.user.id;

  // 7. Insertion du profil applicatif dans public.profils
  const { data: profilCree, error: erreurInsertionProfil } = await supabaseAdmin
    .from('profils')
    .insert({
      id: nouvelUtilisateurId,
      entreprise_id: entreprise.id,
      nom_complet: nomComplet,
      role,
      actif: true,
    })
    .select('id, entreprise_id, nom_complet, role, actif')
    .single();

  if (erreurInsertionProfil || !profilCree) {
    // Rollback : on supprime immédiatement l'utilisateur Auth pour éviter tout compte orphelin
    await supabaseAdmin.auth.admin.deleteUser(nouvelUtilisateurId);

    return reponseJson(
      {
        error:
          "Impossible d'enregistrer le profil utilisateur. Le compte n'a pas été créé.",
      },
      500
    );
  }

  // 8. Écriture de la trace d'audit dans public.journal (sans le mot de passe)
  let journalEnregistre = true;
  let avertissement: string | null = null;

  const { error: erreurJournal } = await supabaseAdmin.from('journal').insert({
    acteur_id: appelantId,
    action: 'creation_utilisateur',
    cible: nomComplet,
    details: {
      utilisateur_id: profilCree.id,
      email,
      role: profilCree.role,
      entreprise_id: entreprise.id,
      entreprise_nom: entreprise.nom,
    },
  });

  if (erreurJournal) {
    // Le compte et le profil sont bien créés : on ne les supprime pas
    journalEnregistre = false;
    avertissement =
      'Utilisateur créé, mais non enregistré dans le journal.';
  }

  // 9. Réponse de succès (sans jamais renvoyer le mot de passe temporaire)
  return reponseJson(
    {
      utilisateur: {
        id: profilCree.id,
        entreprise_id: profilCree.entreprise_id,
        nom_complet: profilCree.nom_complet,
        role: profilCree.role,
        actif: profilCree.actif,
        email,
      },
      journal_enregistre: journalEnregistre,
      avertissement,
    },
    201
  );
});
