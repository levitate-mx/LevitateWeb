export const isJudgingGroupCategory = value => /^(grupo|group)s?$/i.test(String(value || '').trim());
