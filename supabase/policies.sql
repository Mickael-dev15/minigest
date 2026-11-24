-- ============================================================================
-- MiniGest v2 — Sécurité RLS, fonctions utilitaires et trigger (Lot 1, étape 1)
-- ============================================================================
-- À exécuter EN SECOND dans le SQL Editor de Supabase, juste après schema.sql.
-- Ce script est ré-exécutable sans erreur grâce aux "create or replace" et
-- "drop ... if exists".
-- ============================================================================

-- ============================================================================
-- 1. ACTIVATION DE ROW LEVEL SECURITY (RLS) SUR LES 5 TABLES
-- ============================================================================
-- Sans politique explicite, PostgreSQL refuse TOUT accès par défaut dès que
-- RLS est activée. Chaque droit ci-dessous est donc accordé au strict minimum.

alter table public.entreprises enable row level security;
alter table public.profils     enable row level security;
alter table public.clients     enable row level security;
alter table public.abonnements enable row level security;
alter table public.journal     enable row level security;

-- ============================================================================
-- 2. FONCTIONS UTILITAIRES SECURITY DEFINER (ANTI-RÉCURSION SUR PROFILS)
-- ============================================================================
-- Ces fonctions s'exécutent avec les privilèges de leur créateur (le rôle
-- propriétaire de la base) afin de lire public.profils sans redéclencher les
-- politiques RLS de profils (ce qui provoquerait une récursion infinie).
--
-- Sécurité appliquée sur CHAQUE fonction SECURITY DEFINER :
--   - "set search_path = public" pour empêcher le détournement de schéma ;
--   - REVOKE EXECUTE pour public et anon ;
--   - GRANT EXECUTE uniquement au rôle authenticated (utilisateurs connectés).

-- 2.1 Retourne l'entreprise_id de l'utilisateur connecté (si son profil est actif).
-- Retourne NULL pour un super_admin ou un compte désactivé.
create or replace function public.mon_entreprise_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.entreprise_id
  from public.profils p
  where p.id = auth.uid()
    and p.actif = true;
$$;

revoke execute on function public.mon_entreprise_id() from public, anon;
grant  execute on function public.mon_entreprise_id() to authenticated;

-- 2.2 Retourne true si l'utilisateur connecté est un super_admin actif.
create or replace function public.est_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profils p
    where p.id = auth.uid()
      and p.role = 'super_admin'
      and p.actif = true
  );
$$;

revoke execute on function public.est_super_admin() from public, anon;
grant  execute on function public.est_super_admin() to authenticated;

-- 2.3 Retourne true si l'utilisateur connecté est un gérant actif.
-- Utilisée dans la politique de lecture des profils d'une même entreprise.
create or replace function public.est_gerant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profils p
    where p.id = auth.uid()
      and p.role = 'gerant'
      and p.actif = true
  );
$$;

revoke execute on function public.est_gerant() from public, anon;
grant  execute on function public.est_gerant() to authenticated;

-- 2.4 Retourne true uniquement si l'utilisateur connecté est un gérant ou un
-- employé actif appartenant à une entreprise au statut 'active'.
-- Retourne toujours false pour le super_admin, un compte inactif ou une
-- entreprise suspendue.
create or replace function public.mon_entreprise_est_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profils p
    join public.entreprises e on e.id = p.entreprise_id
    where p.id = auth.uid()
      and p.actif = true
      and p.role in ('gerant', 'employe')
      and e.statut = 'active'
  );
$$;

revoke execute on function public.mon_entreprise_est_active() from public, anon;
grant  execute on function public.mon_entreprise_est_active() to authenticated;

