// Section "Dernières actions" : affiche les 20 entrées les plus récentes de public.journal.
import {
  LIBELLES_ACTION_JOURNAL,
  formaterDateHeureFr,
  formaterDetailsJournal,
} from '../utils/admin.js';

function JournalSection({ entrees }) {
  return (
    <section className="card" aria-label="Dernières actions">
      <h2>Dernières actions</h2>

      {entrees.length === 0 ? (
        <p className="empty-text">Aucune action enregistrée pour le moment.</p>
      ) : (
        <div className="table-wrapper">
          <table className="client-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Acteur</th>
                <th>Action</th>
                <th>Cible</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((entree) => {
                const acteurNormalise = Array.isArray(entree.acteur)
                  ? entree.acteur[0]
                  : entree.acteur;
                const nomActeur = acteurNormalise?.nom_complet ?? 'Super admin';
                const libelleAction =
                  LIBELLES_ACTION_JOURNAL[entree.action] ?? entree.action;

                return (
                  <tr key={entree.id}>
                    <td data-label="Date">
                      {formaterDateHeureFr(entree.cree_le)}
                    </td>
                    <td data-label="Acteur">{nomActeur}</td>
                    <td data-label="Action">
                      <span className="badge-statut badge-journal-action">
                        {libelleAction}
                      </span>
                    </td>
                    <td data-label="Cible">
                      <strong>{entree.cible || '—'}</strong>
                    </td>
                    <td data-label="Détails" className="cell-journal-details">
                      {formaterDetailsJournal(entree.details)}
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

export default JournalSection;
