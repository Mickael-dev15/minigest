// Page provisoire du tableau de bord Super admin (sera complétée au Lot 2)
import Header from '../components/Header.jsx';
import { useAuth } from '../context/useAuth.js';

function Admin() {
  const { profil } = useAuth();

  return (
    <div className="app">
      <Header />

      <main className="card admin-placeholder-card">
        <h2>Tableau de bord Super admin – Lot 2</h2>
        <p className="admin-placeholder-text">
          Bienvenue, <strong>{profil?.nom_complet ?? 'Super admin'}</strong>.
        </p>
        <p className="admin-placeholder-text">
          Cet espace accueillera prochainement la gestion des entreprises, des
          comptes utilisateurs, des abonnements et du journal d&apos;audit.
        </p>
      </main>

      <footer className="footer">MiniGest v2 — Administration</footer>
    </div>
  );
}

export default Admin;
