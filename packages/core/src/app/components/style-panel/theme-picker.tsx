import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/panel/panel-fields';
import { format, useLocale } from '@/lib/use-locale';
import type { DesignSystem } from '../../lib/design';
import { SlidePageProvider } from '../../lib/page-context';
import { loadThemeDemo, type Theme, type ThemeDemoModule, themes } from '../../lib/themes';
import { SlideCanvas } from '../slide-canvas';
import { useDesignPanelState } from './design-provider';

export function ThemePickerSection() {
  const t = useLocale();
  const { draft, applyTheme } = useDesignPanelState();

  if (themes.length === 0) return null;

  return (
    <Section title={t.stylePanel.themesSection}>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => (
          <ThemePickerCard
            key={theme.id}
            theme={theme}
            draft={draft}
            onSelect={() => applyTheme(theme.id)}
            ariaLabel={format(t.stylePanel.applyThemeAria, { name: theme.name })}
          />
        ))}
      </div>
    </Section>
  );
}

function ThemePickerCard({
  theme,
  draft,
  onSelect,
  ariaLabel,
}: {
  theme: Theme;
  draft: DesignSystem | null;
  onSelect: () => void;
  ariaLabel: string;
}) {
  const demo = useThemeDemo(theme);
  const selected = useMemo(() => {
    if (!draft || !demo?.design) return false;
    return JSON.stringify(draft) === JSON.stringify(demo.design);
  }, [draft, demo?.design]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={[
        'group block w-full rounded-[6px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'ring-2 ring-brand' : 'ring-1 ring-foreground/[0.06] hover:ring-foreground/20',
      ].join(' ')}
    >
      <div className="relative aspect-video overflow-hidden rounded-[5px] border border-hairline bg-card">
        <ThemePickerPreview theme={theme} demo={demo} />
      </div>
      <p className="mt-1.5 truncate px-0.5 font-heading text-[11px] font-medium tracking-tight">
        {theme.name}
      </p>
    </button>
  );
}

function ThemePickerPreview({ theme, demo }: { theme: Theme; demo: ThemeDemoModule | null }) {
  const t = useLocale();

  if (!theme.hasDemo) {
    return (
      <div className="grid h-full w-full place-items-center bg-muted/40 px-2 text-center text-[9px] text-muted-foreground">
        {t.stylePanel.themeNoPreview}
      </div>
    );
  }
  if (!demo) {
    return (
      <div className="grid h-full w-full place-items-center text-[9px] tracking-[0.12em] uppercase text-muted-foreground/60">
        {t.common.loading}
      </div>
    );
  }
  const FirstPage = demo.default[0];
  if (!FirstPage) {
    return (
      <div className="grid h-full w-full place-items-center bg-muted/40 px-2 text-center text-[9px] text-muted-foreground">
        {t.stylePanel.themeNoPreview}
      </div>
    );
  }

  return (
    <SlideCanvas flat freezeMotion design={demo.design}>
      <SlidePageProvider index={0} total={demo.default.length}>
        <FirstPage />
      </SlidePageProvider>
    </SlideCanvas>
  );
}

function useThemeDemo(theme: Theme): ThemeDemoModule | null {
  const [demo, setDemo] = useState<ThemeDemoModule | null>(null);
  useEffect(() => {
    if (!theme.hasDemo) {
      setDemo(null);
      return;
    }
    let cancelled = false;
    loadThemeDemo(theme.id)
      .then((mod) => {
        if (!cancelled) setDemo(mod);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [theme.id, theme.hasDemo]);
  return demo;
}
