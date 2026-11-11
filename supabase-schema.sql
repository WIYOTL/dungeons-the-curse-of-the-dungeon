create table if not exists public.player_saves (
    user_id uuid primary key references auth.users (id) on delete cascade,
    save_data jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;
revoke all on public.player_saves from anon;
grant select, insert, update on public.player_saves to authenticated;

drop policy if exists "Players can read their own save" on public.player_saves;
drop policy if exists "Players can create their own save" on public.player_saves;
drop policy if exists "Players can update their own save" on public.player_saves;

create policy "Players can read their own save"
    on public.player_saves for select
    using ((select auth.uid()) = user_id);

create policy "Players can create their own save"
    on public.player_saves for insert
    with check ((select auth.uid()) = user_id);

create policy "Players can update their own save"
    on public.player_saves for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
