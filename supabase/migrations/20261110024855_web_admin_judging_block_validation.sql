create or replace function public.web_admin_judging_operation(
  p_action text, p_event_id uuid, p_allowed_event_ids uuid[], p_actor_id text, p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  e public.events%rowtype;
  r public.routines%rowtype;
  j public.judges%rowtype;
  b public.blocks%rowtype;
  target text := coalesce(p_data->>'routine_id', p_data->>'judge_id', '');
  prior jsonb;
  result jsonb;
  ids text[];
begin
  if p_actor_id is null or length(p_actor_id) > 160 or p_event_id is null or not coalesce(p_event_id = any(p_allowed_event_ids), false) then
    raise exception using errcode='42501', message='Evento fuera del alcance de Levitate.';
  end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception using errcode='P0002', message='No se encontro el evento.'; end if;
  if e.event_type='archived' and p_action not in ('restore','access-codes') then
    raise exception using errcode='22023', message='El evento esta archivado.';
  end if;
  if p_action='access-codes' then
    return jsonb_build_object('codes', coalesce((select jsonb_agg(jsonb_build_object('judge_id', c.judge_id, 'name', u.name, 'role', u.role, 'access_code', c.access_code))
      from public.judge_access_codes c join public.judges u using(event_id,judge_id) where c.event_id=p_event_id), '[]'::jsonb));
  elsif p_action in ('metadata','move-routine','delete-routine') then
    select * into r from public.routines where event_id=p_event_id and routine_id=target for update;
    if not found then raise exception using errcode='P0002', message='No se encontro la coreografia.'; end if;
    if p_data->>'expected_updated_at' is null or r.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then
      raise exception using errcode='40001', message='La coreografia cambio. Actualiza antes de volver a guardar.';
    end if;
    prior := to_jsonb(r);
    if p_action='metadata' then
      if p_data->>'field' not in ('name','academy','division','genre','level','category','choreographer','state','scheduled_time','duration') then
        raise exception using errcode='22023', message='Campo de coreografia no permitido.';
      end if;
      update public.routines set
        name=case when p_data->>'field'='name' then p_data->>'value' else name end,
        academy=case when p_data->>'field'='academy' then p_data->>'value' else academy end,
        division=case when p_data->>'field'='division' then p_data->>'value' else division end,
        genre=case when p_data->>'field'='genre' then p_data->>'value' else genre end,
        level=case when p_data->>'field'='level' then p_data->>'value' else level end,
        category=case when p_data->>'field'='category' then p_data->>'value' else category end,
        choreographer=case when p_data->>'field'='choreographer' then p_data->>'value' else choreographer end,
        state=case when p_data->>'field'='state' then p_data->>'value' else state end,
        scheduled_time=case when p_data->>'field'='scheduled_time' then p_data->>'value' else scheduled_time end,
        duration=case when p_data->>'field'='duration' then p_data->>'value' else duration end
      where event_id=p_event_id and routine_id=target returning to_jsonb(routines.*) into result;
    elsif p_action='move-routine' then
      select * into b from public.blocks where event_id=p_event_id and block_id=p_data->>'target_block_id';
      if not found then raise exception using errcode='P0002', message='No se encontro el bloque destino.'; end if;
      if exists(select 1 from public.special_awards a join public.special_awards d on d.event_id=a.event_id and d.award=a.award and d.block_id=b.block_id
        where a.event_id=p_event_id and a.routine_id=target and d.routine_id is distinct from target) then
        raise exception using errcode='40001', message='El bloque destino ya tiene un premio asignado. Revisalo antes de mover la coreografia.';
      end if;
      -- Merge legacy and multiple votes before moving, preserving every other routine's votes.
      insert into public.routine_favorite_votes(event_id,block_id,routine_id,judge_id,category,device_id,updated_at)
        select event_id,b.block_id,routine_id,judge_id,category,device_id,updated_at from public.routine_favorites where event_id=p_event_id and routine_id=target
        on conflict(event_id,block_id,routine_id,judge_id,category) do nothing;
      insert into public.routine_favorite_votes(event_id,block_id,routine_id,judge_id,category,device_id,updated_at)
        select event_id,b.block_id,routine_id,judge_id,category,device_id,updated_at from public.routine_favorite_votes where event_id=p_event_id and routine_id=target and block_id<>b.block_id
        on conflict(event_id,block_id,routine_id,judge_id,category) do nothing;
      delete from public.routine_favorite_votes where event_id=p_event_id and routine_id=target and block_id<>b.block_id;
      delete from public.routine_favorites where event_id=p_event_id and routine_id=target;
      update public.special_awards set block_id=b.block_id where event_id=p_event_id and routine_id=target;
      update public.routines set block_id=b.block_id,block=b.name,block_title=b.title where event_id=p_event_id and routine_id=target returning to_jsonb(routines.*) into result;
      update public.scores set block_id=b.block_id where event_id=p_event_id and routine_id=target;
      update public.feedback set block_id=b.block_id where event_id=p_event_id and routine_id=target;
      update public.penalties set block_id=b.block_id where event_id=p_event_id and routine_id=target;
      update public.judge_activity set block_id=b.block_id where event_id=p_event_id and routine_id=target;
    else
      if p_data->>'confirmation' is distinct from target then raise exception using errcode='22023', message='Confirma el numero de la coreografia.'; end if;
      -- Capture affected sheets before the existing FK cascades remove them.
      prior := prior || jsonb_build_object('scores', (select coalesce(jsonb_agg(s), '[]') from public.scores s where event_id=p_event_id and routine_id=target),
        'feedback', (select coalesce(jsonb_agg(f), '[]') from public.feedback f where event_id=p_event_id and routine_id=target),
        'penalties', (select coalesce(jsonb_agg(p), '[]') from public.penalties p where event_id=p_event_id and routine_id=target));
      delete from public.routines where event_id=p_event_id and routine_id=target;
      result := jsonb_build_object('deleted',true,'routine_id',target);
    end if;
  elsif p_action in ('upsert-judge','delete-judge') then
    if target in ('ati','admin') or target='' then raise exception using errcode='22023', message='No se puede editar ese perfil desde jueces.'; end if;
    select * into j from public.judges where event_id=p_event_id and judge_id=target for update;
    if found then
      if j.role<>'judge' then raise exception using errcode='42501', message='No se puede modificar un administrador desde jueces.'; end if;
      if p_data->>'expected_updated_at' is null or j.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then
        raise exception using errcode='40001', message='El juez cambio. Actualiza antes de guardar.';
      end if;
    elsif p_action='delete-judge' or p_data->>'expected_updated_at' is not null then
      raise exception using errcode='P0002', message='No se encontro el juez.';
    end if;
    prior := to_jsonb(j) - 'photo_data';
    if p_action='delete-judge' then
      if p_data->>'confirmation' is distinct from target then raise exception using errcode='22023', message='Confirma el juez antes de borrarlo.'; end if;
      delete from public.judges where event_id=p_event_id and judge_id=target;
      result := jsonb_build_object('deleted',true,'judge_id',target);
    else
      ids := array(select jsonb_array_elements_text(p_data->'assigned_block_ids'));
      if exists(select 1 from unnest(ids) as assigned(block_key) where not exists(select 1 from public.blocks where event_id=p_event_id and block_id=assigned.block_key)) then
        raise exception using errcode='22023', message='Hay bloques que no pertenecen al evento.';
      end if;
      insert into public.judges(event_id,judge_id,name,role,sort_order,photo_data,hero_image_name,assigned_block_ids)
        values(p_event_id,target,upper(trim(p_data->>'name')),'judge',coalesce(j.sort_order,(select coalesce(max(sort_order),0)+1 from public.judges where event_id=p_event_id)),
          coalesce(p_data->>'photo_data',j.photo_data,''),coalesce(j.hero_image_name,''),ids)
      on conflict(event_id,judge_id) do update set name=excluded.name,photo_data=excluded.photo_data,assigned_block_ids=excluded.assigned_block_ids
      returning to_jsonb(judges.*) - 'photo_data' into result;
    end if;
  elsif p_action='special-award' then
    if not exists(select 1 from public.blocks where event_id=p_event_id and block_id=p_data->>'block_id') then raise exception using errcode='22023', message='Bloque no valido.'; end if;
    target := p_data->>'award';
    prior := (select to_jsonb(a) from public.special_awards a where event_id=p_event_id and block_id=p_data->>'block_id' and award=target);
    if coalesce(trim(p_data->>'manual_value'),'')='' then
      delete from public.special_awards where event_id=p_event_id and block_id=p_data->>'block_id' and award=target;
      result := jsonb_build_object('cleared',true);
    else
      insert into public.special_awards(event_id,block_id,award,manual_value,device_id)
        values(p_event_id,p_data->>'block_id',target,trim(p_data->>'manual_value'),'web-admin')
      on conflict(event_id,block_id,award) do update set manual_value=excluded.manual_value,routine_id=null,device_id=excluded.device_id
      returning to_jsonb(special_awards.*) into result;
    end if;
  elsif p_action in ('configuration','activate','archive','restore') then
    if p_data->>'expected_updated_at' is null or e.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then
      raise exception using errcode='40001', message='El evento cambio. Actualiza antes de guardar.';
    end if;
    prior := to_jsonb(e);
    if p_action='configuration' then
      update public.events set competition_config=competition_config || (p_data->'configuration') where id=p_event_id returning to_jsonb(events.*) into result;
    elsif p_action='activate' then
      update public.events set is_active=(id=p_event_id) where id=any(p_allowed_event_ids) and event_type='event';
      result := jsonb_build_object('activated',true);
    elsif p_action='archive' then
      if p_data->>'confirmation' is distinct from e.slug then raise exception using errcode='22023', message='Confirma el identificador del evento.'; end if;
      update public.events set event_type='archived',is_active=false where id=p_event_id;
      result := jsonb_build_object('archived',true);
    else
      update public.events set event_type='event',is_active=false where id=p_event_id;
      result := jsonb_build_object('restored',true);
    end if;
  else raise exception using errcode='22023', message='Operacion no permitida.';
  end if;
  insert into public.judging_admin_audit(event_id,actor_id,action,target_id,before_value,after_value) values(p_event_id,p_actor_id,p_action,target,prior,result);
  return jsonb_build_object('ok',true,'result',result);
end $$;
revoke all on function public.web_admin_judging_operation(text,uuid,uuid[],text,jsonb) from public, anon, authenticated;
grant execute on function public.web_admin_judging_operation(text,uuid,uuid[],text,jsonb) to service_role;
