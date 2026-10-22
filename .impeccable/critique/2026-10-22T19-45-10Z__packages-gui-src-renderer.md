---
target: Hodor GUI renderer (0.7)
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: 'file:/Users/davide/Repos/Hodor/packages/gui/src/renderer'
timestamp: 2026-10-22T19-45-10Z
slug: packages-gui-src-renderer
---

Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                      |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------ |
| 1         | Visibility of System Status     | 3         | Running forwards show no live state; kubectl switches give no success feedback |
| 2         | Match System / Real World       | 3         | kubectl-fluent; ★/↺ and the sidebar count explained only by tooltips           |
| 3         | User Control and Freedom        | 2         | kubectl context/namespace changes have no undo                                 |
| 4         | Consistency and Standards       | 3         | pod vs service name styling, inline styles in templates.tsx                    |
| 5         | Error Prevention                | 2         | Making prod kubectl's default is one silent click                              |
| 6         | Recognition Rather Than Recall  | 3         | Key explanations are hover-only titles                                         |
| 7         | Flexibility and Efficiency      | 1         | No shortcuts, no Stop all, can't start templates from the app                  |
| 8         | Aesthetic and Minimalist Design | 3         | Calm, balanced themes; status far from name on wide rows                       |
| 9         | Error Recovery                  | 3         | Excellent unreachable view; silent clipboard failures, generic merge error     |
| 10        | Help and Documentation          | 2         | Good inline hints, no legend, empty states point to the CLI                    |
| **Total** |                                 | **25/40** | **Acceptable**                                                                 |

## Design Specificity Verdict

LLM: competent shell, Hodor's own idea (the local port first) lives only on Running; Clusters/Templates are category-interchangeable. Detector: source scan clean (0); URL scans 1 nested-cards (borderline: command chip inside the steps strip) + 1 straggler on empty Templates. No overlay (no interactive browser tool).

## Priority Issues

- [P1] kubectl context/namespace switches are silent, unconfirmed, without undo (cluster-detail.tsx) — /impeccable harden
- [P1] Running doesn't show whether a forward is actually open; meta hard-codes "started from the terminal" — /impeccable harden
- [P2] Essential explanations only in title tooltips (other-file hint, No answer reason, template port targets, ★/↺) — /impeccable clarify
- [P2] First-run Clusters empty state points to the CLI instead of the Merge button / drop target — /impeccable onboard
- [P2] Opening a cluster silently rewrites "last used"; last-used row looks like hover; aria-selected invalid on tr — /impeccable polish

## Persona Red Flags

Power user: no shortcuts, no Stop all, inert template rows. Keyboard/SR: title-only content, aria-live on buttons, aria-selected on tr, Enter-only namespace input, low-contrast input borders. First-timer: unexplained ★/↺, "No answer" without reason, empty states route to CLI.

## Minor Observations

cluster-info breaks mid-token; irrelevant Merge action on a down cluster; .select defined twice; inline styles; merge.failed wording for cluster merges; pod/service name styles differ; scope link target; clipboard errors uncaught; Running wide empty space; Running pill lost in truncate; count formats differ; straggler "rest." (text-wrap: pretty).

## Questions to Consider

Should template rows lead with ports and launch? Should cluster detail ports offer "forward to local port"? Should pointing kubectl at prod feel as weightless as at a local cluster?
