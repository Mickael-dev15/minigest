// Composant représentant une ligne (ou une carte sur mobile) pour un client
function ClientRow({ numero, client, onSupprimerClient }) {
  // Transforme la date ISO en format français jj/mm/aaaa
  const dateFormatee = new Date(client.dateAjout).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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
    <tr>
      {/* L'attribut data-label sert à afficher le nom de la colonne en mode carte sur mobile */}
      <td data-label="N°">{numero}</td>
      <td data-label="Nom">{client.nom}</td>
      <td data-label="Prénom">{client.prenom}</td>
      <td data-label="Téléphone">{client.telephone}</td>
      <td data-label="Email">{client.email || '—'}</td>
      <td data-label="Ville">{client.ville || '—'}</td>
      <td data-label="Date d'ajout">{dateFormatee}</td>
      <td data-label="Action">
        <button type="button" className="btn-danger" onClick={gererSuppression}>
          Supprimer
        </button>
      </td>
    </tr>
  );
}

export default ClientRow;
