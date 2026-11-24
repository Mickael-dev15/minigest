// Écran affiché lorsqu'un utilisateur connecté ne peut pas accéder à l'application
// (profil inactif, profil introuvable ou entreprise suspendue).
import { useState } from 'react';
import { useAuth } from '../context/useAuth.js';

function AccesRefuse() {
  const { profil, erreurProfil, deconnexion } = useAuth();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  async function gererDeconnexion() {
    setDeconnexionEnCours(true);
    try {
      await deconnexion();
    } catch {
      setDeconnexionEnCours(false);
    }
  }

  let titre = 'Accès refusé';
  let message =
    "Votre compte ne dispose pas des autorisations nécessaires pour accéder à MiniGest.";
  let motifSuspension = null;

  if (erreurProfil) {
    titre = 'Impossible de vérifier votre accès';
    message = erreurProfil;
  } else if (!profil) {
    titre = 'Profil introuvable';
    message =
      "Aucun profil MiniGest n'est associé à ce compte. Veuillez contacter l'administrateur.";
  } else if (!profil.actif) {
    titre = 'Compte désactivé';
    message =
      "Votre compte utilisateur est actuellement inactif. Veuillez contacter votre gérant ou l'administrateur MiniGest.";
  } else if (profil.entreprise?.statut === 'suspendue') {
    titre = 'Entreprise suspendue';
    message = `L'accès de l'entreprise « ${profil.entreprise.nom} » est actuellement suspendu. Veuillez contacter l'administrateur MiniGest.`;
    motifSuspension = profil.entreprise.motif_suspension;
  } else if (profil.role !== 'super_admin' && !profil.entreprise) {
    titre = 'Entreprise introuvable';
    message =
      "Votre profil n'est rattaché à aucune entreprise active. Veuillez contacter l'administrateur MiniGest.";
  }

  return (
    <div className="auth-page">
      <div className="card auth-card access-denied-card" role="alert">
        <div className="auth-brand">
          <h1>MiniGest</h1>
        </div>

        <h2>{titre}</h2>

        {profil?.nom_complet && (
          <p className="access-denied-user">
            Connecté en tant que <strong>{profil.nom_complet}</strong>
          </p>
        )}

        <p className="access-denied-message">{message}</p>

        {motifSuspension && (
          <div className="access-denied-reason">
            <strong>Motif indiqué :</strong> {motifSuspension}
          </div>
        )}

        <div className="access-denied-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={gererDeconnexion}
            disabled={deconnexionEnCours}
          >
            {deconnexionEnCours ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccesRefuse;
