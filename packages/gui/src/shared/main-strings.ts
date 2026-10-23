/**
 * Strings shown by the main process (tray menu, native dialogs). Kept apart from the renderer's
 * i18next resources because the main process has no React and only needs a handful.
 */
export interface MainStrings {
  idle: string;
  doors: (n: number) => string;
  copyAddress: (address: string) => string;
  secret: (name: string) => string;
  configMap: (name: string) => string;
  unreadable: (error?: string) => string;
  empty: string;
  loading: string;
  stopForward: string;
  startForward: string;
  stopTemplate: (name: string) => string;
  stopAll: string;
  open: string;
  quit: string;
  state: { stopped: string; error: string; closed: string };
  quitDialog: {
    stopAndQuit: string;
    cancel: string;
    message: (n: number) => string;
    detail: string;
  };
  closeDialog: {
    keep: string;
    stopAndQuit: string;
    cancel: string;
    message: string;
    detail: string;
  };
  cliPrompt: { install: string; notNow: string; message: string; detail: string };
}

const en: MainStrings = {
  idle: 'Nothing running',
  doors: (n) => (n === 1 ? '1 door held' : `${n} doors held`),
  copyAddress: (address) => `Copy ${address}`,
  secret: (name) => `Secret ${name}`,
  configMap: (name) => `Config map ${name}`,
  unreadable: (error) => `Can't read it${error ? `: ${error}` : ''}`,
  empty: 'No keys',
  loading: 'Loading keys…',
  stopForward: 'Stop this forward',
  startForward: 'Start this forward',
  stopTemplate: (name) => `Stop ${name}`,
  stopAll: 'Stop everything',
  open: 'Open Hodor',
  quit: 'Quit Hodor',
  state: { stopped: 'stopped', error: 'error', closed: 'not listening' },
  quitDialog: {
    stopAndQuit: 'Stop and quit',
    cancel: 'Cancel',
    message: (n) =>
      n === 1
        ? 'A template is running. Stop it and quit?'
        : `${n} templates are running. Stop them and quit?`,
    detail:
      'Their port-forwards close when Hodor quits. Templates started from the terminal keep running.',
  },
  closeDialog: {
    keep: 'Keep running in the background',
    stopAndQuit: 'Stop and quit',
    cancel: 'Cancel',
    message: 'Templates are running',
    detail:
      'Keep their port-forwards open in the background? You can get back to Hodor from its tray icon or by opening it again.',
  },
  cliPrompt: {
    install: 'Install',
    notNow: 'Not now',
    message: 'Install the hodor command?',
    detail:
      'Use Hodor from any terminal: hodor template:run, hodor ctx and friends. You can do it later from Settings.',
  },
};

const it: MainStrings = {
  idle: 'Niente in esecuzione',
  doors: (n) => (n === 1 ? '1 porta aperta' : `${n} porte aperte`),
  copyAddress: (address) => `Copia ${address}`,
  secret: (name) => `Secret ${name}`,
  configMap: (name) => `Config map ${name}`,
  unreadable: (error) => `Non riesco a leggerlo${error ? `: ${error}` : ''}`,
  empty: 'Nessuna chiave',
  loading: 'Carico le chiavi…',
  stopForward: 'Ferma questo forward',
  startForward: 'Avvia questo forward',
  stopTemplate: (name) => `Ferma ${name}`,
  stopAll: 'Ferma tutto',
  open: 'Apri Hodor',
  quit: 'Esci da Hodor',
  state: { stopped: 'fermo', error: 'errore', closed: 'non in ascolto' },
  quitDialog: {
    stopAndQuit: 'Ferma ed esci',
    cancel: 'Annulla',
    message: (n) =>
      n === 1
        ? 'Un template è in esecuzione. Lo fermo ed esco?'
        : `${n} template sono in esecuzione. Li fermo ed esco?`,
    detail:
      'I loro port-forward si chiudono quando Hodor esce. I template avviati da terminale continuano a girare.',
  },
  closeDialog: {
    keep: 'Continua in background',
    stopAndQuit: 'Ferma ed esci',
    cancel: 'Annulla',
    message: 'Ci sono template in esecuzione',
    detail:
      'Tengo aperti i loro port-forward in background? Puoi tornare a Hodor dalla sua icona nella tray o riaprendolo.',
  },
  cliPrompt: {
    install: 'Installa',
    notNow: 'Non ora',
    message: 'Installo il comando hodor?',
    detail:
      'Usa Hodor da qualsiasi terminale: hodor template:run, hodor ctx e compagnia. Puoi farlo anche dopo dalle Impostazioni.',
  },
};

export const mainStrings = (language?: string): MainStrings => (language === 'it' ? it : en);
