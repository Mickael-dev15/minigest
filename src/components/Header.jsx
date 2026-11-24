// Composant d'en-tête : titre MiniGest, nom de l'utilisateur et de son entreprise,
// compteur total de clients (sur /app) et bouton de déconnexion.
import { useState } from 'react';
import { useAuth } from '../context/useAuth.js';

function Header({ totalClients }) {
  const { profil, deconnexion } = useAuth();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  // Le super_admin n'appartient à aucune entreprise (entreprise === null) :
  // on gère ce cas proprement sans jamais accéder directement à profil.entreprise.nom.
  const nomUtilisateur = profil?.nom_complet ?? '';
  const nomEntreprise =
    profil?.entreprise?.nom ??
    (profil?.role === 'super_admin' ? 'Super admin' : '');

  async function gererDeconnexion() {
    setDeconnexionEnCours(true);
    try {
      await deconnexion();
    } catch {
      setDeconnexionEnCours(false);
    }
  }

  return (
    <header className="header">
      <div className="header-brand">
        <h1>MiniGest</h1>
        {(nomUtilisateur || nomEntreprise) && (
          <p className="header-user-info">
            {nomUtilisateur && (
              <span className="header-user-name">{nomUtilisateur}</span>
            )}
            {nomUtilisateur && nomEntreprise && (
              <span className="header-user-separator" aria-hidden="true">
                •
              </span>
            )}
            {nomEntreprise && (
              <span className="header-company-name">{nomEntreprise}</span>
            )}
          </p>
        )}
      </div>

      <div className="header-actions">
        {typeof totalClients === 'number' && (
          <p className="client-counter">Total clients : {totalClients}</p>
        )}
        <button
          type="button"
          className="btn-logout"
          onClick={gererDeconnexion}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </div>
    </header>
  );
}

export default Header;
