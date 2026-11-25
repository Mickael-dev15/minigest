// Contexte d'authentification global : session Supabase + profil métier (rôle et entreprise).
// Gère aussi la détection de la récupération de mot de passe (PASSWORD_RECOVERY),
// le drapeau doit_changer_mdp et l'état de double authentification (MFA) du Super admin.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { AuthContext } from './useAuth.js';

// Extrait les facteurs TOTP vérifiés depuis la réponse de supabase.auth.mfa.listFactors()
function extraireFacteursTotpVerifies(donneesFacteurs) {
  if (Array.isArray(donneesFacteurs?.totp) && donneesFacteurs.totp.length > 0) {
    return donneesFacteurs.totp.filter(
      (facteur) => facteur.status === 'verified'
    );
  }

  if (Array.isArray(donneesFacteurs?.all)) {
    return donneesFacteurs.all.filter(
      (facteur) =>
        facteur.factor_type === 'totp' && facteur.status === 'verified'
    );
  }

  return [];
}

// Interroge Supabase Auth pour connaître le niveau AAL courant et les facteurs TOTP vérifiés
async function lireEtatMfaServeur() {
  const [resultatAal, resultatFacteurs] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (resultatAal.error || resultatFacteurs.error) {
    return {
      niveau: 'aal1',
      verifie: false,
      totpId: null,
      erreur:
        'Impossible de vérifier votre double authentification pour le moment. Veuillez réessayer.',
    };
  }

  const facteursVerifies = extraireFacteursTotpVerifies(resultatFacteurs.data);
  const premierFacteur = facteursVerifies[0] ?? null;

  return {
    niveau: resultatAal.data?.currentLevel ?? 'aal1',
    verifie: Boolean(premierFacteur),
    totpId: premierFacteur?.id ?? null,
    erreur: null,
  };
}

// Inspecte l'URL au tout début du chargement (avant que Supabase ne nettoie le hash ou la query)
// pour détecter un lien de réinitialisation de mot de passe (flux implicite ou PKCE).
function detecterRecuperationDansUrl() {
  if (typeof window === 'undefined') {
    return { lienDetecte: false, erreurUrl: false };
  }

  const paramsQuery = new URLSearchParams(window.location.search);
  const hashBrut = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const paramsHash = new URLSearchParams(hashBrut);

  // Si Supabase renvoie une erreur dans l'URL (ex. lien expiré), le lien n'est pas valide
  const erreurUrl = Boolean(
    paramsQuery.get('error') ||
      paramsQuery.get('error_code') ||
      paramsHash.get('error') ||
      paramsHash.get('error_code')
  );

  if (erreurUrl) {
    return { lienDetecte: false, erreurUrl: true };
  }

  const estTypeRecovery =
    paramsHash.get('type') === 'recovery' ||
    paramsQuery.get('type') === 'recovery';
  const aCodePkce = Boolean(paramsQuery.get('code'));
  const estSurReinitialisation =
    window.location.pathname === '/reinitialisation';

  return {
    lienDetecte: estTypeRecovery || (estSurReinitialisation && aCodePkce),
    erreurUrl: false,
  };
}

// Capturé une seule fois au chargement du module, avant tout nettoyage d'URL par Supabase
const ETAT_URL_INITIAL = detecterRecuperationDansUrl();

