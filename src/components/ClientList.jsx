// Composant qui affiche la liste des clients sous forme de tableau triable par colonne
// (ou de cartes sur mobile avec liste déroulante "Trier par"),
// ainsi que les filtres par statut et les boutons d'export / import CSV au-dessus de la liste
import ClientRow from './ClientRow.jsx';
import { OPTIONS_TRI_MOBILE } from '../utils/tri.js';

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
  tri,
  onTrierColonne,
  onChangerTri,
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

  // Gère le choix de tri dans la liste déroulante affichée sur mobile
  function gererChangementTriMobile(evenement) {
    const [colonne, ordre] = evenement.target.value.split(':');
    onChangerTri({ colonne, ordre });
  }

  // Construit un en-tête de colonne triable avec bouton cliquable, flèche et attribut aria-sort
  function rendreEnTeteTriable(colonne, libelle) {
    const estActive = tri.colonne === colonne;
    const ariaSort = estActive
      ? tri.ordre === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined;
    const fleche = estActive ? (tri.ordre === 'asc' ? '▲' : '▼') : '↕';

    return (
      <th aria-sort={ariaSort}>
        <button
          type="button"
          className={
            estActive
              ? 'sort-header-btn sort-header-btn-active'
              : 'sort-header-btn'
          }
          onClick={() => onTrierColonne(colonne)}
        >
          <span>{libelle}</span>
          <span
            className={
              estActive ? 'sort-icon sort-icon-active' : 'sort-icon'
            }
            aria-hidden="true"
          >
            {fleche}
          </span>
        </button>
      </th>
    );
  }

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

      {/* Message si aucun client à afficher, ou tableau / cartes des clients */}
      {clients.length === 0 ? (
        <p className="empty-text">
          {filtreActif ? 'Aucun client trouvé' : 'Aucun client enregistré'}
        </p>
      ) : (
        <>
          {/* Sélecteur de tri affiché uniquement sur mobile (sous 600 px), au-dessus des cartes */}
          <div className="mobile-sort">
            <label htmlFor="tri-mobile" className="mobile-sort-label">
              Trier par
            </label>
            <select
              id="tri-mobile"
              className="mobile-sort-select"
              value={`${tri.colonne}:${tri.ordre}`}
              onChange={gererChangementTriMobile}
            >
              {OPTIONS_TRI_MOBILE.map((option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ))}
            </select>
          </div>

          <div className="table-wrapper">
            <table className="client-table">
              <thead>
                <tr>
                  <th>N°</th>
                  {rendreEnTeteTriable('nom', 'Nom')}
                  {rendreEnTeteTriable('prenom', 'Prénom')}
                  {rendreEnTeteTriable('statut', 'Statut')}
                  <th>Téléphone</th>
                  <th>Email</th>
                  {rendreEnTeteTriable('ville', 'Ville')}
                  <th>Note</th>
                  {rendreEnTeteTriable('dateAjout', "Date d'ajout")}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, index) => (
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
        </>
      )}
    </section>
  );
}

export default ClientList;
