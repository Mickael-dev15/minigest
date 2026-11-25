// Section "Mon équipe" sur /app, visible UNIQUEMENT pour le gérant (Lot 4) :
// - Formulaire d'ajout d'un employé (via l'Edge Function gerer-equipe)
// - Liste des membres de son entreprise (nom, rôle, statut actif), lue via la RLS existante
// - Bouton Désactiver / Réactiver affiché uniquement pour les employés (jamais pour un gérant ni soi-même)
import EmployeForm from './EmployeForm.jsx';
import { LIBELLES_ROLE } from '../utils/admin.js';
import { trierMembresEquipe } from '../utils/equipe.js';

function EquipeSection({
  membres,
  utilisateurConnecteId,
  chargement,
  erreurChargement,
  messageSucces,
  avertissementJournal,
  erreurAction,
  erreurCreation,
  creationEnCours,
  actionMembreId,
  onCreerEmploye,
  onBasculerActifEmploye,
  onRecharger,
  onFermerErreurAction,
}) {
  const membresTries = trierMembresEquipe(membres);
  const uneActionEstEnCours = actionMembreId !== null;

  return (
    <section className="card" aria-label="Mon équipe">
      <div className="list-header">
        <h2>
          Mon équipe {!chargement && !erreurChargement && `(${membresTries.length})`}
        </h2>
      </div>

      {/* Bandeaux de retour pour les actions d'équipe */}
      {(messageSucces || avertissementJournal || erreurAction) && (
        <div className="equipe-feedback-stack">
          {messageSucces && (
            <p className="success-message" role="status" aria-live="polite">
              {messageSucces}
            </p>
          )}

          {avertissementJournal && (
            <div className="import-report import-report-warning" role="status">
              <p className="import-report-summary">{avertissementJournal}</p>
            </div>
          )}

          {erreurAction && (
            <div className="action-error-banner" role="alert">
              <p className="action-error-text">{erreurAction}</p>
              <button
                type="button"
                className="btn-close-report"
                onClick={onFermerErreurAction}
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Formulaire d'ajout d'un employé */}
      <EmployeForm
        onCreerEmploye={onCreerEmploye}
        enCours={creationEnCours}
        erreurServeur={erreurCreation}
      />

      {/* Liste des membres de l'entreprise */}
      {chargement ? (
        <p className="empty-text" role="status" aria-live="polite">
          Chargement de l&apos;équipe...
        </p>
      ) : erreurChargement ? (
        <div role="alert">
          <p className="error-message">{erreurChargement}</p>
          <div className="clients-retry-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onRecharger}
            >
              Réessayer
            </button>
          </div>
        </div>
      ) : membresTries.length === 0 ? (
        <p className="empty-text">Aucun membre trouvé dans votre entreprise.</p>
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
              {membresTries.map((membre) => {
                const estMoiMeme = membre.id === utilisateurConnecteId;
                const estEmploye = membre.role === 'employe';
                const peutGerer = estEmploye && !estMoiMeme;
                const actionSurCetteLigne = actionMembreId === membre.id;
                const libelleRole = LIBELLES_ROLE[membre.role] ?? membre.role;

                const classeBadgeRole =
                  membre.role === 'gerant'
                    ? 'badge-role-gerant'
                    : 'badge-role-employe';

                return (
                  <tr key={membre.id}>
                    <td data-label="Nom complet">
                      <strong>{membre.nom_complet}</strong>
                      {estMoiMeme && <span className="user-self-tag">Vous</span>}
                    </td>

                    <td data-label="Rôle">
                      <span className={`badge-statut ${classeBadgeRole}`}>
                        {libelleRole}
                      </span>
                    </td>

                    <td data-label="Statut">
                      <span
                        className={
                          membre.actif
                            ? 'badge-statut badge-entreprise-active'
                            : 'badge-statut badge-statut-inactif'
                        }
                      >
                        {membre.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>

                    <td data-label="Actions">
                      {peutGerer ? (
                        <div className="action-buttons">
                          {membre.actif ? (
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => onBasculerActifEmploye(membre)}
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
                              onClick={() => onBasculerActifEmploye(membre)}
                              disabled={uneActionEstEnCours}
                            >
                              {actionSurCetteLigne
                                ? 'Réactivation...'
                                : 'Réactiver'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="user-self-note">
                          {estMoiMeme ? 'Votre compte' : 'Gérant'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default EquipeSection;
