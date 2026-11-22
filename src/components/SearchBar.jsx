// Composant barre de recherche : filtre les clients en temps réel
function SearchBar({ recherche, onChangerRecherche, nbResultats, totalClients }) {
  const enRecherche = recherche.trim() !== '';

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
          placeholder="Rechercher par nom, prénom ou téléphone…"
          aria-label="Rechercher un client par nom, prénom ou téléphone"
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

      {/* Compteur affiché uniquement pendant une recherche active */}
      {enRecherche && (
        <p className="search-results-count">
          {nbResultats} {libelleResultat} sur {totalClients} {libelleClient}
        </p>
      )}
    </section>
  );
}

export default SearchBar;
