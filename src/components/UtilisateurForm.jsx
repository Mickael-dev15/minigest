// Formulaire de création d'un compte utilisateur (gérant ou employé) par le Super admin.
// Appelle l'Edge Function `creer-utilisateur` via la prop onCreerUtilisateur.
// Le mot de passe temporaire est vidé dès que la création réussit et n'est jamais journalisé.
import { useState } from 'react';
import {
  LONGUEUR_MIN_MOT_DE_PASSE,
  ROLES_UTILISATEUR_CREABLES,
  validerNouvelUtilisateur,
} from '../utils/admin.js';

function UtilisateurForm({
  entreprises,
  onCreerUtilisateur,
  enCours,
  erreurServeur,
}) {
  const entreprisesActives = entreprises.filter(
    (entreprise) => entreprise.statut === 'active'
  );

  const [entrepriseId, setEntrepriseId] = useState('');
  const [nomComplet, setNomComplet] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employe');
  const [motDePasseTemporaire, setMotDePasseTemporaire] = useState('');
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [erreurs, setErreurs] = useState({});

  // Si l'entreprise sélectionnée vient d'être suspendue, on évite d'envoyer un ID invalide
  const entrepriseSelectionneeEstActive = entreprisesActives.some(
    (entreprise) => entreprise.id === entrepriseId
  );
  const valeurEntreprise = entrepriseSelectionneeEstActive ? entrepriseId : '';

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

    const { erreurs: erreursValidation, donneesPropres } =
      validerNouvelUtilisateur({
        entreprise_id: valeurEntreprise,
        nom_complet: nomComplet,
        email,
        role,
        mot_de_passe_temporaire: motDePasseTemporaire,
      });

    if (Object.keys(erreursValidation).length > 0) {
      setErreurs(erreursValidation);
      return;
    }

    setErreurs({});
    const reussite = await onCreerUtilisateur(donneesPropres);
    if (reussite) {
      // Réinitialise complètement le formulaire, en particulier le mot de passe temporaire
      setNomComplet('');
      setEmail('');
      setRole('employe');
      setMotDePasseTemporaire('');
      setAfficherMotDePasse(false);
    }
  }

  const aucuneEntrepriseActive = entreprisesActives.length === 0;

  return (
    <div className="admin-subform-container user-form-container">
      <h3 className="admin-subform-title">Créer un compte utilisateur</h3>

      {aucuneEntrepriseActive ? (
        <p className="empty-text">
          Aucune entreprise active disponible. Créez ou réactivez une entreprise
          avant d&apos;ajouter un utilisateur.
        </p>
      ) : (
        <form className="client-form" onSubmit={gererSoumission} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="utilisateur-entreprise">
                Entreprise active <span className="required-star">*</span>
              </label>
              <select
                id="utilisateur-entreprise"
                value={valeurEntreprise}
                onChange={(e) => {
                  setEntrepriseId(e.target.value);
                  effacerErreurChamp('entreprise_id');
                }}
                className={erreurs.entreprise_id ? 'input-error' : ''}
                disabled={enCours}
                required
              >
                <option value="">— Choisir une entreprise —</option>
                {entreprisesActives.map((entreprise) => (
                  <option key={entreprise.id} value={entreprise.id}>
                    {entreprise.nom}
                  </option>
                ))}
              </select>
              {erreurs.entreprise_id && (
                <p className="error-message">{erreurs.entreprise_id}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="utilisateur-nom">
                Nom complet <span className="required-star">*</span>
              </label>
              <input
                id="utilisateur-nom"
                type="text"
                value={nomComplet}
                onChange={(e) => {
                  setNomComplet(e.target.value);
                  effacerErreurChamp('nom_complet');
                }}
                placeholder="Ex. Aminata Diallo"
                className={erreurs.nom_complet ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.nom_complet && (
                <p className="error-message">{erreurs.nom_complet}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="utilisateur-email">
                Email <span className="required-star">*</span>
              </label>
              <input
                id="utilisateur-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  effacerErreurChamp('email');
                }}
                placeholder="Ex. aminata@boutique-dakar.test"
                autoComplete="off"
                className={erreurs.email ? 'input-error' : ''}
                disabled={enCours}
                required
              />
              {erreurs.email && (
                <p className="error-message">{erreurs.email}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="utilisateur-role">
                Rôle <span className="required-star">*</span>
              </label>
              <select
                id="utilisateur-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  effacerErreurChamp('role');
                }}
                className={erreurs.role ? 'input-error' : ''}
                disabled={enCours}
                required
              >
                {ROLES_UTILISATEUR_CREABLES.map((option) => (
                  <option key={option.valeur} value={option.valeur}>
                    {option.libelle}
                  </option>
                ))}
              </select>
              {erreurs.role && <p className="error-message">{erreurs.role}</p>}
            </div>

            <div className="form-group user-password-group">
              <label htmlFor="utilisateur-mot-de-passe">
                Mot de passe temporaire ({LONGUEUR_MIN_MOT_DE_PASSE} car. min.){' '}
                <span className="required-star">*</span>
              </label>
              <div className="password-input-row">
                <input
                  id="utilisateur-mot-de-passe"
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
                Transmettez ce mot de passe temporaire de façon sécurisée ; il
                ne sera plus affiché après création.
              </span>
              {erreurs.mot_de_passe_temporaire && (
                <p className="error-message">
                  {erreurs.mot_de_passe_temporaire}
                </p>
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
              {enCours ? 'Création en cours...' : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default UtilisateurForm;