export function AuthProvider({ children }) {
  // Session Supabase courante (null si aucun utilisateur n'est connecté)
  const [session, setSession] = useState(null);

  // Indique si la vérification initiale de la session (getSession) est terminée
  const [sessionInitialisee, setSessionInitialisee] = useState(false);

  // Indique si la session courante provient d'un lien de réinitialisation de mot de passe
  const [sessionRecuperation, setSessionRecuperation] = useState(
    ETAT_URL_INITIAL.lienDetecte
  );

  // Profil applicatif chargé depuis public.profils (+ infos de public.entreprises)
  const [profil, setProfil] = useState(null);

  // Identifiant de l'utilisateur dont le profil a fini d'être chargé
  // Permet d'éviter tout flash de redirection entre la mise à jour de session et le chargement du profil
  const [utilisateurProfilCharge, setUtilisateurProfilCharge] = useState(null);

  // Message d'erreur éventuel si la lecture du profil échoue (ex. problème réseau)
  const [erreurProfil, setErreurProfil] = useState(null);

  // État de la double authentification (uniquement pour un super_admin actif)
  const [niveauAal, setNiveauAal] = useState(null);
  const [aFacteurTotpVerifie, setAFacteurTotpVerifie] = useState(false);
  const [facteurTotpId, setFacteurTotpId] = useState(null);
  const [utilisateurMfaCharge, setUtilisateurMfaCharge] = useState(null);
  const [erreurMfa, setErreurMfa] = useState(null);

  const utilisateurId = session?.user?.id ?? null;
  const estSuperAdminActif = Boolean(
    profil && profil.actif && profil.role === 'super_admin'
  );

  // 1. Récupération de la session au démarrage et écoute des changements d'état
  useEffect(() => {
    let estMonte = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!estMonte) {
          return;
        }
        if (error) {
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
        setSessionInitialisee(true);
      })
      .catch(() => {
        if (!estMonte) {
          return;
        }
        setSession(null);
        setSessionInitialisee(true);
      });

    // IMPORTANT : ne faire aucun appel Supabase (await) dans ce callback,
    // sinon la gestion interne de la session peut se bloquer.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evenement, nouvelleSession) => {
      if (!estMonte) {
        return;
      }

      if (evenement === 'PASSWORD_RECOVERY') {
        setSessionRecuperation(true);
      } else if (evenement === 'SIGNED_OUT') {
        setSessionRecuperation(false);
        setNiveauAal(null);
        setAFacteurTotpVerifie(false);
        setFacteurTotpId(null);
        setErreurMfa(null);
        setUtilisateurMfaCharge(null);
      }

      setSession(nouvelleSession ?? null);
      setSessionInitialisee(true);
    });

    // Désabonnement propre de l'écouteur au démontage du composant
    return () => {
      estMonte = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Chargement du profil dans un useEffect séparé dès que la session change
  useEffect(() => {
    let estActif = true;

    async function chargerProfil() {
      // Si personne n'est connecté, on réinitialise simplement le profil
      if (!utilisateurId) {
        setProfil(null);
        setErreurProfil(null);
        setUtilisateurProfilCharge(null);
        return;
      }

      setErreurProfil(null);

      try {
        // Pour un super_admin, entreprise_id vaut null : la jointure renvoie entreprise = null sans erreur
        const { data, error } = await supabase
          .from('profils')
          .select(
            'id, entreprise_id, nom_complet, role, actif, entreprise:entreprises ( id, nom, statut, motif_suspension )'
          )
          .eq('id', utilisateurId)
          .maybeSingle();

        if (!estActif) {
          return;
        }

        if (error) {
          setProfil(null);
          setErreurProfil(
            'Impossible de charger votre profil pour le moment. Veuillez réessayer.'
          );
        } else if (!data) {
          setProfil(null);
        } else {
          // Normalise la relation entreprise (objet ou null pour le super_admin)
          const entrepriseNormalisee = Array.isArray(data.entreprise)
            ? (data.entreprise[0] ?? null)
            : (data.entreprise ?? null);

          setProfil({
            ...data,
            entreprise: entrepriseNormalisee,
          });
        }
      } catch {
        if (!estActif) {
          return;
        }
        setProfil(null);
        setErreurProfil(
          'Erreur réseau lors du chargement de votre profil. Vérifiez votre connexion.'
        );
      } finally {
        if (estActif) {
          setUtilisateurProfilCharge(utilisateurId);
        }
      }
    }

    chargerProfil();

    return () => {
      estActif = false;
    };
  }, [utilisateurId]);

  // 3. Chargement de l'état MFA uniquement pour un super_admin actif
  // Les gérants et employés ne déclenchent aucun appel MFA.
  useEffect(() => {
    let estActif = true;

    async function chargerEtatMfa() {
      if (!utilisateurId || !estSuperAdminActif) {
        setNiveauAal(null);
        setAFacteurTotpVerifie(false);
        setFacteurTotpId(null);
        setErreurMfa(null);
        setUtilisateurMfaCharge(null);
        return;
      }

      setErreurMfa(null);

      try {
        const etat = await lireEtatMfaServeur();
        if (!estActif) {
          return;
        }
        setNiveauAal(etat.niveau);
        setAFacteurTotpVerifie(etat.verifie);
        setFacteurTotpId(etat.totpId);
        setErreurMfa(etat.erreur);
      } catch {
        if (!estActif) {
          return;
        }
        setNiveauAal('aal1');
        setAFacteurTotpVerifie(false);
        setFacteurTotpId(null);
        setErreurMfa(
          'Erreur réseau lors de la vérification de votre double authentification.'
        );
      } finally {
        if (estActif) {
          setUtilisateurMfaCharge(utilisateurId);
        }
      }
    }

    chargerEtatMfa();

    return () => {
      estActif = false;
    };
  }, [utilisateurId, estSuperAdminActif]);

  // Rafraîchit la session Supabase et l'état MFA dans AuthContext après une vérification TOTP
  // afin que niveauAal passe immédiatement à 'aal2' avant la redirection vers /admin (pas de boucle).
  const rafraichirMfa = useCallback(async () => {
    let sessionFraiche = null;

    const { data: dataRefresh, error: erreurRefresh } =
      await supabase.auth.refreshSession();

    if (!erreurRefresh && dataRefresh?.session) {
      sessionFraiche = dataRefresh.session;
    } else {
      const { data: dataSession } = await supabase.auth.getSession();
      sessionFraiche = dataSession?.session ?? null;
    }

    if (sessionFraiche) {
      setSession(sessionFraiche);
    }

    const etat = await lireEtatMfaServeur();
    const idCourant = sessionFraiche?.user?.id ?? utilisateurId;

    setNiveauAal(etat.niveau);
    setAFacteurTotpVerifie(etat.verifie);
    setFacteurTotpId(etat.totpId);
    setErreurMfa(etat.erreur);
    if (idCourant) {
      setUtilisateurMfaCharge(idCourant);
    }

    return etat;
  }, [utilisateurId]);

  // Met à jour immédiatement l'objet utilisateur dans la session locale (ex. après updateUser)
  // afin d'éviter toute redirection en boucle avant l'arrivée de l'événement USER_UPDATED.
  function mettreAJourUtilisateur(utilisateurMisAJour) {
    if (!utilisateurMisAJour) {
      return;
    }
    setSession((sessionActuelle) => {
      if (!sessionActuelle) {
        return sessionActuelle;
      }
      return {
        ...sessionActuelle,
        user: utilisateurMisAJour,
      };
    });
  }

  // Déconnecte l'utilisateur courant et vide immédiatement l'état local
  async function deconnexion() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setSession(null);
    setProfil(null);
    setErreurProfil(null);
    setUtilisateurProfilCharge(null);
    setSessionRecuperation(false);
    setNiveauAal(null);
    setAFacteurTotpVerifie(false);
    setFacteurTotpId(null);
    setErreurMfa(null);
    setUtilisateurMfaCharge(null);
  }

  // Drapeau indiquant si l'utilisateur doit obligatoirement changer son mot de passe temporaire
  const doitChangerMdp =
    session?.user?.user_metadata?.doit_changer_mdp === true;

  // On reste en chargement tant que la session n'est pas initialisée,
  // tant que le profil d'un utilisateur connecté n'a pas encore été chargé,
  // ou tant que l'état MFA d'un super_admin actif n'a pas encore été vérifié.
  const chargement =
    !sessionInitialisee ||
    (utilisateurId !== null && utilisateurProfilCharge !== utilisateurId) ||
    (utilisateurId !== null &&
      estSuperAdminActif &&
      utilisateurMfaCharge !== utilisateurId);

  const valeur = {
    session,
    sessionInitialisee,
    profil,
    chargement,
    erreurProfil,
    doitChangerMdp,
    sessionRecuperation,
    niveauAal,
    aFacteurTotpVerifie,
    facteurTotpId,
    erreurMfa,
    rafraichirMfa,
    mettreAJourUtilisateur,
    deconnexion,
  };

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}
