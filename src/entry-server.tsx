import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { HomePage } from './components/home/HomePage';
import { MotionGenresPage } from './components/modalities/MotionGenresPage';
import { RulesPage } from './components/rules/RulesPage';

// These are the same page components and props returned by App for these URLs.
// Importing only public pages keeps browser-only account modules out of SSR.
export const prerenderedPaths = [
  '/',
  '/modalidades/levitate-motion/generos',
  '/modalidades/levitate-aerial/evaluacion',
] as const;

export function render(pathname: string): string {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const page = path === '/' ? <HomePage />
    : path === '/modalidades/levitate-motion/generos' ? <MotionGenresPage />
    : path === '/modalidades/levitate-aerial/evaluacion' ? <RulesPage modality="aerial" />
    : null;
  if (!page) throw new Error(`No public prerender is configured for ${path}.`);
  return renderToString(<StrictMode>{page}</StrictMode>);
}
