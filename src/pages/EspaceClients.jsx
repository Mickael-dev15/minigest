// Espace clients connecté à Supabase (table public.clients protégée par RLS).
import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header.jsx';
import Dashboard from '../components/Dashboard.jsx';
import ClientForm from '../components/ClientForm.jsx';
import SearchBar from '../components/SearchBar.jsx';
import ClientList from '../components/ClientList.jsx';
import EquipeSection from '../components/EquipeSection.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';
import {
  COLONNES_CLIENT_SUPABASE,
  clientDepuisSupabase,
  clientVersInsertSupabase,
  clientVersUpdateSupabase,
} from '../utils/mappingClients.js';
import {
  chargerVisibiliteDashboard,
  sauvegarderVisibiliteDashboard,
  chargerTri,
  sauvegarderTri,
  chargerParPage,
  sauvegarderParPage,
} from '../utils/storage.js';
import { validerClient } from '../utils/validation.js';
import {
  formaterTelephone,
  nettoyerRechercheTelephone,
  normaliserTelephone,
} from '../utils/telephone.js';
import {
  exporterCSV,
  importerCSV,
  obtenirNomFichierExport,
} from '../utils/csv.js';
import {
  calculerProchainTri,
  normaliserTri,
  trierClients,
} from '../utils/tri.js';
import { normaliserParPage, paginer } from '../utils/pagination.js';
import { construireMessageBandeauAbonnement } from '../utils/admin.js';
import { extraireMessageErreurEdgeFunction } from '../utils/equipe.js';

const COLONNES_PROFIL_EQUIPE = 'id, entreprise_id, nom_complet, role, actif';

// Traduit les erreurs PostgreSQL / Supabase courantes en messages français clairs
function traduireErreurSupabase(erreur, messageParDefaut) {
  if (!erreur) {
    return messageParDefaut;
  }

  if (erreur.code === '23505') {
    return 'Ce numéro de téléphone existe déjà dans votre entreprise.';
  }

  if (erreur.code === '42501') {
    return 'Action non autorisée';
  }

  return messageParDefaut;
}

