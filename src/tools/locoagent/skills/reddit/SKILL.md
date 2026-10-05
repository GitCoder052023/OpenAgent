---
description: "Reddit platform operations playbook for agent-browser. Covers subreddit browsing, search, engagement, voting, and commenting on CDP port 9224."
allowed-tools:
  - Bash
user-invocable: true
---

# Reddit — Agent Browser Playbook

Platform-specific operation sequences for agent-browser on reddit.com via dedicated CDP port 9224.

---

## 1. Browse & Read

### 1.1 Open Subreddit
```bash
agent-browser --cdp 9224 open "https://www.reddit.com/r/<subreddit>/new/"
agent-browser --cdp 9224 wait 2000
agent-browser --cdp 9224 snapshot -i -c
```

### 1.2 Read Post & Comments
```bash
agent-browser --cdp 9224 open "<post_url>"
agent-browser --cdp 9224 wait 2000
agent-browser --cdp 9224 snapshot -i -c
```

### 1.3 Search Reddit
```bash
agent-browser --cdp 9224 open "https://www.reddit.com/search/?q=<query>&sort=new"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c
```

---

## 2. Engagement

### 2.1 Upvote Post
- Precondition: Verify URL in `persona/operation-log.json`.
```bash
agent-browser --cdp 9224 click @<upvote_button_ref>
bun run scripts/log-operation.ts add --platform reddit --action upvote --url <url> --status success
```

### 2.2 Comment on Post
- Precondition: Verify URL in `persona/operation-log.json`.
```bash
agent-browser --cdp 9224 fill @<comment_box_ref> "<comment_text>"
agent-browser --cdp 9224 click @<comment_submit_button_ref>
bun run scripts/log-operation.ts add --platform reddit --action comment --url <url> --status success --note "<comment_text>"
```
