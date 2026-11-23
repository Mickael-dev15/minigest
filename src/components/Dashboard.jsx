// Composant du tableau de bord d'activité :
// calcule toutes les statistiques directement à partir de la liste complète des clients (valeurs dérivées).
import {
  calculerIndicateurs,
  calculerRepartitionStatuts,
  calculerTopVilles,
  calculerNouveauxClients6DerniersMois,
} from '../utils/statistiques.js';

function Dashboard({ clients, estVisible, onBasculerVisibilite }) {
  // Calcul direct des statistiques (valeurs dérivées, aucun state supplémentaire)
  const indicateurs = calculerIndicateurs(clients);
  const repartitionStatuts = calculerRepartitionStatuts(clients);
  const topVilles = calculerTopVilles(clients, 5);
  const nouveauxParMois = calculerNouveauxClients6DerniersMois(clients);

  return (
    <section className="card dashboard" aria-label="Tableau de bord d'activité">
      {/* En-tête de la section avec bouton Masquer / Afficher */}
      <div className="dashboard-header">
        <h2>Tableau de bord</h2>
        <button
          type="button"
          className="btn-secondary btn-toggle-dashboard"
          onClick={onBasculerVisibilite}
          aria-expanded={estVisible}
        >
          {estVisible
            ? 'Masquer le tableau de bord'
            : 'Afficher le tableau de bord'}
        </button>
      </div>

      {/* Contenu affiché uniquement lorsque le tableau de bord est déplié */}
      {estVisible && (
        <>
          {clients.length === 0 ? (
            <p className="empty-text">
              Ajoutez des clients pour voir les statistiques.
            </p>
          ) : (
            <div className="dashboard-content">
              {/* 4 cartes d'indicateurs clés */}
              <div className="kpi-grid">
                <div className="kpi-card kpi-card-total">
                  <span className="kpi-label">Total clients</span>
                  <strong className="kpi-value">
                    {indicateurs.totalClients}
                  </strong>
                </div>

                <div className="kpi-card kpi-card-nouveaux">
                  <span className="kpi-label">Nouveaux ce mois</span>
                  <strong className="kpi-value">
                    {indicateurs.nouveauxCeMois}
                  </strong>
                </div>

                <div className="kpi-card kpi-card-prospects">
                  <span className="kpi-label">Prospects</span>
                  <strong className="kpi-value">{indicateurs.prospects}</strong>
                </div>

                <div className="kpi-card kpi-card-inactifs">
                  <span className="kpi-label">Inactifs</span>
                  <strong className="kpi-value">{indicateurs.inactifs}</strong>
                </div>
              </div>

              {/* 3 graphiques en barres réalisés en CSS uniquement */}
              <div className="charts-grid">
                {/* Graphique 1 : Répartition par statut */}
                <div className="chart-card">
                  <h3 className="chart-title">Répartition par statut</h3>
                  <ul className="hbar-list">
                    {repartitionStatuts.map((item) => (
                      <li key={item.statut} className="hbar-item">
                        <div className="hbar-meta">
                          <span className="hbar-label">{item.statut}</span>
                          <span className="hbar-value">
                            {item.nombre} ({item.pourcentage} %)
                          </span>
                        </div>
                        <div className="hbar-track" aria-hidden="true">
                          <div
                            className={`hbar-fill hbar-fill-${item.cleCss}`}
                            style={{ width: `${item.largeurPourcent}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Graphique 2 : Top 5 des villes */}
                <div className="chart-card">
                  <h3 className="chart-title">Top 5 des villes</h3>
                  <ul className="hbar-list">
                    {topVilles.map((item) => (
                      <li key={item.cle} className="hbar-item">
                        <div className="hbar-meta">
                          <span className="hbar-label" title={item.ville}>
                            {item.ville}
                          </span>
                          <span className="hbar-value">{item.nombre}</span>
                        </div>
                        <div className="hbar-track" aria-hidden="true">
                          <div
                            className="hbar-fill hbar-fill-ville"
                            style={{ width: `${item.largeurPourcent}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Graphique 3 : Nouveaux clients sur les 6 derniers mois */}
                <div className="chart-card">
                  <h3 className="chart-title">
                    Nouveaux clients (6 derniers mois)
                  </h3>
                  <div className="vbar-chart">
                    {nouveauxParMois.map((mois) => (
                      <div key={mois.cle} className="vbar-col">
                        <span className="vbar-value">{mois.nombre}</span>
                        <div className="vbar-track" aria-hidden="true">
                          <div
                            className="vbar-fill"
                            style={{ height: `${mois.hauteurPourcent}%` }}
                          />
                        </div>
                        <span className="vbar-label">{mois.libelle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Dashboard;
