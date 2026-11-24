// Contexte d'authentification global : session Supabase + profil métier (rôle et entreprise).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { AuthContext } from './useAuth.js';

export function AuthProvider({ children }) {
  // Session Supabase courante (null si aucun utilisateur n'est connecté)
  const [session, setSession] = useState(null);

  // Indique si la vérification initiale de la session (getSession) est terminée
  const [sessionInitialisee, setSessionInitialisee] = useState(false);

  // Profil applicatif chargé depuis public.profils (+ infos de public.entreprises)
  const [profil, setProfil] = useState(null);

  // Identifiant de l'utilisateur dont le profil a fini d'être chargé
  // Permet d'éviter tout flash de redirection entre la mise à jour de session et le chargement du profil
  const [utilisateurProfilCharge, setUtilisateurProfilCharge] = useState(null);

  // Message d'erreur éventuel si la lecture du profil échoue (ex. problème réseau)
  const [erreurProfil, setErreurProfil] = useState(null);

  const utilisateurId = session?.user?.id ?? null;

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
    } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      if (!estMonte) {
        return;
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
  }

  // On reste en chargement tant que la session n'est pas initialisée,
  // ou tant qu'un utilisateur est connecté mais que son profil n'a pas encore été chargé.
  const chargement =
    !sessionInitialisee ||
    (utilisateurId !== null && utilisateurProfilCharge !== utilisateurId);

  const valeur = {
    session,
    profil,
    chargement,
    erreurProfil,
    deconnexion,
  };

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}
