// Composant qui affiche la liste des clients sous forme de tableau trié par nom,
// ainsi que les filtres par statut et les boutons d'export / import CSV au-dessus de la liste
import ClientRow from './ClientRow.jsx';

// Définition des boutons de filtre par statut affichés au-dessus de la liste
const OPTIONS_FILTRE_STATUT = [
  { valeur: 'Tous', libelle: 'Tous' },
  { valeur: 'Prospect', libelle: 'Prospects' },
  { valeur: 'Client', libelle: 'Clients' },
  { valeur: 'Inactif', libelle: 'Inactifs' },
];

function ClientList({
  clients,
  totalClients,
  enRecherche,
  filtreStatut,
  compteursStatut,
  onChangerFiltreStatut,
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

  // Détermine le style visuel du bilan d'import (rouge = erreur, vert = tout importé, orange = lignes ignorées ou avertissements)
  const avertissements = bilanImport?.avertissements ?? [];
  let classeBilan = 'import-report-success';
  if (bilanImport?.erreur) {
    classeBilan = 'import-report-error';
  } else if (
    bilanImport &&
    (bilanImport.lignesIgnorees.length > 0 || avertissements.length > 0)
  ) {
    classeBilan = 'import-report-warning';
  }

  const filtreActif = enRecherche || filtreStatut !== 'Tous';

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

      {/* Boutons de filtre par statut avec compteur calculé pour chaque catégorie */}
      <div
        className="status-filters"
        role="group"
        aria-label="Filtrer les clients par statut"
      >
        {OPTIONS_FILTRE_STATUT.map((option) => {
          const estActif = filtreStatut === option.valeur;
          const nombre = compteursStatut[option.valeur] ?? 0;

          return (
            <button
              key={option.valeur}
              type="button"
              className={
                estActif
                  ? `status-filter-btn status-filter-active status-filter-${option.valeur.toLowerCase()}`
                  : `status-filter-btn status-filter-${option.valeur.toLowerCase()}`
              }
              aria-pressed={estActif}
              onClick={() => onChangerFiltreStatut(option.valeur)}
            >
              {option.libelle} ({nombre})
            </button>
          );
        })}
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

          {!bilanImport.erreur &&
            (avertissements.length > 0 ||
              bilanImport.lignesIgnorees.length > 0) && (
              <ul className="import-report-list">
                {avertissements.map((avertissement, index) => (
                  <li key={`avert-${avertissement.numeroLigne}-${index}`}>
                    Ligne {avertissement.numeroLigne} : {avertissement.message}
                  </li>
                ))}
                {bilanImport.lignesIgnorees.map((ligne, index) => (
                  <li key={`ignore-${ligne.numeroLigne}-${index}`}>
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
          {filtreActif ? 'Aucun client trouvé' : 'Aucun client enregistré'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="client-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Statut</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Ville</th>
                <th>Note</th>
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
