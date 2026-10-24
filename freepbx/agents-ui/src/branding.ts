export const WIZARD_BRANDING_URL = "/freepbx/wizard/branding.json";
export const DEFAULT_BRANDING = {
  name: "NethVoice",
  logoUrl: "/freepbx/wizard/images/brandDark.svg",
};

export async function loadWizardBranding() {
  try {
    const response = await fetch(WIZARD_BRANDING_URL, {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ...DEFAULT_BRANDING };
    const config = await response.json();
    const name =
      typeof config.BRAND_NAME === "string" && config.BRAND_NAME
        ? config.BRAND_NAME
        : DEFAULT_BRANDING.name;
    let logoUrl = DEFAULT_BRANDING.logoUrl;
    if (typeof config.NAVBAR_LOGO_URL === "string" && config.NAVBAR_LOGO_URL) {
      // Relative branding URLs must resolve as they do in the Wizard itself.
      const url = new URL(
        config.NAVBAR_LOGO_URL,
        new URL("/freepbx/wizard/", window.location.origin),
      );
      if (["http:", "https:"].includes(url.protocol)) logoUrl = url.href;
    }
    return { name, logoUrl };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}
