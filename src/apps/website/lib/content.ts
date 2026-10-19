/**
 * Every string in this file is drawn from the repository's own documentation —
 * README.md, docs/JARVIS_INSTRUCTIONS.md, docs/WHATSAPP_INTEGRATION.md and
 * OPENINSTINCT_BRAIN_SPEC.md. Nothing here describes a capability the project
 * does not claim, and anything not yet shipped is marked with a status.
 */

export const repoUrl = "https://github.com/GitCoder052023/OpenAgent";
/**
 * Absolute origin for canonical URLs, Open Graph tags and the sitemap. Set
 * NEXT_PUBLIC_SITE_URL at build time to the domain the site is served from.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** What is real today, what is being trialled, what is direction. */
export type Status = "shipping" | "experimental" | "direction";

export const statusCopy: Record<Status, string> = {
  shipping: "Shipping",
  experimental: "Experimental",
  direction: "Direction",
};

/* -------------------------------------------------------------------------- */
/* The gap — README.md § Why OpenAgent                                        */
/* -------------------------------------------------------------------------- */

export type ComparisonRow = {
  capability: string;
  instinct: boolean;
  withOpenAgent: boolean;
};

export const comparison: ComparisonRow[] = [
  {
    capability: "Always-listening, hands-free voice sessions at your desk",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability: "Account-level tasks (email, calendar, GitHub, Notion)",
    instinct: true,
    withOpenAgent: true,
  },
  {
    capability: "Proactive reminders and follow-ups",
    instinct: true,
    withOpenAgent: true,
  },
  {
    capability: "Shell execution and code edits on your local machine",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability: "Seeing your screen and controlling native macOS apps",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability: "Driving your authenticated, everyday Chrome profile",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability: "Operating WhatsApp Desktop",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability:
      "Posting and engaging on Threads, Reddit, X and LinkedIn from your own browser sessions",
    instinct: false,
    withOpenAgent: true,
  },
  {
    capability: "Private, self-hosted web scraping and crawling",
    instinct: false,
    withOpenAgent: true,
  },
];

/* -------------------------------------------------------------------------- */
/* The loop — README.md § How It Works                                        */
/* -------------------------------------------------------------------------- */

export type LoopStep = {
  n: string;
  title: string;
  body: string;
};

export const loopSteps: LoopStep[] = [
  {
    n: "01",
    title: "Input",
    body: "Woken with “Wake up, Jarvis”, OpenAgent listens until a natural pause, then sends a voice note — or a transcript from on-device Whisper Large V3 Turbo — into your Instinct chat.",
  },
  {
    n: "02",
    title: "Tool calls",
    body: "Instinct replies with structured calls wrapped in a JARVIS_CALL:<base64>:END envelope. Base64 survives WhatsApp's markdown, which would otherwise eat *, _ and ~.",
  },
  {
    n: "03",
    title: "Observation",
    body: "OpenAgent reads incoming messages straight off the macOS Accessibility API. No API key, no hosted backend, no custom integration.",
  },
  {
    n: "04",
    title: "Verification",
    body: "A fail-closed guard confirms the message came from the verified Instinct chat before a single byte is decoded. Anything else is dropped.",
  },
  {
    n: "05",
    title: "Execution",
    body: "The dispatcher routes the call to the right engine or adapter and runs it locally, on your hardware, under your user account.",
  },
  {
    n: "06",
    title: "Response",
    body: "Results, diffs and screenshots go back into the chat. Instinct continues the loop until the task is done, and its voice replies play back automatically.",
  },
];

/* -------------------------------------------------------------------------- */
/* Engines — README.md § Core Features                                        */
/* -------------------------------------------------------------------------- */

export type Engine = {
  name: string;
  provides: string;
  builtOn: string;
  /** Matching slug in lib/tools.ts, when the engine exposes callable tools. */
  categorySlug: string | null;
  /** Shown instead of a tool count when the engine is not a tool category. */
  note?: string;
};

