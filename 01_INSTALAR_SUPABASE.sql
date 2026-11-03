-- BRISA CHAT / sala temporal para GitHub Pages
-- Ejecutar UNA VEZ en Supabase -> SQL Editor -> Run.
-- Las salas usan IDs aleatorios de 192 bits en el fragmento de URL.
-- La tabla NO permite lectura directa a los visitantes; solo se accede vía funciones RPC.

create table if not exists public.brisa_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null check (room_id ~ '^[0-9a-f]{48}$'),
  sender_id uuid not null,
  sender_name text not null check (char_length(sender_name) between 1 and 28),
  kind text not null check (kind in ('text','photo')),
  text_body text,
  photo_data text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint brisa_payload_ok check (
    (kind='text' and text_body is not null and char_length(text_body) between 1 and 2000 and photo_data is null)
    or
    (kind='photo' and text_body is null and (photo_data is null or (char_length(photo_data) between 100 and 240000 and photo_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')))
  )
);
create index if not exists brisa_room_idx on public.brisa_messages(room_id,created_at);
create index if not exists brisa_expiry_idx on public.brisa_messages(expires_at);
alter table public.brisa_messages enable row level security;
revoke all on table public.brisa_messages from public, anon, authenticated;

-- Solo el servidor devuelve metadatos. Las fotos no son visibles con la consulta de sala.
create or replace function public.brisa_feed(p_room text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_room is null or p_room !~ '^[0-9a-f]{48}$' then raise exception 'Sala inválida'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id, 'sender_id',m.sender_id,'sender_name',m.sender_name,
    'kind',m.kind,'text_body',m.text_body,
    'photo_available',(m.kind='photo' and m.photo_data is not null and m.consumed_at is null),
    'created_at',m.created_at,'expires_at',m.expires_at
  ) order by m.created_at,m.id),'[]'::jsonb)
  into result
  from (select * from public.brisa_messages where room_id=p_room and expires_at>now() order by created_at desc limit 150) m;
  return result;
end $$;

create or replace function public.brisa_send(p_room text,p_sender uuid,p_name text,p_kind text,p_payload text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_room is null or p_room !~ '^[0-9a-f]{48}$' then raise exception 'Sala inválida'; end if;
  if p_sender is null or p_name is null or char_length(btrim(p_name)) not between 1 and 28 then raise exception 'Nombre inválido'; end if;
  if p_kind not in ('text','photo') then raise exception 'Tipo inválido'; end if;
  if p_kind='text' and (p_payload is null or char_length(btrim(p_payload)) not between 1 and 2000) then raise exception 'Texto inválido'; end if;
  if p_kind='photo' and (p_payload is null or char_length(p_payload) not between 100 and 240000 or p_payload !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Foto inválida o demasiado grande'; end if;
  -- Evita que una sala acumule un número excesivo de envíos por minuto.
  if (select count(*) from public.brisa_messages where room_id=p_room and created_at>now()-interval '1 minute')>=60 then raise exception 'Demasiados mensajes. Intentá de nuevo en un minuto'; end if;
  insert into public.brisa_messages(room_id,sender_id,sender_name,kind,text_body,photo_data)
  values (p_room,p_sender,btrim(p_name),p_kind,case when p_kind='text' then btrim(p_payload) else null end,case when p_kind='photo' then p_payload else null end)
  returning id into new_id;
  return new_id;
end $$;

-- Operación atómica: solamente la PRIMERA persona que abre una imagen obtiene sus bytes.
-- Bloquear fila, leer foto y borrarla dentro de una única transacción.
create or replace function public.brisa_open_photo(p_room text,p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare photo text;
begin
  if p_room is null or p_room !~ '^[0-9a-f]{48}$' or p_id is null then raise exception 'Solicitud inválida'; end if;
  select photo_data into photo from public.brisa_messages
    where id=p_id and room_id=p_room and kind='photo' and consumed_at is null
      and photo_data is not null and expires_at>now()
    for update;
  if photo is null then return null; end if;
  update public.brisa_messages set photo_data=null,consumed_at=now() where id=p_id;
  return photo;
end $$;

-- Revocar permisos implícitos y exponer solo estas tres operaciones públicas.
revoke execute on function public.brisa_feed(text) from public,anon,authenticated;
revoke execute on function public.brisa_send(text,uuid,text,text,text) from public,anon,authenticated;
revoke execute on function public.brisa_open_photo(text,uuid) from public,anon,authenticated;
grant execute on function public.brisa_feed(text) to anon,authenticated;
grant execute on function public.brisa_send(text,uuid,text,text,text) to anon,authenticated;
grant execute on function public.brisa_open_photo(text,uuid) to anon,authenticated;

-- Función interna de limpieza, no disponible para el público.
create or replace function public.brisa_cleanup() returns void language sql security definer set search_path = '' as $$
  delete from public.brisa_messages where expires_at<=now();
$$;
revoke execute on function public.brisa_cleanup() from public,anon,authenticated;

-- DESPUÉS ejecutá 02_ACTIVAR_BORRADO_AUTOMATICO.sql para asegurar borrado físico.
