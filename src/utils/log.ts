const isDev = typeof window !== 'undefined' && (window as any).__DEV__ !== false

export const log = {
  info: (...args: any[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log(...args)
  },
  warn: (...args: any[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.warn(...args)
  },
  // eslint-disable-next-line no-console
  error: (...args: any[]) => console.error(...args),
}
