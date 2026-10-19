import { repoUrl, siteUrl } from "@/lib/content";
import { faqGroups } from "@/lib/faq";
import { productSummary, routes } from "@/lib/seo";
import { toolCategories, toolCount } from "@/lib/tools";

/**
 * /llms.txt — a supplementary discovery aid for AI crawlers, following the
 * llmstxt.org convention: an H1, a blockquote summary, then linked sections.
 * It is not a ranking signal and not a substitute for the sitemap or the
 * structured data; it exists so a retrieval system that fetches one file gets
 * an accurate, current description rather than guessing from rendered markup.
 */
export function buildLlmsTxt() {
  const engines = toolCategories
    .map((c) => `- ${c.label} (${c.tools.length} tools): ${c.intro}`)
    .join("\n");

  const pages = routes
    .map((r) => `- [${pageTitle(r.path)}](${siteUrl}${r.path === "/" ? "/" : r.path}): ${pageBlurb(r.path)}`)
    .join("\n");

  const faq = faqGroups
    .map(
      (g) =>
        `### ${g.title}\n\n` +
        g.entries.map((e) => `**${e.question}**\n${e.answer}`).join("\n\n"),
    )
    .join("\n\n");

  return `# OpenAgent

> ${productSummary}

OpenAgent is MIT licensed and free. It is in active beta (0.1.x on the main
branch). It is macOS-only: macOS 14 Sonoma or 15 Sequoia, Apple Silicon or
Intel. The canonical source of truth is the GitHub repository; this site
describes the same project and is generated from it.

Positioning: a cloud assistant can reach your accounts but not your machine.
OpenAgent is the local execution half. Instinct is the default intelligence
layer and runs in the cloud; OpenHarness is the same execution engine on its
own for Claude, Gemini, Codex or a local Ollama model; OpenInstinct is an
experimental local brain. Combining OpenInstinct and OpenAgent into one
self-hosted system is stated direction, not a shipped feature.

## Pages

${pages}

## Engines

${toolCount} callable tools across nine engines, plus a voice interface and a
zero-focus background mode that span all of them:

${engines}

## How it works

1. Input: after the wake phrase, OpenAgent listens until a natural pause and sends a voice note or an on-device Whisper Large V3 Turbo transcript into your WhatsApp thread.
2. Tool calls: the assistant replies with structured JSON wrapped in a \`JARVIS_CALL:<base64>:END\` envelope; base64 survives WhatsApp's markdown.
3. Observation: OpenAgent reads incoming messages through the macOS Accessibility API.
4. Verification: a fail-closed guard confirms the message came from the verified chat before anything is decoded.
5. Execution: the dispatcher routes the call to one of the local engines and runs it under your own user account.
6. Response: results, diffs and screenshots return to the same thread.

## Install

\`\`\`bash
git clone ${repoUrl}.git
cd OpenAgent
./install.py                          # Homebrew tools, venv, Bun harness, speech models
./calibrate.py --save                 # auto-detect WhatsApp Desktop accessibility paths
./test.py                             # verify the system
./boot.py --voice --send-mode audio   # hands-free; then say "Wake up, Jarvis"
\`\`\`

## FAQ

${faq}

## Repository

- [GitHub repository](${repoUrl}): source, issues, releases
- [README](${repoUrl}#readme): full product and tool documentation
- [Quick start](${repoUrl}#quick-start): installation and macOS permissions
- [Tool instructions](${repoUrl}/blob/main/docs/JARVIS_INSTRUCTIONS.md): the envelope protocol and full tool schemas
- [WhatsApp protocol guide](${repoUrl}/blob/main/docs/WHATSAPP_INTEGRATION.md)
- [Social media automation guide](${repoUrl}/blob/main/docs/SOCIAL_MEDIA_AUTOMATION.md)
- [Calibration guide](${repoUrl}/blob/main/docs/CALIBRATION.md)
- [OpenInstinct brain spec](${repoUrl}/blob/main/OPENINSTINCT_BRAIN_SPEC.md): experimental local brain
- [Security policy](${repoUrl}/blob/main/SECURITY.md): threat boundaries and disclosure
- [Contributing guide](${repoUrl}/blob/main/CONTRIBUTING.md)
- [MIT licence](${repoUrl}/blob/main/LICENSE)
- [OpenHarness](https://github.com/GitCoder052023/OpenHarness): the execution engine on its own, for your own model
`;
}

function pageTitle(path: string) {
  switch (path) {
    case "/":
      return "OpenAgent — overview";
    case "/tools":
      return "Tool reference";
    case "/faq":
      return "FAQ";
    case "/privacy":
      return "Privacy and security model";
    default:
      return path;
  }
}

function pageBlurb(path: string) {
  switch (path) {
    case "/":
      return "what OpenAgent is, the request loop end to end, the eleven engines, zero-focus operation, the voice interface, installation and the long-term vision";
    case "/tools":
      return `all ${toolCount} callable tools with their key arguments, grouped by engine`;
    case "/faq":
      return "platform requirements, capabilities, model independence, privacy boundaries, licensing and contribution";
    case "/privacy":
      return "what stays local, what crosses the wire and when, what is written to disk, the six fail-closed safeguards, and the risks of computer-use agents";
    default:
      return "";
  }
}
