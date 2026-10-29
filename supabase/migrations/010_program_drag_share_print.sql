-- SongApp v10
-- Rulează după 006_meeting_reorder_and_stability.sql.
-- Adaugă reordonare prin drag & drop pentru grupul principal și grupul backup.

create or replace function public.reorder_meeting_items(
  p_meeting_id uuid,
  p_item_ids uuid[],
  p_is_backup boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_received_count integer;
  v_base integer;
  v_item_id uuid;
  v_index integer := 1;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  if p_meeting_id is null then
    raise exception 'Lipsește programul.';
  end if;

  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    return true;
  end if;

  select count(*)
    into v_expected_count
  from public.meeting_items
  where meeting_id = p_meeting_id
    and is_backup = p_is_backup;

  v_received_count := array_length(p_item_ids, 1);

  if v_expected_count <> v_received_count then
    raise exception 'Lista primită nu conține toate elementele din acest grup. Reîncarcă pagina și încearcă din nou.';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as input_id(id)
    left join public.meeting_items mi
      on mi.id = input_id.id
     and mi.meeting_id = p_meeting_id
     and mi.is_backup = p_is_backup
    where mi.id is null
  ) then
    raise exception 'Lista conține elemente invalide pentru acest program.';
  end if;

  v_base := case when p_is_backup then 900 else 0 end;

  -- Evită conflictul cu unique(meeting_id, position) prin poziții temporare negative.
  v_index := 1;
  foreach v_item_id in array p_item_ids loop
    update public.meeting_items
    set position = -1000000 - v_index
    where id = v_item_id
      and meeting_id = p_meeting_id
      and is_backup = p_is_backup;
    v_index := v_index + 1;
  end loop;

  v_index := 1;
  foreach v_item_id in array p_item_ids loop
    update public.meeting_items
    set position = v_base + v_index
    where id = v_item_id
      and meeting_id = p_meeting_id
      and is_backup = p_is_backup;
    v_index := v_index + 1;
  end loop;

  return true;
end;
$$;

grant execute on function public.reorder_meeting_items(uuid, uuid[], boolean) to authenticated;
