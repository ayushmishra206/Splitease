-- Migration: init
-- SplitEase initial schema

create extension if not exists "pgcrypto";

-- Helper function for updated_at triggers
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_groups_updated_at
before update on groups
for each row
execute procedure handle_updated_at();

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, member_id)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  payer_id uuid references profiles(id) on delete set null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_expenses_updated_at
before update on expenses
for each row
execute procedure handle_updated_at();

create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  share numeric(12, 2) not null check (share >= 0)
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member uuid not null references profiles(id) on delete cascade,
  to_member uuid not null references profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  settlement_date date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;

-- Helper functions for RLS
create or replace function public.is_group_member(target_group uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from groups
    where id = target_group
      and owner_id = auth.uid()
  ) then
    return true;
  end if;

  return exists (
    select 1
    from group_members
    where group_id = target_group
      and member_id = auth.uid()
  );
end;
$$;

create or replace function public.is_group_admin(target_group uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from groups
    where id = target_group
      and owner_id = auth.uid()
  ) then
    return true;
  end if;

  return exists (
    select 1
    from group_members
    where group_id = target_group
      and member_id = auth.uid()
      and role = 'owner'
  );
end;
$$;

-- Profiles policies
create policy "Profiles are self-insertable"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are self-readable"
  on profiles for select using (auth.uid() = id);

create policy "Profiles are self-updatable"
  on profiles for update using (auth.uid() = id);

create policy "Profiles readable to authenticated"
  on profiles for select using (auth.uid() is not null);

-- Groups policies
create policy "Group owners insert groups"
  on groups for insert
  with check (owner_id = auth.uid());

create policy "Group owners update groups"
  on groups for update
  using (owner_id = auth.uid());

create policy "Group owners delete groups"
  on groups for delete
  using (owner_id = auth.uid());

create policy "Members read groups"
  on groups for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from group_members gm
      where gm.group_id = groups.id and gm.member_id = auth.uid()
    )
  );

-- Group members policies
create policy "Members read group membership"
  on group_members for select
  using (is_group_member(group_id));

create policy "Owners manage membership"
  on group_members for all
  using (is_group_admin(group_id))
  with check (is_group_admin(group_id));

create policy "Members manage their membership"
  on group_members for delete
  using (member_id = auth.uid());

-- Expenses policies
create policy "Members read expenses"
  on expenses for select using (is_group_member(group_id));

create policy "Members write expenses"
  on expenses for all using (is_group_member(group_id));

-- Expense splits policies
create policy "Members manage splits"
  on expense_splits for all using (
    expense_id in (
      select id from expenses where is_group_member(group_id)
    )
  );

-- Settlements policies
create policy "Members manage settlements"
  on settlements for all using (is_group_member(group_id));

-- ============================================================
-- Grants
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on groups to authenticated;
