# Community Feedback - Reddit Launch (Oct 7, 2026)

Collected from the OpenAgent launch posts across r/SideProject, r/coolgithubprojects, r/selfhosted (megathread), r/ArtificialInteligence, r/artificial, r/LLMDevs, r/AI_Agents and r/indiehackers.

## Suggestions / Bugs

1. **Voice routing vs background audio** - u/Dry_Childhood_8353 (r/LLMDevs): first external user; Mac control "surprisingly smooth for something this early", but voice routing got confused once while music was playing. -> look at voice-activity detection / echo handling while media plays.
2. **Build the approval gate first** - u/Ctbhatia (r/LLMDevs): the capability list is the easy 80%, the hard part is the trust boundary. Hands-free shell + logged-in social profiles is exactly the combo that burns accounts and machines. Build the approval gate first.
3. **Never act on half-typed input** - u/Cautious-Tax-2211 (r/ArtificialInteligence): make sure it doesn't accidentally post half-typed reddit rants while the user is AFK. -> confirmation gate before public/irreversible actions; ignore incomplete input.
4. **Isolated setup option** - u/Faith_Frasern (r/ArtificialInteligence): current permission scope feels too much for a main device + main social accounts. -> document a separate-device / separate-account setup and sandboxed profiles.
5. **Repo trust signals** - github-guard bot (r/macapps): repo scored below the trust threshold. -> strengthen README, LICENSE, demo screenshots/GIF, contribution guide.

## Positive signals

- u/Massive_Two2988 (r/artificial): persistent browser profiles for social automation called "a neat touch".
- r/LLMDevs: first real-world run of the voice + Mac-control flow reported smooth.

## Launch results

- Live: r/ArtificialInteligence, r/artificial, r/LLMDevs, r/AI_Agents, r/indiehackers, r/SideProject, r/coolgithubprojects, r/selfhosted (weekly New Project Megathread).
- Removed/blocked: r/macapps + r/LocalLLaMA (karma/account-age), r/opensource (karma), r/automation (no promo posts).