-- 2.5 Comptage des clients par entreprise, strictement réservé au super_admin.
-- Renvoie uniquement (entreprise_id, nb_clients), jamais le détail des clients.
create or replace function public.nb_clients_par_entreprise()
returns table (
  entreprise_id uuid,
  nb_clients    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Bloque tout utilisateur qui n'est pas super_admin actif
  if not public.est_super_admin() then
    raise exception 'Accès refusé : cette fonction est réservée au super_admin.';
  end if;

  return query
    select
      e.id as entreprise_id,
      count(c.id)::bigint as nb_clients
    from public.entreprises e
    left join public.clients c on c.entreprise_id = e.id
    group by e.id;
end;
$$;

revoke execute on function public.nb_clients_par_entreprise() from public, anon;
grant  execute on function public.nb_clients_par_entreprise() to authenticated;

-- ============================================================================
-- 3. TRIGGERS BEFORE UPDATE : PROTECTION DES COLONNES IMMUABLES
-- ============================================================================
-- 3.1 Trigger sur profils : protection de role et entreprise_id
-- Ce trigger garantit au niveau de la base que personne ne peut modifier son
-- propre rôle ni son entreprise_id (ni ceux d'un autre profil) via la clé
-- publique (rôles applicatifs authenticated / anon).
-- Seule une action d'administration côté serveur ou SQL Editor (postgres /
-- service_role, où auth.uid() est NULL) reste possible si nécessaire.

create or replace function public.bloquer_modif_role_entreprise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.entreprise_id is distinct from old.entreprise_id then
    -- Bloque toute modification effectuée par un rôle applicatif
    if current_user in ('authenticated', 'anon') or auth.uid() is not null then
      raise exception
        'Opération interdite : impossible de modifier role ou entreprise_id sur profils.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profils_bloquer_modif_role_entreprise on public.profils;

create trigger trg_profils_bloquer_modif_role_entreprise
  before update on public.profils
  for each row
  execute function public.bloquer_modif_role_entreprise();

-- 3.2 Trigger sur clients : protection de date_ajout, cree_par et entreprise_id
-- Empêche toute modification de la date d'ajout, de l'auteur d'origine ou de
-- l'entreprise rattachée à une fiche client existante.

create or replace function public.bloquer_modif_colonnes_clients()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.date_ajout is distinct from old.date_ajout
     or new.cree_par is distinct from old.cree_par
     or new.entreprise_id is distinct from old.entreprise_id then
    raise exception
      'Opération interdite : impossible de modifier date_ajout, cree_par ou entreprise_id sur clients.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clients_bloquer_modif_colonnes on public.clients;

create trigger trg_clients_bloquer_modif_colonnes
  before update on public.clients
  for each row
  execute function public.bloquer_modif_colonnes_clients();

-- ============================================================================
-- 4. POLITIQUES RLS : TABLE CLIENTS
-- ============================================================================
-- Règle : un utilisateur actif d'une entreprise active lit et écrit uniquement
-- les clients de son entreprise. Le super_admin n'a AUCUN accès aux lignes.

drop policy if exists clients_select_entreprise_active on public.clients;
create policy clients_select_entreprise_active
  on public.clients
  for select
  to authenticated
  using (
    not public.est_super_admin()
    and public.mon_entreprise_est_active()
    and entreprise_id = public.mon_entreprise_id()
  );

drop policy if exists clients_insert_entreprise_active on public.clients;
create policy clients_insert_entreprise_active
  on public.clients
  for insert
  to authenticated
  with check (
    not public.est_super_admin()
    and public.mon_entreprise_est_active()
    and entreprise_id = public.mon_entreprise_id()
    and (cree_par is null or cree_par = auth.uid())
  );

drop policy if exists clients_update_entreprise_active on public.clients;
create policy clients_update_entreprise_active
  on public.clients
  for update
  to authenticated
  using (
    not public.est_super_admin()
    and public.mon_entreprise_est_active()
    and entreprise_id = public.mon_entreprise_id()
  )
  with check (
    not public.est_super_admin()
    and public.mon_entreprise_est_active()
    and entreprise_id = public.mon_entreprise_id()
  );

drop policy if exists clients_delete_entreprise_active on public.clients;
create policy clients_delete_entreprise_active
  on public.clients
  for delete
  to authenticated
  using (
    not public.est_super_admin()
    and public.mon_entreprise_est_active()
    and entreprise_id = public.mon_entreprise_id()
  );

-- ============================================================================
-- 5. POLITIQUES RLS : TABLE ENTREPRISES
-- ============================================================================
-- Règle : le super_admin peut lire, créer et modifier les entreprises (aucune
-- politique DELETE) ; un gérant ou un employé actif lit uniquement sa propre
-- entreprise (y compris si elle est suspendue, afin que l'interface puisse
-- afficher le motif de suspension).

drop policy if exists entreprises_super_admin_all on public.entreprises;

drop policy if exists entreprises_super_admin_select on public.entreprises;
create policy entreprises_super_admin_select
  on public.entreprises
  for select
  to authenticated
  using (public.est_super_admin());

drop policy if exists entreprises_super_admin_insert on public.entreprises;
create policy entreprises_super_admin_insert
  on public.entreprises
  for insert
  to authenticated
  with check (public.est_super_admin());

drop policy if exists entreprises_super_admin_update on public.entreprises;
create policy entreprises_super_admin_update
  on public.entreprises
  for update
  to authenticated
  using (public.est_super_admin())
  with check (public.est_super_admin());

drop policy if exists entreprises_select_ma_societe on public.entreprises;
create policy entreprises_select_ma_societe
  on public.entreprises
  for select
  to authenticated
  using (id = public.mon_entreprise_id());

-- ============================================================================
-- 6. POLITIQUES RLS : TABLE ABONNEMENTS
-- ============================================================================
-- Règle : le super_admin peut lire, créer et modifier les abonnements (aucune
-- politique DELETE afin de conserver l'historique) ; un gérant ou un employé
-- actif lit uniquement les abonnements de sa propre entreprise.

drop policy if exists abonnements_super_admin_all on public.abonnements;

drop policy if exists abonnements_super_admin_select on public.abonnements;
create policy abonnements_super_admin_select
  on public.abonnements
  for select
  to authenticated
  using (public.est_super_admin());

drop policy if exists abonnements_super_admin_insert on public.abonnements;
create policy abonnements_super_admin_insert
  on public.abonnements
  for insert
  to authenticated
  with check (public.est_super_admin());

drop policy if exists abonnements_super_admin_update on public.abonnements;
create policy abonnements_super_admin_update
  on public.abonnements
  for update
  to authenticated
  using (public.est_super_admin())
  with check (public.est_super_admin());

drop policy if exists abonnements_select_ma_societe on public.abonnements;
create policy abonnements_select_ma_societe
  on public.abonnements
  for select
  to authenticated
  using (entreprise_id = public.mon_entreprise_id());

-- ============================================================================
-- 7. POLITIQUES RLS : TABLE PROFILS
-- ============================================================================
-- Lecture :
--   - Chacun lit son propre profil ;
--   - Le gérant actif lit tous les profils de son entreprise ;
--   - Le super_admin lit tous les profils.
--
-- Écriture :
--   - AUCUNE politique INSERT ni DELETE (création/suppression gérées côté
--     serveur au Lot 2, jamais via la clé publique).
--   - UPDATE autorisé sur son propre profil actif (sans pouvoir changer
--     role, entreprise_id ni se réactiver soi-même) et par le super_admin
--     (ex. modifier nom_complet ou actif d'un utilisateur, sans pouvoir changer
--     role ni entreprise_id grâce au trigger BEFORE UPDATE).

drop policy if exists profils_select_soi_meme on public.profils;
create policy profils_select_soi_meme
  on public.profils
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profils_select_gerant_entreprise on public.profils;
create policy profils_select_gerant_entreprise
  on public.profils
  for select
  to authenticated
  using (
    public.est_gerant()
    and entreprise_id = public.mon_entreprise_id()
  );

drop policy if exists profils_select_super_admin on public.profils;
create policy profils_select_super_admin
  on public.profils
  for select
  to authenticated
  using (public.est_super_admin());

drop policy if exists profils_update_soi_meme on public.profils;
create policy profils_update_soi_meme
  on public.profils
  for update
  to authenticated
  using (
    id = auth.uid()
    and actif = true
  )
  with check (
    id = auth.uid()
    and actif = true
  );

drop policy if exists profils_update_super_admin on public.profils;
create policy profils_update_super_admin
  on public.profils
  for update
  to authenticated
  using (public.est_super_admin())
  with check (
    public.est_super_admin()
    and (id <> auth.uid() or actif = true)
  );

-- ============================================================================
-- 8. POLITIQUES RLS : TABLE JOURNAL
-- ============================================================================
-- Règle : lecture (et insertion d'audit) réservées au super_admin.
-- Aucune politique UPDATE ni DELETE afin que l'historique reste immuable.

drop policy if exists journal_select_super_admin on public.journal;
create policy journal_select_super_admin
  on public.journal
  for select
  to authenticated
  using (public.est_super_admin());

drop policy if exists journal_insert_super_admin on public.journal;
create policy journal_insert_super_admin
  on public.journal
  for insert
  to authenticated
  with check (
    public.est_super_admin()
    and (acteur_id is null or acteur_id = auth.uid())
  );
