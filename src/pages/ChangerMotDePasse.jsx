// Page de changement obligatoire du mot de passe temporaire (/changer-mot-de-passe).
// Affichée automatiquement à la première connexion quand user_metadata.doit_changer_mdp = true.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';
import {
  MOT_DE_PASSE_LONGUEUR_MIN,
  validerNouveauMotDePasse,
} from '../utils/validation.js';

// Traduit les erreurs courantes de mise à jour du mot de passe en français clair
function traduireErreurChangement(erreur) {
  const code = String(erreur?.code ?? '').toLowerCase();
  const message = String(erreur?.message ?? '').toLowerCase();

  if (
    code === 'same_password' ||
    message.includes('different from the old password')
  ) {
    return 'Le nouveau mot de passe doit être différent de votre mot de passe temporaire.';
  }

  if (code === 'weak_password' || message.includes('weak')) {
    return 'Ce mot de passe est trop faible. Choisissez un mot de passe plus sûr.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.';
  }

  return 'Impossible de modifier votre mot de passe pour le moment. Veuillez réessayer.';
}

function ChangerMotDePasse() {
  const navigate = useNavigate();
  const { profil, mettreAJourUtilisateur, deconnexion } = useAuth();

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreurServeur, setErreurServeur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  function effacerErreurChamp(champ) {
    if (erreursChamps[champ]) {
      setErreursChamps((precedent) => ({ ...precedent, [champ]: '' }));
    }
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

    setErreurServeur('');

    const { valide, erreurs } = validerNouveauMotDePasse(
      nouveauMotDePasse,
      confirmation
    );

    if (!valide) {
      setErreursChamps(erreurs);
      return;
    }

    setErreursChamps({});
    setEnCours(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: nouveauMotDePasse,
        data: { doit_changer_mdp: false },
      });

      if (error) {
        setErreurServeur(traduireErreurChangement(error));
        return;
      }

      // Mise à jour immédiate de l'utilisateur dans AuthContext AVANT la redirection
      // afin que doitChangerMdp passe à false sans boucle vers /changer-mot-de-passe.
      if (data?.user) {
        mettreAJourUtilisateur(data.user);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          mettreAJourUtilisateur(sessionData.session.user);
        }
      }

      navigate('/', { replace: true });
    } catch (err) {
      setErreurServeur(traduireErreurChangement(err));
    } finally {
      setEnCours(false);
    }
  }

  async function gererDeconnexion() {
    setDeconnexionEnCours(true);
    try {
      await deconnexion();
    } catch {
      setDeconnexionEnCours(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <h1>MiniGest</h1>
          <p className="auth-subtitle">Changement de mot de passe requis</p>
        </div>

        {profil?.nom_complet && (
          <p className="access-denied-user">
            Bienvenue, <strong>{profil.nom_complet}</strong>
          </p>
        )}

        <p className="auth-description">
          Pour sécuriser votre compte, vous devez remplacer votre mot de passe
          temporaire avant d&apos;accéder à votre espace. Choisissez au moins{' '}
          {MOT_DE_PASSE_LONGUEUR_MIN} caractères, dont une lettre et un chiffre.
        </p>

        <form className="auth-form" onSubmit={gererSoumission} noValidate>
          <div className="form-group">
            <label htmlFor="change-password">
              Nouveau mot de passe <span className="required-star">*</span>
            </label>
            <div className="password-input-row">
              <input
                id="change-password"
                type={afficherMdp ? 'text' : 'password'}
                value={nouveauMotDePasse}
                onChange={(e) => {
                  setNouveauMotDePasse(e.target.value);
                  effacerErreurChamp('motDePasse');
                }}
                placeholder="8 caractères minimum (lettre + chiffre)"
                autoComplete="new-password"
                className={erreursChamps.motDePasse ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              <button
                type="button"
                className="btn-secondary btn-toggle-password"
                onClick={() => setAfficherMdp((visible) => !visible)}
                disabled={enCours}
              >
                {afficherMdp ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {erreursChamps.motDePasse && (
              <p className="error-message">{erreursChamps.motDePasse}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="change-password-confirm">
              Confirmer le mot de passe <span className="required-star">*</span>
            </label>
            <input
              id="change-password-confirm"
              type={afficherMdp ? 'text' : 'password'}
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
                effacerErreurChamp('confirmation');
              }}
              placeholder="Saisissez à nouveau le mot de passe"
              autoComplete="new-password"
              className={erreursChamps.confirmation ? 'input-error' : ''}
              disabled={enCours}
              required
            />
            {erreursChamps.confirmation && (
              <p className="error-message">{erreursChamps.confirmation}</p>
            )}
          </div>

          {erreurServeur && (
            <p className="auth-error-banner" role="alert">
              {erreurServeur}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={enCours}
          >
            {enCours
              ? 'Enregistrement en cours...'
              : 'Valider mon nouveau mot de passe'}
          </button>
        </form>

        <div className="auth-secondary-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={gererDeconnexion}
            disabled={enCours || deconnexionEnCours}
          >
            {deconnexionEnCours ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangerMotDePasse;
