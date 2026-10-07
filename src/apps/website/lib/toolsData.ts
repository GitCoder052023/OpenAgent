export interface ToolDefinition {
  name: string;
  engine: "Developer Harness" | "Native Computer Use" | "Browser Harness CDP" | "Web Ingestion (Firecrawl)" | "Social Media (LocoAgent)";
  description: string;
  keyArguments: string;
  exampleCall?: string;
  category: string;
}

export const TOOLS_DATA: ToolDefinition[] = [
  // Developer Harness
  {
    name: "bash",
    engine: "Developer Harness",
    description: "Execute shell commands in zsh with real-time output capture and timeouts",
    keyArguments: "command, cwd, timeout_ms",
    exampleCall: '{"tool": "bash", "args": {"command": "./test.py --unit"}}',
    category: "Development"
  },
  {
    name: "read",
    engine: "Developer Harness",
    description: "Read file contents or list directories with high-speed offset pagination",
    keyArguments: "path, offset, limit",
    exampleCall: '{"tool": "read", "args": {"path": "src/core/dispatcher.py", "limit": 100}}',
    category: "Development"
  },
  {
    name: "write",
    engine: "Developer Harness",
    description: "Atomically write or overwrite files to prevent partial or corrupted file writes",
    keyArguments: "path, content",
    exampleCall: '{"tool": "write", "args": {"path": ".env.local", "content": "BRIDGE_SAFE_MODE=true"}}',
    category: "Development"
  },
  {
    name: "edit",
    engine: "Developer Harness",
    description: "Exact chunk search-and-replace with unified diff output verification",
    keyArguments: "path, old_string, new_string",
    exampleCall: '{"tool": "edit", "args": {"path": "config.py", "old_string": "DEBUG = False", "new_string": "DEBUG = True"}}',
    category: "Development"
  },
  {
    name: "grep",
    engine: "Developer Harness",
    description: "High-speed multi-threaded regex code search powered by native ripgrep",
    keyArguments: "pattern, path",
    exampleCall: '{"tool": "grep", "args": {"pattern": "JARVIS_CALL", "path": "src/"}}',
    category: "Development"
  },
  {
    name: "glob",
    engine: "Developer Harness",
    description: "Find files matching filesystem glob patterns recursively",
    keyArguments: "pattern, path",
    exampleCall: '{"tool": "glob", "args": {"pattern": "**/*.py", "path": "src"}}',
    category: "Development"
  },
  {
    name: "applescript",
    engine: "Developer Harness",
    description: "Execute multiline native macOS AppleScript via osascript bridge",
    keyArguments: "script",
    exampleCall: '{"tool": "applescript", "args": {"script": "tell application \\"Finder\\" to get name of startup disk"}}',
    category: "Development"
  },
  {
    name: "system_info",
    engine: "Developer Harness",
    description: "Inspect local macOS OS version, hardware specs, memory, and runtime status",
    keyArguments: "(none)",
    exampleCall: '{"tool": "system_info", "args": {}}',
    category: "Development"
  },

  // Native macOS Computer Use
  {
    name: "mac_see",
    engine: "Native Computer Use",
    description: "Capture high-resolution window screenshot and extract interactive UI elements via Accessibility tree",
    keyArguments: "app, send_image, include_summary",
    exampleCall: '{"tool": "mac_see", "args": {"app": "WhatsApp", "send_image": true}}',
    category: "macOS UI"
  },
  {
    name: "mac_click",
    engine: "Native Computer Use",
    description: "PID-targeted mouse click dispatched directly to window without stealing desktop focus",
    keyArguments: "x, y, app, button, click_count",
    exampleCall: '{"tool": "mac_click", "args": {"x": 340, "y": 820, "app": "WhatsApp"}}',
    category: "macOS UI"
  },
  {
    name: "mac_type",
    engine: "Native Computer Use",
    description: "Type text directly into a target macOS application with synthetic keyboard events",
    keyArguments: "text, app",
    exampleCall: '{"tool": "mac_type", "args": {"text": "All tests passed successfully", "app": "Notes"}}',
    category: "macOS UI"
  },
  {
    name: "mac_key",
    engine: "Native Computer Use",
    description: "Trigger native system keyboard shortcuts (e.g. cmd+s, cmd+space, enter, esc)",
    keyArguments: "key, app",
    exampleCall: '{"tool": "mac_key", "args": {"key": "cmd+s", "app": "TextEdit"}}',
    category: "macOS UI"
  },
  {
    name: "mac_drag",
    engine: "Native Computer Use",
    description: "Perform smooth coordinate drag-and-drop operations across application windows",
    keyArguments: "start_x, start_y, end_x, end_y, app",
    exampleCall: '{"tool": "mac_drag", "args": {"start_x": 100, "start_y": 200, "end_x": 400, "end_y": 200}}',
    category: "macOS UI"
  },
  {
    name: "mac_scroll",
    engine: "Native Computer Use",
    description: "Send directional vertical or horizontal scroll events to specific window coordinates",
    keyArguments: "x, y, dx, dy, app",
    exampleCall: '{"tool": "mac_scroll", "args": {"x": 500, "y": 500, "dx": 0, "dy": -300}}',
    category: "macOS UI"
  },
  {
    name: "mac_apps",
    engine: "Native Computer Use",
    description: "List all currently running applications with process IDs, bundle identifiers, and active status",
    keyArguments: "(none)",
    exampleCall: '{"tool": "mac_apps", "args": {}}',
    category: "macOS UI"
  },
  {
    name: "mac_windows",
    engine: "Native Computer Use",
    description: "List open window titles, window IDs, and bounding rectangles for any application",
    keyArguments: "app",
    exampleCall: '{"tool": "mac_windows", "args": {"app": "Google Chrome"}}',
    category: "macOS UI"
  },
  {
    name: "mac_ax",
    engine: "Native Computer Use",
    description: "Query and interact with macOS Accessibility (AX) elements hierarchy directly",
    keyArguments: "action, app, text",
    exampleCall: '{"tool": "mac_ax", "args": {"action": "find_button", "app": "WhatsApp", "text": "Send"}}',
    category: "macOS UI"
  },
  {
    name: "mac_python",
    engine: "Native Computer Use",
    description: "Run compound, multi-step UI workflows locally in Python for ultra-low latency bursts",
    keyArguments: "code",
    exampleCall: '{"tool": "mac_python", "args": {"code": "import pyautogui; pyautogui.alert(\'Ready\')"}}',
    category: "macOS UI"
  },

  // Real Browser Control (Browser Harness CDP)
  {
    name: "browser_open",
    engine: "Browser Harness CDP",
    description: "Navigate or open a new tab in your authenticated everyday Chrome session via CDP",
    keyArguments: "url, new_tab",
    exampleCall: '{"tool": "browser_open", "args": {"url": "https://github.com/notifications", "new_tab": true}}',
    category: "Web Browsing"
  },
  {
    name: "browser_info",
    engine: "Browser Harness CDP",
    description: "Inspect current tab page URL, title, viewport dimensions, and scroll positions",
    keyArguments: "(none)",
    exampleCall: '{"tool": "browser_info", "args": {}}',
    category: "Web Browsing"
  },
  {
    name: "browser_click",
    engine: "Browser Harness CDP",
    description: "Composited CDP mouse click bypassing nested iframes and shadow DOM boundaries",
    keyArguments: "x, y, selector, button, click_count",
    exampleCall: '{"tool": "browser_click", "args": {"selector": "button[data-action=\'submit\']"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_fill",
    engine: "Browser Harness CDP",
    description: "Framework-safe form input triggering React/Vue synthetic events cleanly",
    keyArguments: "selector, text, clear_first, timeout",
    exampleCall: '{"tool": "browser_fill", "args": {"selector": "input#search", "text": "Next.js 16"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_type",
    engine: "Browser Harness CDP",
    description: "Type text into the currently focused web element character-by-character",
    keyArguments: "text",
    exampleCall: '{"tool": "browser_type", "args": {"text": "hello world"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_key",
    engine: "Browser Harness CDP",
    description: "Trigger web keyboard shortcuts and navigation keys (Enter, Escape, Tab, Backspace)",
    keyArguments: "key, modifiers",
    exampleCall: '{"tool": "browser_key", "args": {"key": "Enter"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_scroll",
    engine: "Browser Harness CDP",
    description: "Scroll page by delta pixels or scroll a specific target element into viewport center",
    keyArguments: "dx, dy, selector",
    exampleCall: '{"tool": "browser_scroll", "args": {"dy": 600}}',
    category: "Web Browsing"
  },
  {
    name: "browser_tabs",
    engine: "Browser Harness CDP",
    description: "Manage background tabs: list all tabs, create new, switch active tab, close, or get current",
    keyArguments: "action, target, url",
    exampleCall: '{"tool": "browser_tabs", "args": {"action": "list"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_see",
    engine: "Browser Harness CDP",
    description: "Inspect live tab state and capture a crisp visual screenshot delivered straight to WhatsApp",
    keyArguments: "send_image, max_elements",
    exampleCall: '{"tool": "browser_see", "args": {"send_image": true}}',
    category: "Web Browsing"
  },
  {
    name: "browser_ax",
    engine: "Browser Harness CDP",
    description: "Discover buttons, inputs, links, and forms via browser internal Accessibility Tree",
    keyArguments: "action, text, role, limit",
    exampleCall: '{"tool": "browser_ax", "args": {"role": "button", "text": "Deploy"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_eval",
    engine: "Browser Harness CDP",
    description: "Evaluate sandboxed JavaScript in active tab context and return serialized results",
    keyArguments: "expression",
    exampleCall: '{"tool": "browser_eval", "args": {"expression": "document.title"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_wait",
    engine: "Browser Harness CDP",
    description: "Wait for page load, network idle, navigation event, or CSS selector appearance",
    keyArguments: "for_what, selector, timeout",
    exampleCall: '{"tool": "browser_wait", "args": {"for_what": "selector", "selector": "#dashboard"}}',
    category: "Web Browsing"
  },
  {
    name: "browser_python",
    engine: "Browser Harness CDP",
    description: "Ultra-fast compound browser burst execution directly in Python (<200ms latency)",
    keyArguments: "code, timeout",
    exampleCall: '{"tool": "browser_python", "args": {"code": "cdp.navigate(\'https://apple.com\')"}}',
    category: "Web Browsing"
  },
  {
    name: "domain_skills",
    engine: "Browser Harness CDP",
    description: "Retrieve pre-built deterministic automation recipes for 80+ top web platforms",
    keyArguments: "host",
    exampleCall: '{"tool": "domain_skills", "args": {"host": "notion.so"}}',
    category: "Web Browsing"
  },

  // Web Ingestion & Extraction (Firecrawl Engine)
  {
    name: "firecrawl_scrape",
    engine: "Web Ingestion (Firecrawl)",
    description: "Scrape dynamic, JavaScript-rendered web pages directly into pristine LLM Markdown",
    keyArguments: "url, formats, only_main_content, wait_for",
    exampleCall: '{"tool": "firecrawl_scrape", "args": {"url": "https://docs.anthropic.com", "formats": ["markdown"]}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_search",
    engine: "Web Ingestion (Firecrawl)",
    description: "Search the web and retrieve full markdown content from top ranking hits in a single call",
    keyArguments: "query, limit, scrape_options",
    exampleCall: '{"tool": "firecrawl_search", "args": {"query": "Next.js 16 App Router changes", "limit": 3}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_crawl",
    engine: "Web Ingestion (Firecrawl)",
    description: "Asynchronously crawl an entire domain or documentation tree recursively with depth controls",
    keyArguments: "url, max_depth, limit",
    exampleCall: '{"tool": "firecrawl_crawl", "args": {"url": "https://astral.sh/uv", "max_depth": 2}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_status",
    engine: "Web Ingestion (Firecrawl)",
    description: "Check the live progress, completion percentage, and scraped page count of an ongoing crawl",
    keyArguments: "job_id",
    exampleCall: '{"tool": "firecrawl_status", "args": {"job_id": "crawl_981a8b"}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_map",
    engine: "Web Ingestion (Firecrawl)",
    description: "High-speed domain sitemap and URL discovery to inspect architecture before ingestion",
    keyArguments: "url, search, limit",
    exampleCall: '{"tool": "firecrawl_map", "args": {"url": "https://tailwindcss.com", "limit": 50}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_extract",
    engine: "Web Ingestion (Firecrawl)",
    description: "Extract structured JSON data matching a strict JSON schema or descriptive LLM prompt",
    keyArguments: "urls, prompt, schema",
    exampleCall: '{"tool": "firecrawl_extract", "args": {"urls": ["https://news.ycombinator.com"], "prompt": "top 5 titles and links"}}',
    category: "Scraping & Data"
  },
  {
    name: "firecrawl_doctor",
    engine: "Web Ingestion (Firecrawl)",
    description: "Inspect health and connection status of self-hosted local Firecrawl Docker daemon",
    keyArguments: "(none)",
    exampleCall: '{"tool": "firecrawl_doctor", "args": {}}',
    category: "Scraping & Data"
  },

  // Social Media Automation (LocoAgent Engine)
  {
    name: "social_targets",
    engine: "Social Media (LocoAgent)",
    description: "Inspect all configured social platforms (Threads, Reddit, X, LinkedIn) and live CDP port status",
    keyArguments: "(none)",
    exampleCall: '{"tool": "social_targets", "args": {}}',
    category: "Social Media"
  },
  {
    name: "social_setup",
    engine: "Social Media (LocoAgent)",
    description: "Launch persistent, isolated Chrome browser for a target social platform to inspect or seed session",
    keyArguments: "target, all, reset",
    exampleCall: '{"tool": "social_setup", "args": {"target": "threads"}}',
    category: "Social Media"
  },
  {
    name: "social_post",
    engine: "Social Media (LocoAgent)",
    description: "Publish a post, thread, or tweet with optional image/media attachment from your authenticated profile",
    keyArguments: "text, platform, media",
    exampleCall: '{"tool": "social_post", "args": {"platform": "threads", "text": "Shipped OpenAgent v0.9 today!"}}',
    category: "Social Media"
  },
  {
    name: "social_reply",
    engine: "Social Media (LocoAgent)",
    description: "Reply to a social post or comment with automated anti-deduplication ledger check",
    keyArguments: "url, text, platform",
    exampleCall: '{"tool": "social_reply", "args": {"platform": "threads", "url": "https://threads.net/@dev/post/1", "text": "Agreed!"}}',
    category: "Social Media"
  },
  {
    name: "social_like",
    engine: "Social Media (LocoAgent)",
    description: "Like or upvote a post with persistent anti-duplication ledger protection",
    keyArguments: "url, platform",
    exampleCall: '{"tool": "social_like", "args": {"platform": "reddit", "url": "https://reddit.com/r/apple/comments/xyz"}}',
    category: "Social Media"
  },
  {
    name: "social_search",
    engine: "Social Media (LocoAgent)",
    description: "Search social discussions, subreddits, or hashtags by keyword to surface live discussions",
    keyArguments: "query, platform, tab",
    exampleCall: '{"tool": "social_search", "args": {"platform": "threads", "query": "macOS agent"}}',
    category: "Social Media"
  },
  {
    name: "social_screenshot",
    engine: "Social Media (LocoAgent)",
    description: "Capture live social feed screenshot from isolated browser profile delivered directly to WhatsApp",
    keyArguments: "platform, full, annotate",
    exampleCall: '{"tool": "social_screenshot", "args": {"platform": "threads", "full": false}}',
    category: "Social Media"
  },
  {
    name: "social_workflow",
    engine: "Social Media (LocoAgent)",
    description: "Control autonomous social workflows (run, start, stop, daemon status, interval trigger)",
    keyArguments: "action, id, interval",
    exampleCall: '{"tool": "social_workflow", "args": {"action": "status"}}',
    category: "Social Media"
  },
  {
    name: "social_agent_task",
    engine: "Social Media (LocoAgent)",
    description: "Delegate an end-to-end autonomous social mission with natural language goal and timeout",
    keyArguments: "prompt, model, timeout",
    exampleCall: '{"tool": "social_agent_task", "args": {"prompt": "Review r/LocalLLaMA for new agent harnesses"}}',
    category: "Social Media"
  },
  {
    name: "social_dedup_check",
    engine: "Social Media (LocoAgent)",
    description: "Check if a target URL or post ID has already been engaged with in the persistent ledger",
    keyArguments: "platform, action, url",
    exampleCall: '{"tool": "social_dedup_check", "args": {"platform": "threads", "action": "reply", "url": "https://threads.net/..."}}',
    category: "Social Media"
  },
  {
    name: "social_log",
    engine: "Social Media (LocoAgent)",
    description: "Record a successful interaction or note into the operation ledger permanently",
    keyArguments: "platform, action, url, status, note",
    exampleCall: '{"tool": "social_log", "args": {"platform": "threads", "action": "post", "url": "https://...", "status": "success"}}',
    category: "Social Media"
  },
  {
    name: "social_exec",
    engine: "Social Media (LocoAgent)",
    description: "Execute direct agent-browser CDP command against any isolated social browser target",
    keyArguments: "platform, command",
    exampleCall: '{"tool": "social_exec", "args": {"platform": "threads", "command": "click @e12"}}',
    category: "Social Media"
  },
  {
    name: "social_doctor",
    engine: "Social Media (LocoAgent)",
    description: "Run preflight health checks on Bun, agent-browser CLI binary, and Chrome CDP ports",
    keyArguments: "(none)",
    exampleCall: '{"tool": "social_doctor", "args": {}}',
    category: "Social Media"
  }
];
