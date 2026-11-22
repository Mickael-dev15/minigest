// Composant d'en-tête : affiche le titre MiniGest et le nombre total de clients
function Header({ totalClients }) {
  return (
    <header className="header">
      <h1>MiniGest</h1>
      <p className="client-counter">Total clients : {totalClients}</p>
    </header>
  );
}

export default Header;
