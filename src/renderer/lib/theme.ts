import type { ThemeId } from '../../common/types';

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'black', label: 'Black' },
  { id: 'white', label: 'White' },
  { id: 'dark', label: 'Purple' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'retro-sand', label: 'Retro Sand' },
  { id: 'retro-green', label: 'Retro Green' }
];

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset['theme'] = theme;
}
