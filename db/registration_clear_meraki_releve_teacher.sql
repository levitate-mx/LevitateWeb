UPDATE registration_choreographers
SET
  is_releve_teacher = 0,
  updated_at = datetime('now')
WHERE academy_id IN (
  SELECT id
  FROM registration_academies
  WHERE lower(name) = lower('Academia de baile MERAKI')
)
  AND lower(full_name) = lower('Gloria Angélica Arenas Urbán')
  AND is_releve_teacher = 1;
