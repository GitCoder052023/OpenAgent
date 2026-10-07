export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: "What is OpenAgent and how does it relate to Instinct?",
    answer:
      "Instinct (instinct.com) is an invite-only personal AI assistant that lives in your messaging apps (WhatsApp and iMessage). It handles account-level tasks, schedules, and cloud computing. OpenAgent provides the local macOS body for Instinct: an always-listening, hands-free bridge that executes local terminal commands, code diffs, native app actions, authenticated Chrome CDP tasks, and social media automation on your actual Mac."
  },
  {
    question: "How does OpenAgent communicate with Instinct without requiring an API key?",
    answer:
      "OpenAgent uses your installed, logged-in WhatsApp Desktop client as the zero-configuration bidirectional transport. Your speech is delivered as voice notes or Whisper transcripts into your Instinct chat. Instinct responds with structured envelopes like JARVIS_CALL:<base64-JSON>:END. OpenAgent reads incoming messages via macOS Accessibility (AX), executes the tool locally, and posts the execution result and screenshots straight back to WhatsApp."
  },
  {
    question: "Does OpenAgent record or stream audio when Jarvis is sleeping?",
    answer:
      "No. Wake-word detection is powered entirely offline by Vosk running locally on your CPU/Neural Engine. Zero audio leaves your Mac until the wake word ('Wake up, Jarvis') is detected. Idle audio is never buffered, stored, or sent to any server. Furthermore, a fail-closed sender guard ensures that only messages from your verified Instinct assistant phone number can trigger tool execution."
  },
  {
    question: "How does OpenAgent operate social media accounts like Threads and Reddit without triggering anti-bot bans?",
    answer:
      "OpenAgent's LocoAgent engine drives authentic, persistent Google Chrome profiles via Chrome DevTools Protocol (CDP) on dedicated ports (e.g., 9227 for Threads, 9224 for Reddit). You log into your accounts once. All sessions and cookies stay preserved in macOS Application Support. The agent interacts through real CDP clicks and keyboard inputs rather than sketchy headless bots or unofficial APIs. Every action is cross-checked against a local SQLite/JSON deduplication ledger to prevent spam."
  },
  {
    question: "Why use WhatsApp Desktop as the bridge instead of a custom WebSocket server?",
    answer:
      "Using WhatsApp Desktop means zero cloud infrastructure to manage, zero port forwarding or public webhooks, no API token expiration, and end-to-end encryption. Because Instinct already lives natively in WhatsApp, communicating through it provides instant multi-modal feedback: voice replies play through your Mac speakers, and visual screenshots from your desktop land directly in your chat."
  },
  {
    question: "What macOS versions and hardware architectures are supported?",
    answer:
      "OpenAgent is built for macOS 14 (Sonoma) and macOS 15 (Sequoia). It runs natively on both Apple Silicon (M1/M2/M3/M4 chips) and Intel Macs. Dependency management and virtual environments are automatically handled by the Astral 'uv' package manager and the Bun JavaScript runtime."
  },
  {
    question: "What safety guards are in place to prevent rogue edits or accidental deletions?",
    answer:
      "OpenAgent enforces multiple safety layers: 1) Strict Safe Mode verifying the incoming WhatsApp chat header against your assistant's exact phone number; 2) Atomic file operations and exact-chunk search-and-replace (edit) requiring exact matches before modifying code; 3) Echo-suppression preventing the assistant from triggering its own voice loop; 4) Anti-duplication ledgers blocking duplicate posts."
  }
];