export const engines: Engine[] = [
  {
    name: "Developer harness",
    provides:
      "Sandboxed bash, paginated read, atomic write, exact-match edit, ripgrep regex search, glob, and AppleScript.",
    builtOn: "Bun + TypeScript",
    categorySlug: "developer-harness",
  },
  {
    name: "Voice interface",
    provides:
      "Offline wake word, continuous hands-free sessions, silence-based turn-taking, echo guard, automatic reply playback — one on-device model for both the wake phrase and transcription.",
    builtOn: "Whisper Large V3 Turbo (MLX / whisper.cpp), SoX",
    categorySlug: null,
    note: "input layer",
  },
  {
    name: "Native computer use",
    provides:
      "Window capture, Accessibility tree queries, PID-targeted clicks, keystrokes, drags and scrolls that don't steal focus.",
    builtOn: "macOS Accessibility & Quartz",
    categorySlug: "computer-use",
  },
  {
    name: "Browser automation",
    provides:
      "Authenticated Chrome: background tabs, compositor clicks through iframes and shadow DOM, framework-safe form filling, 97 domain-specific skills.",
    builtOn: "Browser Harness (CDP)",
    categorySlug: "browser",
  },
  {
    name: "Web ingestion & search",
    provides:
      "Scrape to clean Markdown, search with full-content results, recursive crawl, site mapping, schema-based JSON extraction.",
    builtOn: "Self-hosted Firecrawl (Docker)",
    categorySlug: "web",
  },
  {
    name: "Social media automation",
    provides:
      "Posting, replies, likes, search and scheduled workflows on Threads and Reddit — plus X, LinkedIn, Instagram, Facebook, YouTube, TikTok and GitHub — in isolated, persistent Chrome profiles.",
    builtOn: "LocoAgent (CDP)",
    categorySlug: "social",
  },
  {
    name: "macOS productivity",
    provides:
      "Native desktop integrations: Apple Reminders, iMessage, Things 3, Spotify, 1Password, Apple Notes, camera feeds, Nano-PDF, Tmux.",
    builtOn: "skills_adapter.py (CLI suite)",
    categorySlug: "productivity",
  },
  {
    name: "Office documents",
    provides:
      "Standalone Word, Excel and PowerPoint generation, inspection and template filling — without Microsoft Office installed.",
    builtOn: "python-docx, openpyxl, python-pptx",
    categorySlug: "office",
  },
  {
    name: "WhatsApp communication",
    provides:
      "Full multi-device headless WhatsApp operations — chats, messages, voice notes, media, polls, contacts — plus a lightweight wacli CLI fallback.",
    builtOn: "whatsapp-mcp-extended (whatsmeow)",
    categorySlug: "whatsapp",
  },
  {
    name: "Universal MCP client",
    provides:
      "Dynamic discovery and execution of external tools from any MCP server, across Stdio subprocesses and remote SSE / StreamableHTTP endpoints.",
    builtOn: "mcp_adapter.py",
    categorySlug: "mcp",
  },
  {
    name: "Zero-focus ghost mode",
    provides:
      "Pure background execution while you game or work: CDP offscreen perception, AX tree queries, PID input targeting, instant focus restoration.",
    builtOn: "browser_adapter, mac_adapter, desktop",
    categorySlug: null,
    note: "cross-cutting",
  },
];

/* -------------------------------------------------------------------------- */
/* Ghost mode — README.md § Zero-Focus Background Operation                   */
/* -------------------------------------------------------------------------- */

export const ghostPoints: { label: string; body: string }[] = [
  {
    label: "Offscreen web & social",
    body: "Opens tabs, reads feeds, posts, upvotes and comments over CDP without ever raising a window or moving your physical cursor.",
  },
  {
    label: "Background vision",
    body: "Captures screenshots from offscreen compositor buffers and screencapture -l <window_id>, without bringing background windows forward.",
  },
  {
    label: "Background accessibility",
    body: "Queries full Accessibility trees via browser_ax and mac_ax offscreen, without activating the target application.",
  },
  {
    label: "Silent playback",
    body: "Drives Spotify and Apple Music through native Apple Events and CLI daemons, with no focus loss.",
  },
  {
    label: "Fail-safe restoration",
    body: "Every background operation captures the active application PID first and restores focus in milliseconds.",
  },
];

