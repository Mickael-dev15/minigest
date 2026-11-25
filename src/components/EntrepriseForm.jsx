// Formulaire de création et de modification d'une entreprise
// (nom obligatoire, ville et pays facultatifs ; le statut n'est jamais modifié ici).
import { useState } from 'react';
import {
  PAYS,
  calculerChangementsEntreprise,
  validerEntreprise,
} from '../utils/admin.js';

function EntrepriseForm({
  entrepriseEnEdition = null,
  onCreerEntreprise,
  onModifierEntreprise,
  onAnnulerEdition,
  enCours,
  erreurServeur,
}) {
  const estEdition = Boolean(entrepriseEnEdition);
  const [nom, setNom] = useState(() => entrepriseEnEdition?.nom ?? '');
  const [ville, setVille] = useState(() => entrepriseEnEdition?.ville ?? '');
  const [pays, setPays] = useState(() => entrepriseEnEdition?.pays ?? '');
  const [erreurs, setErreurs] = useState({});
  const [messageInfo, setMessageInfo] = useState('');

  // Si une entreprise existante possède déjà une valeur libre hors liste PAYS,
  // on la conserve dans les options pour éviter de l'écraser involontairement.
  const paysActuelHorsListe =
    estEdition &&
    entrepriseEnEdition.pays &&
    !PAYS.includes(entrepriseEnEdition.pays)
      ? entrepriseEnEdition.pays
      : '';

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

    setMessageInfo('');

    const { erreurs: erreursValidation, donneesPropres } = validerEntreprise({
      nom,
      ville,
      pays,
    });

    if (Object.keys(erreursValidation).length > 0) {
      setErreurs(erreursValidation);
      return;
    }

    setErreurs({});

    if (estEdition) {
      const changements = calculerChangementsEntreprise(
        entrepriseEnEdition,
        donneesPropres
      );

      if (Object.keys(changements).length === 0) {
        setMessageInfo('Aucune modification');
        return;
      }

      await onModifierEntreprise(
        entrepriseEnEdition,
        donneesPropres,
        changements
      );
      return;
    }

    const reussite = await onCreerEntreprise(donneesPropres);
    if (reussite) {
      setNom('');
      setVille('');
      setPays('');
    }
  }

  return (
    <section
      id="form-entreprise"
      className={estEdition ? 'card card-editing' : 'card'}
      aria-label={
        estEdition ? "Modifier l'entreprise" : 'Créer une entreprise'
      }
    >
      <h2>
        {estEdition
          ? `Modifier l'entreprise — ${entrepriseEnEdition.nom}`
          : 'Nouvelle entreprise'}
      </h2>

      <form className="client-form" onSubmit={gererSoumission} noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="entreprise-nom">
              Nom <span className="required-star">*</span>
            </label>
            <input
              id="entreprise-nom"
              type="text"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                if (erreurs.nom) {
                  setErreurs((precedent) => ({ ...precedent, nom: '' }));
                }
                if (messageInfo) {
                  setMessageInfo('');
                }
              }}
              placeholder="Ex. Boutique Dakar"
              className={erreurs.nom ? 'input-error' : ''}
              disabled={enCours}
              required
            />
            {erreurs.nom && <p className="error-message">{erreurs.nom}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="entreprise-ville">Ville</label>
            <input
              id="entreprise-ville"
              type="text"
              value={ville}
              onChange={(e) => {
                setVille(e.target.value);
                if (messageInfo) {
                  setMessageInfo('');
                }
              }}
              placeholder="Ex. Dakar"
              disabled={enCours}
            />
          </div>

          <div className="form-group">
            <label htmlFor="entreprise-pays">Pays</label>
            <select
              id="entreprise-pays"
              value={pays}
              onChange={(e) => {
                setPays(e.target.value);
                if (messageInfo) {
                  setMessageInfo('');
                }
              }}
              disabled={enCours}
            >
              <option value="">— Choisir un pays —</option>
              {paysActuelHorsListe && (
                <option value={paysActuelHorsListe}>
                  {paysActuelHorsListe} (valeur actuelle)
                </option>
              )}
              {PAYS.map((nomPays) => (
                <option key={nomPays} value={nomPays}>
                  {nomPays}
                </option>
              ))}
            </select>
          </div>
        </div>

        {messageInfo && (
          <p className="field-info-message" role="status" aria-live="polite">
            {messageInfo}
          </p>
        )}

        {erreurServeur && (
          <p className="error-message" role="alert">
            {erreurServeur}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={enCours}>
            {enCours
              ? estEdition
                ? 'Enregistrement...'
                : 'Création en cours...'
              : estEdition
                ? 'Enregistrer les modifications'
                : "Créer l'entreprise"}
          </button>

          {estEdition && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onAnnulerEdition}
              disabled={enCours}
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default EntrepriseForm;
