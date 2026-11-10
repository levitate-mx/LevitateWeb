begin;
do $$
declare
  eid uuid := gen_random_uuid();
  rev timestamptz;
begin
  insert into public.events(id,slug,name,is_active) values(eid,'levitate-web-admin-qa-'||eid,'QA admin - rollback',false);
  insert into public.blocks(event_id,block_id,name,title) values(eid,'a','A','A'),(eid,'b','B','B');
  insert into public.judges(event_id,judge_id,name,role) values(eid,'qa','QA','judge');
  insert into public.criteria_templates(event_id,template_id,genre,title,max_score) values(eid,'ballet','Ballet','Ballet',10);
  insert into public.criteria(event_id,template_id,criterion_id,section,label,max_score) values(eid,'ballet',1,'Tecnica','Control',10);
  insert into public.routines(event_id,routine_id,block_id,block,name,academy,genre) values(eid,'qa-r','a','A','Rutina QA','Academia QA','Ballet');
  insert into public.scores(event_id,block_id,routine_id,judge_id,criterion_id,value) values(eid,'a','qa-r','qa',1,8);
  insert into public.feedback(event_id,block_id,routine_id,judge_id,body) values(eid,'a','qa-r','qa','QA feedback');
  insert into public.penalties(event_id,block_id,routine_id,judge_id,value) values(eid,'a','qa-r','qa',-1);
  insert into public.routine_favorite_votes(event_id,block_id,routine_id,judge_id,category) values(eid,'a','qa-r','qa','costume');
  insert into public.routine_favorites(event_id,block_id,routine_id,judge_id,category) values(eid,'a','qa-r','qa','music');
  select updated_at into rev from public.routines where event_id=eid and routine_id='qa-r';
  perform public.web_admin_judging_operation('metadata',eid,array[eid],'qa-admin',jsonb_build_object('routine_id','qa-r','expected_updated_at',rev,'field','level','value','Avanzado'));
  if (select level from public.routines where event_id=eid and routine_id='qa-r')<>'Avanzado' then raise exception 'metadata failed'; end if;
  select updated_at into rev from public.routines where event_id=eid and routine_id='qa-r';
  perform public.web_admin_judging_operation('move-routine',eid,array[eid],'qa-admin',jsonb_build_object('routine_id','qa-r','expected_updated_at',rev,'target_block_id','b'));
  if exists(select 1 from public.scores where event_id=eid and block_id<>'b')
    or exists(select 1 from public.feedback where event_id=eid and block_id<>'b')
    or exists(select 1 from public.penalties where event_id=eid and block_id<>'b')
    or exists(select 1 from public.routine_favorite_votes where event_id=eid and block_id<>'b')
    or (select count(*) from public.routine_favorite_votes where event_id=eid)<>2 then raise exception 'move failed'; end if;
  perform public.web_admin_judging_operation('upsert-judge',eid,array[eid],'qa-admin','{"judge_id":"qa-new","name":"QA New","assigned_block_ids":["b"]}');
  select updated_at into rev from public.judges where event_id=eid and judge_id='qa-new';
  perform public.web_admin_judging_operation('upsert-judge',eid,array[eid],'qa-admin',jsonb_build_object('judge_id','qa-new','expected_updated_at',rev,'name','QA New 2','assigned_block_ids','[]'::jsonb));
  select updated_at into rev from public.judges where event_id=eid and judge_id='qa-new';
  perform public.web_admin_judging_operation('delete-judge',eid,array[eid],'qa-admin',jsonb_build_object('judge_id','qa-new','expected_updated_at',rev,'confirmation','qa-new'));
  perform public.web_admin_judging_operation('special-award',eid,array[eid],'qa-admin','{"block_id":"b","award":"award_1","manual_value":"QA"}');
  select updated_at into rev from public.events where id=eid;
  perform public.web_admin_judging_operation('configuration',eid,array[eid],'qa-admin',jsonb_build_object('expected_updated_at',rev,'configuration','{"scoring":{"aggregation":"average"}}'::jsonb));
  select updated_at into rev from public.routines where event_id=eid and routine_id='qa-r';
  begin
    perform public.web_admin_judging_operation('metadata',eid,array[eid],'qa-admin',jsonb_build_object('routine_id','qa-r','expected_updated_at',rev-interval '1 day','field','level','value','Wrong'));
    raise exception 'stale accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.web_admin_judging_operation('access-codes',eid,null,'qa-admin','{}');
    raise exception 'unscoped accepted';
  exception when insufficient_privilege then null;
  end;
  perform public.web_admin_judging_operation('delete-routine',eid,array[eid],'qa-admin',jsonb_build_object('routine_id','qa-r','expected_updated_at',rev,'confirmation','qa-r'));
  if exists(select 1 from public.scores where event_id=eid) then raise exception 'cascade failed'; end if;
  select updated_at into rev from public.events where id=eid;
  perform public.web_admin_judging_operation('archive',eid,array[eid],'qa-admin',jsonb_build_object('expected_updated_at',rev,'confirmation','levitate-web-admin-qa-'||eid));
  select updated_at into rev from public.events where id=eid;
  perform public.web_admin_judging_operation('restore',eid,array[eid],'qa-admin',jsonb_build_object('expected_updated_at',rev));
  if (select event_type from public.events where id=eid)<>'event' then raise exception 'restore failed'; end if;
end $$;
rollback;
