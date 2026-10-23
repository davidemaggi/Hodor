# Hodor GUI 0.6 — Taste notes

## Inventory (data and jobs)

- Contexts ("clusters"): name, cluster, server URL, kubeconfig file, namespace, reachable + server version,
  ★ kubectl default, ↺ last used by Hodor. Typical: 1-15 contexts across 1-5 files; a new user has 1 (docker-desktop).
- Templates: name, optional description, tags (0-4), forwards (1-8). A user has 0-30 templates.
- Forwards: name, namespace, kind/resource, local port → remote port, status (running/error/stopped),
  active connections (0-20), resolved pod, linked secret/configmap names.
- Logs per forward: timestamp, level, message. Tens to hundreds of lines per session.
- Person: one developer, app open all day in the background, glances many times, desktop only.
- Jobs: start a template on a cluster (most frequent), stop it, copy a linked secret value,
  remember which local port is what, switch kubectl's default context.
- Product's own things: the name Hodor (holds the door), local ports on 127.0.0.1, ★ kubectl default,
  kubeconfig files, pods.

## Questions

- Shell: "Is anything holding a door right now?" → running count in the shell, always visible.
- Clusters: "Which of my clusters are up, and which one is kubectl pointing at?"
- Templates (0.8): "Which stack do I start?"
- Running (0.9): "What is listening on which local port?"
- Settings: "Theme and language."

## Signature element

The local port as the headline figure: every forward row leads with `:15432` in large tabular figures,
because that's the number the developer types into psql/curl. The shell's "doors" count echoes it.
