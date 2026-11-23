// Composant qui affiche la liste des clients sous forme de tableau trié par nom,
// ainsi que les boutons d'export et d'import CSV au-dessus de la liste
import ClientRow from './ClientRow.jsx';

function ClientList({
  clients,
  totalClients,
  enRecherche,
  idClientEnEdition,
  bilanImport,
  onEditerClient,
  onSupprimerClient,
  onExporterCSV,
  onImporterCSV,
  onFermerBilanImport,
}) {
  // Ouvre la fenêtre du système pour choisir un fichier .csv
  function ouvrirSelecteurFichier() {
    const champFichier = document.getElementById('import-csv');
    if (champFichier) {
      champFichier.click();
    }
  }

  // Transmet le fichier sélectionné à App, puis réinitialise le champ pour autoriser un nouvel import du même fichier
  function gererChoixFichier(evenement) {
    const fichier = evenement.target.files?.[0];
    if (fichier) {
      onImporterCSV(fichier);
    }
    evenement.target.value = '';
  }

  // On crée une copie du tableau avec [...clients] avant de trier
  // (car .sort() modifie le tableau sur place et on ne doit jamais modifier le state directement)
  const clientsTries = [...clients].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
  );

  // Détermine le style visuel du bilan d'import (rouge = erreur, vert = tout importé, orange = lignes ignorées)
  let classeBilan = 'import-report-success';
  if (bilanImport?.erreur) {
    classeBilan = 'import-report-error';
  } else if (bilanImport && bilanImport.lignesIgnorees.length > 0) {
    classeBilan = 'import-report-warning';
  }

  return (
    <section className="card">
      {/* En-tête de la liste avec les boutons Export / Import CSV */}
      <div className="list-header">
        <h2>Liste des clients</h2>

        <div className="csv-actions">
          <button
            type="button"
            className="btn-primary btn-csv"
            onClick={onExporterCSV}
            disabled={totalClients === 0}
          >
            Exporter (CSV)
          </button>

          <button
            type="button"
            className="btn-secondary btn-csv"
            onClick={ouvrirSelecteurFichier}
          >
            Importer (CSV)
          </button>

          {/* Champ fichier caché déclenché par le bouton "Importer (CSV)" */}
          <input
            id="import-csv"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={gererChoixFichier}
          />
        </div>
      </div>

      {/* Bilan ou message d'erreur affiché après un import CSV */}
      {bilanImport && (
        <div className={`import-report ${classeBilan}`} role="status">
          <div className="import-report-header">
            <p className="import-report-summary">
              {bilanImport.erreur
                ? bilanImport.erreur
                : `${bilanImport.nbImportes} client(s) importé(s), ${bilanImport.lignesIgnorees.length} ligne(s) ignorée(s)`}
            </p>
            <button
              type="button"
              className="btn-close-report"
              onClick={onFermerBilanImport}
            >
              Fermer
            </button>
          </div>

          {!bilanImport.erreur && bilanImport.lignesIgnorees.length > 0 && (
            <ul className="import-report-list">
              {bilanImport.lignesIgnorees.map((ligne, index) => (
                <li key={`${ligne.numeroLigne}-${index}`}>
                  Ligne {ligne.numeroLigne} : {ligne.raison}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Message si aucun client à afficher, ou tableau des clients */}
      {clients.length === 0 ? (
        <p className="empty-text">
          {enRecherche ? 'Aucun client trouvé' : 'Aucun client enregistré'}
        </p>
      ) : (
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
                  estEnEdition={client.id === idClientEnEdition}
                  onEditerClient={onEditerClient}
                  onSupprimerClient={onSupprimerClient}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ClientList;
