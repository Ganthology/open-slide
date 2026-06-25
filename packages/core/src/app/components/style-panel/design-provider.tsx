import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useHistory } from '@/components/history-provider';
import { useLocale } from '@/lib/use-locale';
import { type DesignSystem, defaultDesign, designToCssVars } from '../../lib/design';
import { shuffleDesign } from '../../lib/design-presets';
import { loadThemeDemo } from '../../lib/themes';
import { useDesign as useDesignFetch } from './use-design';

type DesignCtx = {
  slideId: string;
  loaded: boolean;
  exists: boolean;
  warning: string | null;
  design: DesignSystem | null;
  draft: DesignSystem | null;
  dirty: boolean;
  committing: boolean;
  update: (mut: (next: DesignSystem) => void, coalesceKey?: string) => void;
  commit: () => Promise<void>;
  discard: () => void;
  resetToDefaults: () => void;
  shuffle: () => void;
  applyTheme: (themeId: string) => Promise<void>;
};

const Ctx = createContext<DesignCtx | null>(null);

export function useDesignPanelState(): DesignCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDesignPanelState must be used inside <DesignProvider>');
  return v;
}

function clone<T>(d: T): T {
  return JSON.parse(JSON.stringify(d)) as T;
}

export function DesignProvider({ slideId, children }: { slideId: string; children: ReactNode }) {
  const { design, exists, warning, loaded, save } = useDesignFetch(slideId);
  const t = useLocale();
  const [draft, setDraft] = useState<DesignSystem | null>(null);
  const [committing, setCommitting] = useState(false);
  const history = useHistory();
  const draftRef = useRef<DesignSystem | null>(null);
  draftRef.current = draft;

  useEffect(() => {
    if (design) setDraft(clone(design));
  }, [design]);

  const dirty = useMemo(() => {
    if (!draft || !design) return false;
    return JSON.stringify(draft) !== JSON.stringify(design);
  }, [draft, design]);

  const update = useCallback(
    (mut: (d: DesignSystem) => void, coalesceKey?: string) => {
      const prev = draftRef.current;
      if (!prev) return;
      const next = clone(prev);
      mut(next);
      setDraft(next);
      history.record({
        coalesceKey,
        undo: () => setDraft(prev),
        redo: () => setDraft(next),
      });
    },
    [history],
  );

  const commit = useCallback(async () => {
    if (!draft) return;
    setCommitting(true);
    const r = await save(draft);
    setCommitting(false);
    if (!r.ok) toast.error(r.error ?? 'Failed to save');
    history.clear();
  }, [draft, save, history]);

  const discard = useCallback(() => {
    if (design) setDraft(clone(design));
    history.clear();
  }, [design, history]);

  const resetToDefaults = useCallback(() => {
    const prev = draftRef.current;
    const next = clone(defaultDesign);
    setDraft(next);
    history.record({
      coalesceKey: 'design:reset',
      undo: () => setDraft(prev),
      redo: () => setDraft(next),
    });
  }, [history]);

  const shuffle = useCallback(() => {
    const prev = draftRef.current;
    const next = clone(shuffleDesign(prev));
    setDraft(next);
    history.record({
      undo: () => setDraft(prev),
      redo: () => setDraft(next),
    });
  }, [history]);

  const applyTheme = useCallback(
    async (themeId: string) => {
      try {
        const demo = await loadThemeDemo(themeId);
        if (!demo.design) {
          toast.error(t.stylePanel.themeNoTokens);
          return;
        }
        const prev = draftRef.current;
        const next = clone(demo.design);
        setDraft(next);
        history.record({
          coalesceKey: `design:theme:${themeId}`,
          undo: () => setDraft(prev),
          redo: () => setDraft(next),
        });
      } catch {
        toast.error(t.stylePanel.themeLoadFailed);
      }
    },
    [history, t.stylePanel.themeLoadFailed, t.stylePanel.themeNoTokens],
  );

  // SlideCanvas emits its design vars inline on the canvas root, so a draft
  // overlay must use `!important` to outrank those inline styles.
  const previewCss = useMemo(() => {
    if (!dirty || !draft) return '';
    const lines = Object.entries(designToCssVars(draft))
      .map(([k, v]) => `  ${k}: ${v} !important;`)
      .join('\n');
    return `[data-osd-canvas] {\n${lines}\n}`;
  }, [dirty, draft]);

  const value: DesignCtx = {
    slideId,
    loaded,
    exists,
    warning,
    design,
    draft,
    dirty,
    committing,
    update,
    commit,
    discard,
    resetToDefaults,
    shuffle,
    applyTheme,
  };

  return (
    <Ctx.Provider value={value}>
      {previewCss && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local css from draft state.
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
      )}
      {children}
    </Ctx.Provider>
  );
}
