// Section "Utilisateurs" sur /admin :
// - Formulaire de création d'utilisateur (via Edge Function creer-utilisateur)
// - Liste des profils regroupés par entreprise (nom, rôle, statut actif)
// - Activation / désactivation d'un profil (impossible pour le super_admin sur son propre compte)
import UtilisateurForm from './UtilisateurForm.jsx';
import {
  LIBELLES_ROLE,
  regrouperProfilsParEntreprise,
} from '../utils/admin.js';

function UtilisateursSection({
  entreprises,
  profils,
  utilisateurConnecteId,
  onCreerUtilisateur,
  onBasculerActifUtilisateur,
  creationEnCours,
  actionUtilisateurId,
  erreurCreation,
}) {
  const groupes = regrouperProfilsParEntreprise(profils, entreprises);
  const uneActionEstEnCours = actionUtilisateurId !== null;

  return (
    <section className="card" aria-label="Utilisateurs">
      <div className="list-header">
        <h2>Utilisateurs ({profils.length})</h2>
      </div>

      {/* Formulaire de création de compte utilisateur */}
      <UtilisateurForm
        entreprises={entreprises}
        onCreerUtilisateur={onCreerUtilisateur}
        enCours={creationEnCours}
        erreurServeur={erreurCreation}
      />

      {/* Liste des comptes regroupés par entreprise */}
      <div className="users-groups-list">
        {groupes.length === 0 ? (
          <p className="empty-text">Aucun utilisateur enregistré.</p>
        ) : (
          groupes.map((groupe) => (
            <div key={groupe.id} className="users-company-group">
              <div className="users-company-header">
                <div className="users-company-title-row">
                  <h3 className="users-company-name">{groupe.nom}</h3>
                  {!groupe.estPlateforme && (
                    <span
                      className={
                        groupe.statut === 'active'
                          ? 'badge-statut badge-entreprise-active'
                          : 'badge-statut badge-entreprise-suspendue'
                      }
                    >
                      {groupe.statut === 'active' ? 'Active' : 'Suspendue'}
                    </span>
                  )}
                </div>
                <span className="users-company-count">
                  {groupe.profils.length}{' '}
                  {groupe.profils.length > 1 ? 'utilisateurs' : 'utilisateur'}
                </span>
              </div>

              {groupe.profils.length === 0 ? (
                <p className="empty-text users-empty-group">
                  Aucun utilisateur rattaché à cette entreprise.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="client-table">
                    <thead>
                      <tr>
                        <th>Nom complet</th>
                        <th>Rôle</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupe.profils.map((utilisateur) => {
                        const estMoiMeme =
                          utilisateur.id === utilisateurConnecteId;
                        const actionSurCetteLigne =
                          actionUtilisateurId === utilisateur.id;
                        const libelleRole =
                          LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role;

                        const classeBadgeRole =
                          utilisateur.role === 'super_admin'
                            ? 'badge-role-super-admin'
                            : utilisateur.role === 'gerant'
                              ? 'badge-role-gerant'
                              : 'badge-role-employe';

                        return (
                          <tr key={utilisateur.id}>
                            <td data-label="Nom complet">
                              <strong>{utilisateur.nom_complet}</strong>
                              {estMoiMeme && (
                                <span className="user-self-tag">Vous</span>
                              )}
                            </td>

                            <td data-label="Rôle">
                              <span
                                className={`badge-statut ${classeBadgeRole}`}
                              >
                                {libelleRole}
                              </span>
                            </td>

                            <td data-label="Statut">
                              <span
                                className={
                                  utilisateur.actif
                                    ? 'badge-statut badge-entreprise-active'
                                    : 'badge-statut badge-statut-inactif'
                                }
                              >
                                {utilisateur.actif ? 'Actif' : 'Désactivé'}
                              </span>
                            </td>

                            <td data-label="Actions">
                              {estMoiMeme ? (
                                <span className="user-self-note">
                                  Votre compte (non désactivable)
                                </span>
                              ) : (
                                <div className="action-buttons">
                                  {utilisateur.actif ? (
                                    <button
                                      type="button"
                                      className="btn-danger"
                                      onClick={() =>
                                        onBasculerActifUtilisateur(utilisateur)
                                      }
                                      disabled={uneActionEstEnCours}
                                    >
                                      {actionSurCetteLigne
                                        ? 'Désactivation...'
                                        : 'Désactiver'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-reactivate"
                                      onClick={() =>
                                        onBasculerActifUtilisateur(utilisateur)
                                      }
                                      disabled={uneActionEstEnCours}
                                    >
                                      {actionSurCetteLigne
                                        ? 'Réactivation...'
                                        : 'Réactiver'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default UtilisateursSection;
