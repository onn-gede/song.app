-- SongApp MVP fix v2
-- Rulează după 005_app_helper_functions.sql.
-- Adaugă mutarea elementelor în program și stabilizează ștergerea.

create or replace function public.move_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid,
  p_direction text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_position integer;
  v_current_is_backup boolean;
  v_target_id uuid;
  v_target_position integer;
  v_temp_position integer;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  select position, is_backup
    into v_current_position, v_current_is_backup
  from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  if v_current_position is null then
    raise exception 'Elementul nu există în acest program.';
  end if;

  if p_direction = 'up' then
    select id, position
      into v_target_id, v_target_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and is_backup = v_current_is_backup
      and position < v_current_position
    order by position desc
    limit 1;
  elsif p_direction = 'down' then
    select id, position
      into v_target_id, v_target_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and is_backup = v_current_is_backup
      and position > v_current_position
    order by position asc
    limit 1;
  else
    raise exception 'Direcția trebuie să fie up sau down.';
  end if;

  if v_target_id is null then
    return false;
  end if;

  v_temp_position := -1000000000 - floor(random() * 1000000)::integer;

  update public.meeting_items
  set position = v_temp_position
  where id = p_item_id
    and meeting_id = p_meeting_id;

  update public.meeting_items
  set position = v_current_position
  where id = v_target_id
    and meeting_id = p_meeting_id;

  update public.meeting_items
  set position = v_target_position
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.move_meeting_item(uuid, uuid, text) to authenticated;

create or replace function public.remove_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  delete from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.remove_meeting_item(uuid, uuid) to authenticated;
