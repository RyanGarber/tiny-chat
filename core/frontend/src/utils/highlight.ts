import { CodeHighlightAdapter } from '@mantine/code-highlight';
import hljs from 'highlight.js';

const hljsThemes = import.meta.glob<string>(
  '/node_modules/highlight.js/styles/*.min.css',
  { query: '?inline', import: 'default', eager: false },
);

export const hljsThemeNames = Object.keys(hljsThemes).map((p) => {
  const file = p.split('/').pop()!;
  return file.slice(0, -8); // strip ".min.css"
});

export const applyHljsTheme = async (theme: string) => {
  const key = `/node_modules/highlight.js/styles/${theme}.min.css`;
  const loader = hljsThemes[key];
  if (!loader) return;

  let styleEl = document.getElementById('hljs-theme') as HTMLStyleElement | null;
  if (styleEl?.dataset.current === theme) return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'hljs-theme';
    document.head.appendChild(styleEl);
  }
  styleEl.dataset.current = theme;
  styleEl.textContent = await loader();

  let backgroundColor;
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && rule.selectorText === '.hljs') {
        const value = rule.style.background || rule.style.backgroundColor;
        if (value) backgroundColor = value;
      }
    }
  }

  document.documentElement.style.setProperty('--hljs-bg', backgroundColor ?? 'transparent');
};

export const hljsAdapter: CodeHighlightAdapter = {
  getHighlighter:
    () =>
    ({ code, language }) => {
      code = code.trim();
      const languageFound = !language || hljs.getLanguage(language) !== undefined;
      const result =
        language && languageFound
          ? hljs.highlight(code, {
              language,
              ignoreIllegals: true,
            })
          : hljs.highlightAuto(code);
      return {
        isHighlighted: true,
        highlightedCode: result.value,
        codeElementProps: { className: `hljs ${result.language}` },
      };
    },
};
