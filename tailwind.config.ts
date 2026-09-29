import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sourced from the shared Motus design tokens (/shared/motus-tools.css),
        // not hardcoded hex — see Motus AWS repo's STYLE_GUIDE.md. Each var()
        // carries a fallback reproducing that file's own formula verbatim, so
        // ENPI still renders on-brand on Vercel (where /shared/ 404s) instead
        // of an undefined custom property silently voiding the declaration.
        brand: {
          50: 'var(--motus-primary-tint, color-mix(in srgb, #548325 20%, white))',
          100: 'var(--motus-primary-tint, color-mix(in srgb, #548325 20%, white))',
          500: 'var(--motus-primary, #548325)',
          600: 'var(--motus-primary, #548325)',
          700: 'var(--motus-primary-hover, color-mix(in srgb, #548325 75%, black))',
          900: 'var(--motus-dark, #212529)',
        },
        motus: {
          primary: 'var(--motus-primary, #548325)',
          'primary-hover': 'var(--motus-primary-hover, color-mix(in srgb, #548325 75%, black))',
          'primary-tint': 'var(--motus-primary-tint, color-mix(in srgb, #548325 20%, white))',
          secondary: 'var(--motus-secondary, #0f4c81)',
          'secondary-hover': 'var(--motus-secondary-hover, color-mix(in srgb, #0f4c81 75%, black))',
          danger: 'var(--motus-danger, #da4632)',
          warning: 'var(--motus-warning, color-mix(in srgb, #eed931 70%, black))',
          success: 'var(--motus-success, color-mix(in srgb, #9ad54f 70%, black))',
          info: 'var(--motus-info, #547a8c)',
          light: 'var(--motus-light, #f2f2f2)',
          dark: 'var(--motus-dark, #212529)',
          muted: 'var(--motus-muted, #6c757d)',
          border: 'var(--motus-border, #dee2e6)',
        },
      },
      fontFamily: {
        // A single list item: the var()'s fallback is itself a comma list,
        // which CSS allows, so an undefined --motus-font degrades to Overpass
        // (loaded separately via the Google Fonts <link> in layout.tsx, so it
        // resolves regardless of whether /shared/motus-tools.css loads) rather
        // than invalidating the whole font-family declaration.
        sans: ["var(--motus-font, 'Overpass', -apple-system, 'Segoe UI', Roboto, sans-serif)"],
      },
    },
  },
  plugins: [],
};

export default config;
