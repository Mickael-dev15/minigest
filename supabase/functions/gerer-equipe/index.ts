// Edge Function Supabase : gerer-equipe (Lot 4)
// Rôle : permettre à un gérant ACTIF d'une entreprise ACTIVE de :
//   - créer un employé rattaché automatiquement à son entreprise (action "creer") ;
//   - désactiver ou réactiver un employé de sa propre entreprise ("desactiver" / "reactiver").
//
// Sécurité :
// - La clé service_role est lue UNIQUEMENT via Deno.env.get (jamais écrite dans le code).
// - Le JWT de l'appelant est vérifié explicitement via auth.getUser(token).
// - Pour "creer", le rôle est FORCÉ à 'employe' et l'entreprise_id FORCÉE à celle du gérant
//   (toute valeur envoyée par le navigateur est ignorée).
// - Pour "desactiver" / "reactiver", la cible est vérifiée avant ET dans la requête UPDATE
//   (.eq('id', ...).eq('entreprise_id', ...).eq('role', 'employe')) avec contrôle d'exactement
//   1 ligne modifiée (défense en profondeur).
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

const ACTIONS_AUTORISEES = new Set(['creer', 'desactiver', 'reactiver']);
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

  // 4. Vérification que l'appelant est un gérant ACTIF d'une entreprise ACTIVE
  const { data: profilAppelant, error: erreurProfilAppelant } =
    await supabaseAdmin
      .from('profils')
      .select('id, entreprise_id, nom_complet, role, actif')
      .eq('id', appelantId)
      .maybeSingle();

  if (
    erreurProfilAppelant ||
    !profilAppelant ||
    profilAppelant.role !== 'gerant' ||
    profilAppelant.actif !== true ||
    !profilAppelant.entreprise_id
  ) {
    return reponseJson(
      {
        error:
          "Accès refusé : action réservée au gérant actif d'une entreprise active.",
      },
      403
    );
  }

  const { data: entrepriseAppelant, error: erreurEntrepriseAppelant } =
    await supabaseAdmin
      .from('entreprises')
      .select('id, nom, statut')
      .eq('id', profilAppelant.entreprise_id)
      .maybeSingle();

  if (
    erreurEntrepriseAppelant ||
    !entrepriseAppelant ||
    entrepriseAppelant.statut !== 'active'
  ) {
    return reponseJson(
      {
        error:
          "Accès refusé : votre entreprise n'est pas active.",
      },
      403
    );
  }

  // 5. Lecture et validation du corps JSON et du nom d'action
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

  const action = typeof corps.action === 'string' ? corps.action.trim() : '';

  if (!ACTIONS_AUTORISEES.has(action)) {
    return reponseJson({ error: 'Action non reconnue' }, 400);
  }

  // ==========================================================================
  // ACTION 1 : "creer" — Ajout d'un employé dans l'entreprise du gérant
  // ==========================================================================
  if (action === 'creer') {
    const email =
      typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
    const nomComplet =
      typeof corps.nom_complet === 'string' ? corps.nom_complet.trim() : '';
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

    // Valeurs FORCÉES côté serveur : tout rôle ou entreprise_id reçu du navigateur est ignoré
    const roleForce = 'employe';
    const entrepriseIdForcee = entrepriseAppelant.id;

    // Création du compte Auth (email confirmé immédiatement)
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

    // Insertion du profil dans public.profils avec rôle et entreprise forcés
    const { data: profilCree, error: erreurInsertionProfil } =
      await supabaseAdmin
        .from('profils')
        .insert({
          id: nouvelUtilisateurId,
          entreprise_id: entrepriseIdForcee,
          nom_complet: nomComplet,
          role: roleForce,
          actif: true,
        })
        .select('id, entreprise_id, nom_complet, role, actif')
        .single();

    if (erreurInsertionProfil || !profilCree) {
      // Rollback immédiat : suppression du compte Auth pour éviter tout compte orphelin
      await supabaseAdmin.auth.admin.deleteUser(nouvelUtilisateurId);

      return reponseJson(
        {
          error:
            "Impossible d'enregistrer le profil employé. Le compte n'a pas été créé.",
        },
        500
      );
    }

    // Écriture dans public.journal (sans jamais inclure le mot de passe)
    let journalEnregistre = true;
    let avertissement: string | null = null;

    const { error: erreurJournal } = await supabaseAdmin.from('journal').insert({
      acteur_id: appelantId,
      action: 'creation_employe',
      cible: nomComplet,
      details: {
        utilisateur_id: profilCree.id,
        email,
        role: profilCree.role,
        entreprise_id: entrepriseAppelant.id,
        entreprise_nom: entrepriseAppelant.nom,
      },
    });

    if (erreurJournal) {
      // Le compte et le profil sont bien créés : on ne les supprime pas
      journalEnregistre = false;
      avertissement = 'Employé créé, mais non enregistré dans le journal.';
    }

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
  }

  // ==========================================================================
  // ACTIONS 2 & 3 : "desactiver" / "reactiver" — Un employé de la même entreprise
  // ==========================================================================
  const profilId =
    typeof corps.profil_id === 'string' ? corps.profil_id.trim() : '';

  if (!profilId || !REGEX_UUID.test(profilId)) {
    return reponseJson(
      { error: "L'identifiant du profil fourni est invalide." },
      400
    );
  }

  // Interdiction explicite d'agir sur son propre compte
  if (profilId === appelantId) {
    return reponseJson(
      { error: 'Action non autorisée : vous ne pouvez pas modifier votre propre compte.' },
      403
    );
  }

  // Vérification préalable de la cible (existence, même entreprise, rôle employe)
  const { data: profilCible, error: erreurLectureCible } = await supabaseAdmin
    .from('profils')
    .select('id, entreprise_id, nom_complet, role, actif')
    .eq('id', profilId)
    .maybeSingle();

  if (erreurLectureCible) {
    return reponseJson(
      { error: 'Impossible de vérifier le profil sélectionné.' },
      500
    );
  }

  if (!profilCible || profilCible.entreprise_id !== entrepriseAppelant.id) {
    return reponseJson({ error: 'Action non autorisée' }, 403);
  }

  if (profilCible.role !== 'employe') {
    return reponseJson(
      {
        error:
          'Action non autorisée : vous ne pouvez gérer que les comptes employés.',
      },
      403
    );
  }

  const nouvelEtatActif = action === 'reactiver';

  // Défense en profondeur : la requête UPDATE impose elle-même l'id, l'entreprise du gérant
  // et le rôle 'employe', et on vérifie qu'exactement 1 ligne a été modifiée.
  const { data: profilsMisAJour, error: erreurMiseAJour } = await supabaseAdmin
    .from('profils')
    .update({ actif: nouvelEtatActif })
    .eq('id', profilId)
    .eq('entreprise_id', entrepriseAppelant.id)
    .eq('role', 'employe')
    .select('id, entreprise_id, nom_complet, role, actif');

  if (erreurMiseAJour) {
    return reponseJson(
      {
        error: nouvelEtatActif
          ? "Impossible de réactiver l'employé."
          : "Impossible de désactiver l'employé.",
      },
      500
    );
  }

  if (!Array.isArray(profilsMisAJour) || profilsMisAJour.length !== 1) {
    return reponseJson({ error: 'Action non autorisée' }, 403);
  }

  const profilMisAJour = profilsMisAJour[0];

  // Écriture dans public.journal
  let journalEnregistre = true;
  let avertissement: string | null = null;

  const { error: erreurJournal } = await supabaseAdmin.from('journal').insert({
    acteur_id: appelantId,
    action: nouvelEtatActif
      ? 'reactivation_employe'
      : 'desactivation_employe',
    cible: profilMisAJour.nom_complet,
    details: {
      utilisateur_id: profilMisAJour.id,
      role: profilMisAJour.role,
      entreprise_id: entrepriseAppelant.id,
      entreprise_nom: entrepriseAppelant.nom,
      actif: profilMisAJour.actif,
    },
  });

  if (erreurJournal) {
    journalEnregistre = false;
    avertissement =
      'Action effectuée, mais non enregistrée dans le journal.';
  }

  return reponseJson(
    {
      utilisateur: {
        id: profilMisAJour.id,
        entreprise_id: profilMisAJour.entreprise_id,
        nom_complet: profilMisAJour.nom_complet,
        role: profilMisAJour.role,
        actif: profilMisAJour.actif,
      },
      journal_enregistre: journalEnregistre,
      avertissement,
    },
    200
  );
});
