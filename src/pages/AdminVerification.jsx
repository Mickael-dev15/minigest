// Page de vérification TOTP à 6 chiffres (/admin/verification).
// Affichée au Super admin actif qui dispose déjà d'un facteur vérifié mais dont la session est en aal1.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';

// Traduit les erreurs Supabase MFA en messages clairs en français
function traduireErreurVerification(erreur) {
  const code = String(erreur?.code ?? '').toLowerCase();
  const message = String(erreur?.message ?? '').toLowerCase();

  if (
    code.includes('invalid') ||
    code.includes('expired') ||
    code.includes('mfa_verification_failed') ||
    message.includes('invalid totp') ||
    message.includes('invalid code') ||
    message.includes('expired') ||
    message.includes('verification failed')
  ) {
    return 'Code incorrect ou expiré. Vérifiez le code affiché dans votre application et réessayez.';
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.';
  }

  return 'Code incorrect ou expiré. Veuillez réessayer.';
}

function AdminVerification() {
  const navigate = useNavigate();
  const { profil, facteurTotpId, rafraichirMfa, deconnexion } = useAuth();

  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (verificationEnCours) {
      return;
    }

    setErreur('');
    const codePropre = code.replace(/\s+/g, '');

    if (!/^\d{6}$/.test(codePropre)) {
      setErreur(
        'Veuillez saisir le code à 6 chiffres généré par votre application.'
      );
      return;
    }

    setVerificationEnCours(true);

    try {
      // Récupère l'identifiant du facteur TOTP vérifié (déjà en contexte ou relu en secours)
      let idFacteur = facteurTotpId;
      if (!idFacteur) {
        const { data: donneesFacteurs, error: erreurListe } =
          await supabase.auth.mfa.listFactors();

        if (erreurListe) {
          setErreur(traduireErreurVerification(erreurListe));
          return;
        }

        const facteurVerifie = (donneesFacteurs?.totp ?? []).find(
          (f) => f.status === 'verified'
        );

        if (!facteurVerifie) {
          await rafraichirMfa();
          navigate('/admin/securite', { replace: true });
          return;
        }

        idFacteur = facteurVerifie.id;
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: idFacteur,
        code: codePropre,
      });

      if (error) {
        setErreur(traduireErreurVerification(error));
        return;
      }

      // Rafraîchit la session et l'état MFA dans AuthContext AVANT la redirection vers /admin
      const etat = await rafraichirMfa();
      if (etat.niveau === 'aal2') {
        navigate('/admin', { replace: true });
      } else {
        setErreur(
          "La vérification a réussi, mais la session n'a pas encore été actualisée. Veuillez réessayer."
        );
      }
    } catch (err) {
      setErreur(traduireErreurVerification(err));
    } finally {
      setVerificationEnCours(false);
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
          <p className="auth-subtitle">Vérification en deux étapes</p>
        </div>

        {profil?.nom_complet && (
          <p className="access-denied-user">
            Compte Super admin : <strong>{profil.nom_complet}</strong>
          </p>
        )}

        <p className="auth-description">
          Ouvrez votre application d&apos;authentification et saisissez le code
          à 6 chiffres pour accéder à l&apos;administration.
        </p>

        <form className="auth-form" onSubmit={gererSoumission} noValidate>
          <div className="form-group">
            <label htmlFor="mfa-verify-code">
              Code à 6 chiffres <span className="required-star">*</span>
            </label>
            <input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const chiffres = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(chiffres);
                if (erreur) {
                  setErreur('');
                }
              }}
              placeholder="000000"
              className={`mfa-code-input${erreur ? ' input-error' : ''}`}
              disabled={verificationEnCours}
              autoFocus
              required
            />
          </div>

          {erreur && (
            <p className="auth-error-banner" role="alert">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={verificationEnCours}
          >
            {verificationEnCours ? 'Vérification en cours...' : 'Vérifier'}
          </button>
        </form>

        <div className="auth-secondary-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={gererDeconnexion}
            disabled={verificationEnCours || deconnexionEnCours}
          >
            {deconnexionEnCours ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminVerification;
