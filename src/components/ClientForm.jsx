// Composant formulaire contrôlé permettant d'ajouter un nouveau client avec validation
import { useState } from 'react';
import { validerClient } from '../utils/validation.js';

function ClientForm({ clients, onAjouterClient }) {
  // Un state par champ du formulaire (formulaire contrôlé par React)
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [ville, setVille] = useState('');

  // State contenant les messages d'erreur par champ (ex. { nom: "Le nom est obligatoire" })
  const [erreurs, setErreurs] = useState({});

  // State pour afficher le message de confirmation après un ajout réussi
  const [messageSucces, setMessageSucces] = useState('');

  // Efface le message d'erreur d'un champ précis dès que l'utilisateur le modifie
  function effacerErreurChamp(champ) {
    if (erreurs[champ]) {
      const nouvellesErreurs = { ...erreurs };
      delete nouvellesErreurs[champ];
      setErreurs(nouvellesErreurs);
    }
    if (messageSucces) {
      setMessageSucces('');
    }
  }

  // Fonction appelée lors du clic sur "Ajouter" (ou touche Entrée)
  function gererSoumission(event) {
    // Empêche le navigateur de recharger la page
    event.preventDefault();

    // Valide et nettoie les champs avant tout ajout
    const { erreurs: nouvellesErreurs, donneesPropres } = validerClient(
      { nom, prenom, telephone, email, ville },
      clients
    );

    // S'il y a au moins une erreur, on affiche les messages et on bloque l'ajout
    if (Object.keys(nouvellesErreurs).length > 0) {
      setErreurs(nouvellesErreurs);
      setMessageSucces('');
      return;
    }

    // Envoie les données nettoyées et formatées au composant parent (App)
    onAjouterClient(donneesPropres);

    // Vide tous les champs et les erreurs après un ajout réussi
    setNom('');
    setPrenom('');
    setTelephone('');
    setEmail('');
    setVille('');
    setErreurs({});

    // Affiche le message de confirmation
    setMessageSucces('Client ajouté avec succès');
  }

  return (
    <section className="card">
      <h2>Ajouter un client</h2>

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
              placeholder="Ex. 771234567 ou +221771234567"
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

        <button type="submit" className="btn-primary">
          Ajouter
        </button>

        {/* Message affiché uniquement si messageSucces contient du texte */}
        {messageSucces && <p className="success-message">{messageSucces}</p>}
      </form>
    </section>
  );
}

export default ClientForm;