/* -------------------------------------------------------------------------- */
/* Voice — README.md § Talking to Jarvis                                      */
/* -------------------------------------------------------------------------- */

export const voicePoints: { label: string; body: string }[] = [
  {
    label: "Wake once, keep talking",
    body: "Say “Wake up, Jarvis” and the session stays awake. Speak naturally, pause, and the request is sent after a stretch of silence.",
  },
  {
    label: "Natural turn-taking",
    body: "Instinct's voice replies play automatically through your speakers. An echo guard keeps the agent from hearing itself.",
  },
  {
    label: "Freeform follow-ups",
    body: "The conversation lives in your Instinct chat, so context carries across turns. “Now do the same for Reddit” works the way you'd expect.",
  },
  {
    label: "Private by default",
    body: "Wake-word detection runs fully offline on Whisper Large V3 Turbo. Idle audio is never saved or sent. Nothing leaves your Mac until Jarvis is awake and you've spoken a request.",
  },
  {
    label: "Push-to-talk fallback",
    body: "For quiet rooms and shared spaces, hold F8 to talk instead. Holding F8 during a reply cuts the reply short.",
  },
];

export const voiceDefaults: { key: string; value: string; meaning: string }[] = [
  {
    key: "BRIDGE_VOICE_SILENCE_SECONDS",
    value: "2.0",
    meaning: "Silence before your turn is submitted",
  },
  { key: "BRIDGE_HOTKEY", value: "f8", meaning: "Push-to-talk key" },
  {
    key: "BRIDGE_SEND_MODE",
    value: "audio",
    meaning: "Voice note, or a local transcript",
  },
  {
    key: "BRIDGE_STT_ENGINE",
    value: "auto",
    meaning: "MLX on Apple Silicon, whisper.cpp elsewhere",
  },
  {
    key: "BRIDGE_SAFE_MODE",
    value: "true",
    meaning: "Execute only from the verified chat header",
  },
];

/* -------------------------------------------------------------------------- */
/* Install — README.md § Quick Start                                          */
/* -------------------------------------------------------------------------- */

export const prerequisites: string[] = [
  "macOS 14 (Sonoma) or 15 (Sequoia), Apple Silicon or Intel",
  "uv, Homebrew and Bun",
  "WhatsApp Desktop, installed and logged in",
  "~2 GB free for the Whisper Large V3 Turbo weights",
];

export const installSteps: {
  n: string;
  command: string;
  caption: string;
}[] = [
  {
    n: "01",
    command: "./install.py",
    caption:
      "Homebrew tools, virtual environment, Bun harness and speech models. Zero touch.",
  },
  {
    n: "02",
    command: "./calibrate.py --save",
    caption:
      "Auto-detects WhatsApp Desktop's accessibility buttons and input fields.",
  },
  {
    n: "03",
    command: "./test.py",
    caption: "Verifies the whole system before you trust it with your machine.",
  },
  {
    n: "04",
    command: "./boot.py --voice --send-mode audio",
    caption: "Hands-free. Then say “Wake up, Jarvis.”",
  },
];

export const permissions: { name: string; reason: string }[] = [
  { name: "Accessibility", reason: "UI inspection and desktop automation" },
  { name: "Input Monitoring", reason: "Global push-to-talk hotkey" },
  { name: "Microphone", reason: "Audio recording via SoX" },
  { name: "Screen Recording", reason: "Window capture for mac_see" },
  { name: "Automation", reason: "System Events and AppleScript app control" },
];

/* -------------------------------------------------------------------------- */
/* Philosophy — README.md § Directional Philosophy                            */
/* -------------------------------------------------------------------------- */

export type Tenet = {
  n: string;
  title: string;
  body: string;
  status: Status;
};

