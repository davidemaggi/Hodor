import type { Plugin } from 'vite';

/**
 * Inject the Content-Security-Policy. Production allows nothing but the app's own files;
 * development also allows Vite's dev server, websocket and React refresh preamble.
 */
export function csp(): Plugin {
  return {
    name: 'hodor-csp',
    transformIndexHtml(_html, ctx) {
      const dev = !!ctx.server;
      const policy = [
        "default-src 'self'",
        dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        dev ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}
