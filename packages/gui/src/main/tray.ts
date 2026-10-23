import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import type { LinkedResources, RunningTemplate } from '../shared/api';
import type { MainServices } from './ipc';
import type { MainStrings } from '../shared/main-strings';

const LINKED_TTL_MS = 60_000;

interface TrayOptions {
  services: MainServices;
  /** Current strings; read on every rebuild so a language change applies right away */
  strings: () => MainStrings;
  iconDir: string;
  showWindow: () => void;
  quit: () => void;
}

/**
 * The menu bar / system tray: what's running, copy addresses and linked values, stop things.
 * Keeps working while the window is hidden.
 */
export function createTray({ services, strings, iconDir, showWindow, quit }: TrayOptions) {
  const isMac = process.platform === 'darwin';
  const icon = nativeImage.createFromPath(
    path.join(iconDir, isMac ? 'trayTemplate.png' : 'tray.png')
  );
  if (isMac) icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('Hodor');
  if (!isMac) tray.on('click', showWindow);

  const linkedCache = new Map<string, { at: number; value?: LinkedResources; loading?: boolean }>();
  let runs: RunningTemplate[] = [];

  const run = (fn: () => Promise<unknown>) => () => {
    fn()
      .catch(() => undefined)
      .finally(() => void refresh());
  };

  let STRINGS = strings();

  const linkedItems = (
    r: RunningTemplate,
    forward: RunningTemplate['forwards'][number]
  ): MenuItemConstructorOptions[] => {
    if (!forward.secrets.length && !forward.configMaps.length) return [];
    const key = `${r.templateId}/${forward.name}`;
    const cached = linkedCache.get(key);
    if (!cached || (Date.now() - cached.at > LINKED_TTL_MS && !cached.loading)) {
      linkedCache.set(key, { at: Date.now(), value: cached?.value, loading: true });
      services
        .linked(r.templateId, forward.name)
        .then((value) => linkedCache.set(key, { at: Date.now(), value }))
        .catch(() => linkedCache.set(key, { at: Date.now() }))
        .finally(() => build());
    }
    const value = linkedCache.get(key)?.value;
    const entries = (kind: 'secret' | 'configMap') =>
      (kind === 'secret' ? forward.secrets : forward.configMaps).map(
        (name): MenuItemConstructorOptions => {
          const entry = value?.[kind === 'secret' ? 'secrets' : 'configMaps'].find(
            (e) => e.name === name
          );
          const label = kind === 'secret' ? STRINGS.secret(name) : STRINGS.configMap(name);
          if (!entry) return { label, submenu: [{ label: STRINGS.loading, enabled: false }] };
          if (!entry.keys)
            return { label, submenu: [{ label: STRINGS.unreadable(entry.error), enabled: false }] };
          if (!entry.keys.length)
            return { label, submenu: [{ label: STRINGS.empty, enabled: false }] };
          return {
            label,
            submenu: entry.keys.map((k) => ({
              label: k,
              click: run(() =>
                services.copyValue({
                  templateId: r.templateId,
                  forward: forward.name,
                  kind,
                  name,
                  key: k,
                })
              ),
            })),
          };
        }
      );
    return [{ type: 'separator' }, ...entries('secret'), ...entries('configMap')];
  };

  const build = () => {
    STRINGS = strings();
    STRINGS = strings();
    const doors = runs.reduce((sum, r) => sum + r.forwards.length, 0);
    const items: MenuItemConstructorOptions[] = [
      { label: doors ? STRINGS.doors(doors) : STRINGS.idle, enabled: false },
    ];

    for (const r of runs) {
      items.push({
        label: `${r.templateName} · ${r.clusterName}`,
        submenu: [
          ...r.forwards.map((f): MenuItemConstructorOptions => {
            const state =
              f.status && f.status !== 'running'
                ? STRINGS.state[f.status]
                : !f.listening
                  ? STRINGS.state.closed
                  : '';
            const address = `127.0.0.1:${f.localPort}`;
            return {
              label: `:${f.localPort}  ${f.name}${state ? `  (${state})` : ''}`,
              submenu: [
                {
                  label: STRINGS.copyAddress(address),
                  click: run(() => services.copyText(address)),
                },
                ...linkedItems(r, f),
                ...(r.controllable
                  ? ([
                      { type: 'separator' },
                      f.status === 'running'
                        ? {
                            label: STRINGS.stopForward,
                            click: run(() => services.setForward(r.templateId, f.name, 'stop')),
                          }
                        : {
                            label: STRINGS.startForward,
                            click: run(() => services.setForward(r.templateId, f.name, 'start')),
                          },
                    ] as MenuItemConstructorOptions[])
                  : []),
              ],
            };
          }),
          { type: 'separator' },
          {
            label: STRINGS.stopTemplate(r.templateName),
            click: run(() => services.stop(r.templateId)),
          },
        ],
      });
    }

    items.push({ type: 'separator' });
    if (runs.length)
      items.push(
        { label: STRINGS.stopAll, click: run(() => services.stopAll()) },
        { type: 'separator' }
      );
    items.push({ label: STRINGS.open, click: showWindow }, { label: STRINGS.quit, click: quit });

    tray.setContextMenu(Menu.buildFromTemplate(items));
    tray.setToolTip(doors ? `Hodor · ${STRINGS.doors(doors)}` : 'Hodor');
    if (isMac) tray.setTitle(doors ? String(doors) : '');
  };

  const refresh = async () => {
    try {
      runs = await services.runningList();
    } catch {
      runs = [];
    }
    build();
  };

  const timer = setInterval(refresh, 4000);
  void refresh();

  return {
    refresh,
    destroy: () => {
      clearInterval(timer);
      tray.destroy();
    },
  };
}
