// Formulaire d'ajout d'un employé par le gérant (section "Mon équipe" sur /app).
// Appelle l'Edge Function `gerer-equipe` (action "creer") via la prop onCreerEmploye.
// Le mot de passe temporaire est vidé dès que la création réussit et n'est jamais journalisé.
import { useState } from 'react';
import { LONGUEUR_MIN_MOT_DE_PASSE } from '../utils/admin.js';
import { validerNouvelEmploye } from '../utils/equipe.js';

function EmployeForm({ onCreerEmploye, enCours, erreurServeur }) {
  const [nomComplet, setNomComplet] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasseTemporaire, setMotDePasseTemporaire] = useState('');
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [erreurs, setErreurs] = useState({});

  function effacerErreurChamp(champ) {
    if (erreurs[champ]) {
      setErreurs((precedent) => ({ ...precedent, [champ]: '' }));
    }
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    if (enCours) {
      return;
    }

    const { erreurs: erreursValidation, donneesPropres } = validerNouvelEmploye(
      {
        nom_complet: nomComplet,
        email,
        mot_de_passe_temporaire: motDePasseTemporaire,
      }
    );

    if (Object.keys(erreursValidation).length > 0) {
      setErreurs(erreursValidation);
      return;
    }

    setErreurs({});
    const reussite = await onCreerEmploye(donneesPropres);
    if (reussite) {
      // Réinitialise complètement le formulaire, en particulier le mot de passe temporaire
      setNomComplet('');
      setEmail('');
      setMotDePasseTemporaire('');
      setAfficherMotDePasse(false);
    }
  }

  return (
    <div className="admin-subform-container user-form-container">
      <h3 className="admin-subform-title">Ajouter un employé</h3>

      <form className="client-form" onSubmit={gererSoumission} noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="employe-nom">
              Nom complet <span className="required-star">*</span>
            </label>
            <input
              id="employe-nom"
              type="text"
              value={nomComplet}
              onChange={(e) => {
                setNomComplet(e.target.value);
                effacerErreurChamp('nom_complet');
              }}
              placeholder="Ex. Fatou Ndiaye"
              className={erreurs.nom_complet ? 'input-error' : ''}
              disabled={enCours}
              required
            />
            {erreurs.nom_complet && (
              <p className="error-message">{erreurs.nom_complet}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="employe-email">
              Email <span className="required-star">*</span>
            </label>
            <input
              id="employe-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                effacerErreurChamp('email');
              }}
              placeholder="Ex. fatou@boutique-dakar.test"
              autoComplete="off"
              className={erreurs.email ? 'input-error' : ''}
              disabled={enCours}
              required
            />
            {erreurs.email && <p className="error-message">{erreurs.email}</p>}
          </div>

          <div className="form-group user-password-group">
            <label htmlFor="employe-mot-de-passe">
              Mot de passe temporaire ({LONGUEUR_MIN_MOT_DE_PASSE} car. min.){' '}
              <span className="required-star">*</span>
            </label>
            <div className="password-input-row">
              <input
                id="employe-mot-de-passe"
                type={afficherMotDePasse ? 'text' : 'password'}
                value={motDePasseTemporaire}
                onChange={(e) => {
                  setMotDePasseTemporaire(e.target.value);
                  effacerErreurChamp('mot_de_passe_temporaire');
                }}
                placeholder="Au moins 12 caractères"
                minLength={LONGUEUR_MIN_MOT_DE_PASSE}
                autoComplete="new-password"
                className={
                  erreurs.mot_de_passe_temporaire ? 'input-error' : ''
                }
                disabled={enCours}
                required
              />
              <button
                type="button"
                className="btn-secondary btn-toggle-password"
                onClick={() => setAfficherMotDePasse((visible) => !visible)}
                disabled={enCours}
              >
                {afficherMotDePasse ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <span className="field-help-text">
              Le nouveau compte sera créé avec le rôle Employé. Transmettez ce
              mot de passe temporaire de façon sécurisée ; il ne sera plus
              affiché après création.
            </span>
            {erreurs.mot_de_passe_temporaire && (
              <p className="error-message">{erreurs.mot_de_passe_temporaire}</p>
            )}
          </div>
        </div>

        {erreurServeur && (
          <p className="error-message" role="alert">
            {erreurServeur}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={enCours}>
            {enCours ? 'Ajout en cours...' : "Ajouter l'employé"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmployeForm;
