# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Desktop app built with Electron: a web renderer in a native window on macOS, Windows and Linux, plus a CLI. The design language is the app's own, not per-OS native.)

## Users

A single developer working with Kubernetes every day, across several clusters (local, dev, staging, prod). Hodor runs in the background all day; they glance at it many times, open it to start or stop a set of port-forwards, grab a local address or a credential, and go back to their editor and terminal. Templates are occasionally shared with colleagues through export/import, but there is no team or account concept in the product.

## Product Purpose

Make Kubernetes port-forwarding something you set up once and reuse: bundle the forwards a piece of work needs into a template, run it on whichever cluster you pick at launch, see what is listening on which local port, and get the linked secrets and config map values without `kubectl get secret | base64 -d`. Success: the developer stops juggling terminal tabs of `kubectl port-forward` and never wonders which local port is which.

## Positioning

Templates are cluster-agnostic: they hold namespaces, resource names and ports, never servers, contexts or credentials. The same template runs on dev, staging or prod, chosen when it starts, and is safe to share. Hodor reads every kubeconfig in `~/.kube`, knows which clusters are up, and highlights kubectl's own default context.

## Operating Context

- Lives next to a terminal and an editor; the CLI (`hodor`) and the desktop app share the same data in `~/.hodor` and can start/stop each other's templates.
- Works with the user's existing kubeconfig files and with kubectl when installed (changing kubectl's default context/namespace is only offered when kubectl exists).
- Every change Hodor makes to a kubeconfig is backed up first to `~/.hodor/backups`.
- Forwards listen on `127.0.0.1` only.
- From 0.9 the app keeps forwards alive in the tray when its window is closed.

## Capabilities and Constraints

- Clusters: all contexts from all kubeconfigs, reachability and server version, kubectl default (★), last cluster used (remembered across restarts), switch kubectl context/namespace, merge kubeconfigs, browse pods and services with their ports.
- Templates: name, optional description, tags, ordered forwards (pod/service/deployment, local port, remote port, linked secret/config map names); search, reorder, import/export, generate equivalent kubectl commands for bash and PowerShell.
- Running: start/stop a single forward, a template, or everything; per-forward logs; copy linked secret/config map values (never written to disk or logs).
- Sensitive data in the OS keychain; no plain-file fallback.
- English first; the UI is fully translatable (Italian next).
- Snow (light) and Night (dark) themes, following the OS by default.
- Unsigned releases until 1.0.1; Windows builds signed with Certum afterwards.

## Brand Commitments

- Name: Hodor ("holds the door", after the Game of Thrones character). A stylised character logo is planned but not made yet; the current mark is a door.
- Colours: as light as snow or as dark as night.
- Voice: English, developer to developer, playful about the name, never at the expense of clarity. Error messages say what went wrong and what to do next.
- Major versions are named after Game of Thrones characters, one letter per major (1.x Aerys).

## Evidence on Hand

No users, testimonials, metrics or press yet. The project is pre-release open source (Apache 2.0). Sample data in the GUI's browser preview (`packages/gui/src/renderer/src/fixtures.ts`) is invented for design reviews and must never be presented as real.

## Product Principles

1. The local port is the thing people use: show it first and make it copyable.
2. Never surprise a kubeconfig: preview, confirm, back up, keep comments.
3. Templates carry no cluster details, so sharing them is always safe.
4. The CLI and the app are equals; whatever one starts, the other can see and stop.
5. Secrets are shown and copied on demand, then forgotten.

## Accessibility & Inclusion

WCAG 2.2 AA: text and UI contrast, visible focus, everything operable by keyboard, screen-reader names on icon-only controls, reduced-motion respected.
