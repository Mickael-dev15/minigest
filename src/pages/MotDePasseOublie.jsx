// Page de demande de réinitialisation de mot de passe (/mot-de-passe-oublie).
// Sécurité : affiche TOUJOURS le même message neutre après soumission
// afin de ne jamais révéler si une adresse email existe dans la base.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_NEUTRE =
  "Si un compte existe pour cette adresse, un email vient d'être envoyé.";

function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [erreurFormat, setErreurFormat] = useState('');
  const [messageConfirmation, setMessageConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

    setErreurFormat('');
    setMessageConfirmation('');

    const emailPropre = email.trim();
    if (!emailPropre || !REGEX_EMAIL.test(emailPropre)) {
      setErreurFormat('Veuillez saisir une adresse email valide.');
      return;
    }

    setEnCours(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailPropre, {
        redirectTo: `${window.location.origin}/reinitialisation`,
      });

      // En cas d'erreur (y compris limite d'envoi HTTP 429), on ne révèle rien
      // à l'utilisateur : le détail est écrit uniquement dans la console de développement.
      if (error && import.meta.env.DEV) {
        console.warn(
          'Erreur lors de resetPasswordForEmail (détail dev uniquement) :',
          error
        );
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(
          'Exception lors de resetPasswordForEmail (détail dev uniquement) :',
          err
        );
      }
    } finally {
      // Message toujours neutre après soumission
      setMessageConfirmation(MESSAGE_NEUTRE);
      setEnCours(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <h1>MiniGest</h1>
          <p className="auth-subtitle">Mot de passe oublié</p>
        </div>

        <p className="auth-description">
          Saisissez votre adresse email professionnelle pour recevoir un lien de
          réinitialisation de mot de passe.
        </p>

        {messageConfirmation && (
          <p className="auth-success-banner" role="status">
            {messageConfirmation}
          </p>
        )}

        <form className="auth-form" onSubmit={gererSoumission} noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email">
              Adresse email <span className="required-star">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (erreurFormat) {
                  setErreurFormat('');
                }
              }}
              placeholder="prenom.nom@entreprise.ci"
              autoComplete="email"
              className={erreurFormat ? 'input-error' : ''}
              disabled={enCours}
              required
            />
            {erreurFormat && <p className="error-message">{erreurFormat}</p>}
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={enCours}
          >
            {enCours ? 'Envoi en cours...' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="auth-secondary-actions">
          <Link to="/login" className="auth-link">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MotDePasseOublie;
