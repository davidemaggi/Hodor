import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type HodorApi } from '../shared/api';

// Only these functions cross the bridge. The renderer never sees ipcRenderer itself.
const api: HodorApi = {
  app: {
    info: () => ipcRenderer.invoke(CHANNELS.appInfo),
  },
  clusters: {
    list: () => ipcRenderer.invoke(CHANNELS.clustersList),
    health: (clusterId) => ipcRenderer.invoke(CHANNELS.clustersHealth, clusterId),
  },
  templates: {
    list: () => ipcRenderer.invoke(CHANNELS.templatesList),
  },
  running: {
    list: () => ipcRenderer.invoke(CHANNELS.runningList),
    stop: (templateId) => ipcRenderer.invoke(CHANNELS.runningStop, templateId),
  },
  settings: {
    get: () => ipcRenderer.invoke(CHANNELS.settingsGet),
    update: (patch) => ipcRenderer.invoke(CHANNELS.settingsUpdate, patch),
  },
};

contextBridge.exposeInMainWorld('hodor', api);
