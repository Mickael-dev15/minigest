// Composant qui affiche la liste des clients sous forme de tableau trié par nom
import ClientRow from './ClientRow.jsx';

function ClientList({ clients, enRecherche, onSupprimerClient }) {
  // Si aucun client à afficher, on adapte le message selon qu'une recherche est active ou non
  if (clients.length === 0) {
    return (
      <section className="card">
        <h2>Liste des clients</h2>
        <p className="empty-text">
          {enRecherche ? 'Aucun client trouvé' : 'Aucun client enregistré'}
        </p>
      </section>
    );
  }

  // On crée une copie du tableau avec [...clients] avant de trier
  // (car .sort() modifie le tableau sur place et on ne doit jamais modifier le state directement)
  const clientsTries = [...clients].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
  );

  return (
    <section className="card">
      <h2>Liste des clients</h2>

      <div className="table-wrapper">
        <table className="client-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Ville</th>
              <th>Date d&apos;ajout</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {clientsTries.map((client, index) => (
              <ClientRow
                key={client.id}
                numero={index + 1}
                client={client}
                onSupprimerClient={onSupprimerClient}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ClientList;
