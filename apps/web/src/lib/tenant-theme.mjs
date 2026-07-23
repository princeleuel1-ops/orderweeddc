const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_TENANT_THEME = Object.freeze({
  primary: '#0e9f5a',
  secondary: '#0a7443',
  background: '#f6faf7',
  surface: '#ffffff',
  text: '#0d1f18',
});

// Platform-level derived tones shared by every tenant surface. Kept out of
// per-brand customization so contrast and evidence-label legibility stay
// guaranteed regardless of tenant palette choices.
export const PLATFORM_TONES = Object.freeze({
  raised: '#edf4ee',
  border: 'rgba(13, 31, 24, 0.10)',
  muted: '#54685e',
  gold: '#b9840c',
});

function acceptedHexColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
    ? value
    : fallback;
}

export function buildTenantTheme(brand) {
  return Object.freeze({
    primary: acceptedHexColor(
      brand?.themePrimary,
      DEFAULT_TENANT_THEME.primary,
    ),
    secondary: acceptedHexColor(
      brand?.themeSecondary,
      DEFAULT_TENANT_THEME.secondary,
    ),
    background: acceptedHexColor(
      brand?.themeBg,
      DEFAULT_TENANT_THEME.background,
    ),
    surface: acceptedHexColor(
      brand?.themeSurface,
      DEFAULT_TENANT_THEME.surface,
    ),
    text: acceptedHexColor(brand?.themeText, DEFAULT_TENANT_THEME.text),
  });
}
