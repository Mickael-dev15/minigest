// Composant principal de l'application MiniGest
import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header.jsx';
import ClientForm from './components/ClientForm.jsx';
import SearchBar from './components/SearchBar.jsx';
import ClientList from './components/ClientList.jsx';
import { chargerClients, sauvegarderClients } from './utils/storage.js';
import { validerClient } from './utils/validation.js';
import {
  formaterTelephone,
  nettoyerRechercheTelephone,
} from './utils/telephone.js';
import {
  exporterCSV,
  importerCSV,
  obtenirNomFichierExport,
} from './utils/csv.js';

// Supprime les accents et met le texte en minuscules pour comparer facilement
function normaliserTexte(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function App() {
  // Charge la liste des clients depuis localStorage une seule fois au démarrage
  const [clients, setClients] = useState(() => chargerClients());

  // State contenant le texte tapé dans la barre de recherche
  const [recherche, setRecherche] = useState('');

  // State contenant le client en cours de modification (null lorsqu'on est en mode ajout)
  const [clientEnEdition, setClientEnEdition] = useState(null);

  // State pour afficher le message de succès vert après un ajout ou une modification
  const [messageSucces, setMessageSucces] = useState('');

  // State pour afficher le bilan (ou l'erreur) après un import CSV
  const [bilanImport, setBilanImport] = useState(null);

  // Sauvegarde automatiquement dans localStorage à chaque modification de la liste
  useEffect(() => {
    sauvegarderClients(clients);
  }, [clients]);

  // Ajoute un nouveau client en lui générant un identifiant unique et la date d'ajout
  function ajouterClient(donneesClient) {
    const nouveauClient = {
      id: crypto.randomUUID(),
      ...donneesClient,
      dateAjout: new Date().toISOString(),
    };

    // On crée un nouveau tableau sans modifier le state directement
    setClients([...clients, nouveauClient]);
    setMessageSucces('Client ajouté avec succès');
  }

  // Passe le formulaire en mode modification pour le client sélectionné et remonte vers le formulaire
  function demarrerEdition(client) {
    setClientEnEdition(client);
    setMessageSucces('');

    const formulaire = document.getElementById('formulaire-client');
    if (formulaire) {
      formulaire.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Quitte le mode modification sans rien changer
  function annulerEdition() {
    setClientEnEdition(null);
    setMessageSucces('');
  }

  // Met à jour un seul client dans la liste grâce à map(), sans modifier le state directement
  function modifierClient(clientModifie) {
    setClients(
      clients.map((client) => {
        if (client.id === clientModifie.id) {
          // On remplace uniquement les champs modifiés tout en conservant l'id et la dateAjout d'origine
          return {
            ...client,
            ...clientModifie,
            id: client.id,
            dateAjout: client.dateAjout,
          };
        }
        return client;
      })
    );

    // Retourne au mode ajout avec le message de confirmation
    setClientEnEdition(null);
    setMessageSucces('Client modifié avec succès');
  }

  // Supprime le client correspondant à l'identifiant donné grâce à filter()
  function supprimerClient(id) {
    // filter() renvoie un nouveau tableau contenant tous les clients sauf celui à supprimer
    setClients(clients.filter((client) => client.id !== id));

    // Si le client supprimé était en cours de modification, on quitte le mode édition
    if (clientEnEdition && clientEnEdition.id === id) {
      setClientEnEdition(null);
      setMessageSucces('');
    }
  }

  // Exporte tous les clients enregistrés dans un fichier CSV téléchargé par le navigateur
  function exporterClientsCSV() {
    if (clients.length === 0) {
      return;
    }

    const contenuCSV = exporterCSV(clients);
    const fichierBlob = new Blob([contenuCSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(fichierBlob);

    const lien = document.createElement('a');
    lien.href = url;
    lien.download = obtenirNomFichierExport();
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  // Lit un fichier CSV choisi par l'utilisateur, valide chaque ligne et ajoute les clients valides
  function importerClientsCSV(fichier) {
    if (!fichier) {
      return;
    }

    const lecteur = new FileReader();

    lecteur.onerror = () => {
      setBilanImport({
        erreur:
          "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier CSV valide.",
        nbImportes: 0,
        lignesIgnorees: [],
      });
    };

    lecteur.onload = () => {
      const texte = typeof lecteur.result === 'string' ? lecteur.result : '';
      const resultat = importerCSV(texte);

      // Si le fichier est vide, illisible ou n'a pas les bonnes colonnes, on ne modifie rien
      if (resultat.erreur) {
        setBilanImport({
          erreur: resultat.erreur,
          nbImportes: 0,
          lignesIgnorees: [],
        });
        return;
      }

      // Copie de référence pour détecter les doublons aussi bien avec la liste existante qu'au sein du fichier
      const clientsDeReference = [...clients];
      const nouveauxClients = [];
      const lignesIgnorees = [];

      for (const ligne of resultat.lignes) {
        if (ligne.tropDeColonnes) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: 'Nombre de colonnes incorrect (6 colonnes attendues)',
          });
          continue;
        }

        if (ligne.telephoneAbimeExcel) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: 'Téléphone abîmé par Excel : ressaisir le numéro',
          });
          continue;
        }

        // Chaque ligne passe par la même fonction validerClient que le formulaire
        const { erreurs, donneesPropres } = validerClient(
          ligne,
          clientsDeReference
        );
        const messagesErreurs = Object.values(erreurs);

        if (messagesErreurs.length > 0) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: messagesErreurs.join(' ; '),
          });
          continue;
        }

        const nouveauClient = {
          id: crypto.randomUUID(),
          ...donneesPropres,
          dateAjout: ligne.dateAjout,
        };

        nouveauxClients.push(nouveauClient);
        clientsDeReference.push(nouveauClient);
      }

      // On ajoute les clients importés à la liste existante sans jamais remplacer ni modifier le state directement
      if (nouveauxClients.length > 0) {
        setClients([...clients, ...nouveauxClients]);
      }

      setBilanImport({
        erreur: null,
        nbImportes: nouveauxClients.length,
        lignesIgnorees,
      });
    };

    lecteur.readAsText(fichier, 'UTF-8');
  }

  // Détecte les éventuels doublons de téléphone (ex. apparus après migration) sans rien supprimer
  const groupesParTelephone = {};
  for (const client of clients) {
    const cleTelephone = String(client.telephone ?? '').trim();
    if (cleTelephone === '') {
      continue;
    }
    if (!groupesParTelephone[cleTelephone]) {
      groupesParTelephone[cleTelephone] = [];
    }
    groupesParTelephone[cleTelephone].push(client);
  }

  const doublonsTelephone = Object.entries(groupesParTelephone)
    .filter(([, liste]) => liste.length > 1)
    .map(([numero, liste]) => ({
      numero,
      clients: liste,
    }));

  // Calcul direct de la liste filtrée (valeur dérivée, pas besoin d'un second state)
  const rechercheNormalisee = normaliserTexte(recherche.trim());
  const rechercheTelephone = nettoyerRechercheTelephone(recherche);
  const enRecherche = rechercheNormalisee !== '';

  const clientsFiltres = enRecherche
    ? clients.filter((client) => {
        const nom = normaliserTexte(client.nom);
        const prenom = normaliserTexte(client.prenom);
        const telephone = normaliserTexte(client.telephone);
        const telephoneFormate = normaliserTexte(
          formaterTelephone(client.telephone)
        );
        const telephoneSansSeparateurs = String(client.telephone ?? '').replace(
          /[\s.\-()]/g,
          ''
        );

        const correspondTelephone =
          telephone.includes(rechercheNormalisee) ||
          telephoneFormate.includes(rechercheNormalisee) ||
          (rechercheTelephone !== '' &&
            telephoneSansSeparateurs.includes(rechercheTelephone));

        return (
          nom.includes(rechercheNormalisee) ||
          prenom.includes(rechercheNormalisee) ||
          correspondTelephone
        );
      })
    : clients;

  return (
    <div className="app">
      {/* En-tête : affiche toujours le nombre TOTAL de clients */}
      <Header totalClients={clients.length} />

      {/* Bandeau d'alerte orange si des doublons de téléphone existent (aucune suppression automatique) */}
      {doublonsTelephone.length > 0 && (
        <section className="duplicate-banner" role="alert">
          <p className="duplicate-banner-title">
            {doublonsTelephone.length} doublon(s) de téléphone détecté(s)
          </p>
          <p className="duplicate-banner-text">
            Aucun client n&apos;a été supprimé. Modifiez ou supprimez les fiches
            concernées ci-dessous :
          </p>
          <ul className="duplicate-banner-list">
            {doublonsTelephone.map((groupe) => (
              <li key={groupe.numero}>
                <strong>{formaterTelephone(groupe.numero)}</strong> :{' '}
                {groupe.clients
                  .map((client) => `${client.nom} ${client.prenom}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulaire d'ajout ou de modification d'un client.
          La prop key permet à React de réinitialiser proprement les champs quand on change de client édité. */}
      <ClientForm
        key={clientEnEdition ? clientEnEdition.id : 'ajout'}
        clients={clients}
        clientEnEdition={clientEnEdition}
        messageSucces={messageSucces}
        onEffacerMessageSucces={() => setMessageSucces('')}
        onAjouterClient={ajouterClient}
        onModifierClient={modifierClient}
        onAnnulerEdition={annulerEdition}
      />

      {/* Barre de recherche en temps réel */}
      <SearchBar
        recherche={recherche}
        onChangerRecherche={setRecherche}
        nbResultats={clientsFiltres.length}
        totalClients={clients.length}
      />

      {/* Tableau des clients (tous les clients, ou uniquement ceux qui correspondent à la recherche) */}
      <ClientList
        clients={clientsFiltres}
        totalClients={clients.length}
        enRecherche={enRecherche}
        idClientEnEdition={clientEnEdition ? clientEnEdition.id : null}
        bilanImport={bilanImport}
        onEditerClient={demarrerEdition}
        onSupprimerClient={supprimerClient}
        onExporterCSV={exporterClientsCSV}
        onImporterCSV={importerClientsCSV}
        onFermerBilanImport={() => setBilanImport(null)}
      />

      {/* Pied de page de l'application */}
      <footer className="footer">MiniGest v1.3 — Patrick Kassi</footer>
    </div>
  );
}

export default App;
