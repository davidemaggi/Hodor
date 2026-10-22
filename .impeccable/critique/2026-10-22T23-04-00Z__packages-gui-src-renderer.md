---
target: Hodor GUI renderer (0.8-0.9)
total_score: 27
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: 'file:/Users/davide/Repos/Hodor/packages/gui/src/renderer'
timestamp: 2026-10-22T23-04-00Z
slug: packages-gui-src-renderer
---

Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                        |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| 1         | Visibility of System Status     | 3         | A run's cluster and prod status vanish after start                                               |
| 2         | Match System / Real World       | 3         | "2 linked", "kubectl" button, "kubectl's current" need translating                               |
| 3         | User Control and Freedom        | 2         | Editor discard guard only on Back/Cancel; no undo for removing a forward                         |
| 4         | Consistency and Standards       | 2         | One fault, three labels; Stop at three scopes in three styles; destructive confirms look primary |
| 5         | Error Prevention                | 2         | Prod warning is a muted hint; manual add shows errors before typing                              |
| 6         | Recognition Rather Than Recall  | 3         | Which cluster a running template is on must be remembered                                        |
| 7         | Flexibility and Efficiency      | 3         | Shortcuts exist; palette can't run/stop/copy                                                     |
| 8         | Aesthetic and Minimalist Design | 3         | Calm; templates row overflows at 960px                                                           |
| 9         | Error Recovery                  | 3         | Plain errors, few next steps                                                                     |
| 10        | Help and Documentation          | 3         | Good hints; some stale copy                                                                      |
| **Total** |                                 | **27/40** | **Acceptable**                                                                                   |

## Design Specificity Verdict

LLM: mostly authored for Hodor (local port leads everywhere, door language, CLI parity); templates table and palette still generic. Detector: CLI clean; URL scans found a dark-theme placeholder at 4.0:1 in the tags input and a skipped heading (h2 → h4) in the values panel.

## Priority Issues

- [P1] Production context disappears after Run (Running, Templates pill, values) — /impeccable harden
- [P1] Templates table overflows at the 960px minimum window — /impeccable adapt
- [P1] Unsaved editor changes lost on sidebar/shortcut/palette navigation — /impeccable harden
- [P2] Inconsistent status and stop vocabulary; destructive confirms styled as primary — /impeccable polish
- [P2] Logs aria-live chatter, no follow-tail; config maps masked like secrets — /impeccable audit
- [P2] Palette only navigates; running a template takes three steps — /impeccable shape

## Persona Red Flags

Power user: palette can't act, no keyboard Run on rows. Keyboard/SR: logs live region, editor alerts re-fire per keystroke, index keys on forwards, aria-expanded hard-coded. First-timer: stale empty-state copy, ambiguous "kubectl"/"linked" labels, premature validation errors.

## Minor Observations

Stretched Run buttons in idle view; Restart/Stop touching; delete confirm suggests export without a button; PowerShell named as a platform; preview version label stale; start=1 preview hook missing.
