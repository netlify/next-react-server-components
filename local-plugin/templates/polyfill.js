/**
 * We're using this polyfill from the Next.js source instead of the builtin
 * because Next.js doesn't like the real one. Should have been fixed by
 * https://github.com/facebook/react/issues/22772
 */
export class ReadableStreamPolyfill {
  constructor(opts = {}) {
    let closed = false
    let pullPromise

    let transformController
    const { readable, writable } = new TransformStream(
      {
        start: (controller) => {
          transformController = controller
        },
      },
      undefined,
      {
        highWaterMark: 1,
      }
    )

    const writer = writable.getWriter()
    const encoder = new TextEncoder()
    const controller = {
      get desiredSize() {
        return transformController.desiredSize
      },
      close: () => {
        if (!closed) {
          closed = true
          writer.close()
        }
      },
      enqueue: (chunk) => {
        writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
        pull()
      },
      error: (reason) => {
        transformController.error(reason)
      },
    }

    const pull = () => {
      if (opts.pull) {
        if (!pullPromise) {
          pullPromise = Promise.resolve().then(() => {
            pullPromise = 0
            opts.pull(controller)
          })
        }
      }
    }

    if (opts.start) {
      opts.start(controller)
    }

    if (opts.cancel) {
      readable.cancel = (reason) => {
        opts.cancel(reason)
        return readable.cancel(reason)
      }
    }

    pull()

    return readable
  }
}
