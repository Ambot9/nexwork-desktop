const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'

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
