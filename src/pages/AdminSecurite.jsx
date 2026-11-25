// Page d'activation de la double authentification TOTP (/admin/securite).
// Affichée uniquement au Super admin actif lorsqu'aucun facteur TOTP vérifié n'existe.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';

// Évite un double enroll concurrent au montage en développement sous React.StrictMode
let inscriptionEnCours = null;

// Encode proprement un SVG data URI brut renvoyé par Supabase pour qu'il s'affiche dans tous les navigateurs
function normaliserQrCodeDataUri(qrCode) {
  if (typeof qrCode !== 'string' || !qrCode) {
    return '';
  }

  const prefixeBrut = 'data:image/svg+xml;utf-8,<';
  if (qrCode.startsWith(prefixeBrut)) {
    const svgBrut = qrCode.slice('data:image/svg+xml;utf-8,'.length);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgBrut)}`;
  }

  return qrCode;
}

// Traduit les erreurs Supabase MFA en messages clairs en français
function traduireErreurMfa(erreur) {
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

// Supprime les éventuels facteurs TOTP non vérifiés restants, puis inscrit un nouveau facteur TOTP
function preparerInscriptionTotp(utilisateurId) {
  if (
    inscriptionEnCours &&
    inscriptionEnCours.utilisateurId === utilisateurId
  ) {
    return inscriptionEnCours.promesse;
  }

  const promesse = (async () => {
    const { data: donneesFacteurs, error: erreurListe } =
      await supabase.auth.mfa.listFactors();

    if (erreurListe) {
      throw erreurListe;
    }

    // Si un facteur TOTP vérifié existe finalement déjà, on ne réinscrit pas un doublon
    const dejaVerifie =
      (Array.isArray(donneesFacteurs?.totp) &&
        donneesFacteurs.totp.some((f) => f.status === 'verified')) ||
      (Array.isArray(donneesFacteurs?.all) &&
        donneesFacteurs.all.some(
          (f) => f.factor_type === 'totp' && f.status === 'verified'
        ));

    if (dejaVerifie) {
      return { dejaVerifie: true };
    }

    // Les facteurs non vérifiés figurent dans donneesFacteurs.all (jamais dans donneesFacteurs.totp)
    const facteursNonVerifies = (donneesFacteurs?.all ?? []).filter(
      (facteur) =>
        facteur.factor_type === 'totp' && facteur.status !== 'verified'
    );

    for (const facteur of facteursNonVerifies) {
      const { error: erreurSuppression } = await supabase.auth.mfa.unenroll({
        factorId: facteur.id,
      });
      if (erreurSuppression) {
        throw erreurSuppression;
      }
    }

    const { data: donneesEnroll, error: erreurEnroll } =
      await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

    if (erreurEnroll || !donneesEnroll?.id || !donneesEnroll?.totp) {
      throw (
        erreurEnroll ??
        new Error("Impossible de démarrer l'inscription TOTP.")
      );
    }

    return {
      dejaVerifie: false,
      factorId: donneesEnroll.id,
      qrCode: normaliserQrCodeDataUri(donneesEnroll.totp.qr_code),
      secret: donneesEnroll.totp.secret ?? '',
    };
  })().finally(() => {
    if (inscriptionEnCours?.promesse === promesse) {
      inscriptionEnCours = null;
    }
  });

  inscriptionEnCours = { utilisateurId, promesse };
  return promesse;
}

function AdminSecurite() {
  const navigate = useNavigate();
  const { session, profil, rafraichirMfa, deconnexion } = useAuth();
  const utilisateurId = session?.user?.id ?? null;

  const [chargementInscription, setChargementInscription] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [cleCopiee, setCleCopiee] = useState(false);

  const [code, setCode] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const initialiserFacteur = useCallback(async () => {
    if (!utilisateurId) {
      return;
    }

    setChargementInscription(true);
    setErreurChargement('');
    setErreurCode('');
    setCleCopiee(false);

    try {
      const resultat = await preparerInscriptionTotp(utilisateurId);

      if (resultat.dejaVerifie) {
        await rafraichirMfa();
        navigate('/admin/verification', { replace: true });
        return;
      }

      setFactorId(resultat.factorId);
      setQrCode(resultat.qrCode);
      setSecret(resultat.secret);
    } catch {
      setErreurChargement(
        "Impossible de préparer la double authentification pour le moment. Vérifiez votre connexion et réessayez."
      );
    } finally {
      setChargementInscription(false);
    }
  }, [utilisateurId, rafraichirMfa, navigate]);

  useEffect(() => {
    let estActif = true;

    async function demarrer() {
      if (!utilisateurId) {
        return;
      }

      setChargementInscription(true);
      setErreurChargement('');

      try {
        const resultat = await preparerInscriptionTotp(utilisateurId);
        if (!estActif) {
          return;
        }

        if (resultat.dejaVerifie) {
          await rafraichirMfa();
          if (estActif) {
            navigate('/admin/verification', { replace: true });
          }
          return;
        }

        setFactorId(resultat.factorId);
        setQrCode(resultat.qrCode);
        setSecret(resultat.secret);
      } catch {
        if (!estActif) {
          return;
        }
        setErreurChargement(
          "Impossible de préparer la double authentification pour le moment. Vérifiez votre connexion et réessayez."
        );
      } finally {
        if (estActif) {
          setChargementInscription(false);
        }
      }
    }

    demarrer();

    return () => {
      estActif = false;
    };
  }, [utilisateurId, rafraichirMfa, navigate]);

  async function copierCleSecrete() {
    if (!secret) {
      return;
    }
    try {
      await navigator.clipboard.writeText(secret);
      setCleCopiee(true);
    } catch {
      setCleCopiee(false);
    }
  }

  async function gererVerification(evenement) {
    evenement.preventDefault();
    if (verificationEnCours || !factorId) {
      return;
    }

    setErreurCode('');
    const codePropre = code.replace(/\s+/g, '');

    if (!/^\d{6}$/.test(codePropre)) {
      setErreurCode(
        'Veuillez saisir le code à 6 chiffres généré par votre application.'
      );
      return;
    }

    setVerificationEnCours(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: codePropre,
      });

      if (error) {
        setErreurCode(traduireErreurMfa(error));
        return;
      }

      // Rafraîchit la session et l'état MFA dans AuthContext AVANT la redirection vers /admin
      const etat = await rafraichirMfa();
      if (etat.niveau === 'aal2') {
        navigate('/admin', { replace: true });
      } else {
        setErreurCode(
          "La double authentification a été validée, mais la session n'a pas encore été actualisée. Veuillez réessayer."
        );
      }
    } catch (err) {
      setErreurCode(traduireErreurMfa(err));
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
      <div className="card auth-card mfa-card">
        <div className="auth-brand">
          <h1>MiniGest</h1>
          <p className="auth-subtitle">
            Activation de la double authentification
          </p>
        </div>

        {profil?.nom_complet && (
          <p className="access-denied-user">
            Compte Super admin : <strong>{profil.nom_complet}</strong>
          </p>
        )}

        <p className="auth-description">
          La double authentification est obligatoire pour accéder à l&apos;espace
          Super admin. Scannez ce QR code avec votre application
          d&apos;authentification (Google Authenticator, Microsoft
          Authenticator, Authy…) ou saisissez la clé manuellement.
        </p>

        {chargementInscription ? (
          <div className="mfa-loading" role="status" aria-live="polite">
            Préparation du QR code en cours...
          </div>
        ) : erreurChargement ? (
          <div className="mfa-error-box">
            <p className="auth-error-banner" role="alert">
              {erreurChargement}
            </p>
            <button
              type="button"
              className="btn-primary auth-submit-btn"
              onClick={initialiserFacteur}
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <div className="mfa-qr-wrapper">
              {qrCode && (
                <img
                  src={qrCode}
                  alt="QR code d'activation de la double authentification"
                  className="mfa-qr-image"
                />
              )}
            </div>

            <div className="mfa-secret-box">
              <p className="mfa-secret-label">
                Clé secrète (saisie manuelle) :
              </p>
              <div className="mfa-secret-row">
                <code className="mfa-secret-value">{secret}</code>
                <button
                  type="button"
                  className="btn-secondary btn-copy-secret"
                  onClick={copierCleSecrete}
                >
                  {cleCopiee ? 'Copiée' : 'Copier'}
                </button>
              </div>
            </div>

            <form
              className="auth-form"
              onSubmit={gererVerification}
              noValidate
            >
              <div className="form-group">
                <label htmlFor="mfa-enroll-code">
                  Code à 6 chiffres <span className="required-star">*</span>
                </label>
                <input
                  id="mfa-enroll-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const chiffres = e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 6);
                    setCode(chiffres);
                    if (erreurCode) {
                      setErreurCode('');
                    }
                  }}
                  placeholder="000000"
                  className={`mfa-code-input${erreurCode ? ' input-error' : ''}`}
                  disabled={verificationEnCours}
                  required
                />
              </div>

              {erreurCode && (
                <p className="auth-error-banner" role="alert">
                  {erreurCode}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary auth-submit-btn"
                disabled={verificationEnCours}
              >
                {verificationEnCours
                  ? 'Vérification en cours...'
                  : 'Activer et accéder à /admin'}
              </button>
            </form>
          </>
        )}

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

export default AdminSecurite;
