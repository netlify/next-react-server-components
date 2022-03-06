import type { NetlifyConfig } from '@netlify/build'
import type { MiddlewareManifest } from 'next/dist/build/webpack/plugins/middleware-plugin'
import { promises as fs, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { emptyDir, ensureDir, readJson, writeJson } from 'fs-extra'
import { getHandler } from './runtime'

const loadMiddlewareManifest = async (
  netlifyConfig: NetlifyConfig
): Promise<MiddlewareManifest | null> => {
  const middlewarePath = resolve(
    netlifyConfig.build.publish,
    'server',
    'middleware-manifest.json'
  )
  if (!existsSync(middlewarePath)) {
    return null
  }
  return readJson(middlewarePath)
}

const sanitizeName = (name: string) =>
  `next${name === '/' ? '_index' : name.replace('/', '_')}`

const bootstrap = /* js */ `
  globalThis._ENTRIES ||= {}
  // We shadow the global because of packages that check for the existence of window to know if they're in the browser
  let window = undefined
`

// TODO: set the proper env
const getEnv = () => /* js */ `
let process = { env: {} }
`

const getMiddlewareBundle = async ({
  middlewareDefinition,
  netlifyConfig,
}: {
  middlewareDefinition: MiddlewareManifest['middleware']['name']
  netlifyConfig: NetlifyConfig
  handlerDir: string
}): Promise<string> => {
  const { publish } = netlifyConfig.build
  const chunks: Array<string> = [bootstrap, getEnv()]
  for (const file of middlewareDefinition.files) {
    const filePath = join(publish, file)
    const data = await fs.readFile(filePath, 'utf8')
    chunks.push(data)
  }

  const middleware = await fs.readFile(
    join(publish, `server`, `${middlewareDefinition.name}.js`),
    'utf8'
  )

  chunks.push(middleware)

  const exports = /* js */ `export default _ENTRIES["middleware_${middlewareDefinition.name}"].default;`
  chunks.push(exports)
  return chunks.join('\n')
}

interface HandlerManifest {
  version: 1
  edge_handlers: Array<
    | {
        handler: string
        path: string
      }
    | {
        handler: string
        pattern: string
      }
  >
}

const copySourceFile = ({
  file,
  handlerDir,
}: {
  file: string
  handlerDir: string
}) => fs.copyFile(join(__dirname, 'templates', file), join(handlerDir, file))

export const writeMiddleware = async (netlifyConfig: NetlifyConfig) => {
  const middlewareManifest = await loadMiddlewareManifest(netlifyConfig)
  if (!middlewareManifest) {
    return
  }

  const manifest: HandlerManifest = {
    edge_handlers: [],
    version: 1,
  }

  const edgeHandlerRoot = resolve('.netlify', 'edge-handlers')
  await emptyDir(edgeHandlerRoot)

  for (const middleware of middlewareManifest.sortedMiddleware) {
    const name = sanitizeName(middleware)
    const handlerDir = join(edgeHandlerRoot, name)
    const middlewareDefinition = middlewareManifest.middleware[middleware]
    const bundle = await getMiddlewareBundle({
      middlewareDefinition,
      netlifyConfig,
      handlerDir,
    })

    await ensureDir(handlerDir)
    await fs.writeFile(join(handlerDir, 'bundle.js'), bundle)
    await fs.writeFile(join(handlerDir, 'index.ts'), getHandler())
    await copySourceFile({ handlerDir, file: 'polyfill.js' })
    await copySourceFile({ handlerDir, file: 'utils.ts' })
    manifest.edge_handlers.push({
      handler: name,
      pattern: middlewareDefinition.regexp,
    })
  }

  await writeJson(join(edgeHandlerRoot, 'manifest.json'), manifest)
}
