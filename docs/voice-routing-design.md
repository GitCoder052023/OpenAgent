# Jarvis voice routing: frozen design draft

**Decision record - 27 September 2026 (IST).** This is a design, not an implemented feature or a promise that the classifiers work on Hamdan's Mac. It captures the 02:57-03:29 discussion. The current bridge remains experimental; see [README](../README.md), [setup](setup.md), and [limitations](limitations.md) for what exists and what still needs on-device calibration.

## Goal and scope

After Hamdan deliberately says **"Wakeup Jarvis"**, he should be able to speak naturally without starting each request with "Jarvis". The bridge must distinguish Hamdan addressing Jarvis from Hamdan talking to a person nearby or on a call. It should not send family conversation or call audio to Instinct. This is a device-directed speech decision, not merely wake-word detection or diarization.

**First release:** only Hamdan's enrolled voice may command Jarvis. Everyone else is rejected, even if they say "Jarvis". This is a deliberate temporary narrowing of the earlier multi-person/showoff idea. No camera-facing requirement. Explicit sleep remains the existing two-step sequence: "Jarvis stand by", then "confirm stand by Jarvis" within eight seconds. **No automatic sleep on silence**; Hamdan explicitly discarded it. Do not reintroduce a ten-second idle timer. Keep the existing 4-5 second silence-based *clip boundary*: it is not sleep and should not end a session. Preserve the current raw-audio-to-WhatsApp path rather than replacing it with a transcript-only send.

## Decision boundaries

There are two independent questions for every speech segment:

1. **Who spoke?** Local diarization finds speaker turns, and local speaker verification compares them with Hamdan's enrolled samples. Unknown or low-confidence speakers cannot command Jarvis.
2. **To whom was Hamdan speaking?** Classify each of *his* utterances or contiguous speech spans as `JARVIS`, `HUMAN`, or `UNCERTAIN`. Speaker identity alone cannot answer this. Do not discard an entire multi-speaker clip simply because another person interrupted it.

A proposed flow, subject to on-device testing:

```text
microphone -> wake/sleep state -> detect speech and segment speaker turns
           -> verify Hamdan's voice -> call-state gate
           -> local ASR for routing features + context/prosody
           -> local addressee decision on each Hamdan segment
           -> retain only confirmed Jarvis-directed audio spans
           -> guarded attachment send to the fixed Instinct chat
           -> native WhatsApp voice-note playback
```

The ASR transcript helps make the routing decision but is **not** the outgoing message. Keep the original audio spans, timestamps, order, and short context needed to interpret follow-ups. Do not stitch separated Hamdan spans across a human-directed reply as though they form one request. If a sentence is interrupted by someone else's speech, resume Hamdan's segment only when the timing and addressee evidence support continuity; otherwise split or ask rather than fabricating continuity. Avoid clipping the first and last syllables with segment padding/overlap, and keep mixed/overlapping speech in `UNCERTAIN` until evaluated.

### Addressee signals and limits

| Signal | Useful evidence | Failure mode |
| --- | --- | --- |
| Words/content | Requests, second-person references, device-specific intents, explicit "Jarvis" if naturally used | "Jarvis" should *not* become mandatory; "mummy khana lagao" is a human-directed imperative. Hinglish transcription can mishear words. |
| Conversation context | A coherent follow-up to Jarvis's recent reply, task state, and prior confirmed addressee | Recency is not permission: Hamdan may turn to a person immediately after a reply. |
| Other speakers and turn-taking | A nearby person's reply may signal human conversation | An interruption by his mother cannot erase Hamdan's valid request; a phone call makes ordinary turn-taking especially misleading. |
| Prosody/acoustics | Directness, volume, timing, mic distance, speech style as weak hints | No reliable guarantee: he need not speak differently to a device. |
| Gaze | None required | Dropped as a gate: Hamdan need not look at the Mac to speak to Jarvis. At most an optional future signal, never a dependency. |

Fuse these signals with a lightweight local classifier/LLM and calibrated confidence thresholds, not a single rule ("alone means Jarvis" or "someone else replied means ignore"). Keep a short, explicitly bounded context window; do not treat a long conversation as permanently Jarvis-directed. An explicit wake phrase is a session control, not blanket authorization to forward all later speech. When uncertain, **do not send private audio automatically**; keep a recoverable short-lived local pending segment and offer a clear way to replay/confirm or dismiss it. Storage lifetime and UX need a decision before implementation.

