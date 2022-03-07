import { NetlifyPlugin } from '@netlify/build'
import { writeMiddleware } from './helpers'
export const onBuild: NetlifyPlugin['onBuild'] = async ({ netlifyConfig }) => {
  await writeMiddleware(netlifyConfig)
}
