# Citizen interface: text chat only

Design target: the simplicity of an ordinary messaging conversation.

- The **home screen is a chat**, not a marketing dashboard or a voice assistant.
- One short welcome bubble, three quick replies — **Report a problem**, **Ask a question**, **Find a service** — and one editable message composer with a **Send** button.
- Citizen and assistant turns use familiar left/right message bubbles with no audio, microphone, speech recognition, text-to-speech or voice overlays. Browser speech APIs are not accessed.
- Reporting and tracking remain conversational; their existing safeguards stay in place. Reports are still **private on-device drafts**, not submitted. Tracking still explicitly says there are no live cases.
- Asking a factual question uses the existing source-backed endpoint; natural language reporting, tracking and service-search requests route to those respective workflows without sending private report narratives to the knowledge API.
- The bottom navigation has four destinations; **Profile** remains in the header.
- Input uses regular typing and Enter-to-send, with Shift+Enter for multiline report or tracking replies. The composer stays visible above the mobile bottom bar.
- Dark theme, English/Yoruba support, independently verified source links and opt-in location checking remain.

## QA

Browser regression checks verify: three quick actions, text-first home, send semantics, no voice controls even if browser speech recognition exists, reports/track privacy constraints, phone widths down to 280px, and real rendered screenshots from Chromium. Screenshots are saved in CI as `citizen-chat-visual-review`.

No deployment or database changes were made by this UI milestone.
