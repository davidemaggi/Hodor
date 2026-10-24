import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { CHANNELS, type HodorApi } from '../shared/api';

// Only these functions cross the bridge. The renderer never sees ipcRenderer itself.
const api: HodorApi = {
  app: {
    info: () => ipcRenderer.invoke(CHANNELS.appInfo),
    cliStatus: () => ipcRenderer.invoke(CHANNELS.appCliStatus),
    installCli: () => ipcRenderer.invoke(CHANNELS.appInstallCli),
    checkUpdate: () => ipcRenderer.invoke(CHANNELS.appCheckUpdate),
    openRelease: (url) => ipcRenderer.invoke(CHANNELS.appOpenRelease, url),
  },
  clusters: {
    list: () => ipcRenderer.invoke(CHANNELS.clustersList),
    health: (clusterId) => ipcRenderer.invoke(CHANNELS.clustersHealth, clusterId),
    select: (clusterId) => ipcRenderer.invoke(CHANNELS.clustersSelect, clusterId),
    namespaces: (clusterId) => ipcRenderer.invoke(CHANNELS.clustersNamespaces, clusterId),
    pods: (clusterId, namespace) =>
      ipcRenderer.invoke(CHANNELS.clustersPods, { clusterId, namespace }),
    services: (clusterId, namespace) =>
      ipcRenderer.invoke(CHANNELS.clustersServices, { clusterId, namespace }),
    linkables: (clusterId, namespace) =>
      ipcRenderer.invoke(CHANNELS.clustersLinkables, { clusterId, namespace }),
  },
  kubectl: {
    setContext: (clusterId) => ipcRenderer.invoke(CHANNELS.kubectlSetContext, clusterId),
    setNamespace: (clusterId, namespace) =>
      ipcRenderer.invoke(CHANNELS.kubectlSetNamespace, { clusterId, namespace }),
  },
  kubeconfig: {
    files: () => ipcRenderer.invoke(CHANNELS.kubeconfigFiles),
    // File objects can't cross IPC; their paths are resolved here, in the preload
    openDropped: (files) =>
      ipcRenderer.invoke(
        CHANNELS.kubeconfigOpenDropped,
        files.map((f) => webUtils.getPathForFile(f))
      ),
    chooseSources: () => ipcRenderer.invoke(CHANNELS.kubeconfigChooseSources),
    openKnown: (paths) => ipcRenderer.invoke(CHANNELS.kubeconfigOpenKnown, paths),
    planMerge: (request) => ipcRenderer.invoke(CHANNELS.kubeconfigPlan, request),
    applyMerge: (request) => ipcRenderer.invoke(CHANNELS.kubeconfigApply, request),
    exportContexts: (clusterIds) => ipcRenderer.invoke(CHANNELS.kubeconfigExport, clusterIds),
  },
  templates: {
    list: () => ipcRenderer.invoke(CHANNELS.templatesList),
    get: (id) => ipcRenderer.invoke(CHANNELS.templatesGet, id),
    create: (input) => ipcRenderer.invoke(CHANNELS.templatesCreate, input),
    update: (id, input) => ipcRenderer.invoke(CHANNELS.templatesUpdate, { id, input }),
    remove: (id) => ipcRenderer.invoke(CHANNELS.templatesRemove, id),
    reorder: (ids) => ipcRenderer.invoke(CHANNELS.templatesReorder, ids),
    exportToFile: (ids) => ipcRenderer.invoke(CHANNELS.templatesExport, ids),
    importFromFile: () => ipcRenderer.invoke(CHANNELS.templatesImport),
    commands: (id, options) => ipcRenderer.invoke(CHANNELS.templatesCommands, { id, options }),
  },
  running: {
    list: () => ipcRenderer.invoke(CHANNELS.runningList),
    stop: (templateId) => ipcRenderer.invoke(CHANNELS.runningStop, templateId),
    restart: (templateId) => ipcRenderer.invoke(CHANNELS.runningRestart, templateId),
    start: (templateId, clusterId) =>
      ipcRenderer.invoke(CHANNELS.runningStart, { templateId, clusterId }),
    stopAll: () => ipcRenderer.invoke(CHANNELS.runningStopAll),
    forward: (templateId, forwardName, action) =>
      ipcRenderer.invoke(CHANNELS.runningForward, { templateId, forwardName, action }),
    logs: (templateId, forwardName) =>
      ipcRenderer.invoke(CHANNELS.runningLogs, { templateId, forwardName }),
    linked: (templateId, forwardName) =>
      ipcRenderer.invoke(CHANNELS.runningLinked, { templateId, forwardName }),
    reveal: (ref) => ipcRenderer.invoke(CHANNELS.runningReveal, ref),
    copyValue: (ref) => ipcRenderer.invoke(CHANNELS.runningCopyValue, ref),
  },
  settings: {
    get: () => ipcRenderer.invoke(CHANNELS.settingsGet),
    update: (patch) => ipcRenderer.invoke(CHANNELS.settingsUpdate, patch),
  },
};

contextBridge.exposeInMainWorld('hodor', api);