Illustrative routing examples, not validated rules:

- Hamdan asks Jarvis for a task; his mother asks "khaana lagaun?" mid-clip. Drop the mother's segment, keep the Jarvis-directed parts of Hamdan's request if continuity is clear. His answer to his mother should not be glued into the Jarvis request.
- Hamdan says "mummy khana lagao" while Jarvis is awake: Hamdan is verified, but the addressee is human, so do not send.
- Hamdan follows up right after a Jarvis reply: context helps, but content and nearby human speech still matter.
- Hamdan speaks on a phone or video call: call gate suppresses the bridge's outgoing capture rather than betting on addressee classification. The abandoned suggestion to require a "Jarvis, ..." prefix during calls conflicts with free-form use and is **not** this design.

## Call-state gate

The classifier must not rely on turn-taking while a call is active. If a known call is active, suppress capture/forwarding of speech from the bridge, even if Hamdan's speaker check passes. This intentionally trades availability for privacy. Whether the mic process should pause entirely or merely discard buffered audio is an implementation choice; never transmit it. Wake/sleep handling while a call is active also needs an explicit UX decision.

- **Mac calls:** investigate a dependable macOS indication of another app using the microphone (WhatsApp Desktop, Meet, Zoom, etc.). A generic microphone-use indicator or process check is an *idea*, not a verified public API that identifies every call. Test permissions and false positives, including benign recording apps and a call on a different input device.
- **Android calls, first prototype:** MacroDroid/Tasker reports call start/end to a small endpoint on the Mac bridge while the phone and Mac can reach one another (initially same Wi-Fi). Ordinary cellular calls may use phone-state triggers. WhatsApp/Meet and other VoIP calls need separate detection, potentially an in-communication audio mode or an ongoing-call notification, subject to Android version, app and automation-tool behavior. These mechanisms are proposed, not proven universal.
- **Later:** a small Android companion app could report a normalized call state, subject to Android permissions and reliability testing. The Mac cannot infer an Android call merely because its own mic is in use.

Treat a start signal as an immediate gate and clear it only on a trustworthy end signal. The design must handle lost end pings, restarts, disconnection/off-Wi-Fi, stale status, device clock skew, simultaneous Mac/Android calls, and duplicate/reordered events. A timestamped state with heartbeat/expiry plus a visible manual override is one candidate, but expiry must not silently declare "safe" while a call continues. Decide the safe fallback and test it. Keep the endpoint bound to an appropriate local interface, authenticated against stray LAN requests, and free of raw audio or unnecessary phone metadata. Do not expose an unauthenticated control endpoint to the internet.

## Local-first performance and model selection

Do speaker segmentation, verification, ASR for routing, call gating, and addressee inference locally on the M5 Air. The current Vosk English model is used for command spotting; it is a weak foundation for Hinglish semantic routing. Benchmark a better *local multilingual* ASR on Hamdan's actual speech before choosing it. A small local model (for example, a Qwen-class 1.5-3B model) is a candidate for final text/context decisions, not a selected dependency. Speaker-embedding stacks such as ECAPA/SpeechBrain or Resemblyzer, and diarization such as pyannote, are candidates only; verify Apple Silicon support, model licenses, memory, cold-start time and real-world accuracy before adoption. Some choices may require local conversion or may not meet latency.

Earlier discussion floated **300-500 ms** for a local decision. That is an unbenchmarked estimate, not an acceptance target or measured end-to-end delay. Measure speech-end-to-decision and speech-end-to-send separately, with model load, overlapping voices, Hinglish and sustained sessions on Hamdan's **16 GB unified-memory M5 Air**. Account for RAM used by WhatsApp, ASR, diarization, the local LLM and audio buffers. Prefer a cheaper cascade: deterministic call gate and speaker check before expensive language inference; do not skip safety checks merely to hit a speed number.

