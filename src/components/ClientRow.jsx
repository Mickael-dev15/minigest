// Composant représentant une ligne (ou une carte sur mobile) pour un client
import {
  estTelephoneNormalise,
  formaterTelephone,
  lienWhatsApp,
} from '../utils/telephone.js';
import { STATUT_PAR_DEFAUT } from '../utils/validation.js';

// Message d'infobulle affiché quand un numéro n'est pas encore normalisé
const INFOBULLE_NUMERO_INVALIDE =
  'Numéro à corriger avant de contacter ce client';

// Nombre maximal de caractères affichés pour la note dans le tableau bureau
const LONGUEUR_APERCU_NOTE = 40;

// Associe chaque statut à sa classe CSS de couleur (Prospect = bleu cyan, Client = vert, Inactif = gris)
function obtenirClasseBadgeStatut(statut) {
  if (statut === 'Prospect') {
    return 'badge-statut-prospect';
  }
  if (statut === 'Inactif') {
    return 'badge-statut-inactif';
  }
  return 'badge-statut-client';
}

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

  // Valeurs propres du statut et de la note (toujours affichée en texte simple via JSX)
  const statut = client.statut || STATUT_PAR_DEFAUT;
  const note = typeof client.note === 'string' ? client.note : '';
  const noteApercu =
    note.length > LONGUEUR_APERCU_NOTE
      ? `${note.slice(0, LONGUEUR_APERCU_NOTE)}…`
      : note;

  // Demande confirmation avant de supprimer le client
  function gererSuppression() {
    const confirmation = window.confirm(
      `Voulez-vous vraiment supprimer ${client.nom.toUpperCase()} ${client.prenom} ?`
    );

    if (confirmation) {
      onSupprimerClient(client.id);
    }
  }

  // Boutons WhatsApp et Appeler (réutilisés en format compact sous le téléphone sur bureau,
  // et dans la grille d'actions des cartes sur mobile)
  function rendreBoutonsContact(classeSupplementaire) {
    if (telephoneValide && urlWhatsApp) {
      return (
        <>
          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn-whatsapp ${classeSupplementaire}`}
          >
            WhatsApp
          </a>
          <a
            href={`tel:${client.telephone}`}
            className={`btn-call ${classeSupplementaire}`}
          >
            Appeler
          </a>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          className={`btn-whatsapp ${classeSupplementaire}`}
          disabled
          title={INFOBULLE_NUMERO_INVALIDE}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={`btn-call ${classeSupplementaire}`}
          disabled
          title={INFOBULLE_NUMERO_INVALIDE}
        >
          Appeler
        </button>
      </>
    );
  }

  return (
    <tr className={estEnEdition ? 'row-editing' : ''}>
      {/* L'attribut data-label sert à afficher le nom de la colonne en mode carte sur mobile */}
      <td data-label="N°">{numero}</td>
      <td data-label="Nom">{client.nom}</td>
      <td data-label="Prénom">{client.prenom}</td>
      <td data-label="Statut">
        <span className={`badge-statut ${obtenirClasseBadgeStatut(statut)}`}>
          {statut}
        </span>
      </td>
      <td data-label="Téléphone" className="cell-phone">
        <div className="phone-cell-content">
          <span className="phone-number">
            {formaterTelephone(client.telephone)}
          </span>
          {/* Sur bureau, WhatsApp et Appeler sont regroupés en petits boutons sous le numéro */}
          <div className="phone-contact-actions">
            {rendreBoutonsContact('btn-contact-compact')}
          </div>
        </div>
      </td>
      <td
        data-label="Email"
        className="cell-email"
        title={client.email || undefined}
      >
        {client.email || '—'}
      </td>
      <td data-label="Ville">{client.ville || '—'}</td>
      {/* Affichage uniquement en texte via JSX (jamais de HTML) ; note complète au survol et sur mobile */}
      <td
        data-label="Note"
        className="cell-note"
        title={note !== '' ? note : undefined}
      >
        {note === '' ? (
          '—'
        ) : (
          <>
            <span className="note-apercu">{noteApercu}</span>
            <span className="note-complete">{note}</span>
          </>
        )}
      </td>
      <td data-label="Date d'ajout">{dateFormatee}</td>
      <td data-label="Action" className="cell-actions">
        <div className="action-buttons">
          {/* Sur mobile uniquement, WhatsApp et Appeler restent dans les cartes comme avant */}
          {rendreBoutonsContact('action-contact-mobile')}
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
