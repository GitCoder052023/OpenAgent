// Illustrative replay data for the transport demonstration.
// Tool names and argument keys come from README.md § Tool Suite; the envelope
// strings are genuine base64 of the JSON shown beside them, encoded exactly as
// docs/JARVIS_INSTRUCTIONS.md specifies. Results are illustrative, not measured.

export type DemoStep = {
  tool: string;
  json: string;
  envelope: string;
  argLabel: string;
  result: string;
};

export type DemoTurn = {
  spoken: string;
  aside: string;
  steps: DemoStep[];
  reply: string;
};

export type DemoScenario = {
  id: string;
  label: string;
  engines: string;
  turns: DemoTurn[];
};

export const scenarios: DemoScenario[] = [
  {
    "id": "ship",
    "label": "Ship, then post",
    "engines": "Developer harness → Social automation",
    "turns": [
      {
        "spoken": "Run the test suite on OpenAgent. If it's green, post a Threads update about what I shipped today.",
        "aside": "making coffee",
        "steps": [
          {
            "tool": "bash",
            "json": "{\"tool\": \"bash\", \"args\": {\"command\": \"./test.py\"}}",
            "envelope": "eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICIuL3Rlc3QucHkifX0=",
            "argLabel": "./test.py",
            "result": "260 passed"
          },
          {
            "tool": "bash",
            "json": "{\"tool\": \"bash\", \"args\": {\"command\": \"git log --since=midnight --oneline\"}}",
            "envelope": "eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICJnaXQgbG9nIC0tc2luY2U9bWlkbmlnaHQgLS1vbmVsaW5lIn19",
            "argLabel": "git log --since=midnight",
            "result": "6 commits"
          },
          {
            "tool": "social_dedup_check",
            "json": "{\"tool\": \"social_dedup_check\", \"args\": {\"platform\": \"threads\", \"action\": \"post\"}}",
            "envelope": "eyJ0b29sIjogInNvY2lhbF9kZWR1cF9jaGVjayIsICJhcmdzIjogeyJwbGF0Zm9ybSI6ICJ0aHJlYWRzIiwgImFjdGlvbiI6ICJwb3N0In19",
            "argLabel": "threads / post",
            "result": "not yet posted"
          },
          {
            "tool": "social_post",
            "json": "{\"tool\": \"social_post\", \"args\": {\"platform\": \"threads\", \"text\": \"Shipped offline wake-word detection today — one Whisper Large V3 Turbo model now handles both the wake phrase and transcription, fully on-device.\"}}",
            "envelope": "eyJ0b29sIjogInNvY2lhbF9wb3N0IiwgImFyZ3MiOiB7InBsYXRmb3JtIjogInRocmVhZHMiLCAidGV4dCI6ICJTaGlwcGVkIG9mZmxpbmUgd2FrZS13b3JkIGRldGVjdGlvbiB0b2RheSDigJQgb25lIFdoaXNwZXIgTGFyZ2UgVjMgVHVyYm8gbW9kZWwgbm93IGhhbmRsZXMgYm90aCB0aGUgd2FrZSBwaHJhc2UgYW5kIHRyYW5zY3JpcHRpb24sIGZ1bGx5IG9uLWRldmljZS4ifX0=",
            "argLabel": "threads.net (authenticated profile)",
            "result": "published"
          }
        ],
        "reply": "All 260 tests passed. The update is live on Threads."
      },
      {
        "spoken": "Show me what it looks like.",
        "aside": "from the couch",
        "steps": [
          {
            "tool": "social_screenshot",
            "json": "{\"tool\": \"social_screenshot\", \"args\": {\"platform\": \"threads\"}}",
            "envelope": "eyJ0b29sIjogInNvY2lhbF9zY3JlZW5zaG90IiwgImFyZ3MiOiB7InBsYXRmb3JtIjogInRocmVhZHMifX0=",
            "argLabel": "live Chrome session",
            "result": "delivered to WhatsApp"
          }
        ],
        "reply": "Screenshot's in your chat."
      }
    ]
  },
  {
    "id": "late",
    "label": "Running late",
    "engines": "WhatsApp protocol engine",
    "turns": [
      {
        "spoken": "Message Sarah that I'm running five minutes late.",
        "aside": "walking to the car",
        "steps": [
          {
            "tool": "whatsapp_contacts",
            "json": "{\"tool\": \"whatsapp_contacts\", \"args\": {\"query\": \"Sarah\"}}",
            "envelope": "eyJ0b29sIjogIndoYXRzYXBwX2NvbnRhY3RzIiwgImFyZ3MiOiB7InF1ZXJ5IjogIlNhcmFoIn19",
            "argLabel": "query: Sarah",
            "result": "1 match"
          },
          {
            "tool": "whatsapp_send",
            "json": "{\"tool\": \"whatsapp_send\", \"args\": {\"recipient\": \"sarah\", \"message\": \"Running 5 minutes late — leaving now.\"}}",
            "envelope": "eyJ0b29sIjogIndoYXRzYXBwX3NlbmQiLCAiYXJncyI6IHsicmVjaXBpZW50IjogInNhcmFoIiwgIm1lc3NhZ2UiOiAiUnVubmluZyA1IG1pbnV0ZXMgbGF0ZSDigJQgbGVhdmluZyBub3cuIn19",
            "argLabel": "sarah",
            "result": "sent"
          }
        ],
        "reply": "Told Sarah you're five minutes behind."
      }
    ]
  },
  {
    "id": "brief",
    "label": "Read it, write it up",
    "engines": "Web ingestion → Office documents → Delivery",
    "turns": [
      {
        "spoken": "Pull what's being said about Apple Silicon inference benchmarks and put it in a Word doc for me.",
        "aside": "mid-game, fullscreen",
        "steps": [
          {
            "tool": "firecrawl_search",
            "json": "{\"tool\": \"firecrawl_search\", \"args\": {\"query\": \"Apple Silicon inference benchmarks\", \"limit\": 5}}",
            "envelope": "eyJ0b29sIjogImZpcmVjcmF3bF9zZWFyY2giLCAiYXJncyI6IHsicXVlcnkiOiAiQXBwbGUgU2lsaWNvbiBpbmZlcmVuY2UgYmVuY2htYXJrcyIsICJsaW1pdCI6IDV9fQ==",
            "argLabel": "limit: 5",
            "result": "5 results, full markdown"
          },
          {
            "tool": "firecrawl_scrape",
            "json": "{\"tool\": \"firecrawl_scrape\", \"args\": {\"url\": \"https://example.org/benchmarks\", \"formats\": [\"markdown\"], \"only_main_content\": true}}",
            "envelope": "eyJ0b29sIjogImZpcmVjcmF3bF9zY3JhcGUiLCAiYXJncyI6IHsidXJsIjogImh0dHBzOi8vZXhhbXBsZS5vcmcvYmVuY2htYXJrcyIsICJmb3JtYXRzIjogWyJtYXJrZG93biJdLCAib25seV9tYWluX2NvbnRlbnQiOiB0cnVlfX0=",
            "argLabel": "formats: markdown",
            "result": "main content only"
          },
          {
            "tool": "word_write",
            "json": "{\"tool\": \"word_write\", \"args\": {\"path\": \"~/Desktop/inference-brief.docx\", \"title\": \"Apple Silicon inference — field notes\"}}",
            "envelope": "eyJ0b29sIjogIndvcmRfd3JpdGUiLCAiYXJncyI6IHsicGF0aCI6ICJ+L0Rlc2t0b3AvaW5mZXJlbmNlLWJyaWVmLmRvY3giLCAidGl0bGUiOiAiQXBwbGUgU2lsaWNvbiBpbmZlcmVuY2Ug4oCUIGZpZWxkIG5vdGVzIn19",
            "argLabel": "~/Desktop/inference-brief.docx",
            "result": "written, 1 table"
          },
          {
            "tool": "whatsapp_file",
            "json": "{\"tool\": \"whatsapp_file\", \"args\": {\"recipient\": \"self\", \"file_path\": \"~/Desktop/inference-brief.docx\"}}",
            "envelope": "eyJ0b29sIjogIndoYXRzYXBwX2ZpbGUiLCAiYXJncyI6IHsicmVjaXBpZW50IjogInNlbGYiLCAiZmlsZV9wYXRoIjogIn4vRGVza3RvcC9pbmZlcmVuY2UtYnJpZWYuZG9jeCJ9fQ==",
            "argLabel": "self",
            "result": "delivered"
          }
        ],
        "reply": "Brief's on your Desktop and in your chat. Your game never lost focus."
      }
    ]
  }
];
