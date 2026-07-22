const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_TENANT_THEME = Object.freeze({
  primary: '#1EC36A',
  secondary: '#0D8343',
  background: '#0B0F12',
  surface: '#141A1E',
  text: '#E2E8F0',
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
