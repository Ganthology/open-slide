export const OFFICIAL_THEME_SLUGS = ['aurora', 'bright-sans', 'replit', 'sticker-pop'] as const;

export type OfficialThemeSlug = (typeof OFFICIAL_THEME_SLUGS)[number];

export function isOfficialThemeSlug(slug: string): slug is OfficialThemeSlug {
  return (OFFICIAL_THEME_SLUGS as readonly string[]).includes(slug);
}
