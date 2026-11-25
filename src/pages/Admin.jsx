// Tableau de bord Super admin (/admin) — Lots 2a et 2b.
// IMPORTANT : cette page ne lit JAMAIS public.clients ; elle utilise uniquement
// le RPC nb_clients_par_entreprise pour le comptage par entreprise.
import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header.jsx';
import AdminKpis from '../components/AdminKpis.jsx';
import EntrepriseForm from '../components/EntrepriseForm.jsx';
import EntreprisesTable from '../components/EntreprisesTable.jsx';
import AbonnementsPanel from '../components/AbonnementsPanel.jsx';
import UtilisateursSection from '../components/UtilisateursSection.jsx';
import JournalSection from '../components/JournalSection.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';
import {
  calculerIndicateursAdmin,
  construireCarteNbClients,
  regrouperAbonnementsParEntreprise,
} from '../utils/admin.js';

const COLONNES_ENTREPRISE =
  'id, nom, ville, pays, statut, motif_suspension, cree_le';
const COLONNES_ABONNEMENT =
  'id, entreprise_id, formule, date_debut, date_fin, montant_fcfa, statut_paiement, reference';
const COLONNES_PROFIL = 'id, entreprise_id, nom_complet, role, actif';
const COLONNES_JOURNAL =
  'id, acteur_id, action, cible, details, cree_le, acteur:profils ( nom_complet )';

// Traduit les erreurs Supabase courantes en messages français clairs
function traduireErreurAdmin(erreur, messageParDefaut) {
  if (!erreur) {
    return messageParDefaut;
  }

  if (erreur.code === '42501') {
    return 'Action non autorisée';
  }

  if (erreur.code === '23514') {
    return 'Données invalides (vérifiez les dates ou le montant).';
  }

  return messageParDefaut;
}

// Lit le vrai message d'erreur JSON renvoyé par une Edge Function (FunctionsHttpError).
// Avec supabase.functions.invoke, les réponses 4xx/5xx placent la Response HTTP dans error.context.
async function extraireMessageErreurEdgeFunction(erreur, messageParDefaut) {
  if (!erreur) {
    return messageParDefaut;
  }

  const contexte = erreur.context;
  if (contexte && typeof contexte.json === 'function') {
    try {
      const reponseALire =
        typeof contexte.clone === 'function' ? contexte.clone() : contexte;
      const corps = await reponseALire.json();
      if (typeof corps?.error === 'string' && corps.error.trim() !== '') {
        return corps.error.trim();
      }
      if (typeof corps?.message === 'string' && corps.message.trim() !== '') {
        return corps.message.trim();
      }
    } catch {
      // Si le corps n'est pas du JSON exploitable, on utilise le message de repli
    }
  }

  if (erreur.name === 'FunctionsFetchError') {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion ou le déploiement de la fonction.';
  }

  return messageParDefaut;
}

