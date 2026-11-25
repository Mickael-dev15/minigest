// Page de connexion MiniGest v2 (aucune inscription publique : les comptes sont créés par le Super admin)
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

// Traduit les messages d'erreur courants de Supabase Auth en français clair
function traduireErreurConnexion(erreur) {
  const message = String(erreur?.message ?? '').toLowerCase();

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid_credentials')
  ) {
    return 'Email ou mot de passe incorrect.';
  }

  if (message.includes('email not confirmed')) {
    return "Votre adresse email n'est pas encore confirmée.";
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Trop de tentatives de connexion. Veuillez patienter quelques instants.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.';
  }

  return 'La connexion a échoué. Vérifiez vos identifiants et réessayez.';
}

function Login() {
  const location = useLocation();
  const messageSuccesNavigation =
    typeof location.state?.messageSucces === 'string'
      ? location.state.messageSucces
      : '';

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    setErreur('');

    const emailPropre = email.trim();
    if (!emailPropre || !motDePasse) {
      setErreur('Veuillez saisir votre adresse email et votre mot de passe.');
      return;
    }

    setEnCours(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailPropre,
        password: motDePasse,
      });

      if (error) {
        setErreur(traduireErreurConnexion(error));
      }
      // En cas de succès, onAuthStateChange met à jour la session et les routes redirigent automatiquement
    } catch (err) {
      setErreur(traduireErreurConnexion(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <h1>MiniGest</h1>
          <p className="auth-subtitle">Connexion à votre espace professionnel</p>
        </div>

        {messageSuccesNavigation && !erreur && (
          <p className="auth-success-banner" role="status">
            {messageSuccesNavigation}
          </p>
        )}

        <form className="auth-form" onSubmit={gererSoumission} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">
              Adresse email <span className="required-star">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@entreprise.ci"
              autoComplete="email"
              disabled={enCours}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">
              Mot de passe <span className="required-star">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              disabled={enCours}
              required
            />
          </div>

          <div className="auth-links-row">
            <Link to="/mot-de-passe-oublie" className="auth-link">
              Mot de passe oublié ?
            </Link>
          </div>

          {erreur && (
            <p className="auth-error-banner" role="alert">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={enCours}
          >
            {enCours ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p className="auth-info-note">
          Accès réservé aux utilisateurs autorisés. Contactez l&apos;administrateur
          en cas de besoin.
        </p>
      </div>
    </div>
  );
}

export default Login;
