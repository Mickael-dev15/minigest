// Composant représentant une ligne (ou une carte sur mobile) pour un client
import {
  estTelephoneNormalise,
  formaterTelephone,
  lienWhatsApp,
} from '../utils/telephone.js';

// Message d'infobulle affiché quand un numéro n'est pas encore normalisé
const INFOBULLE_NUMERO_INVALIDE =
  'Numéro à corriger avant de contacter ce client';

function ClientRow({
  numero,
  client,
  estEnEdition,
  onEditerClient,
  onSupprimerClient,
}) {
  // Transforme la date ISO en format français jj/mm/aaaa
  const dateFormatee = new Date(client.dateAjout).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Vérifie si le numéro est normalisé afin d'activer ou non les boutons de contact
  const telephoneValide = estTelephoneNormalise(client.telephone);
  const urlWhatsApp = lienWhatsApp(client);

  // Demande confirmation avant de supprimer le client
  function gererSuppression() {
    const confirmation = window.confirm(
      `Voulez-vous vraiment supprimer ${client.nom.toUpperCase()} ${client.prenom} ?`
    );

    if (confirmation) {
      onSupprimerClient(client.id);
    }
  }

  return (
    <tr className={estEnEdition ? 'row-editing' : ''}>
      {/* L'attribut data-label sert à afficher le nom de la colonne en mode carte sur mobile */}
      <td data-label="N°">{numero}</td>
      <td data-label="Nom">{client.nom}</td>
      <td data-label="Prénom">{client.prenom}</td>
      <td data-label="Téléphone">{formaterTelephone(client.telephone)}</td>
      <td data-label="Email">{client.email || '—'}</td>
      <td data-label="Ville">{client.ville || '—'}</td>
      <td data-label="Date d'ajout">{dateFormatee}</td>
      <td data-label="Action">
        <div className="action-buttons">
          {/* Si le numéro est normalisé, on affiche de vrais liens <a> ; sinon des <button disabled> grisés */}
          {telephoneValide && urlWhatsApp ? (
            <>
              <a
                href={urlWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
              >
                WhatsApp
              </a>
              <a href={`tel:${client.telephone}`} className="btn-call">
                Appeler
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-whatsapp"
                disabled
                title={INFOBULLE_NUMERO_INVALIDE}
              >
                WhatsApp
              </button>
              <button
                type="button"
                className="btn-call"
                disabled
                title={INFOBULLE_NUMERO_INVALIDE}
              >
                Appeler
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-edit"
            onClick={() => onEditerClient(client)}
          >
            Modifier
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={gererSuppression}
          >
            Supprimer
          </button>
        </div>
      </td>
    </tr>
  );
}

export default ClientRow;
