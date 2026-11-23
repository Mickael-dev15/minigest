// Composant formulaire contrôlé permettant d'ajouter ou de modifier un client avec validation
import { useState } from 'react';
import { validerClient } from '../utils/validation.js';
import { formaterTelephone } from '../utils/telephone.js';

function ClientForm({
  clients,
  clientEnEdition,
  messageSucces,
  onEffacerMessageSucces,
  onAjouterClient,
  onModifierClient,
  onAnnulerEdition,
}) {
  // Indique si le formulaire est actuellement en mode modification
  const enModeEdition = clientEnEdition !== null;

  // Un state par champ, initialisé avec les valeurs du client en édition (ou vide en mode ajout)
  const [nom, setNom] = useState(clientEnEdition ? clientEnEdition.nom : '');
  const [prenom, setPrenom] = useState(
    clientEnEdition ? clientEnEdition.prenom : ''
  );
  const [telephone, setTelephone] = useState(
    clientEnEdition ? formaterTelephone(clientEnEdition.telephone) : ''
  );
  const [email, setEmail] = useState(
    clientEnEdition ? clientEnEdition.email : ''
  );
  const [ville, setVille] = useState(
    clientEnEdition ? clientEnEdition.ville : ''
  );

  // State contenant les messages d'erreur par champ (ex. { nom: "Le nom est obligatoire" })
  const [erreurs, setErreurs] = useState({});

  // Efface le message d'erreur d'un champ précis dès que l'utilisateur le modifie
  function effacerErreurChamp(champ) {
    if (erreurs[champ]) {
      const nouvellesErreurs = { ...erreurs };
      delete nouvellesErreurs[champ];
      setErreurs(nouvellesErreurs);
    }
    if (messageSucces) {
      onEffacerMessageSucces();
    }
  }

  // Fonction appelée lors de la soumission du formulaire (ajout ou modification)
  function gererSoumission(event) {
    // Empêche le navigateur de recharger la page
    event.preventDefault();

    // En mode modification, on ignore l'id du client en cours pour lui permettre de garder son numéro
    const idIgnore = clientEnEdition ? clientEnEdition.id : null;

    // Valide et nettoie les champs avant tout enregistrement
    const { erreurs: nouvellesErreurs, donneesPropres } = validerClient(
      { nom, prenom, telephone, email, ville },
      clients,
      idIgnore
    );

    // S'il y a au moins une erreur, on affiche les messages et on bloque l'enregistrement
    if (Object.keys(nouvellesErreurs).length > 0) {
      setErreurs(nouvellesErreurs);
      onEffacerMessageSucces();
      return;
    }

    if (enModeEdition) {
      // Enregistre les modifications en conservant l'id et la dateAjout du client
      onModifierClient({
        ...clientEnEdition,
        ...donneesPropres,
      });
    } else {
      // Envoie les données nettoyées et formatées au composant parent (App)
      onAjouterClient(donneesPropres);

      // Vide tous les champs et les erreurs après un ajout réussi
      setNom('');
      setPrenom('');
      setTelephone('');
      setEmail('');
      setVille('');
      setErreurs({});
    }
  }

  return (
    <section
      id="formulaire-client"
      className={enModeEdition ? 'card card-editing' : 'card'}
    >
      <h2>{enModeEdition ? 'Modifier un client' : 'Ajouter un client'}</h2>

      {/* noValidate désactive les bulles du navigateur pour afficher nos propres erreurs en français */}
      <form className="client-form" onSubmit={gererSoumission} noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="nom">
              Nom <span className="required-star">*</span>
            </label>
            <input
              id="nom"
              type="text"
              className={erreurs.nom ? 'input-error' : ''}
              value={nom}
              onChange={(event) => {
                setNom(event.target.value);
                effacerErreurChamp('nom');
              }}
              placeholder="Ex. Diop"
            />
            {erreurs.nom && <p className="error-message">{erreurs.nom}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="prenom">
              Prénom <span className="required-star">*</span>
            </label>
            <input
              id="prenom"
              type="text"
              className={erreurs.prenom ? 'input-error' : ''}
              value={prenom}
              onChange={(event) => {
                setPrenom(event.target.value);
                effacerErreurChamp('prenom');
              }}
              placeholder="Ex. Awa"
            />
            {erreurs.prenom && <p className="error-message">{erreurs.prenom}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="telephone">
              Téléphone <span className="required-star">*</span>
            </label>
            <input
              id="telephone"
              type="tel"
              className={erreurs.telephone ? 'input-error' : ''}
              value={telephone}
              onChange={(event) => {
                setTelephone(event.target.value);
                effacerErreurChamp('telephone');
              }}
              placeholder="Ex. 77 123 45 67 ou +221 77 123 45 67"
            />
            {erreurs.telephone && (
              <p className="error-message">{erreurs.telephone}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={erreurs.email ? 'input-error' : ''}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                effacerErreurChamp('email');
              }}
              placeholder="Ex. awa.diop@exemple.sn"
            />
            {erreurs.email && <p className="error-message">{erreurs.email}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="ville">Ville</label>
            <input
              id="ville"
              type="text"
              value={ville}
              onChange={(event) => {
                setVille(event.target.value);
                effacerErreurChamp('ville');
              }}
              placeholder="Ex. Dakar"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {enModeEdition ? 'Enregistrer les modifications' : 'Ajouter'}
          </button>

          {/* Bouton Annuler affiché uniquement en mode modification */}
          {enModeEdition && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onAnnulerEdition}
            >
              Annuler
            </button>
          )}
        </div>

        {/* Message affiché uniquement si messageSucces contient du texte */}
        {messageSucces && <p className="success-message">{messageSucces}</p>}
      </form>
    </section>
  );
}

export default ClientForm;
