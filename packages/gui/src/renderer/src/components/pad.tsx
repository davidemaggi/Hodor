import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

type Key = 'up' | 'down' | 'left' | 'right' | 'b' | 'a' | 'select' | 'start';

const CODE: Key[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

const KEYS: Record<string, Key> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  b: 'b',
  B: 'b',
  a: 'a',
  A: 'a',
};

interface PadProps {
  open: boolean;
  onClose: () => void;
}

export const Pad: React.FC<PadProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(0);
  const [pressed, setPressed] = useState<Key | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setProgress(0);
      setWon(false);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const press = (key: Key) => {
    if (won) return;
    setPressed(key);
    setTimeout(() => setPressed((p) => (p === key ? null : p)), 120);
    setProgress((n) => {
      if (key === CODE[n]) {
        if (n + 1 === CODE.length) setWon(true);
        return n + 1;
      }
      if (key === 'select' || key === 'start') return n;
      setShake((s) => s + 1);
      return key === CODE[0] ? 1 : 0;
    });
  };

  useEffect(() => {
    if (!open || won) return;
    const onKey = (e: KeyboardEvent) => {
      const key = KEYS[e.key];
      if (!key) return;
      e.preventDefault();
      press(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, won]);

  // Confetti until the apology. The page's CSP allows no blob workers, so no worker.
  useEffect(() => {
    if (!won || !canvas.current) return;
    const fire = confetti.create(canvas.current, {
      resize: true,
      useWorker: false,
      disableForReducedMotion: true,
    });
    const burst = () => {
      void fire({
        particleCount: 36,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 0.75 },
      });
      void fire({
        particleCount: 36,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 0.75 },
      });
    };
    burst();
    const timer = setInterval(burst, 450);
    return () => {
      clearInterval(timer);
      fire.reset();
    };
  }, [won]);

  const button = (key: Key, className: string) => (
    <button
      type="button"
      className={`pad-${className}${pressed === key ? ' down' : ''}`}
      aria-label={t(`pad.keys.${key}`)}
      onClick={() => press(key)}
    />
  );

  return (
    <dialog
      ref={ref}
      className="pad-dialog"
      aria-labelledby="pad-title"
      onCancel={(e) => {
        // Once the code is in, only the apology closes it
        if (won) e.preventDefault();
        else onClose();
      }}
    >
      {open && (
        <>
          <canvas ref={canvas} className="pad-confetti" aria-hidden="true" />
          {won ? (
            <div className="pad-won">
              <h2 id="pad-title">{t('pad.wonTitle')}</h2>
              <p>{t('pad.wonBody')}</p>
              <button type="button" className="btn primary" onClick={onClose} autoFocus>
                {t('pad.back')}
              </button>
            </div>
          ) : (
            // Focus starts here, not on a key, so no key looks pressed
            <div className="pad-stage" tabIndex={-1} autoFocus>
              <h2 id="pad-title" className="visually-hidden">
                {t('pad.title')}
              </h2>
              <div key={shake} className={shake ? 'pad shake' : 'pad'}>
                <div className="pad-face">
                  <div className="pad-cross">
                    {button('up', 'up')}
                    {button('left', 'left')}
                    <span className="pad-hub" aria-hidden="true" />
                    {button('right', 'right')}
                    {button('down', 'down')}
                  </div>
                  <div className="pad-middle">
                    <div className="pad-labels" aria-hidden="true">
                      <span>SELECT</span>
                      <span>START</span>
                    </div>
                    <div className="pad-pills">
                      {button('select', 'pill')}
                      {button('start', 'pill')}
                    </div>
                  </div>
                  <div className="pad-ab">
                    <div>
                      {button('b', 'round')}
                      <span aria-hidden="true">B</span>
                    </div>
                    <div>
                      {button('a', 'round')}
                      <span aria-hidden="true">A</span>
                    </div>
                  </div>
                </div>
              </div>
              <ol className="pad-progress" aria-label={t('pad.progress', { done: progress })}>
                {CODE.map((_, i) => (
                  <li key={i} className={i < progress ? 'on' : undefined} />
                ))}
              </ol>
              <p className="pad-hint">{t('pad.hint')}</p>
            </div>
          )}
        </>
      )}
    </dialog>
  );
};
