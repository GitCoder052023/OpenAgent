// Generated from the repository README.md tool tables — do not edit by hand.
// Run: python3 src/apps/website/scripts/generate-tools.py

export type Tool = {
  name: string;
  summary: string;
  args: string[];
};

export type ToolCategory = {
  slug: string;
  label: string;
  builtOn: string;
  intro: string;
  tools: Tool[];
};

export const toolCategories: ToolCategory[] = [
  {
    slug: "developer-harness",
    label: "Developer harness",
    builtOn: "Bun + TypeScript",
    intro:
      "Sandboxed bash, paginated read, atomic write, exact-match edit, ripgrep regex search, glob, and AppleScript — the primitives a coding agent needs, running directly on your machine.",
    tools: [
      {
        name: "bash",
        summary:
          "Execute shell commands in zsh",
        args: ["command", "cwd", "timeout_ms"],
      },
      {
        name: "read",
        summary:
          "Read file contents or list directories with pagination",
        args: ["path", "offset", "limit"],
      },
      {
        name: "write",
        summary:
          "Atomically write or overwrite files",
        args: ["path", "content"],
      },
      {
        name: "edit",
        summary:
          "Exact chunk search-and-replace with unified diff output",
        args: ["path", "old_string", "new_string"],
      },
      {
        name: "grep",
        summary:
          "High-speed regex code search via ripgrep",
        args: ["pattern", "path"],
      },
      {
        name: "glob",
        summary:
          "Find files matching glob patterns",
        args: ["pattern", "path"],
      },
      {
        name: "applescript",
        summary:
          "Execute multiline native AppleScript via osascript",
        args: ["script"],
      },
      {
        name: "system_info",
        summary:
          "Inspect local OS version, hardware, and runtime status",
        args: [],
      },
    ],
  },
  {
    slug: "computer-use",
    label: "Native computer use",
    builtOn: "macOS Accessibility & Quartz",
    intro:
      "Window capture, Accessibility tree queries, PID-targeted clicks, keystrokes, drags and scrolls that do not steal focus from whatever you are doing.",
    tools: [
      {
        name: "mac_see",
        summary:
          "Capture window screenshot and extract interactive UI elements",
        args: ["app", "send_image", "include_summary"],
      },
      {
        name: "mac_click",
        summary:
          "PID-targeted mouse click without stealing focus",
        args: ["x", "y", "app", "button", "click_count"],
      },
      {
        name: "mac_type",
        summary:
          "Type text directly into a target application",
        args: ["text", "app"],
      },
      {
        name: "mac_key",
        summary:
          "Trigger keyboard shortcuts (e.g., cmd+s, enter)",
        args: ["key", "app"],
      },
      {
        name: "mac_drag",
        summary:
          "Perform drag-and-drop operations",
        args: ["start_x", "start_y", "end_x", "end_y", "app"],
      },
      {
        name: "mac_scroll",
        summary:
          "Send directional scroll events",
        args: ["x", "y", "dx", "dy", "app"],
      },
      {
        name: "mac_apps",
        summary:
          "List all running applications with process IDs",
        args: [],
      },
      {
        name: "mac_windows",
        summary:
          "List open window titles and bounds for an application",
        args: ["app"],
      },
      {
        name: "mac_ax",
        summary:
          "Query and interact with macOS Accessibility elements",
        args: ["action", "app", "text"],
      },
      {
        name: "mac_python",
        summary:
          "Run compound, multi-step UI workflows locally in Python",
        args: ["code"],
      },
    ],
  },
  {
    slug: "browser",
    label: "Browser automation",
    builtOn: "Browser Harness (CDP)",
    intro:
      "Your authenticated, everyday Chrome: background tabs, compositor clicks through iframes and shadow DOM, framework-safe form filling, and 97 domain-specific skills.",
    tools: [
      {
        name: "browser_open",
        summary:
          "Navigate or open a new tab in your authenticated Chrome session",
        args: ["url", "new_tab"],
      },
      {
        name: "browser_info",
        summary:
          "Inspect page URL, title, viewport dimensions, and scroll offset",
        args: [],
      },
      {
        name: "browser_click",
        summary:
          "Composited CDP mouse click bypassing iframes/shadow DOM",
        args: ["x", "y", "selector", "button", "click_count"],
      },
      {
        name: "browser_fill",
        summary:
          "Framework-safe form input (React/Vue synthetic events)",
        args: ["selector", "text", "clear_first", "timeout"],
      },
      {
        name: "browser_type",
        summary:
          "Type text into currently focused web element",
        args: ["text"],
      },
      {
        name: "browser_key",
        summary:
          "Trigger web keyboard shortcuts (Enter, Escape, Tab, Backspace)",
        args: ["key", "modifiers"],
      },
      {
        name: "browser_scroll",
        summary:
          "Scroll by delta pixels or scroll element into view",
        args: ["dx", "dy", "selector"],
      },
      {
        name: "browser_tabs",
        summary:
          "Background tab management (list, new, switch, close, current)",
        args: ["action", "target", "url"],
      },
      {
        name: "browser_see",
        summary:
          "Inspect tab state and send visual screenshot to WhatsApp",
        args: ["send_image", "max_elements"],
      },
      {
        name: "browser_ax",
        summary:
          "Discover buttons/inputs via internal Accessibility Tree",
        args: ["action", "text", "role", "limit"],
      },
      {
        name: "browser_eval",
        summary:
          "Evaluate JavaScript in the active tab context",
        args: ["expression"],
      },
      {
        name: "browser_wait",
        summary:
          "Wait for page load, network idle, or element appearance",
        args: ["for_what", "selector", "timeout"],
      },
      {
        name: "browser_python",
        summary:
          "Ultra-fast compound browser burst execution (<200ms)",
        args: ["code", "timeout"],
      },
      {
        name: "domain_skills",
        summary:
          "Retrieve pre-built domain automation skills for 80+ platforms",
        args: ["host"],
      },
    ],
  },
  {
    slug: "web",
    label: "Web ingestion & extraction",
    builtOn: "Self-hosted Firecrawl",
    intro:
      "Scrape to clean Markdown, search with full-content results, recursive crawl, site mapping and schema-based JSON extraction, against a Firecrawl daemon you host yourself.",
    tools: [
      {
        name: "firecrawl_scrape",
        summary:
          "Scrape dynamic web pages directly into clean LLM Markdown",
        args: ["url", "formats", "only_main_content", "wait_for"],
      },
      {
        name: "firecrawl_search",
        summary:
          "Search the web and return full Markdown from top hits in one shot",
        args: ["query", "limit", "scrape_options"],
      },
      {
        name: "firecrawl_crawl",
        summary:
          "Asynchronously crawl an entire domain or documentation tree",
        args: ["url", "max_depth", "limit"],
      },
      {
        name: "firecrawl_status",
        summary:
          "Check the progress and page count of an ongoing crawl",
        args: ["job_id"],
      },
      {
        name: "firecrawl_map",
        summary:
          "Fast sitemap and URL discovery across a domain",
        args: ["url", "search", "limit"],
      },
      {
        name: "firecrawl_extract",
        summary:
          "Extract structured JSON data matching a schema or prompt",
        args: ["urls", "prompt", "schema"],
      },
      {
        name: "firecrawl_doctor",
        summary:
          "Inspect health of self-hosted local Firecrawl daemon",
        args: [],
      },
    ],
  },
  {
    slug: "social",
    label: "Social media automation",
    builtOn: "LocoAgent (CDP)",
    intro:
      "Operate real social accounts with primary focus on Threads (threads.net) and Reddit (reddit.com) (plus X/Twitter, LinkedIn, Instagram, Facebook, YouTube, TikTok, and GitHub) with persistent anti-detection Chrome profiles.",
    tools: [
      {
        name: "social_targets",
        summary:
          "Inspect all configured social platforms and live CDP port status",
        args: [],
      },
      {
        name: "social_setup",
        summary:
          "Launch persistent, isolated Chrome browser for a social platform",
        args: ["target", "all", "reset"],
      },
      {
        name: "social_post",
        summary:
          "Publish a post or tweet with optional image/media attachment",
        args: ["text", "platform", "media"],
      },
      {
        name: "social_reply",
        summary:
          "Reply to a post or tweet with anti-deduplication check",
        args: ["url", "text", "platform"],
      },
      {
        name: "social_like",
        summary:
          "Like or react to a post with anti-deduplication check",
        args: ["url", "platform"],
      },
      {
        name: "social_search",
        summary:
          "Search social media discussions by keyword/hashtag",
        args: ["query", "platform", "tab"],
      },
      {
        name: "social_screenshot",
        summary:
          "Capture live social feed screenshot delivered to WhatsApp",
        args: ["platform", "full", "annotate"],
      },
      {
        name: "social_workflow",
        summary:
          "Control automation pipelines (run, start, stop, daemon, status)",
        args: ["action", "id", "interval"],
      },
      {
        name: "social_agent_task",
        summary:
          "Delegate an end-to-end autonomous social media mission",
        args: ["prompt", "model", "timeout"],
      },
      {
        name: "social_dedup_check",
        summary:
          "Check if a URL was already interacted with in persistent ledger",
        args: ["platform", "action", "url"],
      },
      {
        name: "social_log",
        summary:
          "Record a successful interaction into the operation log",
        args: ["platform", "action", "url", "status", "note"],
      },
      {
        name: "social_exec",
        summary:
          "Execute direct agent-browser CDP command on any target",
        args: ["platform", "command"],
      },
      {
        name: "social_doctor",
        summary:
          "Run health checks on Bun, agent-browser CLI, and Chrome CDP",
        args: [],
      },
    ],
  },
  {
    slug: "productivity",
    label: "macOS productivity",
    builtOn: "skills_adapter.py",
    intro:
      "Execute native macOS productivity and desktop workflows through system CLIs and AppleScript (remindctl, imsg, things, spogo, op, peekaboo, osascript, camsnap, nano-pdf, tmux).",
    tools: [
      {
        name: "apple_reminders",
        summary:
          "Create, list, complete, and delete Apple Reminders (synced to iOS via remindctl)",
        args: ["action", "title", "due", "list"],
      },
      {
        name: "imsg",
        summary:
          "Read iMessage conversation threads and send SMS/iMessage from the command line (imsg)",
        args: ["action", "to", "text", "limit"],
      },
      {
        name: "things_mac",
        summary:
          "Query Things 3 Inbox, Today view, search tasks, and add tagged todos (things)",
        args: ["action", "title", "notes", "when"],
      },
      {
        name: "spotify",
        summary:
          "Control desktop Spotify playback, search tracks, and list devices (spogo)",
        args: ["action", "query"],
      },
      {
        name: "1password",
        summary:
          "Retrieve secrets, API tokens, and logins securely via 1Password CLI (op)",
        args: ["action", "item", "reference"],
      },
      {
        name: "peekaboo",
        summary:
          "Inspect macOS window hierarchies and capture specific screen regions (peekaboo)",
        args: ["action", "target", "out"],
      },
      {
        name: "apple_notes",
        summary:
          "Create and search rich formatted Apple Notes via native AppleScript (osascript)",
        args: ["action", "title", "body"],
      },
      {
        name: "camsnap",
        summary:
          "Capture live frames and video clips from RTSP/ONVIF security cameras (camsnap)",
        args: ["action", "camera"],
      },
      {
        name: "nano_pdf",
        summary:
          "Edit PDF pages using natural language prompts (nano-pdf)",
        args: ["action", "path", "prompt"],
      },
      {
        name: "skills_list",
        summary:
          "List all registered agent skills and local installation status",
        args: [],
      },
    ],
  },
  {
    slug: "office",
    label: "Office documents",
    builtOn: "python-docx / openpyxl / python-pptx",
    intro:
      "Inspect, create, and format Microsoft Office documents programmatically without requiring Microsoft Office installed, built on python-docx, openpyxl, and python-pptx.",
    tools: [
      {
        name: "word_read",
        summary:
          "Read Word .docx documents with headings, body paragraphs, and tables",
        args: ["path", "max_paragraphs"],
      },
      {
        name: "word_write",
        summary:
          "Generate styled Word .docx documents with custom headings and table styling",
        args: ["path", "title", "paragraphs", "tables"],
      },
      {
        name: "excel_read",
        summary:
          "Inspect Excel .xlsx workbooks, sheet names, headers, and data rows",
        args: ["path", "sheet_name", "max_rows"],
      },
      {
        name: "excel_write",
        summary:
          "Create or update formatted Excel .xlsx workbooks with styled headers and column widths",
        args: ["path", "sheet_name", "headers", "rows"],
      },
      {
        name: "pptx_read",
        summary:
          "Inspect PowerPoint .pptx decks, slide hierarchy, titles, and bullet points",
        args: ["path", "max_slides"],
      },
      {
        name: "pptx_write",
        summary:
          "Generate presentation slide decks with title and content layouts",
        args: ["path", "title", "slides", "subtitle"],
      },
      {
        name: "pptx_template_fill",
        summary:
          "Replace template placeholder tags (e.g. {{TITLE}}, {{METRICS}}) with dynamic values in existing decks",
        args: ["template_path", "output_path", "replacements"],
      },
    ],
  },
  {
    slug: "whatsapp",
    label: "WhatsApp protocol",
    builtOn: "whatsmeow + MCP",
    intro:
      "Operate your personal WhatsApp account headlessly via a multi-device WebSocket protocol engine (powered by Go whatsmeow and FastMCP) with end-to-end Signal Protocol cryptography. Jarvis interacts, searches, sends media, and manages groups without touching the desktop GUI or stealing mouse focus. For lightweight CLI-only messaging, wacli is also available as a fallback channel.",
    tools: [
      {
        name: "whatsapp_send",
        summary:
          "Send text messages headlessly via native Multi-Device WebSocket protocol (with quoting and @mentions)",
        args: ["recipient", "message", "quoted_message_id", "mentioned_jids"],
      },
      {
        name: "whatsapp_read",
        summary:
          "Search historical messages across all chats or read thread history",
        args: ["chat_jid", "query", "limit", "sender"],
      },
      {
        name: "whatsapp_chats",
        summary:
          "List all active conversations, group threads, and unread counts",
        args: ["limit"],
      },
      {
        name: "whatsapp_contacts",
        summary:
          "Fast contact search by name, push name, or phone number",
        args: ["query"],
      },
      {
        name: "whatsapp_contact_context",
        summary:
          "Full contact historical thread and CRM interaction metrics",
        args: ["contact"],
      },
      {
        name: "whatsapp_file",
        summary:
          "Send files, images, PDFs, and documents headlessly without desktop GUI",
        args: ["recipient", "file_path", "caption"],
      },
      {
        name: "whatsapp_audio",
        summary:
          "Send native audio recordings and official voice notes (.m4a, .ogg, .wav)",
        args: ["recipient", "audio_path"],
      },
      {
        name: "whatsapp_reaction",
        summary:
          "React to any WhatsApp message with emojis",
        args: ["chat_jid", "message_id", "emoji"],
      },
      {
        name: "whatsapp_edit",
        summary:
          "Edit previously sent message text",
        args: ["chat_jid", "message_id", "new_text"],
      },
      {
        name: "whatsapp_delete",
        summary:
          "Revoke / delete messages for everyone in the chat",
        args: ["chat_jid", "message_id"],
      },
      {
        name: "whatsapp_poll",
        summary:
          "Create interactive multi-choice polls in individual chats or groups",
        args: ["chat_jid", "question", "options", "max_answers"],
      },
      {
        name: "whatsapp_group",
        summary:
          "Group administration (create groups, add/remove members, promote admins, set topics)",
        args: ["action", "group_jid", "participants", "name", "topic"],
      },
      {
        name: "whatsapp_presence",
        summary:
          "Set presence state (available, unavailable, composing, recording)",
        args: ["status"],
      },
      {
        name: "whatsapp_status",
        summary:
          "Inspect WhatsApp protocol engine health and session status",
        args: [],
      },
    ],
  },
  {
    slug: "mcp",
    label: "Universal MCP client",
    builtOn: "Model Context Protocol",
    intro:
      "Dynamically discover and execute tools from any external MCP-compliant server (such as PostgreSQL, GitHub, Slack, Linear, or Supabase) declared in .openagent/mcp.json. Supports both local Stdio subprocesses and remote StreamableHTTP / SSE endpoints.",
    tools: [
      {
        name: "mcp_call",
        summary:
          "Invoke any dynamic Model Context Protocol (MCP) server tool",
        args: ["server", "tool", "arguments"],
      },
      {
        name: "mcp_tools",
        summary:
          "List all discovered tools from active Stdio & SSE MCP servers",
        args: ["server"],
      },
      {
        name: "mcp_status",
        summary:
          "Inspect registered MCP servers and connection status",
        args: [],
      },
    ],
  },
];

export const toolCount = toolCategories.reduce((n, c) => n + c.tools.length, 0);