export const tenets: Tenet[] = [
  {
    n: "01",
    title: "Zero external dependence",
    body: "OpenAgent integrates with Instinct today because its cloud chief-of-staff experience over WhatsApp is battle-tested for daily mobile life. But the foundational mission is that OpenAgent is never permanently locked into any external closed-source commercial product or corporate cloud. Every layer — voice perception, computer-use execution, memory, guardrails, intelligence — is engineered to run entirely on your own terms.",
    status: "direction",
  },
  {
    n: "02",
    title: "Plugging the two monsters together",
    body: "Integrating OpenInstinct, the sovereign local intelligence, into OpenAgent, the sovereign macOS execution body, is the defining architectural step toward independence. Plug them together and you have a completely open-source personal Jarvis that no provider can shut off, paywall or censor.",
    status: "experimental",
  },
  {
    n: "03",
    title: "Built for beast models, not toys",
    body: "This infrastructure is not here to run small 7B models on shallow tasks. It is being prepared for frontier-tier local models — multi-GPU rigs, unified-memory Apple Silicon clusters, home servers with the raw reasoning capacity to handle real-world complex jobs, not just simple commands.",
    status: "direction",
  },
  {
    n: "04",
    title: "Sovereignty on bare metal",
    body: "Your personal assistant should work for you and only you. Keeping execution local on bare metal keeps your secrets, tokens, private chats and files strictly inside your own boundary.",
    status: "shipping",
  },
];

/* -------------------------------------------------------------------------- */
/* OpenInstinct — README.md § OpenInstinct: The Sovereign Local Brain          */
/* -------------------------------------------------------------------------- */

export const openInstinctPoints: { label: string; body: string }[] = [
  {
    label: "100% offline",
    body: "Zero cloud dependencies. Code, terminal output and conversation never leave your hardware.",
  },
  {
    label: "Direct harness execution",
    body: "Drives shell commands, file edits, Chrome CDP automation, native window clicks and web ingestion with live receipts.",
  },
  {
    label: "Cross-session memory",
    body: "Records project goals, active tasks and profile facts into ~/.openagent/memory.json, across machine restarts.",
  },
  {
    label: "Any local endpoint",
    body: "Points at any OpenAI-compatible or Ollama endpoint — localhost, or a GPU box in the next room.",
  },
];

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */

export const docLinks: { label: string; href: string; blurb: string }[] = [
  {
    label: "Setup prompt & tool instructions",
    href: `${repoUrl}/blob/main/docs/JARVIS_INSTRUCTIONS.md`,
    blurb: "The initialization block that connects Instinct",
  },
  {
    label: "Native WhatsApp protocol guide",
    href: `${repoUrl}/blob/main/docs/WHATSAPP_INTEGRATION.md`,
    blurb: "Pairing, session recovery, anti-ban safeguards",
  },
  {
    label: "Social media automation guide",
    href: `${repoUrl}/blob/main/docs/SOCIAL_MEDIA_AUTOMATION.md`,
    blurb: "Platform ports and operational playbooks",
  },
  {
    label: "Accessibility & calibration",
    href: `${repoUrl}/blob/main/docs/CALIBRATION.md`,
    blurb: "AX trees, audio routing, debug states",
  },
  {
    label: "OpenInstinct brain spec",
    href: `${repoUrl}/blob/main/OPENINSTINCT_BRAIN_SPEC.md`,
    blurb: "Feasibility analysis for local offline models",
  },
  {
    label: "Security policy",
    href: `${repoUrl}/blob/main/SECURITY.md`,
    blurb: "Threat boundaries and disclosure",
  },
];

export const credits: { name: string; href: string; role: string }[] = [
  {
    name: "Browser Use",
    href: "https://github.com/browser-use/browser-harness",
    role: "Browser Harness and macOS Harness",
  },
  {
    name: "Whisper",
    href: "https://github.com/openai/whisper",
    role: "Large V3 Turbo, via mlx-whisper and whisper.cpp",
  },
  {
    name: "Firecrawl",
    href: "https://github.com/firecrawl/firecrawl",
    role: "Self-hosted scraping and crawling",
  },
  {
    name: "LocoAgent",
    href: "https://github.com/LocoreMind/locoagent",
    role: "Persistent social browser sessions",
  },
  {
    name: "whatsapp-mcp-extended",
    href: "https://github.com/FelixIsaac/whatsapp-mcp-extended",
    role: "Multi-device WhatsApp transport",
  },
  {
    name: "OpenCode",
    href: "https://github.com/anomalyco/opencode",
    role: "Open-source agentic coding architecture",
  },
];
