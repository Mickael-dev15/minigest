-- ============================================================================
-- MiniGest v2 — Double authentification (MFA / TOTP) du Super admin (Mini-lot I)
-- ============================================================================
-- ORDRE D'EXÉCUTION (IMPORTANT) :
--   À exécuter UNIQUEMENT APRÈS que l'inscription TOTP du Super admin a été
--   testée avec succès dans l'application (connexion -> /admin/securite ->
--   validation du code à 6 chiffres -> accès à /admin en aal2).
--   Exécuter ce script avant d'avoir vérifié le flux MFA côté interface
--   bloquerait immédiatement tout accès Super admin en base tant que la
--   session n'est pas en niveau 'aal2'.
--
-- Ce script est ré-exécutable sans erreur grâce à "create or replace".
-- Aucun autre script SQL (schema.sql, policies.sql) n'a besoin d'être modifié.
-- ============================================================================

-- ============================================================================
-- EFFET SUR LES POLITIQUES RLS ET FONCTIONS EXISTANTES
-- ============================================================================
-- En redéfinissant public.est_super_admin() pour exiger le niveau 'aal2' dans
-- le JWT (coalesce(auth.jwt() ->> 'aal', '') = 'aal2'), TOUTES les règles
-- existantes qui appellent cette fonction exigent automatiquement la double
-- authentification pour le Super admin, sans toucher aux autres politiques :
--
-- 1. Accès bloqués en aal1, autorisés uniquement en aal2 pour le Super admin :
--    - public.entreprises (select, insert, update via entreprises_super_admin_*)
--    - public.abonnements (select, insert, update via abonnements_super_admin_*)
--    - public.profils     (lecture/modification de tous les profils via
--                          profils_select_super_admin et profils_update_super_admin)
--    - public.journal     (lecture/écriture via journal_select_super_admin et
--                          journal_insert_super_admin)
--    - public.nb_clients_par_entreprise() (fonction RPC protégée par est_super_admin())
--
-- 2. Ce qui reste volontairement accessible au Super admin en aal1 :
--    - public.profils (politique profils_select_soi_meme : id = auth.uid()).
--      Le Super admin peut lire uniquement SON propre profil juste après la
--      connexion par mot de passe, ce qui permet à React d'identifier le rôle
--      'super_admin' et de le rediriger vers /admin/securite ou /admin/verification.
--
-- 3. Sécurité inchangée sur public.clients :
--    - Les politiques clients_*_entreprise_active vérifient à la fois
--      "not public.est_super_admin()" ET "public.mon_entreprise_est_active()".
--      Comme mon_entreprise_est_active() exige role in ('gerant', 'employe')
--      et une entreprise active, le Super admin reste totalement bloqué sur
--      public.clients en aal1 comme en aal2.
--
-- 4. Gérants et employés :
--    - Aucun impact : leurs politiques reposent sur mon_entreprise_id(),
--      mon_entreprise_est_active() et est_gerant().
-- ============================================================================

create or replace function public.est_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.profils p
      where p.id = auth.uid()
        and p.role = 'super_admin'
        and p.actif = true
    );
$$;

revoke execute on function public.est_super_admin() from public, anon;
grant  execute on function public.est_super_admin() to authenticated;
