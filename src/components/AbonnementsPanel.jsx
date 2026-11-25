// Panneau de gestion des abonnements d'une entreprise :
// affichage de l'historique, ajout et modification (aucune suppression).
import { useState } from 'react';
import {
  LIBELLES_STATUT_PAIEMENT,
  STATUTS_PAIEMENT,
  estAbonnementEnRetard,
  formaterDateFr,
  formaterMontantFcfa,
  normaliserDateIso,
  obtenirDateLocaleAujourdhui,
  validerAbonnement,
} from '../utils/admin.js';

function creerFormulaireVide() {
  return {
    formule: '',
    date_debut: obtenirDateLocaleAujourdhui(),
    date_fin: '',
    montant_fcfa: '',
    statut_paiement: 'en_attente',
    reference: '',
  };
}

function AbonnementsPanel({
  entreprise,
  abonnements,
  onAjouterAbonnement,
  onModifierAbonnement,
  onFermer,
  enCours,
  erreurServeur,
}) {
  const [abonnementEnEdition, setAbonnementEnEdition] = useState(null);
  const [formulaire, setFormulaire] = useState(() => creerFormulaireVide());
  const [erreurs, setErreurs] = useState({});

  function mettreAJourChamp(champ, valeur) {
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));
    if (erreurs[champ]) {
      setErreurs((precedent) => ({ ...precedent, [champ]: '' }));
    }
  }

  function demarrerEdition(abonnement) {
    setAbonnementEnEdition(abonnement);
    setFormulaire({
      formule: abonnement.formule ?? '',
      date_debut: normaliserDateIso(abonnement.date_debut),
      date_fin: normaliserDateIso(abonnement.date_fin),
      montant_fcfa: String(abonnement.montant_fcfa ?? ''),
      statut_paiement: abonnement.statut_paiement ?? 'en_attente',
      reference: abonnement.reference ?? '',
    });
    setErreurs({});
  }

  function annulerEdition() {
    setAbonnementEnEdition(null);
    setFormulaire(creerFormulaireVide());
    setErreurs({});
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

    const { erreurs: erreursValidation, donneesPropres } =
      validerAbonnement(formulaire);

    if (Object.keys(erreursValidation).length > 0) {
      setErreurs(erreursValidation);
      return;
    }

    setErreurs({});

    const reussite = abonnementEnEdition
      ? await onModifierAbonnement(
          entreprise,
          abonnementEnEdition.id,
          donneesPropres
        )
      : await onAjouterAbonnement(entreprise, donneesPropres);

    if (reussite) {
      setAbonnementEnEdition(null);
      setFormulaire(creerFormulaireVide());
    }
  }

  return (
    <section
      id="section-abonnements"
      className={abonnementEnEdition ? 'card card-editing' : 'card'}
      aria-label={`Abonnements de ${entreprise.nom}`}
    >
      <div className="list-header">
        <h2>Abonnements — {entreprise.nom}</h2>
        <button
          type="button"
          className="btn-secondary"
          onClick={onFermer}
          disabled={enCours}
        >
          Fermer
        </button>
      </div>

      {/* Historique des abonnements de l'entreprise */}
      {abonnements.length === 0 ? (
        <p className="empty-text admin-section-empty">
          Aucun abonnement enregistré pour cette entreprise.
        </p>
      ) : (
        <div className="table-wrapper admin-subtable-wrapper">
          <table className="client-table">
            <thead>
              <tr>
                <th>Formule</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Référence</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {abonnements.map((abonnement) => {
                const enRetard = estAbonnementEnRetard(abonnement);
                const estEnEdition = abonnementEnEdition?.id === abonnement.id;
                const classeBadge =
                  abonnement.statut_paiement === 'paye'
                    ? 'badge-paiement-paye'
                    : abonnement.statut_paiement === 'en_retard' || enRetard
                      ? 'badge-paiement-retard'
                      : 'badge-paiement-attente';

                return (
                  <tr
                    key={abonnement.id}
                    className={estEnEdition ? 'row-editing' : ''}
                  >
                    <td data-label="Formule">
                      <strong>{abonnement.formule}</strong>
                    </td>
                    <td data-label="Début">
                      {formaterDateFr(abonnement.date_debut)}
                    </td>
                    <td data-label="Fin">
                      {formaterDateFr(abonnement.date_fin)}
                    </td>
                    <td data-label="Montant">
                      {formaterMontantFcfa(abonnement.montant_fcfa)}
                    </td>
                    <td data-label="Paiement">
                      <span className={`badge-statut ${classeBadge}`}>
                        {LIBELLES_STATUT_PAIEMENT[abonnement.statut_paiement] ??
                          abonnement.statut_paiement}
                        {abonnement.statut_paiement === 'en_attente' && enRetard
                          ? ' (échu)'
                          : ''}
                      </span>
                    </td>
                    <td data-label="Référence">
                      {abonnement.reference || '—'}
                    </td>
                    <td data-label="Action">
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => demarrerEdition(abonnement)}
                          disabled={enCours}
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulaire d'ajout ou de modification d'un abonnement */}
      <div className="admin-subform-container">
        <h3 className="admin-subform-title">
          {abonnementEnEdition
            ? "Modifier l'abonnement"
            : 'Ajouter un abonnement'}
        </h3>

        <form className="client-form" onSubmit={gererSoumission} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="abo-formule">
                Formule <span className="required-star">*</span>
              </label>
              <input
                id="abo-formule"
                type="text"
                value={formulaire.formule}
                onChange={(e) => mettreAJourChamp('formule', e.target.value)}
                placeholder="Ex. Mensuel Standard"
                className={erreurs.formule ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.formule && (
                <p className="error-message">{erreurs.formule}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="abo-date-debut">
                Date de début <span className="required-star">*</span>
              </label>
              <input
                id="abo-date-debut"
                type="date"
                value={formulaire.date_debut}
                onChange={(e) => mettreAJourChamp('date_debut', e.target.value)}
                className={erreurs.date_debut ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.date_debut && (
                <p className="error-message">{erreurs.date_debut}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="abo-date-fin">
                Date de fin <span className="required-star">*</span>
              </label>
              <input
                id="abo-date-fin"
                type="date"
                value={formulaire.date_fin}
                min={formulaire.date_debut || undefined}
                onChange={(e) => mettreAJourChamp('date_fin', e.target.value)}
                className={erreurs.date_fin ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.date_fin && (
                <p className="error-message">{erreurs.date_fin}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="abo-montant">
                Montant (FCFA) <span className="required-star">*</span>
              </label>
              <input
                id="abo-montant"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={formulaire.montant_fcfa}
                onChange={(e) =>
                  mettreAJourChamp('montant_fcfa', e.target.value)
                }
                placeholder="Ex. 15000"
                className={erreurs.montant_fcfa ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.montant_fcfa && (
                <p className="error-message">{erreurs.montant_fcfa}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="abo-statut">
                Statut de paiement <span className="required-star">*</span>
              </label>
              <select
                id="abo-statut"
                value={formulaire.statut_paiement}
                onChange={(e) =>
                  mettreAJourChamp('statut_paiement', e.target.value)
                }
                className={erreurs.statut_paiement ? 'input-error' : ''}
                disabled={enCours}
              >
                {STATUTS_PAIEMENT.map((statut) => (
                  <option key={statut.valeur} value={statut.valeur}>
                    {statut.libelle}
                  </option>
                ))}
              </select>
              {erreurs.statut_paiement && (
                <p className="error-message">{erreurs.statut_paiement}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="abo-reference">Référence</label>
              <input
                id="abo-reference"
                type="text"
                value={formulaire.reference}
                onChange={(e) => mettreAJourChamp('reference', e.target.value)}
                placeholder="Ex. OM-2026-001"
                disabled={enCours}
              />
            </div>
          </div>

          {erreurServeur && (
            <p className="error-message" role="alert">
              {erreurServeur}
            </p>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={enCours}>
              {enCours
                ? 'Enregistrement...'
                : abonnementEnEdition
                  ? 'Enregistrer les modifications'
                  : "Ajouter l'abonnement"}
            </button>

            {abonnementEnEdition && (
              <button
                type="button"
                className="btn-secondary"
                onClick={annulerEdition}
                disabled={enCours}
              >
                Annuler la modification
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

export default AbonnementsPanel;
