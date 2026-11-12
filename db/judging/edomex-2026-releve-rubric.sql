-- Relevé rubric approved for Estado de México · Otoño 2026.
-- Five criteria, integer points 1–3 each (15 per judge). Existing apparatus
-- templates and scores are preserved; the 150-point final scale is unchanged.
BEGIN;
DO $$
DECLARE target_event uuid := 'a62f724b-9d66-47ea-8dee-d54294783130';
BEGIN
  IF (SELECT count(*) FROM public.routines WHERE event_id=target_event
      AND routine_id IN ('232','233','234','235','236') AND division='RELEVÉ'
      AND block_id='bloque-7-aerial-seniors-releve') <> 5 THEN
    RAISE EXCEPTION 'The five definitive Relevé routines need review before changing their rubric';
  END IF;
  IF EXISTS (SELECT 1 FROM public.scores WHERE event_id=target_event
      AND routine_id IN ('232','233','234','235','236')) THEN
    RAISE EXCEPTION 'Relevé already has recorded scores; do not replace its rubric automatically';
  END IF;
  IF EXISTS (SELECT 1 FROM public.criteria WHERE event_id=target_event AND template_id='releve' AND criterion_id NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'Unexpected existing Relevé criteria need review';
  END IF;
END $$;
INSERT INTO public.criteria_templates (event_id,template_id,genre,title,max_score,sort_order,template_version,applies_to,feedback_required)
VALUES ('a62f724b-9d66-47ea-8dee-d54294783130','releve','RELEVÉ','HOJA DE JUECEO RELEVÉ',15,0,1,
  '{"divisions":["RELEVÉ"],"primary_categories":["TELA","ARO","TRAPECIO"]}'::jsonb,false)
ON CONFLICT (event_id,template_id) DO UPDATE SET genre=EXCLUDED.genre,title=EXCLUDED.title,max_score=EXCLUDED.max_score,
  sort_order=EXCLUDED.sort_order,applies_to=EXCLUDED.applies_to,feedback_required=EXCLUDED.feedback_required,updated_at=now();
INSERT INTO public.criteria (event_id,template_id,criterion_id,section,label,max_score,sort_order,is_required)
VALUES
('a62f724b-9d66-47ea-8dee-d54294783130','releve',1,'RELEVÉ','Técnica y control',3,1,true),
('a62f724b-9d66-47ea-8dee-d54294783130','releve',2,'RELEVÉ','Composición coreográfica',3,2,true),
('a62f724b-9d66-47ea-8dee-d54294783130','releve',3,'RELEVÉ','Musicalidad',3,3,true),
('a62f724b-9d66-47ea-8dee-d54294783130','releve',4,'RELEVÉ','Interpretación artística',3,4,true),
('a62f724b-9d66-47ea-8dee-d54294783130','releve',5,'RELEVÉ','Presencia escénica',3,5,true)
ON CONFLICT (event_id,template_id,criterion_id) DO UPDATE SET section=EXCLUDED.section,label=EXCLUDED.label,
  max_score=EXCLUDED.max_score,sort_order=EXCLUDED.sort_order,is_required=EXCLUDED.is_required,updated_at=now();
COMMIT;
