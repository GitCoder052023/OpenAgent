---
description: "LinkedIn platform operations playbook for agent-browser. Covers feed browsing, search, engagement, posting updates, commenting, and network connection operations on CDP port 9223."
allowed-tools:
  - Bash
user-invocable: true
---

# LinkedIn — Agent Browser Playbook

Platform-specific operation sequences for agent-browser on linkedin.com via dedicated CDP port 9223.

---

## 1. Browse & Read

### 1.1 Open Feed
```bash
agent-browser --cdp 9223 open https://www.linkedin.com/feed/
agent-browser --cdp 9223 wait 2000
agent-browser --cdp 9223 snapshot -i -c
```

### 1.2 Open Specific Post by URL
```bash
agent-browser --cdp 9223 open "<post_url>"
agent-browser --cdp 9223 wait 1500
agent-browser --cdp 9223 snapshot -i -c
```

### 1.3 Search Content
```bash
agent-browser --cdp 9223 open "https://www.linkedin.com/search/results/content/?keywords=<query>&sortBy=%22date_posted%22"
agent-browser --cdp 9223 wait 2500
agent-browser --cdp 9223 snapshot -i -c
```

---

## 2. Engagement

### 2.1 Like a Post
- Precondition: Verify URL in `persona/operation-log.json` via `bun run scripts/log-operation.ts check --platform linkedin --action like --url <url>`.
- Find like button ref from snapshot (e.g. `button "React Like"`):
```bash
agent-browser --cdp 9223 click @<like_button_ref>
bun run scripts/log-operation.ts add --platform linkedin --action like --url <url> --status success
```

### 2.2 Comment on a Post
- Precondition: Verify URL in `persona/operation-log.json`.
- Find comment textbox ref from snapshot:
```bash
agent-browser --cdp 9223 click @<comment_button_ref>
agent-browser --cdp 9223 fill @<comment_textbox_ref> "<comment_text>"
agent-browser --cdp 9223 click @<post_comment_button_ref>
bun run scripts/log-operation.ts add --platform linkedin --action comment --url <url> --status success --note "<comment_text>"
```

---

## 3. Content Creation

### 3.1 Create a New Post
- Navigate to feed:
```bash
agent-browser --cdp 9223 open https://www.linkedin.com/feed/
agent-browser --cdp 9223 click @<start_a_post_button_ref>
agent-browser --cdp 9223 wait 1000
agent-browser --cdp 9223 fill @<post_editor_ref> "<post_content>"
agent-browser --cdp 9223 click @<post_publish_button_ref>
bun run scripts/log-operation.ts add --platform linkedin --action post --url "https://www.linkedin.com/feed/" --status success
```
