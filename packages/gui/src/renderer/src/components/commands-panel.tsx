import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CommandRequest, TemplateSummary } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useAppInfo, useClusters } from '../queries';
import { CopyButton } from './command';
import { Skeleton } from './states';

type Platform = CommandRequest['platform'];

const PLATFORMS: Array<{ value: Platform; key: string }> = [
  { value: 'linux', key: 'commands.linux' },
  { value: 'macos', key: 'commands.macos' },
  { value: 'windows', key: 'commands.windows' },
];

function platformOf(os?: string): Platform {
  return os === 'win32' ? 'windows' : os === 'darwin' ? 'macos' : 'linux';
}

/** The plain kubectl equivalent of a template, for when Hodor isn't around */
export const CommandsPanel: React.FC<{ template: TemplateSummary }> = ({ template }) => {
  const { t } = useTranslation();
  const info = useAppInfo();
  const clusters = useClusters();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [forward, setForward] = useState('');
  const [context, setContext] = useState('');
  const [script, setScript] = useState(false);

  const chosen = platform ?? platformOf(info.data?.platform);
  const request: CommandRequest = {
    platform: chosen,
    script,
    ...(forward ? { forward } : {}),
    ...(context ? { context } : {}),
  };
  const output = useQuery({
    queryKey: ['commands', template.id, request],
    queryFn: () => api.templates.commands(template.id, request),
  });

  // Only contexts kubectl can see by name are useful targets: the ones in the default kubeconfig
  const contexts = (clusters.data ?? []).filter(
    (c) => c.sourceFile === info.data?.defaultKubeconfig
  );
  const uid = `cmd-${template.id}`;

  return (
    <div className="commands-panel">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label={t('commands.platform')}>
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={chosen === p.value}
              onClick={() => setPlatform(p.value)}
            >
              {t(p.key)}
            </button>
          ))}
        </div>
        <label className="field-inline">
          <span>{t('commands.forward')}</span>
          <select className="select" value={forward} onChange={(e) => setForward(e.target.value)}>
            <option value="">
              {t('commands.allForwards', { count: template.forwards.length })}
            </option>
            {template.forwards.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} (:{f.localPort})
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span>{t('commands.context')}</span>
          <select className="select" value={context} onChange={(e) => setContext(e.target.value)}>
            <option value="">{t('commands.currentContext')}</option>
            {contexts.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="switch-row" htmlFor={`${uid}-script`}>
          <input
            id={`${uid}-script`}
            type="checkbox"
            className="switch plain"
            checked={script}
            onChange={(e) => setScript(e.target.checked)}
          />
          {t('commands.script')}
        </label>
      </div>
      <div className="code-block">
        {output.isError ? (
          <p className="inline-error">{errorMessage(output.error)}</p>
        ) : output.data === undefined ? (
          <Skeleton width={420} />
        ) : (
          <>
            <pre>
              <code>{output.data}</code>
            </pre>
            <CopyButton
              value={output.data}
              label={script ? t('commands.copyScript') : t('commands.copy')}
            />
          </>
        )}
      </div>
      <p className="hint">{script ? t('commands.scriptHint') : t('commands.hint')}</p>
    </div>
  );
};
