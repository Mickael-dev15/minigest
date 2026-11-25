// Page de réinitialisation de mot de passe (/reinitialisation).
// Accessible depuis le lien envoyé par email (session de récupération Supabase).
// Jamais redirigée par les gardes de routes : si le lien est absent, invalide ou expiré,
// affiche explicitement « Lien invalide ou expiré ».
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';
import {
  MOT_DE_PASSE_LONGUEUR_MIN,
  validerNouveauMotDePasse,
} from '../utils/validation.js';

// Traduit les erreurs courantes de mise à jour du mot de passe en français clair
function traduireErreurMiseAJour(erreur) {
  const code = String(erreur?.code ?? '').toLowerCase();
  const message = String(erreur?.message ?? '').toLowerCase();

  if (
    code === 'same_password' ||
    message.includes('different from the old password')
  ) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }

  if (code === 'weak_password' || message.includes('weak')) {
    return 'Ce mot de passe est trop faible. Choisissez un mot de passe plus sûr.';
  }

  if (
    message.includes('session') ||
    message.includes('expired') ||
    message.includes('invalid')
  ) {
    return 'Votre lien de réinitialisation a expiré. Veuillez en demander un nouveau.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.';
  }

  return 'Impossible de réinitialiser le mot de passe pour le moment. Veuillez réessayer.';
}

function Reinitialisation() {
  const navigate = useNavigate();
  const { session, sessionInitialisee, sessionRecuperation, deconnexion } =
    useAuth();

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreurServeur, setErreurServeur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [redirectionEnCours, setRedirectionEnCours] = useState(false);

  // Tant que Supabase n'a pas fini de vérifier la session / le lien dans l'URL
  if (!sessionInitialisee || redirectionEnCours) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <p className="loading-text">
          {redirectionEnCours
            ? 'Redirection vers la connexion...'
            : 'Vérification du lien...'}
        </p>
      </div>
    );
  }

  // Le lien est valide uniquement si une session de récupération a bien été établie
  const lienValide = Boolean(session && sessionRecuperation);

  if (!lienValide) {
    return (
      <div className="auth-page">
        <div className="card auth-card access-denied-card" role="alert">
          <div className="auth-brand">
            <h1>MiniGest</h1>
            <p className="auth-subtitle">Réinitialisation du mot de passe</p>
          </div>

          <h2>Lien invalide ou expiré</h2>
          <p className="access-denied-message">
            Ce lien de réinitialisation n&apos;est plus valide ou a déjà été
            utilisé. Vous pouvez demander un nouveau lien depuis la page mot de
            passe oublié.
          </p>

          <div className="auth-secondary-actions auth-secondary-actions-column">
            <Link to="/mot-de-passe-oublie" className="btn-primary auth-link-btn">
              Demander un nouveau lien
            </Link>
            <Link to="/login" className="auth-link">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
      const { error } = await supabase.auth.updateUser({
        password: nouveauMotDePasse,
      });

      if (error) {
        setErreurServeur(traduireErreurMiseAJour(error));
        return;
      }

      // Déconnexion de la session de récupération avant retour sur /login
      setRedirectionEnCours(true);
      try {
        await deconnexion();
      } catch {
        // Même si la déconnexion échoue côté réseau, on renvoie vers la page de connexion
      }

      navigate('/login', {
        replace: true,
        state: {
          messageSucces:
            'Votre mot de passe a été réinitialisé avec succès. Vous pouvez vous connecter.',
        },
      });
    } catch (err) {
      setErreurServeur(traduireErreurMiseAJour(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <h1>MiniGest</h1>
          <p className="auth-subtitle">Choisir un nouveau mot de passe</p>
        </div>

        <p className="auth-description">
          Votre nouveau mot de passe doit contenir au moins{' '}
          {MOT_DE_PASSE_LONGUEUR_MIN} caractères, dont une lettre et un chiffre.
        </p>

        <form className="auth-form" onSubmit={gererSoumission} noValidate>
          <div className="form-group">
            <label htmlFor="reset-password">
              Nouveau mot de passe <span className="required-star">*</span>
            </label>
            <div className="password-input-row">
              <input
                id="reset-password"
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
            <label htmlFor="reset-password-confirm">
              Confirmer le mot de passe <span className="required-star">*</span>
            </label>
            <input
              id="reset-password-confirm"
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
              : 'Enregistrer le nouveau mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Reinitialisation;