**Muse Glimmer is not selected.** Meta describes it as a 30B text-and-image-in/text-out model, not an audio recognizer or voice/addressee detector. Its smallest official Q4 text checkpoint is around 16.8 GB on disk, before runtime memory, so it is not a practical low-latency classifier on the 16 GB machine. Sources: [Meta Muse Glimmer docs](https://ai.developer.meta.com/docs/muse-glimmer), [quantization](https://ai.developer.meta.com/docs/muse-glimmer/quantization). Revisit only if hardware or deployment constraints change; it still would not replace the audio front end.

## Safety and privacy contract

- Default fail-closed for unverified speakers, overlaps, low-confidence addressee decisions and active calls. Do not auto-send uncertainty to the WhatsApp chat for remote classification: doing so would defeat the local privacy gate.
- Enrollment should use multiple clean samples of Hamdan in different positions and speaking styles; design re-enrollment/revocation. Test household voices, playback/recordings of Hamdan, TV audio and voices on speakers. Speaker verification is probabilistic, not an authentication guarantee against replay/spoofing.
- Keep raw audio local until a span is accepted; delete rejected spans and diagnostic logs under a documented retention policy. Redact transcripts, speaker embeddings and call-state history from shared logs. Never commit enrollment samples or AX dumps.
- Preserve the existing exact-number WhatsApp destination guard, attachment controls and reply-watcher calibration. This document does not authorize loosening UI safeguards or unattended operation. A classifier that works in a notebook is not proof that the full WhatsApp send/playback path is safe.
- Provide a visible status: asleep, awake, call-paused, pending decision, or sending. Provide a manual quick mute/stop and a way to inspect or recover a wrongly held segment without retaining room audio indefinitely.

## Phased implementation and validation

1. **Baseline and fixtures.** Check the current `main` branch and actual Mac behavior first; README/architecture may lag code. Capture consented, local test recordings: Hamdan alone, family interruption, direct family talk, Hinglish follow-up, overlapping voices, call playback, Mac call and Android cellular/VoIP calls. Label speaker boundaries and intended addressee by segment. Set privacy and latency metrics, with false sends as the primary risk.
2. **Local speaker gate.** Add enrollment, diarization, per-segment verification and confidence handling. Test against unknown speakers, near/far mic, noise, interruptions and overlaps. No other person can command. Keep current wake and two-step sleep behavior; no auto-sleep.
3. **Per-segment addressee prototype.** Compare ASR candidates and small local decision models on the labeled Hinglish fixtures. Tune thresholds against false Jarvis-directed sends and dropped real requests. Do not use gaze as a required input. Implement pending/confirmation UX for ambiguity before enabling automatic forwarding.
4. **Call-state integration.** Prototype Mac call signal and authenticated local Android status reporting. Test cellular and WhatsApp/Meet call transitions, missed end events, network loss and simultaneous calls. Keep forwarding disabled while call state is known active; define safe unknown-state handling before enabling unattended use.
5. **Integrated supervised trial.** Run an opt-in, supervised end-to-end trial on Hamdan's machine with the existing guarded WhatsApp attachment and playback path. Measure performance and review misroutes/false sends; enable routine use only after the real-device tests meet agreed thresholds. Preserve a manual off switch and rollback.
6. **Deferred multi-person mode.** Only after the owner-only design works, consider enrolled family and Guest1/Guest2 labeling, multi-speaker clips, and per-speaker replies. This changes authority and disclosure rules: decide who is allowed to command, what each may hear, and how guests opt in before enabling it. Phase 3 repo rename/polish and broader laptop/WhatsApp control remain separate, user-led work, not part of this routing build.

## Open decisions

- What false-send and missed-request rates are acceptable, and what labeled test set reflects a real room? How long may a local uncertain recording be retained, and what should the confirmation cue be?
- Which speaker verifier, diarizer, Hinglish ASR and local classifier meet accuracy, license, memory and *measured* latency constraints on this Mac? Is a simpler detector better than an LLM on this dataset?
- Does the Mac provide a reliable, permission-compatible per-app or system call-state signal? Which Android version, phone model and automation app are in use, and which VoIP triggers actually fire?
- How should unknown/stale call state fail closed without leaving Jarvis permanently unusable? How does a manual override work safely? What happens to wake/sleep commands during a call?
- How will overlapping Hamdan/other speech, cross-segment continuity, and feedback after a rejected utterance be handled without leaking nearby people's audio?
- When, if ever, should someone other than Hamdan be allowed to speak to Jarvis? The owner-only rule stands until he explicitly changes it.

**Status:** plan frozen for review; no speaker lock, addressee classifier, Android reporter or call-status endpoint is claimed to be implemented by this document.
