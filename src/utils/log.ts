const isDev = typeof window !== 'undefined' && (window as any).__DEV__ !== false

export const log = {
  // eslint-disable-next-line no-console
  info: (...args: any[]) => {
    if (isDev) console.log(...args)
  },
  // eslint-disable-next-line no-console
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args)
  },
  error: (...args: any[]) => console.error(...args),
}
