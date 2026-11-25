// Formulaire de création d'une nouvelle entreprise (nom obligatoire, ville, pays).
import { useState } from 'react';
import { validerEntreprise } from '../utils/admin.js';

function EntrepriseForm({ onCreerEntreprise, enCours, erreurServeur }) {
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [pays, setPays] = useState('');
  const [erreurs, setErreurs] = useState({});

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

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
    const reussite = await onCreerEntreprise(donneesPropres);
    if (reussite) {
      setNom('');
      setVille('');
      setPays('');
    }
  }

  return (
    <section className="card" aria-label="Créer une entreprise">
      <h2>Nouvelle entreprise</h2>

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
              onChange={(e) => setVille(e.target.value)}
              placeholder="Ex. Dakar"
              disabled={enCours}
            />
          </div>

          <div className="form-group">
            <label htmlFor="entreprise-pays">Pays</label>
            <input
              id="entreprise-pays"
              type="text"
              value={pays}
              onChange={(e) => setPays(e.target.value)}
              placeholder="Ex. Sénégal"
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
            {enCours ? 'Création en cours...' : "Créer l'entreprise"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default EntrepriseForm;
