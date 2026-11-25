// Cartes d'indicateurs clés affichées en haut du tableau de bord Super admin (/admin).

function AdminKpis({ indicateurs }) {
  return (
    <section className="card" aria-label="Indicateurs de la plateforme">
      <h2>Vue d&apos;ensemble</h2>

      <div className="kpi-grid admin-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Entreprises</span>
          <strong className="kpi-value">{indicateurs.totalEntreprises}</strong>
        </div>

        <div className="kpi-card kpi-card-nouveaux">
          <span className="kpi-label">Actives</span>
          <strong className="kpi-value">
            {indicateurs.entreprisesActives}
          </strong>
        </div>

        <div className="kpi-card kpi-card-suspendues">
          <span className="kpi-label">Suspendues</span>
          <strong className="kpi-value">
            {indicateurs.entreprisesSuspendues}
          </strong>
        </div>

        <div className="kpi-card kpi-card-prospects">
          <span className="kpi-label">Total clients</span>
          <strong className="kpi-value">{indicateurs.totalClients}</strong>
        </div>

        <div className="kpi-card kpi-card-retard">
          <span className="kpi-label">Abonnements en retard</span>
          <strong className="kpi-value">
            {indicateurs.abonnementsEnRetard}
          </strong>
        </div>
      </div>
    </section>
  );
}

export default AdminKpis;
