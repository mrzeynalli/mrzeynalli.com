// Named exports used by the layout components
export const SITE_TITLE = "Elvin Zeynalli";
export const SITE_DESCRIPTION =
  "Business Analyst / Quantitative Researcher / Automation Engineer";

export const SITE = {
  website: "https://mrzeynalli.xyz/",
  author: "Elvin Zeynalli",
  profile: "https://mrzeynalli.xyz/",
  desc: "Business Analyst / Quantitative Researcher / Automation Engineer",
  title: "Elvin Zeynalli",
  // Fallback social card. Per-post cards are generated at /blog/<slug>/index.png
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerPage: 6,
  scheduledPostMargin: 15 * 60 * 1000,
  showArchives: true,
  showBackButton: true,
  dynamicOgImage: true,
  dir: "ltr",
  lang: "en",
  timezone: "Asia/Istanbul",
} as const;
