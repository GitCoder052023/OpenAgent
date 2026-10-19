import { repoUrl } from "@/lib/content";
import { toolCount } from "@/lib/tools";

/**
 * Every answer is a single self-contained paragraph, so it stays correct when
 * an AI assistant or a search result extracts it without the surrounding page.
 * The same strings render as visible text and feed the FAQPage structured data,
 * so what a crawler reads and what a person reads are never different.
 *
 * Sources: README.md, SECURITY.md, CONTRIBUTING.md, docs/.
 */

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  links?: { label: string; href: string }[];
};

export type FaqGroup = {
  id: string;
  title: string;
  blurb: string;
  entries: FaqEntry[];
};

export const faqGroups: FaqGroup[] = [
  {
    id: "what-it-is",
    title: "What OpenAgent is",
    blurb: "The project, who it is for, and how it differs from a cloud agent.",
    entries: [
      {
        id: "what-is-openagent",
        question: "What is OpenAgent?",
        answer: `OpenAgent is an open-source, MIT-licensed execution environment for macOS. It runs on your own Mac and exposes ${toolCount} callable tools — shell commands and file edits, native application control through the macOS Accessibility API, your authenticated Chrome over the Chrome DevTools Protocol, self-hosted web scraping, social media automation, Word, Excel and PowerPoint documents, headless WhatsApp, and any external Model Context Protocol server — to an AI assistant that decides what to call. Wake-word detection and transcription run on-device on Whisper Large V3 Turbo, so a spoken request can turn into real work on your machine without you touching the keyboard.`,
        links: [
          { label: "Browse all tools", href: "/tools" },
          { label: "Repository", href: repoUrl },
        ],
      },
      {
        id: "how-different",
        question:
          "How is OpenAgent different from cloud-based AI agents and computer-use products?",
        answer:
          "Cloud agents run computer-use tasks on a virtual desktop inside the provider's own infrastructure, so they can reach your accounts but not your machine. OpenAgent executes locally under your own macOS user account: your real filesystem, your terminal, the Chrome profile you are already logged into, the windows you actually have open, and the applications installed on your Mac. Nothing is simulated in a remote sandbox, and no execution data has to leave your hardware for a tool call to run.",
        links: [{ label: "How a request travels", href: "/#architecture" }],
      },
      {
        id: "who-is-it-for",
        question: "Who is OpenAgent for?",
        answer:
          "It is built for developers and technical macOS users who want an assistant that acts on the machine in front of them rather than describing what to do. Running it means granting your terminal Accessibility, Input Monitoring, Microphone, Screen Recording and Automation permissions, installing a handful of command-line dependencies, and accepting the risks of letting an AI agent operate a real computer. It is currently in active beta and is not aimed at non-technical users.",
      },
      {
        id: "openagent-vs-openinstinct",
        question: "What is OpenInstinct, and how does it relate to OpenAgent?",
        answer:
          "OpenAgent is the execution body: the macOS harness that performs actions. OpenInstinct is an experimental, secondary local brain — a terminal REPL that reasons against any local or remote OpenAI-compatible or Ollama endpoint and drives the same harness engines with no WhatsApp, no closed cloud API and no telemetry. It runs today via ./boot.py --brain openinstinct, but it is explicitly experimental; Instinct remains the primary intelligence because its chief-of-staff experience over WhatsApp is the one that has been used daily. Combining the two into a single self-hosted system is the project's stated long-term direction, not a shipped feature.",
        links: [
          {
            label: "OpenInstinct brain spec",
            href: `${repoUrl}/blob/main/OPENINSTINCT_BRAIN_SPEC.md`,
          },
          { label: "The vision", href: "/#vision" },
        ],
      },
    ],
  },
  {
    id: "requirements",
    title: "Platforms and setup",
    blurb: "What it runs on, what it needs, and how long installation takes.",
    entries: [
      {
        id: "system-requirements",
        question: "What are the system requirements for OpenAgent?",
        answer:
          "OpenAgent requires macOS 14 Sonoma or macOS 15 Sequoia on Apple Silicon or Intel, plus uv, Homebrew and Bun. You also need WhatsApp Desktop installed and logged in if you are using Instinct as the intelligence layer, and roughly 2 GB of free disk space for the Whisper Large V3 Turbo weights. Apple Silicon Macs run the speech model on the GPU through MLX; Intel Macs fall back to whisper.cpp.",
      },
      {
        id: "windows-linux",
        question: "Does OpenAgent run on Windows or Linux?",
        answer:
          "No. OpenAgent is macOS-only by design. Its computer-use layer is built directly on the macOS Accessibility API, Quartz event taps and AppleScript, and there is no Windows or Linux port.",
      },
      {
        id: "how-to-install",
        question: "How do I install OpenAgent?",
        answer:
          "Clone the repository and run four commands: ./install.py provisions Homebrew tools, a virtual environment, the Bun harness and the speech models; ./calibrate.py --save auto-detects WhatsApp Desktop's accessibility buttons and input fields; ./test.py verifies the whole system; and ./boot.py --voice --send-mode audio starts the hands-free session. If anything looks wrong, ./boot.py --doctor runs a zero-touch preflight audit of hardware, harnesses and permissions.",
        links: [
          { label: "Installation steps", href: "/#install" },
          { label: "Full quick start", href: `${repoUrl}#quick-start` },
        ],
      },
      {
        id: "permissions",
        question: "Which macOS permissions does OpenAgent need, and why?",
        answer:
          "Five, all granted by you to your own terminal application in System Settings → Privacy & Security: Accessibility for UI inspection and desktop automation, Input Monitoring for the global push-to-talk hotkey, Microphone for audio recording through SoX, Screen Recording for window capture used by mac_see, and Automation for System Events and AppleScript application control. OpenAgent requests nothing on your behalf and holds no account of its own.",
        links: [{ label: "Privacy and security model", href: "/privacy" }],
      },
    ],
  },
  {
    id: "capabilities",
    title: "Capabilities and integrations",
    blurb: "What it can do today, and what is still experimental.",
    entries: [
      {
        id: "what-can-it-do",
        question: "What can OpenAgent actually do today?",
        answer: `It ships ${toolCount} tools across nine callable engines: a developer harness (sandboxed bash, read, write, exact-match edit, ripgrep, glob, AppleScript), native macOS computer use (window capture, Accessibility tree queries, PID-targeted clicks, keystrokes, drags and scrolls), browser automation in your authenticated Chrome, self-hosted web scraping and crawling through Firecrawl, social media automation on Threads and Reddit plus X, LinkedIn, Instagram, Facebook, YouTube, TikTok and GitHub, native macOS productivity apps, Word, Excel and PowerPoint generation without Microsoft Office, headless multi-device WhatsApp, and a universal MCP client. A voice interface and a zero-focus background mode run across all of them.`,
        links: [{ label: "Full tool reference", href: "/tools" }],
      },
      {
        id: "integrations",
        question: "Which applications and services does OpenAgent integrate with?",
        answer:
          "Natively: Apple Reminders, iMessage, Apple Notes, Things 3, Spotify, 1Password, Peekaboo, RTSP and ONVIF cameras, Nano-PDF and Tmux through macOS CLIs and AppleScript; Google Chrome over the Chrome DevTools Protocol with domain-specific skills for around 97 sites; Threads and Reddit as primary social targets with X, LinkedIn, Instagram, Facebook, YouTube, TikTok and GitHub also configured; WhatsApp both as the conversational transport and as a headless multi-device protocol engine. Anything else can be reached through an external MCP server declared in .openagent/mcp.json — Stdio subprocesses and remote SSE or StreamableHTTP endpoints are both supported.",
      },
      {
        id: "while-using-mac",
        question: "Can OpenAgent work while I am using my Mac?",
        answer:
          "Yes. Zero-focus ghost mode captures the active application's PID before doing anything, drives Chrome offscreen over CDP, queries Accessibility trees without activating the target app, captures screenshots from offscreen compositor buffers, and restores focus in milliseconds. You can stay in a fullscreen Metal game with exclusive mouse capture, or keep typing in your editor, while a post goes out or a document is written.",
      },
      {
        id: "production-ready",
        question: "Is OpenAgent production-ready?",
        answer:
          "No. OpenAgent is in active beta at version 0.1.x on the main branch, and security fixes are provided for the latest version on main only. OpenInstinct, the local brain, is labelled experimental and secondary. Treat anything described as direction — full self-hosting of every layer, frontier-scale local models, the convergence of OpenAgent and OpenInstinct — as intent rather than shipped behaviour.",
        links: [{ label: "Security policy", href: `${repoUrl}/blob/main/SECURITY.md` }],
      },
    ],
  },
  {
    id: "models-privacy",
    title: "Models, privacy and licensing",
    blurb: "Model independence, what crosses the wire, and what it costs.",
    entries: [
      {
        id: "requires-instinct",
        question: "Does OpenAgent require Instinct, or can I use my own model?",
        answer:
          "You can use your own model. Instinct is the default intelligence layer because its WhatsApp chief-of-staff experience is battle-tested for daily mobile use, but OpenHarness is the same execution engine available on its own: point Claude, Gemini, Codex or a local Ollama model at the same Mac tools, without the voice and WhatsApp setup. OpenInstinct goes further and keeps reasoning local against any OpenAI-compatible or Ollama endpoint, though it is still experimental.",
        links: [
          { label: "OpenHarness", href: "https://github.com/GitCoder052023/OpenHarness" },
        ],
      },
      {
        id: "offline",
        question: "Can OpenAgent run completely offline?",
        answer:
          "Parts of it already do. Wake-word detection and transcription run fully on-device on Whisper Large V3 Turbo, idle audio is never saved or sent, every tool call executes locally, and web scraping runs against a Firecrawl daemon you host yourself in Docker. What is not yet fully local is the reasoning layer: with Instinct the model runs in the cloud, and the local alternative, OpenInstinct, is experimental. Running every layer on your own terms is the project's stated direction.",
      },
      {
        id: "what-leaves-my-mac",
        question: "What data leaves my Mac?",
        answer:
          "Nothing leaves until the session is awake and you have spoken a request: wake-word detection runs offline and idle audio is never saved or transmitted. Once you have spoken, either a voice note or an on-device transcript goes into your own WhatsApp thread with your assistant, and the tool results, diffs and screenshots you asked for go back through the same thread. Tool execution itself happens on your hardware under your user account, scraping runs against your own Firecrawl instance, and diagnostic logs stay in ~/Library/Logs/OpenAgent/.",
        links: [{ label: "Privacy and security model", href: "/privacy" }],
      },
      {
        id: "safe",
        question: "Is it safe to give an AI agent access to my computer?",
        answer:
          "It carries real risk, and the project says so plainly. OpenAgent can act with the privileges of your local user account, and bugs, unexpected model behaviour, prompt injection or misconfiguration may cause unintended actions, data loss or privacy incidents. The design mitigates this — a fail-closed guard that only accepts messages from one verified chat, an execution ledger that prevents replay, PID-targeted input, a configurable prohibited-targets list, and audio silence gating — but the maintainers are explicit that safeguards cannot eliminate the fundamental risk. Never run an autonomous computer-use agent where an unintended action could cause unacceptable damage.",
        links: [
          { label: "The full security model", href: "/privacy" },
          { label: "SECURITY.md", href: `${repoUrl}/blob/main/SECURITY.md` },
        ],
      },
      {
        id: "cost-licence",
        question: "Is OpenAgent free, and what licence is it under?",
        answer:
          "OpenAgent is free and open source under the MIT licence. There is no paid tier, no hosted service and no account to create. You may incur costs from whatever intelligence layer you connect it to, and from running a local model on your own hardware.",
        links: [{ label: "MIT licence", href: `${repoUrl}/blob/main/LICENSE` }],
      },
      {
        id: "contribute",
        question: "How can I contribute to OpenAgent?",
        answer:
          "Contributions go through the GitHub repository. The maintainers name new macOS harness primitives and tool adapters, voice pipeline latency and wake-word accuracy, browser domain skills for additional sites, LocoAgent workflows and platform playbooks, and sandboxing and isolation as the highest-impact areas. CONTRIBUTING.md documents the development workflow, architectural invariants, code structure, testing guidelines and pull request process.",
        links: [
          { label: "Contributing guide", href: `${repoUrl}/blob/main/CONTRIBUTING.md` },
          { label: "Open issues", href: `${repoUrl}/issues` },
        ],
      },
    ],
  },
];

export const faqEntries = faqGroups.flatMap((g) => g.entries);
