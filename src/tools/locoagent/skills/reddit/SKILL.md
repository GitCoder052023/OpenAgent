---
description: "Reddit platform operations playbook for agent-browser. Covers subreddit exploration, post reading, upvoting, nested commenting, post submission (title, markdown body, flairs), and anti-bot safeguards on CDP port 9224."
allowed-tools:
  - Bash
user-invocable: true
---

# Reddit — Agent Browser Playbook

Platform-specific operation recipes for agent-browser on `reddit.com` via dedicated CDP port `9224`.

---

## 1. Browse & Read

### 1.1 Open Subreddit Feed
Sort by `hot`, `new`, or `top/?t=day`:
```bash
# Explore hot technical posts in r/LocalLLaMA
agent-browser --cdp 9224 open "https://www.reddit.com/r/LocalLLaMA/hot/"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c
```

### 1.2 Read Post & Top Comments
```bash
agent-browser --cdp 9224 open "<post_url>"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c
```

### 1.3 Search Reddit (Global or Subreddit)
```bash
# Global search sorted by new
agent-browser --cdp 9224 open "https://www.reddit.com/search/?q=<query>&sort=new"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c

# Subreddit restricted search
agent-browser --cdp 9224 open "https://www.reddit.com/r/<subreddit>/search/?q=<query>&restrict_sr=1&sort=new"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c
```

---

## 2. Engagement

### 2.1 Upvote Post or Comment
- **Precondition**: Always check `bun run scripts/log-operation.ts check --platform reddit --action upvote --url <post_url>`.
- Reddit upvote buttons typically have `aria-label^="Upvote"` or `data-click-id="upvote"`.
```bash
agent-browser --cdp 9224 click @<upvote_button_ref>
agent-browser --cdp 9224 wait 500
bun run scripts/log-operation.ts add --platform reddit --action upvote --url "<post_url>" --status success
```

### 2.2 Comment on a Post
- **Precondition**: Dedup check first.
- Locate the main comment box (often marked "Add a comment" or "What are your thoughts?").
- If the comment box is collapsed, click the input first to expand the rich text / markdown editor.
```bash
# 1. Expand comment box if necessary
agent-browser --cdp 9224 click @<comment_input_trigger_ref>
agent-browser --cdp 9224 wait 500

# 2. Fill comment text
agent-browser --cdp 9224 fill @<comment_textarea_ref> "<comment_markdown>"
agent-browser --cdp 9224 wait 500

# 3. Click Comment button
agent-browser --cdp 9224 click @<comment_submit_ref>
agent-browser --cdp 9224 wait 2000

# 4. Record action in ledger
bun run scripts/log-operation.ts add --platform reddit --action comment --url "<post_url>" --status success --note "<comment_preview>"
```

### 2.3 Reply to a Specific Comment
- Locate the "Reply" button directly under the target comment thread.
```bash
agent-browser --cdp 9224 click @<reply_button_ref>
agent-browser --cdp 9224 wait 500
agent-browser --cdp 9224 fill @<nested_reply_box_ref> "<reply_markdown>"
agent-browser --cdp 9224 click @<nested_submit_ref>
agent-browser --cdp 9224 wait 1500
```

---

## 3. Content Creation & Submissions

### 3.1 Submit a New Post to a Subreddit
- Direct submission URL format: `https://www.reddit.com/r/<subreddit>/submit`
```bash
agent-browser --cdp 9224 open "https://www.reddit.com/r/<subreddit>/submit"
agent-browser --cdp 9224 wait 2500
agent-browser --cdp 9224 snapshot -i -c
```

### 3.2 Fill Post Title and Body
```bash
# Fill Title (mandatory)
agent-browser --cdp 9224 fill @<title_input_ref> "<post_title>"
agent-browser --cdp 9224 wait 500

# Fill Body Text / Markdown
agent-browser --cdp 9224 fill @<body_textarea_ref> "<post_body_markdown>"
agent-browser --cdp 9224 wait 500

# If flair is required:
# agent-browser --cdp 9224 click @<flair_selector_ref>
# agent-browser --cdp 9224 click @<chosen_flair_ref>

# Click Post / Submit
agent-browser --cdp 9224 click @<post_submit_button_ref>
agent-browser --cdp 9224 wait 3000

# Verify and record
agent-browser --cdp 9224 screenshot "reddit_submitted.png"
bun run scripts/log-operation.ts add --platform reddit --action post --url "https://www.reddit.com/r/<subreddit>/submit" --status success --note "<post_title>"
```

---

## 4. Anti-Bot & Community Etiquette Safeguards

1. **Check Subreddit Rules**:
   - High-quality subreddits like `r/LocalLLaMA`, `r/MachineLearning`, and `r/programming` enforce strict self-promotion and relevance guidelines.
   - Always ensure post content provides direct, open-source technical value.
2. **Strict Deduplication**:
   - Never upvote or comment on the same URL twice across sessions.
3. **Natural Latency**:
   - Allow 2-3 seconds between page loads and interactions.