// Supprime les accents et met le texte en minuscules pour comparer facilement
function normaliserTexte(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Applique la recherche texte puis le filtre par statut, sans modifier la liste d'origine
function filtrerClients(listeClients, recherche, filtreStatut) {
  const rechercheNormalisee = normaliserTexte(recherche.trim());
  const rechercheTelephone = nettoyerRechercheTelephone(recherche);
  const enRecherche = rechercheNormalisee !== '';

  return listeClients.filter((client) => {
    // 1. Recherche texte (nom, prénom, téléphone ou note)
    if (enRecherche) {
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
      const note = normaliserTexte(client.note ?? '');

      const correspondTelephone =
        telephone.includes(rechercheNormalisee) ||
        telephoneFormate.includes(rechercheNormalisee) ||
        (rechercheTelephone !== '' &&
          telephoneSansSeparateurs.includes(rechercheTelephone));

      const correspondRecherche =
        nom.includes(rechercheNormalisee) ||
        prenom.includes(rechercheNormalisee) ||
        correspondTelephone ||
        note.includes(rechercheNormalisee);

      if (!correspondRecherche) {
        return false;
      }
    }

    // 2. Filtre par statut
    if (filtreStatut !== 'Tous' && client.statut !== filtreStatut) {
      return false;
    }

    return true;
  });
}

function EspaceClients() {
  const { session, profil, chargement: chargementProfil } = useAuth();

  // Indique que le profil métier et l'utilisateur connecté sont prêts avant tout appel Supabase
  const profilPret =
    !chargementProfil &&
    Boolean(profil?.entreprise_id) &&
    Boolean(session?.user?.id);

  // Le bandeau d'échéance d'abonnement et la section "Mon équipe" sont réservés au gérant
  const estGerant = profil?.role === 'gerant';

  // Liste des clients chargés depuis public.clients (plus aucun localStorage pour les clients)
  const [clients, setClients] = useState([]);

  // Abonnements de l'entreprise (chargés uniquement pour le gérant via la politique RLS existante)
  const [abonnementsEntreprise, setAbonnementsEntreprise] = useState([]);

  // Gestion de l'équipe (chargée et utilisée uniquement pour le gérant — Lot 4)
  const [membresEquipe, setMembresEquipe] = useState([]);
  const [chargementEquipe, setChargementEquipe] = useState(false);
  const [erreurChargementEquipe, setErreurChargementEquipe] = useState('');
  const [compteurRechargementEquipe, setCompteurRechargementEquipe] =
    useState(0);
  const [messageSuccesEquipe, setMessageSuccesEquipe] = useState('');
  const [avertissementJournalEquipe, setAvertissementJournalEquipe] =
    useState('');
  const [erreurActionEquipe, setErreurActionEquipe] = useState('');
  const [erreurCreationEmploye, setErreurCreationEmploye] = useState('');
  const [creationEmployeEnCours, setCreationEmployeEnCours] = useState(false);
  const [actionMembreId, setActionMembreId] = useState(null);

  // État de chargement initial et message d'erreur éventuel lors de la lecture
  const [chargementClients, setChargementClients] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [compteurRechargement, setCompteurRechargement] = useState(0);

  // Messages d'erreur pour le formulaire (ajout/modification) et les actions (suppression)
  const [erreurFormulaire, setErreurFormulaire] = useState('');
  const [erreurAction, setErreurAction] = useState('');

  // Indique si un import CSV est en cours d'enregistrement dans Supabase
  const [importEnCours, setImportEnCours] = useState(false);

  // State contenant le texte tapé dans la barre de recherche
  const [recherche, setRecherche] = useState('');

  // State contenant le filtre de statut actif ("Tous", "Prospect", "Client" ou "Inactif")
  const [filtreStatut, setFiltreStatut] = useState('Tous');

  // State contenant le client en cours de modification (null lorsqu'on est en mode ajout)
  const [clientEnEdition, setClientEnEdition] = useState(null);

  // State pour afficher le message de succès vert après un ajout ou une modification
  const [messageSucces, setMessageSucces] = useState('');

  // State pour afficher le bilan (ou l'erreur) après un import CSV
  const [bilanImport, setBilanImport] = useState(null);

  // Préférences d'affichage conservées dans localStorage (tableau de bord, tri, pagination)
  const [dashboardVisible, setDashboardVisible] = useState(() =>
    chargerVisibiliteDashboard()
  );
  const [tri, setTri] = useState(() => chargerTri());
  const [parPage, setParPage] = useState(() => chargerParPage());

  // State pour la page courante (non mémorisé : on revient toujours en page 1 à l'ouverture)
  const [pageCourante, setPageCourante] = useState(1);

  // Chargement des clients depuis public.clients dès que le profil est chargé.
  // IMPORTANT : aucun filtre .eq('entreprise_id', ...) côté React : la RLS filtre déjà par entreprise.
  useEffect(() => {
    if (!profilPret) {
      return;
    }

    let estActif = true;

    async function chargerClientsDepuisSupabase() {
      setChargementClients(true);
      setErreurChargement('');

      try {
        const { data, error } = await supabase
          .from('clients')
          .select(COLONNES_CLIENT_SUPABASE)
          .order('date_ajout', { ascending: false });

        if (!estActif) {
          return;
        }

        if (error) {
          setClients([]);
          setErreurChargement(
            traduireErreurSupabase(
              error,
              'Impossible de charger la liste des clients. Veuillez réessayer.'
            )
          );
        } else {
          // Convertit chaque ligne snake_case (date_ajout) vers le format attendu par l'application
          const clientsConvertis = (data ?? []).map(clientDepuisSupabase);
          setClients(clientsConvertis);
        }
      } catch {
        if (!estActif) {
          return;
        }
        setClients([]);
        setErreurChargement(
          'Erreur réseau lors du chargement des clients. Vérifiez votre connexion.'
        );
      } finally {
        if (estActif) {
          setChargementClients(false);
        }
      }
    }

    chargerClientsDepuisSupabase();

    return () => {
      estActif = false;
    };
  }, [profilPret, profil?.id, compteurRechargement]);

  // Pour le gérant uniquement : lit les abonnements de son entreprise afin d'afficher
  // un bandeau d'alerte en cas d'échéance proche ou dépassée (aucune suspension automatique).
  // IMPORTANT : aucun filtre .eq('entreprise_id', ...) côté React : la RLS filtre déjà par entreprise.
  useEffect(() => {
    if (!profilPret || !estGerant) {
      return;
    }

    let estActif = true;

    async function chargerAbonnementsGerant() {
      try {
        const { data, error } = await supabase
          .from('abonnements')
          .select('id, date_debut, date_fin, formule, statut_paiement')
          .order('date_fin', { ascending: false });

        if (!estActif) {
          return;
        }

        if (error) {
          setAbonnementsEntreprise([]);
        } else {
          setAbonnementsEntreprise(data ?? []);
        }
      } catch {
        if (estActif) {
          setAbonnementsEntreprise([]);
        }
      }
    }

    chargerAbonnementsGerant();

    return () => {
      estActif = false;
    };
  }, [profilPret, estGerant, profil?.id, compteurRechargement]);

  // Pour le gérant uniquement : lit les profils de son entreprise via la politique RLS existante
  // (profils_select_gerant_entreprise), sans aucun filtre entreprise_id côté React.
  const recupererEquipeDepuisSupabase = useCallback(async () => {
    const { data, error } = await supabase
      .from('profils')
      .select(COLONNES_PROFIL_EQUIPE)
      .order('nom_complet', { ascending: true });

    if (error) {
      return { erreur: error, membres: [] };
    }

    return { erreur: null, membres: data ?? [] };
  }, []);

  useEffect(() => {
    if (!profilPret || !estGerant) {
      return;
    }

    let estActif = true;

    async function chargerEquipeGerant() {
      setChargementEquipe(true);
      setErreurChargementEquipe('');

      try {
        const resultat = await recupererEquipeDepuisSupabase();
        if (!estActif) {
          return;
        }

        if (resultat.erreur) {
          setMembresEquipe([]);
          setErreurChargementEquipe(
            traduireErreurSupabase(
              resultat.erreur,
              "Impossible de charger la liste de votre équipe. Veuillez réessayer."
            )
          );
        } else {
          setMembresEquipe(resultat.membres);
        }
      } catch {
        if (!estActif) {
          return;
        }
        setMembresEquipe([]);
        setErreurChargementEquipe(
          "Erreur réseau lors du chargement de l'équipe. Vérifiez votre connexion."
        );
      } finally {
        if (estActif) {
          setChargementEquipe(false);
        }
      }
    }

    chargerEquipeGerant();

    return () => {
      estActif = false;
    };
  }, [
    profilPret,
    estGerant,
    profil?.id,
    compteurRechargement,
    compteurRechargementEquipe,
    recupererEquipeDepuisSupabase,
  ]);

  // Recharge silencieusement l'équipe après une création ou un changement de statut
  async function rechargerEquipeSilencieusement() {
    try {
      const resultat = await recupererEquipeDepuisSupabase();
      if (!resultat.erreur) {
        setMembresEquipe(resultat.membres);
      }
    } catch {
      // L'état local a déjà été mis à jour ; on ne bloque pas l'utilisateur
    }
  }

  // Crée un employé rattaché à l'entreprise du gérant via l'Edge Function gerer-equipe
  async function creerEmploye(donneesPropres) {
    if (!profilPret || !estGerant || creationEmployeEnCours) {
      return false;
    }

    setMessageSuccesEquipe('');
    setAvertissementJournalEquipe('');
    setErreurActionEquipe('');
    setErreurCreationEmploye('');
    setCreationEmployeEnCours(true);

    try {
      const { data, error } = await supabase.functions.invoke('gerer-equipe', {
        body: {
          action: 'creer',
          email: donneesPropres.email,
          nom_complet: donneesPropres.nom_complet,
          mot_de_passe_temporaire: donneesPropres.mot_de_passe_temporaire,
        },
      });

      if (error) {
        const messageErreur = await extraireMessageErreurEdgeFunction(
          error,
          "Impossible d'ajouter l'employé. Veuillez réessayer."
        );
        setErreurCreationEmploye(messageErreur);
        return false;
      }

      if (data?.error) {
        setErreurCreationEmploye(data.error);
        return false;
      }

      const utilisateurCree = data?.utilisateur;
      if (!utilisateurCree?.id) {
        setErreurCreationEmploye(
          "Réponse inattendue lors de la création de l'employé."
        );
        return false;
      }

      const nouveauMembre = {
        id: utilisateurCree.id,
        entreprise_id: utilisateurCree.entreprise_id,
        nom_complet: utilisateurCree.nom_complet,
        role: utilisateurCree.role,
        actif: utilisateurCree.actif,
      };

      setMembresEquipe((listeActuelle) => [...listeActuelle, nouveauMembre]);

      if (data.journal_enregistre === false) {
        setAvertissementJournalEquipe(
          data.avertissement ||
            'Employé créé, mais non enregistré dans le journal.'
        );
      }

      await rechargerEquipeSilencieusement();
      setMessageSuccesEquipe(
        `Compte employé créé pour « ${utilisateurCree.nom_complet} » (${utilisateurCree.email}).`
      );
      return true;
    } catch {
      setErreurCreationEmploye(
        "Erreur réseau lors de la création de l'employé. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setCreationEmployeEnCours(false);
    }
  }

  // Désactive ou réactive un employé de l'entreprise via l'Edge Function gerer-equipe
  async function basculerActifEmploye(membre) {
    if (!profilPret || !estGerant || actionMembreId !== null) {
      return false;
    }

    // Garde-fou côté interface (la sécurité réelle est garantie par l'Edge Function)
    if (membre.role !== 'employe' || membre.id === session.user.id) {
      setErreurActionEquipe('Action non autorisée');
      return false;
    }

    setMessageSuccesEquipe('');
    setAvertissementJournalEquipe('');
    setErreurActionEquipe('');
    setErreurCreationEmploye('');
    setActionMembreId(membre.id);

    const actionDemandee = membre.actif ? 'desactiver' : 'reactiver';

    try {
      const { data, error } = await supabase.functions.invoke('gerer-equipe', {
        body: {
          action: actionDemandee,
          profil_id: membre.id,
        },
      });

      if (error) {
        const messageErreur = await extraireMessageErreurEdgeFunction(
          error,
          membre.actif
            ? "Impossible de désactiver l'employé. Veuillez réessayer."
            : "Impossible de réactiver l'employé. Veuillez réessayer."
        );
        setErreurActionEquipe(messageErreur);
        return false;
      }

      if (data?.error) {
        setErreurActionEquipe(data.error);
        return false;
      }

      const profilMisAJour = data?.utilisateur;
      if (!profilMisAJour?.id) {
        setErreurActionEquipe(
          "Réponse inattendue lors de la mise à jour de l'employé."
        );
        return false;
      }

      setMembresEquipe((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === profilMisAJour.id ? profilMisAJour : item
        )
      );

      if (data.journal_enregistre === false) {
        setAvertissementJournalEquipe(
          data.avertissement ||
            'Action effectuée, mais non enregistrée dans le journal.'
        );
      }

      await rechargerEquipeSilencieusement();
      setMessageSuccesEquipe(
        profilMisAJour.actif
          ? `Compte de « ${profilMisAJour.nom_complet} » réactivé.`
          : `Compte de « ${profilMisAJour.nom_complet} » désactivé.`
      );
      return true;
    } catch {
      setErreurActionEquipe(
        "Erreur réseau lors de la mise à jour de l'employé. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionMembreId(null);
    }
  }

  // Mémorise automatiquement le choix d'affichage du tableau de bord
  useEffect(() => {
    sauvegarderVisibiliteDashboard(dashboardVisible);
  }, [dashboardVisible]);

  // Mémorise automatiquement le choix de tri dans localStorage
  useEffect(() => {
    sauvegarderTri(tri);
  }, [tri]);

  // Mémorise automatiquement le nombre de clients par page dans localStorage
  useEffect(() => {
    sauvegarderParPage(parPage);
  }, [parPage]);

  // Met à jour la recherche et revient directement à la page 1
  function gererChangementRecherche(nouvelleRecherche) {
    setRecherche(nouvelleRecherche);
    setPageCourante(1);
  }

  // Met à jour le filtre de statut et revient directement à la page 1
  function gererChangementFiltreStatut(nouveauStatut) {
    setFiltreStatut(nouveauStatut);
    setPageCourante(1);
  }

  // Change le tri lors d'un clic sur un en-tête de colonne du tableau et revient à la page 1
  function gererTriColonne(colonne) {
    setTri((triActuel) => calculerProchainTri(triActuel, colonne));
    setPageCourante(1);
  }

  // Applique directement un tri choisi dans la liste déroulante mobile et revient à la page 1
  function gererSelectionTri(nouveauTri) {
    setTri(normaliserTri(nouveauTri));
    setPageCourante(1);
  }

  // Change le nombre de clients affichés par page et revient directement à la page 1
  function gererChangementParPage(nouveauParPage) {
    setParPage(normaliserParPage(nouveauParPage));
    setPageCourante(1);
  }

  // Ajoute un nouveau client dans Supabase (id UUID et date_ajout générés par la base),
  // puis met à jour le state sans recharger la page.
  async function ajouterClient(donneesClient) {
    if (!profilPret) {
      setErreurFormulaire('Action non autorisée');
      return false;
    }

    setErreurFormulaire('');
    setErreurAction('');
    setMessageSucces('');

    // Vérifie et normalise explicitement le téléphone avant l'envoi vers Supabase
    const { numero: telephoneNormalise, erreur: erreurTel } =
      normaliserTelephone(donneesClient.telephone);
    if (erreurTel) {
      setErreurFormulaire(erreurTel);
      return false;
    }

    const ligneAInserer = clientVersInsertSupabase(
      {
        ...donneesClient,
        telephone: telephoneNormalise,
      },
      profil.entreprise_id,
      session.user.id
    );

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert(ligneAInserer)
        .select(COLONNES_CLIENT_SUPABASE);

      if (error) {
        setErreurFormulaire(
          traduireErreurSupabase(
            error,
            "Impossible d'ajouter le client. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurFormulaire('Action non autorisée');
        return false;
      }

      const nouveauClient = clientDepuisSupabase(data[0]);

      // On crée un nouveau tableau sans modifier le state directement
      const nouvelleListe = [...clients, nouveauClient];
      setClients(nouvelleListe);

      // Si le nouveau client ne correspond pas au filtre de statut actif, on repasse sur "Tous" pour le rendre visible
      const nouveauFiltreStatut =
        filtreStatut !== 'Tous' && nouveauClient.statut !== filtreStatut
          ? 'Tous'
          : filtreStatut;

      if (nouveauFiltreStatut !== filtreStatut) {
        setFiltreStatut(nouveauFiltreStatut);
      }

      // Calcule la position du client ajouté après recherche, filtre et tri pour aller sur sa page
      const listeFiltree = filtrerClients(
        nouvelleListe,
        recherche,
        nouveauFiltreStatut
      );
      const listeTriee = trierClients(listeFiltree, tri);
      const indexNouveauClient = listeTriee.findIndex(
        (client) => client.id === nouveauClient.id
      );

      if (indexNouveauClient !== -1) {
        const pageDuNouveauClient = Math.floor(indexNouveauClient / parPage) + 1;
        setPageCourante(pageDuNouveauClient);
      }

      setMessageSucces('Client ajouté avec succès');
      return true;
    } catch {
      setErreurFormulaire(
        "Erreur réseau lors de l'ajout du client. Vérifiez votre connexion."
      );
      return false;
    }
  }

  // Passe le formulaire en mode modification pour le client sélectionné et remonte vers le formulaire
  function demarrerEdition(client) {
    setClientEnEdition(client);
    setMessageSucces('');
    setErreurFormulaire('');
    setErreurAction('');

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
    setErreurFormulaire('');
  }

  // Met à jour un client dans Supabase (via son id UUID) puis dans le state avec map()
  async function modifierClient(clientModifie) {
    if (!profilPret) {
      setErreurFormulaire('Action non autorisée');
      return false;
    }

    setErreurFormulaire('');
    setErreurAction('');
    setMessageSucces('');

    // Normalise explicitement le téléphone avant l'envoi pour la contrainte unique en base
    const { numero: telephoneNormalise, erreur: erreurTel } =
      normaliserTelephone(clientModifie.telephone);
    if (erreurTel) {
      setErreurFormulaire(erreurTel);
      return false;
    }

    // Ne contient que les colonnes éditables (jamais date_ajout, cree_par ni entreprise_id)
    const champsModifies = clientVersUpdateSupabase({
      ...clientModifie,
      telephone: telephoneNormalise,
    });

    try {
      const { data, error } = await supabase
        .from('clients')
        .update(champsModifies)
        .eq('id', clientModifie.id)
        .select(COLONNES_CLIENT_SUPABASE);

      if (error) {
        setErreurFormulaire(
          traduireErreurSupabase(
            error,
            'Impossible de modifier ce client. Veuillez réessayer.'
          )
        );
        return false;
      }

      // 0 ligne modifiée signifie un refus de droits RLS ou une fiche introuvable
      if (!data || data.length === 0) {
        setErreurFormulaire('Action non autorisée');
        return false;
      }

      const clientMisAJour = clientDepuisSupabase(data[0]);

      // Remplace uniquement le client modifié sans jamais muter le state directement
      const nouvelleListe = clients.map((client) =>
        client.id === clientMisAJour.id ? clientMisAJour : client
      );
      setClients(nouvelleListe);

      // Si le client modifié ne correspond plus au filtre de statut actif, on repasse sur "Tous" pour le garder visible
      const nouveauFiltreStatut =
        filtreStatut !== 'Tous' && clientMisAJour.statut !== filtreStatut
          ? 'Tous'
          : filtreStatut;

      if (nouveauFiltreStatut !== filtreStatut) {
        setFiltreStatut(nouveauFiltreStatut);
      }

      // Si la page courante n'existe plus après modification (ex. recherche active), on recale sur la dernière page
      const listeFiltreeApresModif = filtrerClients(
        nouvelleListe,
        recherche,
        nouveauFiltreStatut
      );
      const nouveauTotalPages = Math.max(
        1,
        Math.ceil(listeFiltreeApresModif.length / parPage)
      );
      if (pageCourante > nouveauTotalPages) {
        setPageCourante(nouveauTotalPages);
      }

      // Retourne au mode ajout avec le message de confirmation
      setClientEnEdition(null);
      setMessageSucces('Client modifié avec succès');
      return true;
    } catch {
      setErreurFormulaire(
        'Erreur réseau lors de la modification du client. Vérifiez votre connexion.'
      );
      return false;
    }
  }

  // Supprime un client dans Supabase (via son id UUID) puis met à jour le state avec filter()
  async function supprimerClient(id) {
    if (!profilPret) {
      setErreurAction('Action non autorisée');
      return;
    }

    setErreurAction('');

    try {
      const { data, error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        setErreurAction(
          traduireErreurSupabase(
            error,
            'Impossible de supprimer ce client. Veuillez réessayer.'
          )
        );
        return;
      }

      // 0 ligne supprimée : refus de droits RLS ou fiche déjà supprimée
      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return;
      }

      // filter() renvoie un nouveau tableau contenant tous les clients sauf celui supprimé
      const nouvelleListe = clients.filter((client) => client.id !== id);
      setClients(nouvelleListe);

      // Si la page courante n'existe plus (ex. suppression du dernier client de la dernière page),
      // on revient automatiquement à la dernière page existante
      const listeFiltreeApresSuppression = filtrerClients(
        nouvelleListe,
        recherche,
        filtreStatut
      );
      const nouveauTotalPages = Math.max(
        1,
        Math.ceil(listeFiltreeApresSuppression.length / parPage)
      );
      if (pageCourante > nouveauTotalPages) {
        setPageCourante(nouveauTotalPages);
      }

      // Si le client supprimé était en cours de modification, on quitte le mode édition
      if (clientEnEdition && clientEnEdition.id === id) {
        setClientEnEdition(null);
        setMessageSucces('');
        setErreurFormulaire('');
      }
    } catch {
      setErreurAction(
        'Erreur réseau lors de la suppression du client. Vérifiez votre connexion.'
      );
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

  // Lit un fichier CSV, normalise les téléphones, écarte les doublons connus avant l'envoi,
  // insère le reste en lot dans Supabase et bascule ligne par ligne en cas d'erreur 23505.
  function importerClientsCSV(fichier) {
    if (!fichier || !profilPret || importEnCours) {
      return;
    }

    setErreurAction('');

    const lecteur = new FileReader();

    lecteur.onerror = () => {
      setBilanImport({
        erreur:
          "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier CSV valide.",
        nbImportes: 0,
        nbDoublons: 0,
        lignesIgnorees: [],
        avertissements: [],
      });
    };

    lecteur.onload = async () => {
      const texte = typeof lecteur.result === 'string' ? lecteur.result : '';
      const resultat = importerCSV(texte);

      // Si le fichier est vide, illisible ou n'a pas les bonnes colonnes, on ne modifie rien
      if (resultat.erreur) {
        setBilanImport({
          erreur: resultat.erreur,
          nbImportes: 0,
          nbDoublons: 0,
          lignesIgnorees: [],
          avertissements: [],
        });
        return;
      }

      // Étape a) Normalisation des téléphones déjà chargés pour cette entreprise
      const telephonesExistants = new Set();
      for (const client of clients) {
        const resExistant = normaliserTelephone(client.telephone);
        const numeroNormalise = resExistant.erreur
          ? String(client.telephone ?? '').trim()
          : resExistant.numero;
        if (numeroNormalise) {
          telephonesExistants.add(numeroNormalise);
        }
      }

      // Ensemble des téléphones déjà rencontrés dans ce fichier CSV (doublons internes)
      const telephonesDansFichier = new Set();
      const candidatsAInserer = [];
      const lignesIgnorees = [];
      const avertissements = [];
      let nbDoublons = 0;

      // Étape b) Validation de chaque ligne et filtrage des doublons avant tout envoi
      for (const ligne of resultat.lignes) {
        if (ligne.tropDeColonnes) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: `Nombre de colonnes incorrect (${ligne.nbColonnesAttendues} colonnes attendues)`,
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

        // Validation de format/obligatoires (le contrôle des doublons se fait juste après avec les numéros normalisés)
        const { erreurs, donneesPropres } = validerClient(ligne, []);
        const messagesErreurs = Object.values(erreurs);

        if (messagesErreurs.length > 0) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: messagesErreurs.join(' ; '),
          });
          continue;
        }

        // Normalisation explicite avec telephone.js
        const { numero: telephoneNormalise, erreur: erreurTel } =
          normaliserTelephone(donneesPropres.telephone);
        if (erreurTel) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: erreurTel,
          });
          continue;
        }

        if (telephonesExistants.has(telephoneNormalise)) {
          nbDoublons += 1;
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: `Doublon de téléphone (${formaterTelephone(telephoneNormalise)}) déjà enregistré`,
          });
          continue;
        }

        if (telephonesDansFichier.has(telephoneNormalise)) {
          nbDoublons += 1;
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: `Doublon de téléphone (${formaterTelephone(telephoneNormalise)}) présent plusieurs fois dans le fichier`,
          });
          continue;
        }

        telephonesDansFichier.add(telephoneNormalise);

        // Si le statut du CSV était inconnu, on a appliqué "Client" par défaut et on le signale dans le bilan
        if (ligne.statutInconnu) {
          avertissements.push({
            numeroLigne: ligne.numeroLigne,
            message: 'statut inconnu, Client par défaut',
          });
        }

        // Prépare l'objet Supabase (sans id ni date_ajout : valeurs par défaut PostgreSQL)
        const payload = clientVersInsertSupabase(
          {
            ...donneesPropres,
            telephone: telephoneNormalise,
          },
          profil.entreprise_id,
          session.user.id
        );

        candidatsAInserer.push({
          numeroLigne: ligne.numeroLigne,
          telephone: telephoneNormalise,
          payload,
        });
      }

      // Aucune ligne valide à envoyer : on affiche directement le bilan sans requête inutile
      if (candidatsAInserer.length === 0) {
        lignesIgnorees.sort((a, b) => a.numeroLigne - b.numeroLigne);
        setBilanImport({
          erreur: null,
          nbImportes: 0,
          nbDoublons,
          lignesIgnorees,
          avertissements,
        });
        return;
      }

      setImportEnCours(true);

      let nbImportes = 0;
      let erreurImport = null;

      try {
        // Étape c) Insertion en lot des lignes restantes
        const { data, error } = await supabase
          .from('clients')
          .insert(candidatsAInserer.map((candidat) => candidat.payload))
          .select(COLONNES_CLIENT_SUPABASE);

        if (!error) {
          const clientsInseres = (data ?? []).map(clientDepuisSupabase);
          if (clientsInseres.length === 0) {
            erreurImport = 'Action non autorisée';
          } else {
            // Met à jour le state sans jamais le modifier directement
            setClients((listeActuelle) => [
              ...listeActuelle,
              ...clientsInseres,
            ]);
            nbImportes = clientsInseres.length;
          }
        } else if (error.code === '23505') {
          // Étape d) Un doublon est survenu en base (ex. ajout simultané par un collègue) :
          // le lot PostgreSQL a été annulé, on réessaie ligne par ligne pour isoler les lignes refusées.
          const clientsInseresLigneParLigne = [];

          for (const candidat of candidatsAInserer) {
            const { data: dataLigne, error: erreurLigne } = await supabase
              .from('clients')
              .insert(candidat.payload)
              .select(COLONNES_CLIENT_SUPABASE);

            if (erreurLigne) {
              if (erreurLigne.code === '23505') {
                nbDoublons += 1;
                lignesIgnorees.push({
                  numeroLigne: candidat.numeroLigne,
                  raison: `Doublon de téléphone (${formaterTelephone(candidat.telephone)}) déjà présent en base`,
                });
              } else if (erreurLigne.code === '42501') {
                erreurImport = 'Action non autorisée';
                break;
              } else {
                lignesIgnorees.push({
                  numeroLigne: candidat.numeroLigne,
                  raison: "Impossible d'enregistrer cette ligne dans la base",
                });
              }
            } else if (!dataLigne || dataLigne.length === 0) {
              erreurImport = 'Action non autorisée';
              break;
            } else {
              clientsInseresLigneParLigne.push(
                clientDepuisSupabase(dataLigne[0])
              );
            }
          }

          if (clientsInseresLigneParLigne.length > 0) {
            setClients((listeActuelle) => [
              ...listeActuelle,
              ...clientsInseresLigneParLigne,
            ]);
            nbImportes = clientsInseresLigneParLigne.length;
          }
        } else {
          erreurImport = traduireErreurSupabase(
            error,
            "Impossible d'importer les clients. Veuillez réessayer."
          );
        }
      } catch {
        erreurImport =
          "Erreur réseau lors de l'import CSV. Vérifiez votre connexion.";
      } finally {
        setImportEnCours(false);
      }

      // Trie les lignes refusées par numéro de ligne pour une lecture claire
      lignesIgnorees.sort((a, b) => a.numeroLigne - b.numeroLigne);

      setBilanImport({
        erreur: erreurImport,
        nbImportes,
        nbDoublons,
        lignesIgnorees,
        avertissements,
      });
    };

    lecteur.readAsText(fichier, 'UTF-8');
  }

  // Détecte les éventuels doublons de téléphone (affichage d'alerte sans rien supprimer)
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

  // Compteurs par statut calculés directement à partir de la liste des clients (valeurs dérivées, aucun state en plus)
  const compteursStatut = {
    Tous: clients.length,
    Prospect: clients.filter((client) => client.statut === 'Prospect').length,
    Client: clients.filter((client) => client.statut === 'Client').length,
    Inactif: clients.filter((client) => client.statut === 'Inactif').length,
  };

  // Chaîne complète sans modifier "clients" : recherche → filtre statut → tri → pagination
  const enRecherche = normaliserTexte(recherche.trim()) !== '';
  const clientsFiltres = filtrerClients(clients, recherche, filtreStatut);
  const clientsTries = trierClients(clientsFiltres, tri);
  const pagination = paginer(clientsTries, pageCourante, parPage);

  // Bandeau d'échéance réservé au gérant (null si employé, aucun abonnement, renouvelé ou > 7 jours)
  const bandeauAbonnement = estGerant
    ? construireMessageBandeauAbonnement(abonnementsEntreprise)
    : null;

  // Écran d'attente tant que le profil ou la liste des clients est en cours de chargement
  if (chargementProfil || !profilPret || chargementClients) {
    return (
      <div className="app">
        <Header />
        <section
          className="card clients-status-card"
          role="status"
          aria-live="polite"
        >
          <p className="clients-loading-text">Chargement...</p>
        </section>
        <footer className="footer">MiniGest v2 — Patrick Kassi</footer>
      </div>
    );
  }

  // Écran d'erreur en français si la lecture initiale dans Supabase a échoué
  if (erreurChargement) {
    return (
      <div className="app">
        <Header />
        <section className="card clients-status-card" role="alert">
          <p className="auth-error-banner">{erreurChargement}</p>
          <div className="clients-retry-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCompteurRechargement((compteur) => compteur + 1)}
            >
              Réessayer
            </button>
          </div>
        </section>
        <footer className="footer">MiniGest v2 — Patrick Kassi</footer>
      </div>
    );
  }

  return (
    <div className="app">
      {/* En-tête : affiche toujours le nombre TOTAL de clients */}
      <Header totalClients={clients.length} />

      {/* Bandeau d'information d'échéance d'abonnement (gérant uniquement, aucune suspension automatique) */}
      {bandeauAbonnement && (
        <section
          className={
            bandeauAbonnement.etat === 'expire'
              ? 'subscription-banner subscription-banner-expire'
              : 'subscription-banner subscription-banner-bientot'
          }
          role={bandeauAbonnement.etat === 'expire' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <p className="subscription-banner-text">
            {bandeauAbonnement.message}
          </p>
        </section>
      )}

      {/* Message d'erreur global pour les actions sur la liste (ex. suppression refusée) */}
      {erreurAction && (
        <section className="action-error-banner" role="alert">
          <p className="action-error-text">{erreurAction}</p>
          <button
            type="button"
            className="btn-close-report"
            onClick={() => setErreurAction('')}
          >
            Fermer
          </button>
        </section>
      )}

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

      {/* Tableau de bord d'activité : calculé sur TOUS les clients, sans tenir compte du filtre ni de la recherche */}
      <Dashboard
        clients={clients}
        estVisible={dashboardVisible}
        onBasculerVisibilite={() => setDashboardVisible((visible) => !visible)}
      />

      {/* Formulaire d'ajout ou de modification d'un client.
          La prop key utilise l'id UUID renvoyé par Supabase pour réinitialiser proprement les champs. */}
      <ClientForm
        key={clientEnEdition ? clientEnEdition.id : 'ajout'}
        clients={clients}
        clientEnEdition={clientEnEdition}
        messageSucces={messageSucces}
        erreurServeur={erreurFormulaire}
        onEffacerMessageSucces={() => setMessageSucces('')}
        onEffacerErreurServeur={() => setErreurFormulaire('')}
        onAjouterClient={ajouterClient}
        onModifierClient={modifierClient}
        onAnnulerEdition={annulerEdition}
      />

      {/* Barre de recherche en temps réel */}
      <SearchBar
        recherche={recherche}
        onChangerRecherche={gererChangementRecherche}
        nbResultats={clientsFiltres.length}
        totalClients={clients.length}
        filtreStatut={filtreStatut}
      />

      {/* Tableau des clients (recherchés, filtrés, triés puis paginés) */}
      <ClientList
        clients={pagination.elements}
        totalClients={clients.length}
        totalClientsFiltres={clientsTries.length}
        debutPagination={pagination.debut}
        finPagination={pagination.fin}
        pageCourante={pagination.pageCourante}
        totalPages={pagination.totalPages}
        parPage={parPage}
        onChangerPage={setPageCourante}
        onChangerParPage={gererChangementParPage}
        enRecherche={enRecherche}
        filtreStatut={filtreStatut}
        compteursStatut={compteursStatut}
        onChangerFiltreStatut={gererChangementFiltreStatut}
        tri={tri}
        onTrierColonne={gererTriColonne}
        onChangerTri={gererSelectionTri}
        idClientEnEdition={clientEnEdition ? clientEnEdition.id : null}
        bilanImport={bilanImport}
        importEnCours={importEnCours}
        onEditerClient={demarrerEdition}
        onSupprimerClient={supprimerClient}
        onExporterCSV={exporterClientsCSV}
        onImporterCSV={importerClientsCSV}
        onFermerBilanImport={() => setBilanImport(null)}
      />

      {/* Section "Mon équipe" : visible UNIQUEMENT pour le gérant (jamais pour un employé) */}
      {estGerant && (
        <EquipeSection
          membres={membresEquipe}
          utilisateurConnecteId={session.user.id}
          chargement={chargementEquipe}
          erreurChargement={erreurChargementEquipe}
          messageSucces={messageSuccesEquipe}
          avertissementJournal={avertissementJournalEquipe}
          erreurAction={erreurActionEquipe}
          erreurCreation={erreurCreationEmploye}
          creationEnCours={creationEmployeEnCours}
          actionMembreId={actionMembreId}
          onCreerEmploye={creerEmploye}
          onBasculerActifEmploye={basculerActifEmploye}
          onRecharger={() =>
            setCompteurRechargementEquipe((compteur) => compteur + 1)
          }
          onFermerErreurAction={() => setErreurActionEquipe('')}
        />
      )}

      {/* Pied de page de l'application */}
      <footer className="footer">MiniGest v2 — Patrick Kassi</footer>
    </div>
  );
}

export default EspaceClients;
