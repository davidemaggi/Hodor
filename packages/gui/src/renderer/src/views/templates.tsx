import { useTranslation } from 'react-i18next';
import { errorMessage } from '../api';
import { useTemplates } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { Command } from '../components/command';
import { formatRelative } from '../format';

export const TemplatesView: React.FC = () => {
  const { t } = useTranslation();
  const templates = useTemplates();
  const list = templates.data ?? [];
  const running = list.filter((tpl) => tpl.running).length;

  return (
    <section className="view" aria-labelledby="templates-title">
      <div className="title-row">
        <div>
          <h1 id="templates-title">{t('templates.title')}</h1>
          <p className="sub">
            {templates.isPending ? (
              <Skeleton width={180} />
            ) : list.length > 0 ? (
              t('templates.sub', { count: list.length, running })
            ) : (
              t('templates.subEmpty')
            )}
          </p>
        </div>
      </div>

      {templates.isError ? (
        <ErrorBlock
          message={t('templates.error', { message: errorMessage(templates.error) })}
          onRetry={() => templates.refetch()}
        />
      ) : templates.isSuccess && list.length === 0 ? (
        <div className="start">
          <h2>{t('templates.startTitle')}</h2>
          <ol className="steps">
            <li>
              <h3>{t('templates.stepCreate')}</h3>
              <p>{t('templates.stepCreateDesc')}</p>
              <Command value="hodor template:create" />
            </li>
            <li>
              <h3>{t('templates.stepImport')}</h3>
              <p>{t('templates.stepImportDesc')}</p>
              <Command value="hodor template:import stack.json" />
            </li>
            <li>
              <h3>{t('templates.stepRun')}</h3>
              <p>{t('templates.stepRunDesc')}</p>
              <Command value="hodor template:run stack" />
            </li>
          </ol>
          <p className="note">{t('templates.editorSoon')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('templates.colName')}</th>
              <th>{t('templates.colPorts')}</th>
              <th>{t('templates.colTags')}</th>
              <th className="n">{t('templates.colUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {templates.isPending
              ? [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td className="identity">
                      <Skeleton width={120} />
                      <span className="sub">
                        <Skeleton width={200} height={12} />
                      </span>
                    </td>
                    <td>
                      <Skeleton width={150} />
                    </td>
                    <td>
                      <Skeleton width={80} height={22} />
                    </td>
                    <td className="n">
                      <Skeleton width={70} />
                    </td>
                  </tr>
                ))
              : list.map((tpl) => (
                  <tr key={tpl.id}>
                    <td className="identity">
                      <span className="name-line">
                        <span className="name truncate">{tpl.name}</span>
                        {tpl.running && <span className="pill pos">{t('templates.running')}</span>}
                      </span>
                      {tpl.description && <span className="sub truncate">{tpl.description}</span>}
                    </td>
                    <td>
                      <span className="port-list num">
                        {tpl.forwards.map((f) => (
                          <span key={f.name}>
                            <span className="mono">:{f.localPort}</span>{' '}
                            <span className="port-name">{f.name}</span>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      {tpl.tags.length ? (
                        <span className="tags">
                          {tpl.tags.map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">{t('common.dash')}</span>
                      )}
                    </td>
                    <td className="n num nowrap">{formatRelative(tpl.updatedAt)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