function Admin() {
  const { session, profil, chargement: chargementProfil } = useAuth();

  // Vérifie que la session et le profil super_admin sont prêts avant tout appel Supabase
  const superAdminPret =
    !chargementProfil &&
    Boolean(session?.user?.id) &&
    profil?.role === 'super_admin' &&
    Boolean(profil?.actif);

  // Données chargées depuis Supabase
  const [entreprises, setEntreprises] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [lignesRpcClients, setLignesRpcClients] = useState([]);
  const [profils, setProfils] = useState([]);
  const [journal, setJournal] = useState([]);

  // États de chargement initial et d'erreur globale
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [compteurRechargement, setCompteurRechargement] = useState(0);

  // Bandeaux de retour utilisateur
  const [messageSucces, setMessageSucces] = useState('');
  const [avertissementJournal, setAvertissementJournal] = useState('');
  const [erreurAction, setErreurAction] = useState('');
  const [erreurCreation, setErreurCreation] = useState('');
  const [erreurModificationEntreprise, setErreurModificationEntreprise] =
    useState('');
  const [erreurAbonnement, setErreurAbonnement] = useState('');
  const [erreurCreationUtilisateur, setErreurCreationUtilisateur] =
    useState('');

  // États "en cours" pour désactiver les boutons et éviter les doubles clics
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [modificationEntrepriseEnCours, setModificationEntrepriseEnCours] =
    useState(false);
  const [actionEntrepriseId, setActionEntrepriseId] = useState(null);
  const [enregistrementAbonnement, setEnregistrementAbonnement] =
    useState(false);
  const [creationUtilisateurEnCours, setCreationUtilisateurEnCours] =
    useState(false);
  const [actionUtilisateurId, setActionUtilisateurId] = useState(null);

  // Entreprise actuellement ouverte dans le panneau Abonnements (null si fermé)
  const [entrepriseSelectionneeId, setEntrepriseSelectionneeId] =
    useState(null);

  // Entreprise actuellement en cours de modification (nom, ville, pays uniquement)
  const [entrepriseEnEditionId, setEntrepriseEnEditionId] = useState(null);

  // Charge les 5 sources de données en parallèle (sans jamais lire public.clients)
  const recupererDonneesAdmin = useCallback(async () => {
    const [
      resEntreprises,
      resAbonnements,
      resRpcClients,
      resProfils,
      resJournal,
    ] = await Promise.all([
      supabase
        .from('entreprises')
        .select(COLONNES_ENTREPRISE)
        .order('cree_le', { ascending: false }),
      supabase
        .from('abonnements')
        .select(COLONNES_ABONNEMENT)
        .order('date_fin', { ascending: false }),
      supabase.rpc('nb_clients_par_entreprise'),
      supabase
        .from('profils')
        .select(COLONNES_PROFIL)
        .order('nom_complet', { ascending: true }),
      supabase
        .from('journal')
        .select(COLONNES_JOURNAL)
        .order('cree_le', { ascending: false })
        .limit(20),
    ]);

    const premiereErreur =
      resEntreprises.error ||
      resAbonnements.error ||
      resRpcClients.error ||
      resProfils.error ||
      resJournal.error;

    if (premiereErreur) {
      return { erreur: premiereErreur };
    }

    return {
      erreur: null,
      entreprises: resEntreprises.data ?? [],
      abonnements: resAbonnements.data ?? [],
      lignesRpcClients: resRpcClients.data ?? [],
      profils: resProfils.data ?? [],
      journal: resJournal.data ?? [],
    };
  }, []);

  // Chargement initial dès que le profil super_admin est prêt
  useEffect(() => {
    if (!superAdminPret) {
      return;
    }

    let estActif = true;

    async function chargerInitial() {
      setChargementDonnees(true);
      setErreurChargement('');

      try {
        const resultat = await recupererDonneesAdmin();
        if (!estActif) {
          return;
        }

        if (resultat.erreur) {
          setErreurChargement(
            traduireErreurAdmin(
              resultat.erreur,
              'Impossible de charger les données du tableau de bord. Veuillez réessayer.'
            )
          );
        } else {
          setEntreprises(resultat.entreprises);
          setAbonnements(resultat.abonnements);
          setLignesRpcClients(resultat.lignesRpcClients);
          setProfils(resultat.profils);
          setJournal(resultat.journal);
        }
      } catch {
        if (!estActif) {
          return;
        }
        setErreurChargement(
          'Erreur réseau lors du chargement du tableau de bord. Vérifiez votre connexion.'
        );
      } finally {
        if (estActif) {
          setChargementDonnees(false);
        }
      }
    }

    chargerInitial();

    return () => {
      estActif = false;
    };
  }, [superAdminPret, profil?.id, compteurRechargement, recupererDonneesAdmin]);

  // Recharge silencieusement les indicateurs, tableaux, profils et journal après chaque action
  async function rechargerDonneesSilencieusement() {
    try {
      const resultat = await recupererDonneesAdmin();
      if (!resultat.erreur) {
        setEntreprises(resultat.entreprises);
        setAbonnements(resultat.abonnements);
        setLignesRpcClients(resultat.lignesRpcClients);
        setProfils(resultat.profils);
        setJournal(resultat.journal);
      }
    } catch {
      // L'état local a déjà été mis à jour ; on ne bloque pas l'utilisateur
    }
  }

  // Insère une ligne dans public.journal. Si cela échoue, l'action principale reste validée
  // et un avertissement dédié est affiché.
  async function enregistrerDansJournal(action, cible, details) {
    try {
      const { error } = await supabase.from('journal').insert({
        acteur_id: session.user.id,
        action,
        cible,
        details: details ?? {},
      });

      if (error) {
        setAvertissementJournal(
          'Action effectuée, mais non enregistrée dans le journal'
        );
        return false;
      }

      return true;
    } catch {
      setAvertissementJournal(
        'Action effectuée, mais non enregistrée dans le journal'
      );
      return false;
    }
  }

  // Réinitialise les messages de retour avant de lancer une nouvelle action
  function reinitialiserMessages() {
    setMessageSucces('');
    setAvertissementJournal('');
    setErreurAction('');
    setErreurCreation('');
    setErreurModificationEntreprise('');
    setErreurAbonnement('');
    setErreurCreationUtilisateur('');
  }

  // 1. Création d'une nouvelle entreprise
  async function creerEntreprise(donneesPropres) {
    if (!superAdminPret || creationEnCours) {
      return false;
    }

    reinitialiserMessages();
    setCreationEnCours(true);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .insert({
          nom: donneesPropres.nom,
          ville: donneesPropres.ville,
          pays: donneesPropres.pays,
        })
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurCreation(
          traduireErreurAdmin(
            error,
            "Impossible de créer l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurCreation('Action non autorisée');
        return false;
      }

      const nouvelleEntreprise = data[0];
      setEntreprises((listeActuelle) => [nouvelleEntreprise, ...listeActuelle]);

      await enregistrerDansJournal(
        'creation_entreprise',
        nouvelleEntreprise.nom,
        {
          entreprise_id: nouvelleEntreprise.id,
          ville: nouvelleEntreprise.ville,
          pays: nouvelleEntreprise.pays,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(
        `Entreprise « ${nouvelleEntreprise.nom} » créée avec succès.`
      );
      return true;
    } catch {
      setErreurCreation(
        "Erreur réseau lors de la création de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setCreationEnCours(false);
    }
  }

  // 1b. Modification des coordonnées d'une entreprise (nom, ville, pays uniquement ; jamais statut)
  async function modifierEntreprise(entreprise, donneesPropres, changements) {
    if (
      !superAdminPret ||
      modificationEntrepriseEnCours ||
      actionEntrepriseId !== null ||
      !changements ||
      Object.keys(changements).length === 0
    ) {
      return false;
    }

    reinitialiserMessages();
    setModificationEntrepriseEnCours(true);
    setActionEntrepriseId(entreprise.id);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .update({
          nom: donneesPropres.nom,
          ville: donneesPropres.ville,
          pays: donneesPropres.pays,
        })
        .eq('id', entreprise.id)
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurModificationEntreprise(
          traduireErreurAdmin(
            error,
            "Impossible de modifier l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurModificationEntreprise('Action non autorisée');
        return false;
      }

      const entrepriseMiseAJour = data[0];
      setEntreprises((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === entrepriseMiseAJour.id ? entrepriseMiseAJour : item
        )
      );

      // Le journal n'enregistre que les champs réellement modifiés (avant / après)
      await enregistrerDansJournal(
        'modification_entreprise',
        entrepriseMiseAJour.nom,
        {
          entreprise_id: entrepriseMiseAJour.id,
          changements,
        }
      );

      await rechargerDonneesSilencieusement();
      setEntrepriseEnEditionId(null);
      setMessageSucces(
        `Entreprise « ${entrepriseMiseAJour.nom} » modifiée avec succès.`
      );
      return true;
    } catch {
      setErreurModificationEntreprise(
        "Erreur réseau lors de la modification de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setModificationEntrepriseEnCours(false);
      setActionEntrepriseId(null);
    }
  }

  // 2. Suspension d'une entreprise (motif obligatoire déjà validé)
  async function suspendreEntreprise(entreprise, motifPropre) {
    if (!superAdminPret || actionEntrepriseId !== null) {
      return false;
    }

    reinitialiserMessages();
    setActionEntrepriseId(entreprise.id);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .update({
          statut: 'suspendue',
          motif_suspension: motifPropre,
        })
        .eq('id', entreprise.id)
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurAction(
          traduireErreurAdmin(
            error,
            "Impossible de suspendre l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return false;
      }

      const entrepriseMiseAJour = data[0];
      setEntreprises((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === entrepriseMiseAJour.id ? entrepriseMiseAJour : item
        )
      );

      await enregistrerDansJournal(
        'suspension_entreprise',
        entrepriseMiseAJour.nom,
        {
          entreprise_id: entrepriseMiseAJour.id,
          motif: motifPropre,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Entreprise « ${entrepriseMiseAJour.nom} » suspendue.`);
      return true;
    } catch {
      setErreurAction(
        "Erreur réseau lors de la suspension de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionEntrepriseId(null);
    }
  }

  // 3. Réactivation d'une entreprise (remet motif_suspension à null)
  async function reactiverEntreprise(entreprise) {
    if (!superAdminPret || actionEntrepriseId !== null) {
      return false;
    }

    reinitialiserMessages();
    setActionEntrepriseId(entreprise.id);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .update({
          statut: 'active',
          motif_suspension: null,
        })
        .eq('id', entreprise.id)
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurAction(
          traduireErreurAdmin(
            error,
            "Impossible de réactiver l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return false;
      }

      const entrepriseMiseAJour = data[0];
      setEntreprises((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === entrepriseMiseAJour.id ? entrepriseMiseAJour : item
        )
      );

      await enregistrerDansJournal(
        'reactivation_entreprise',
        entrepriseMiseAJour.nom,
        {
          entreprise_id: entrepriseMiseAJour.id,
          ancien_motif: entreprise.motif_suspension ?? null,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Entreprise « ${entrepriseMiseAJour.nom} » réactivée.`);
      return true;
    } catch {
      setErreurAction(
        "Erreur réseau lors de la réactivation de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionEntrepriseId(null);
    }
  }

  // 4. Ajout d'un abonnement pour une entreprise
  async function ajouterAbonnement(entreprise, donneesPropres) {
    if (!superAdminPret || enregistrementAbonnement) {
      return false;
    }

    reinitialiserMessages();
    setEnregistrementAbonnement(true);

    try {
      const { data, error } = await supabase
        .from('abonnements')
        .insert({
          entreprise_id: entreprise.id,
          formule: donneesPropres.formule,
          date_debut: donneesPropres.date_debut,
          date_fin: donneesPropres.date_fin,
          montant_fcfa: donneesPropres.montant_fcfa,
          statut_paiement: donneesPropres.statut_paiement,
          reference: donneesPropres.reference,
        })
        .select(COLONNES_ABONNEMENT);

      if (error) {
        setErreurAbonnement(
          traduireErreurAdmin(
            error,
            "Impossible d'ajouter l'abonnement. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAbonnement('Action non autorisée');
        return false;
      }

      const nouvelAbonnement = data[0];
      setAbonnements((listeActuelle) => [nouvelAbonnement, ...listeActuelle]);

      await enregistrerDansJournal('creation_abonnement', entreprise.nom, {
        entreprise_id: entreprise.id,
        abonnement_id: nouvelAbonnement.id,
        formule: nouvelAbonnement.formule,
        date_debut: nouvelAbonnement.date_debut,
        date_fin: nouvelAbonnement.date_fin,
        montant_fcfa: nouvelAbonnement.montant_fcfa,
        statut_paiement: nouvelAbonnement.statut_paiement,
        reference: nouvelAbonnement.reference,
      });

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Abonnement ajouté pour « ${entreprise.nom} ».`);
      return true;
    } catch {
      setErreurAbonnement(
        "Erreur réseau lors de l'ajout de l'abonnement. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setEnregistrementAbonnement(false);
    }
  }

  // 5. Modification d'un abonnement existant
  async function modifierAbonnement(entreprise, abonnementId, donneesPropres) {
    if (!superAdminPret || enregistrementAbonnement) {
      return false;
    }

    reinitialiserMessages();
    setEnregistrementAbonnement(true);

    try {
      const { data, error } = await supabase
        .from('abonnements')
        .update({
          formule: donneesPropres.formule,
          date_debut: donneesPropres.date_debut,
          date_fin: donneesPropres.date_fin,
          montant_fcfa: donneesPropres.montant_fcfa,
          statut_paiement: donneesPropres.statut_paiement,
          reference: donneesPropres.reference,
        })
        .eq('id', abonnementId)
        .select(COLONNES_ABONNEMENT);

      if (error) {
        setErreurAbonnement(
          traduireErreurAdmin(
            error,
            "Impossible de modifier l'abonnement. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAbonnement('Action non autorisée');
        return false;
      }

      const abonnementMisAJour = data[0];
      setAbonnements((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === abonnementMisAJour.id ? abonnementMisAJour : item
        )
      );

      await enregistrerDansJournal('modification_abonnement', entreprise.nom, {
        entreprise_id: entreprise.id,
        abonnement_id: abonnementMisAJour.id,
        formule: abonnementMisAJour.formule,
        date_debut: abonnementMisAJour.date_debut,
        date_fin: abonnementMisAJour.date_fin,
        montant_fcfa: abonnementMisAJour.montant_fcfa,
        statut_paiement: abonnementMisAJour.statut_paiement,
        reference: abonnementMisAJour.reference,
      });

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Abonnement modifié pour « ${entreprise.nom} ».`);
      return true;
    } catch {
      setErreurAbonnement(
        "Erreur réseau lors de la modification de l'abonnement. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setEnregistrementAbonnement(false);
    }
  }

  // 6. Création d'un compte utilisateur via l'Edge Function creer-utilisateur
  async function creerUtilisateur(donneesPropres) {
    if (!superAdminPret || creationUtilisateurEnCours) {
      return false;
    }

    reinitialiserMessages();
    setCreationUtilisateurEnCours(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'creer-utilisateur',
        {
          body: {
            email: donneesPropres.email,
            nom_complet: donneesPropres.nom_complet,
            role: donneesPropres.role,
            entreprise_id: donneesPropres.entreprise_id,
            mot_de_passe_temporaire: donneesPropres.mot_de_passe_temporaire,
          },
        }
      );

      if (error) {
        const messageErreur = await extraireMessageErreurEdgeFunction(
          error,
          "Impossible de créer l'utilisateur. Veuillez réessayer."
        );
        setErreurCreationUtilisateur(messageErreur);
        return false;
      }

      if (data?.error) {
        setErreurCreationUtilisateur(data.error);
        return false;
      }

      const utilisateurCree = data?.utilisateur;
      if (!utilisateurCree?.id) {
        setErreurCreationUtilisateur(
          "Réponse inattendue lors de la création de l'utilisateur."
        );
        return false;
      }

      const nouveauProfil = {
        id: utilisateurCree.id,
        entreprise_id: utilisateurCree.entreprise_id,
        nom_complet: utilisateurCree.nom_complet,
        role: utilisateurCree.role,
        actif: utilisateurCree.actif,
      };

      setProfils((listeActuelle) => [...listeActuelle, nouveauProfil]);

      if (data.journal_enregistre === false) {
        setAvertissementJournal(
          data.avertissement ||
            'Utilisateur créé, mais non enregistré dans le journal.'
        );
      }

      await rechargerDonneesSilencieusement();
      setMessageSucces(
        `Compte créé pour « ${utilisateurCree.nom_complet} » (${utilisateurCree.email}).`
      );
      return true;
    } catch {
      setErreurCreationUtilisateur(
        "Erreur réseau lors de la création de l'utilisateur. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setCreationUtilisateurEnCours(false);
    }
  }

  // 7. Activation / désactivation directe d'un utilisateur (profils.actif) + journal
  async function basculerActifUtilisateur(utilisateur) {
    if (!superAdminPret || actionUtilisateurId !== null) {
      return false;
    }

    // Garde-fou : le super_admin ne peut jamais se désactiver lui-même
    if (utilisateur.id === session.user.id && utilisateur.actif) {
      setErreurAction(
        'Vous ne pouvez pas désactiver votre propre compte Super admin.'
      );
      return false;
    }

    reinitialiserMessages();
    setActionUtilisateurId(utilisateur.id);

    const nouvelEtatActif = !utilisateur.actif;

    try {
      const { data, error } = await supabase
        .from('profils')
        .update({ actif: nouvelEtatActif })
        .eq('id', utilisateur.id)
        .select(COLONNES_PROFIL);

      if (error) {
        setErreurAction(
          traduireErreurAdmin(
            error,
            nouvelEtatActif
              ? "Impossible de réactiver l'utilisateur. Veuillez réessayer."
              : "Impossible de désactiver l'utilisateur. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return false;
      }

      const profilMisAJour = data[0];
      setProfils((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === profilMisAJour.id ? profilMisAJour : item
        )
      );

      const entrepriseRattachee = entreprises.find(
        (e) => e.id === profilMisAJour.entreprise_id
      );

      await enregistrerDansJournal(
        nouvelEtatActif
          ? 'activation_utilisateur'
          : 'desactivation_utilisateur',
        profilMisAJour.nom_complet,
        {
          utilisateur_id: profilMisAJour.id,
          role: profilMisAJour.role,
          entreprise_id: profilMisAJour.entreprise_id,
          entreprise_nom: entrepriseRattachee?.nom ?? null,
          actif: profilMisAJour.actif,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(
        nouvelEtatActif
          ? `Compte de « ${profilMisAJour.nom_complet} » réactivé.`
          : `Compte de « ${profilMisAJour.nom_complet} » désactivé.`
      );
      return true;
    } catch {
      setErreurAction(
        "Erreur réseau lors de la mise à jour de l'utilisateur. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionUtilisateurId(null);
    }
  }

  // Ouvre le formulaire d'édition pour une entreprise et fait défiler jusqu'à lui
  function ouvrirEditionEntreprise(entreprise) {
    setErreurCreation('');
    setErreurModificationEntreprise('');
    setEntrepriseEnEditionId(entreprise.id);

    setTimeout(() => {
      const section = document.getElementById('form-entreprise');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  function annulerEditionEntreprise() {
    setEntrepriseEnEditionId(null);
    setErreurModificationEntreprise('');
  }

  // Ouvre la section Abonnements de l'entreprise cliquée et fait défiler jusqu'à elle
  function ouvrirAbonnements(entreprise) {
    setErreurAbonnement('');
    setEntrepriseSelectionneeId(entreprise.id);

    setTimeout(() => {
      const section = document.getElementById('section-abonnements');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  // Calculs dérivés effectués uniquement par des fonctions pures de src/utils/admin.js
  const indicateurs = calculerIndicateursAdmin(
    entreprises,
    abonnements,
    lignesRpcClients
  );
  const carteNbClients = construireCarteNbClients(lignesRpcClients);
  const abonnementsParEntreprise =
    regrouperAbonnementsParEntreprise(abonnements);
  const entrepriseSelectionnee =
    entreprises.find((e) => e.id === entrepriseSelectionneeId) ?? null;
  const entrepriseEnEdition =
    entreprises.find((e) => e.id === entrepriseEnEditionId) ?? null;
  const abonnementsEntrepriseSelectionnee = entrepriseSelectionnee
    ? (abonnementsParEntreprise[entrepriseSelectionnee.id] ?? [])
    : [];

  return (
    <div className="app">
      <Header />

      {chargementDonnees ? (
        <section
          className="card clients-status-card"
          role="status"
          aria-live="polite"
        >
          <p className="clients-loading-text">
            Chargement du tableau de bord Super admin...
          </p>
        </section>
      ) : erreurChargement ? (
        <section className="card clients-status-card" role="alert">
          <p className="action-error-text">{erreurChargement}</p>
          <div className="clients-retry-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCompteurRechargement((c) => c + 1)}
            >
              Réessayer
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Bandeaux de retour après une action (succès, avertissement journal, erreur) */}
          {messageSucces && (
            <div className="success-message" role="status" aria-live="polite">
              {messageSucces}
            </div>
          )}

          {avertissementJournal && (
            <div className="import-report import-report-warning" role="status">
              <div className="import-report-header">
                <p className="import-report-summary">{avertissementJournal}</p>
                <button
                  type="button"
                  className="btn-close-report"
                  onClick={() => setAvertissementJournal('')}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {erreurAction && (
            <div className="action-error-banner" role="alert">
              <p className="action-error-text">{erreurAction}</p>
              <button
                type="button"
                className="btn-close-report"
                onClick={() => setErreurAction('')}
              >
                Fermer
              </button>
            </div>
          )}

          {/* 1. Indicateurs clés en haut */}
          <AdminKpis indicateurs={indicateurs} />

          {/* 2. Formulaire de création / modification d'entreprise */}
          <EntrepriseForm
            key={entrepriseEnEdition?.id ?? 'creation'}
            entrepriseEnEdition={entrepriseEnEdition}
            onCreerEntreprise={creerEntreprise}
            onModifierEntreprise={modifierEntreprise}
            onAnnulerEdition={annulerEditionEntreprise}
            enCours={
              entrepriseEnEdition
                ? modificationEntrepriseEnCours
                : creationEnCours
            }
            erreurServeur={
              entrepriseEnEdition
                ? erreurModificationEntreprise
                : erreurCreation
            }
          />

          {/* 3. Tableau des entreprises + modification / suspension / réactivation */}
          <EntreprisesTable
            entreprises={entreprises}
            carteNbClients={carteNbClients}
            abonnementsParEntreprise={abonnementsParEntreprise}
            entrepriseSelectionneeId={entrepriseSelectionneeId}
            entrepriseEnEditionId={entrepriseEnEditionId}
            onModifierEntreprise={ouvrirEditionEntreprise}
            onSelectionnerAbonnements={ouvrirAbonnements}
            onSuspendreEntreprise={suspendreEntreprise}
            onReactiverEntreprise={reactiverEntreprise}
            actionEnCoursId={actionEntrepriseId}
          />

          {/* 4. Panneau des abonnements de l'entreprise sélectionnée */}
          {entrepriseSelectionnee && (
            <AbonnementsPanel
              key={entrepriseSelectionnee.id}
              entreprise={entrepriseSelectionnee}
              abonnements={abonnementsEntrepriseSelectionnee}
              onAjouterAbonnement={ajouterAbonnement}
              onModifierAbonnement={modifierAbonnement}
              onFermer={() => {
                setEntrepriseSelectionneeId(null);
                setErreurAbonnement('');
              }}
              enCours={enregistrementAbonnement}
              erreurServeur={erreurAbonnement}
            />
          )}

          {/* 5. Utilisateurs par entreprise + création et activation / désactivation */}
          <UtilisateursSection
            entreprises={entreprises}
            profils={profils}
            utilisateurConnecteId={session?.user?.id ?? null}
            onCreerUtilisateur={creerUtilisateur}
            onBasculerActifUtilisateur={basculerActifUtilisateur}
            creationEnCours={creationUtilisateurEnCours}
            actionUtilisateurId={actionUtilisateurId}
            erreurCreation={erreurCreationUtilisateur}
          />

          {/* 6. Dernières actions (20 plus récentes du journal) */}
          <JournalSection entrees={journal} />
        </>
      )}

      <footer className="footer">MiniGest v2 — Administration</footer>
    </div>
  );
}

export default Admin;
