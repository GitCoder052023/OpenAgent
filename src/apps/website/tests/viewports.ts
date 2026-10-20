/** The screen sizes the site is held to, and the routes every one of them covers. */

export type Viewport = {
  name: string;
  width: number;
  height: number;
  /** Whether a finger is the likely pointer, which changes the target rules. */
  touch: boolean;
};

export const VIEWPORTS: Viewport[] = [
  { name: "320 small phone", width: 320, height: 568, touch: true },
  { name: "360 android", width: 360, height: 800, touch: true },
  { name: "375 iphone 8", width: 375, height: 667, touch: true },
  { name: "390 iphone 14", width: 390, height: 844, touch: true },
  { name: "430 iphone pro max", width: 430, height: 932, touch: true },
  { name: "640 large phone", width: 640, height: 960, touch: true },
  { name: "768 tablet portrait", width: 768, height: 1024, touch: true },
  { name: "820 tablet", width: 820, height: 1180, touch: true },
  { name: "1024 tablet landscape", width: 1024, height: 768, touch: true },
  { name: "1280 laptop", width: 1280, height: 800, touch: false },
  { name: "1440 laptop", width: 1440, height: 900, touch: false },
  { name: "1728 large laptop", width: 1728, height: 1117, touch: false },
  { name: "1920 desktop", width: 1920, height: 1080, touch: false },
  { name: "2560 ultrawide", width: 2560, height: 1440, touch: false },
];

export const LANDSCAPE: Viewport[] = [
  { name: "568 phone landscape", width: 568, height: 320, touch: true },
  { name: "844 phone landscape", width: 844, height: 390, touch: true },
  { name: "932 phone landscape", width: 932, height: 430, touch: true },
];

export const PAGES = ["/", "/tools", "/faq", "/privacy"] as const;
