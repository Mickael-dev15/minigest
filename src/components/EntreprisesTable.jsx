// Tableau des entreprises sur /admin : statut, nombre de clients (RPC),
// abonnement en cours, gestion des abonnements, suspension avec motif et réactivation.
// Aucune suppression d'entreprise n'est proposée.
import { useState } from 'react';
import {
  LIBELLES_STATUT_PAIEMENT,
  analyserEcheanceEntreprise,
  estAbonnementEnRetard,
  estEntrepriseASurveiller,
  formaterBadgeEcheance,
  formaterDateFr,
  obtenirNbClientsEntreprise,
  validerMotifSuspension,
} from '../utils/admin.js';

function EntreprisesTable({
  entreprises,
  carteNbClients,
  abonnementsParEntreprise,
  entrepriseSelectionneeId,
  onSelectionnerAbonnements,
  onSuspendreEntreprise,
  onReactiverEntreprise,
  actionEnCoursId,
}) {
  // Entreprise actuellement ciblée par l'encart de confirmation de suspension
  const [entrepriseASuspendre, setEntrepriseASuspendre] = useState(null);
  const [motifSuspension, setMotifSuspension] = useState('');
  const [erreurMotif, setErreurMotif] = useState('');

  // Filtre d'affichage du tableau : 'toutes' ou 'a_surveiller'
  const [filtreEntreprises, setFiltreEntreprises] = useState('toutes');

  // Ouvre le formulaire de confirmation de suspension pour l'entreprise choisie
  function ouvrirConfirmationSuspension(entreprise) {
    setEntrepriseASuspendre(entreprise);
    setMotifSuspension('');
    setErreurMotif('');
  }

  function fermerConfirmationSuspension() {
    setEntrepriseASuspendre(null);
    setMotifSuspension('');
    setErreurMotif('');
  }

  async function confirmerSuspension(evenement) {
    evenement.preventDefault();
    if (!entrepriseASuspendre || actionEnCoursId !== null) {
      return;
    }

    const { erreur, motifPropre } = validerMotifSuspension(motifSuspension);
    if (erreur) {
      setErreurMotif(erreur);
      return;
    }

    setErreurMotif('');
    const reussite = await onSuspendreEntreprise(
      entrepriseASuspendre,
      motifPropre
    );
    if (reussite) {
      fermerConfirmationSuspension();
    }
  }

  const suspensionEnCours =
    entrepriseASuspendre !== null &&
    actionEnCoursId === entrepriseASuspendre.id;

  // Filtrage dérivé sans modifier le tableau entreprises d'origine
  const entreprisesASurveiller = entreprises.filter((entreprise) =>
    estEntrepriseASurveiller(abonnementsParEntreprise[entreprise.id] ?? [])
  );
  const entreprisesAffichees =
    filtreEntreprises === 'a_surveiller' ? entreprisesASurveiller : entreprises;

  return (
    <section className="card" aria-label="Liste des entreprises">
      <div className="list-header">
        <h2>Entreprises ({entreprisesAffichees.length})</h2>

        {/* Filtres rapides : toutes les entreprises ou uniquement celles à surveiller */}
        <div
          className="status-filters admin-company-filters"
          role="group"
          aria-label="Filtrer les entreprises"
        >
          <button
            type="button"
            className={
              filtreEntreprises === 'toutes'
                ? 'status-filter-btn status-filter-active'
                : 'status-filter-btn'
            }
            onClick={() => setFiltreEntreprises('toutes')}
            aria-pressed={filtreEntreprises === 'toutes'}
          >
            Toutes ({entreprises.length})
          </button>
          <button
            type="button"
            className={
              filtreEntreprises === 'a_surveiller'
                ? 'status-filter-btn status-filter-active'
                : 'status-filter-btn'
            }
            onClick={() => setFiltreEntreprises('a_surveiller')}
            aria-pressed={filtreEntreprises === 'a_surveiller'}
          >
            À surveiller ({entreprisesASurveiller.length})
          </button>
        </div>
      </div>

      {/* Encart de confirmation avec motif obligatoire avant toute suspension */}
      {entrepriseASuspendre && (
        <form
          className="suspend-confirm-box"
          onSubmit={confirmerSuspension}
          noValidate
        >
          <p className="suspend-confirm-title">
            Confirmer la suspension de{' '}
            <strong>{entrepriseASuspendre.nom}</strong>
          </p>
          <p className="suspend-confirm-help">
            Les utilisateurs de cette entreprise ne pourront plus accéder à leur
            espace tant qu&apos;elle restera suspendue. Le motif ci-dessous leur
            sera affiché.
          </p>

          <div className="form-group">
            <label htmlFor="motif-suspension">
              Motif de suspension <span className="required-star">*</span>
            </label>
            <textarea
              id="motif-suspension"
              value={motifSuspension}
              onChange={(e) => {
                setMotifSuspension(e.target.value);
                if (erreurMotif) {
                  setErreurMotif('');
                }
              }}
              placeholder="Ex. Abonnement expiré depuis le 01/11/2026"
              className={erreurMotif ? 'input-error' : ''}
              disabled={suspensionEnCours}
              required
            />
            {erreurMotif && <p className="error-message">{erreurMotif}</p>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-danger"
              disabled={suspensionEnCours}
            >
              {suspensionEnCours
                ? 'Suspension en cours...'
                : 'Confirmer la suspension'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={fermerConfirmationSuspension}
              disabled={suspensionEnCours}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {entreprises.length === 0 ? (
        <p className="empty-text">Aucune entreprise enregistrée.</p>
      ) : entreprisesAffichees.length === 0 ? (
        <p className="empty-text">
          Aucune entreprise à surveiller pour le moment.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="client-table admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Ville</th>
                <th>Pays</th>
                <th>Statut</th>
                <th>Clients</th>
                <th>Abonnement en cours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entreprisesAffichees.map((entreprise) => {
                const nbClients = obtenirNbClientsEntreprise(
                  carteNbClients,
                  entreprise.id
                );
                const abonnementsEntreprise =
                  abonnementsParEntreprise[entreprise.id] ?? [];
                const analyseEcheance = analyserEcheanceEntreprise(
                  abonnementsEntreprise
                );
                const { abonnementEnCours } = analyseEcheance;
                const badgeEcheance = formaterBadgeEcheance(analyseEcheance);
                const enRetard = estAbonnementEnRetard(abonnementEnCours);
                const estSelectionnee =
                  entreprise.id === entrepriseSelectionneeId;
                const actionSurCetteLigne = actionEnCoursId === entreprise.id;
                const uneActionEstEnCours = actionEnCoursId !== null;

                const classeBadgePaiement = abonnementEnCours
                  ? abonnementEnCours.statut_paiement === 'paye'
                    ? 'badge-paiement-paye'
                    : abonnementEnCours.statut_paiement === 'en_retard' ||
                        enRetard
                      ? 'badge-paiement-retard'
                      : 'badge-paiement-attente'
                  : '';

                return (
                  <tr
                    key={entreprise.id}
                    className={estSelectionnee ? 'row-editing' : ''}
                  >
                    <td data-label="Nom">
                      <strong>{entreprise.nom}</strong>
                    </td>

                    <td data-label="Ville">{entreprise.ville || '—'}</td>

                    <td data-label="Pays">{entreprise.pays || '—'}</td>

                    <td data-label="Statut" className="cell-statut-entreprise">
                      <span
                        className={
                          entreprise.statut === 'active'
                            ? 'badge-statut badge-entreprise-active'
                            : 'badge-statut badge-entreprise-suspendue'
                        }
                      >
                        {entreprise.statut === 'active'
                          ? 'Active'
                          : 'Suspendue'}
                      </span>
                      {entreprise.statut === 'suspendue' &&
                        entreprise.motif_suspension && (
                          <span
                            className="entreprise-motif"
                            title={entreprise.motif_suspension}
                          >
                            Motif : {entreprise.motif_suspension}
                          </span>
                        )}
                    </td>

                    <td data-label="Clients">
                      <strong>{nbClients}</strong>
                    </td>

                    <td data-label="Abonnement en cours" className="cell-abo">
                      {!abonnementEnCours ? (
                        <span className="empty-text">Aucun</span>
                      ) : (
                        <div className="abo-resume">
                          <span className="abo-formule">
                            {abonnementEnCours.formule}
                          </span>
                          <span className="abo-echeance">
                            Fin : {formaterDateFr(abonnementEnCours.date_fin)}
                          </span>
                          <span
                            className={`badge-statut ${classeBadgePaiement}`}
                          >
                            {LIBELLES_STATUT_PAIEMENT[
                              abonnementEnCours.statut_paiement
                            ] ?? abonnementEnCours.statut_paiement}
                            {abonnementEnCours.statut_paiement ===
                              'en_attente' && enRetard
                              ? ' (échu)'
                              : ''}
                          </span>
                          {badgeEcheance && (
                            <span
                              className={`badge-statut badge-echeance-${badgeEcheance.type}`}
                            >
                              {badgeEcheance.libelle}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td data-label="Actions">
                      <div className="action-buttons admin-action-buttons">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => onSelectionnerAbonnements(entreprise)}
                          disabled={uneActionEstEnCours}
                        >
                          {estSelectionnee
                            ? 'Abonnements (ouvert)'
                            : 'Abonnements'}
                        </button>

                        {entreprise.statut === 'active' ? (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() =>
                              ouvrirConfirmationSuspension(entreprise)
                            }
                            disabled={uneActionEstEnCours}
                          >
                            Suspendre
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-reactivate"
                            onClick={() => onReactiverEntreprise(entreprise)}
                            disabled={uneActionEstEnCours}
                          >
                            {actionSurCetteLigne
                              ? 'Réactivation...'
                              : 'Réactiver'}
                          </button>
                        )}
                      </div>
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

export default EntreprisesTable;
