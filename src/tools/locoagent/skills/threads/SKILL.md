---
description: "Meta Threads (threads.net) platform operations playbook for agent-browser. Covers feed browsing, search, engagement, posting threads, replying, and notifications on dedicated CDP port 9227."
allowed-tools:
  - Bash
user-invocable: true
---

# Threads (threads.net) — Agent Browser Playbook

Platform-specific operation sequences for agent-browser on Meta Threads (`threads.net`) via dedicated CDP port 9227.

---

## 1. Browse & Read

### 1.1 Open Home Feed
```bash
agent-browser --cdp 9227 open https://www.threads.net/
agent-browser --cdp 9227 wait 2000
agent-browser --cdp 9227 snapshot -i -c
```

### 1.2 Open a Specific Thread by URL
```bash
agent-browser --cdp 9227 open "<thread_url>"
agent-browser --cdp 9227 wait 2000
agent-browser --cdp 9227 snapshot -i -c
```

### 1.3 Search Threads by Keyword
```bash
agent-browser --cdp 9227 open "https://www.threads.net/search?q=<query>&serp_type=default"
agent-browser --cdp 9227 wait 2500
agent-browser --cdp 9227 snapshot -i -c
```

### 1.4 View Notifications / Activity
```bash
agent-browser --cdp 9227 open https://www.threads.net/activity
agent-browser --cdp 9227 wait 2000
agent-browser --cdp 9227 snapshot -i -c
```

---

## 2. Engagement

### 2.1 Like a Thread or Reply
- Precondition: Check dedup log `bun run scripts/log-operation.ts check --platform threads --action like --url <url>`.
- Threads renders like buttons with `aria-label="Like"` or SVG heart.
```bash
agent-browser --cdp 9227 click @<like_button_ref>
bun run scripts/log-operation.ts add --platform threads --action like --url <url> --status success
```

### 2.2 Reply to a Thread
- Precondition: Check dedup log.
- Click the reply icon / button (`aria-label="Reply"`):
```bash
agent-browser --cdp 9227 click @<reply_button_ref>
agent-browser --cdp 9227 wait 1000
agent-browser --cdp 9227 fill @<reply_textbox_ref> "<reply_text>"
agent-browser --cdp 9227 click @<post_button_ref>
bun run scripts/log-operation.ts add --platform threads --action reply --url <url> --status success --note "<reply_text>"
```

### 2.3 Repost / Quote
- Find repost control (`aria-label="Repost"`):
```bash
agent-browser --cdp 9227 click @<repost_button_ref>
# Select "Repost" or "Quote" from popover menu
```

---

## 3. Content Creation

### 3.1 Publish a New Thread
- Navigate to Home:
```bash
agent-browser --cdp 9227 open https://www.threads.net/
# Click the center "Create" navigation button or inline "What's new?"
agent-browser --cdp 9227 click @<create_button_ref>
agent-browser --cdp 9227 wait 1000
# Type content into the composer
agent-browser --cdp 9227 fill @<thread_composer_ref> "<thread_content>"
# Click Post
agent-browser --cdp 9227 click @<post_submit_ref>
agent-browser --cdp 9227 wait 2000
bun run scripts/log-operation.ts add --platform threads --action post --url "https://www.threads.net/" --status success
```

### 3.2 Publish with Image/Media Attachment
- In the open composer dialog, locate the file input or attach icon:
```bash
agent-browser --cdp 9227 fill @<file_input_ref> "<path_to_image>"
agent-browser --cdp 9227 wait 1500
agent-browser --cdp 9227 click @<post_submit_ref>
```
