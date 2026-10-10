// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The backend sends its per-instance settings (Casdoor issuer, client ID, branding)
// in the "jsonWebConfig" cookie with index.html and every /api/get-account
// response, so one build serves every instance and can sit on a shared CDN.

export const AuthConfig = {
  issuer: "",
  clientId: "",
  appName: "",
  organizationName: "",
  redirectPath: "/callback",
};

// A build made with VITE_EMBED_STATIC_ASSETS=true carries img/ and flag-icons/ in
// web/public, so it asks for them on its own origin instead of the CDN. The
// backend blanks out a default staticBaseUrl too when it runs with -tags embed.
export let StaticBaseUrl = import.meta.env.VITE_EMBED_STATIC_ASSETS === "true" ? "" : "https://cdn.openagentai.org";
export let HtmlTitle = "";
export let FaviconUrl = "";
export let LogoUrl = "";
export let NavbarHtml = "";
export let FooterHtml = "";
export let IsDemoMode = false;

export const DefaultLanguage = "en";
export const ForceLanguage = "";

/** "Labeling" turns tasks into the label-an-example tool; "PBL" grades a document against a scale. */
export const TaskMode: "PBL" | "Labeling" = "PBL";

export const ThemeDefault = {
  themeType: "default",
  colorPrimary: "",
};

export function setConfig(config: any) {
  if (config === null || config === undefined) {
    return;
  }

  if (config.authConfig) {
    Object.assign(AuthConfig, config.authConfig);
  }

  if (config.staticBaseUrl !== undefined && config.staticBaseUrl !== "") {StaticBaseUrl = config.staticBaseUrl;}
  if (config.htmlTitle !== undefined) {HtmlTitle = config.htmlTitle;}
  if (config.faviconUrl !== undefined) {FaviconUrl = config.faviconUrl;}
  if (config.logoUrl !== undefined) {LogoUrl = config.logoUrl;}
  if (config.navbarHtml !== undefined) {NavbarHtml = config.navbarHtml;}
  if (config.footerHtml !== undefined) {FooterHtml = config.footerHtml;}
  if (config.isDemoMode !== undefined) {IsDemoMode = config.isDemoMode;}

  if (config.themeDefault) {
    Object.assign(ThemeDefault, config.themeDefault);
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) {
      return item.slice(prefix.length);
    }
  }
  return null;
}

export function initConfigFromCookie() {
  const encoded = readCookie("jsonWebConfig");
  if (!encoded || encoded === "null") {
    return;
  }

  try {
    setConfig(JSON.parse(decodeURIComponent(encoded.replace(/\+/g, " "))));
  } catch {
    // a malformed cookie must not keep the app from starting
  }
}
