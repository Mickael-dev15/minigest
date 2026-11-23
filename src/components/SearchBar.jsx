// Composant barre de recherche : filtre les clients en temps réel (nom, prénom, téléphone et note)
function SearchBar({
  recherche,
  onChangerRecherche,
  nbResultats,
  totalClients,
  filtreStatut = 'Tous',
}) {
  const enRecherche = recherche.trim() !== '';
  const filtreActif = enRecherche || filtreStatut !== 'Tous';

  // Accord singulier / pluriel pour l'affichage du compteur de résultats
  const libelleResultat = nbResultats > 1 ? 'résultats' : 'résultat';
  const libelleClient = totalClients > 1 ? 'clients' : 'client';

  return (
    <section className="card search-bar">
      <div className="search-input-group">
        <input
          type="text"
          className="search-input"
          value={recherche}
          onChange={(event) => onChangerRecherche(event.target.value)}
          placeholder="Rechercher par nom, prénom, téléphone ou note…"
          aria-label="Rechercher un client par nom, prénom, téléphone ou note"
        />

        {/* Bouton affiché uniquement lorsqu'une recherche est saisie */}
        {recherche !== '' && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onChangerRecherche('')}
          >
            Effacer
          </button>
        )}
      </div>

      {/* Compteur affiché lorsqu'une recherche ou un filtre de statut est actif */}
      {filtreActif && (
        <p className="search-results-count">
          {nbResultats} {libelleResultat} sur {totalClients} {libelleClient}
        </p>
      )}
    </section>
  );
}

export default SearchBar;
