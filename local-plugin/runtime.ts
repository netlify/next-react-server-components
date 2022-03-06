export const getHandler = () => /* typescript */ `

import type { Context } from 'https://dinosaurs:are-the-future!@edge-bootstrap.netlify.app/context.ts'
import { buildResponse } from "./utils.ts"
import { ReadableStreamPolyfill } from "./polyfill.js";
globalThis.ReadableStream = ReadableStreamPolyfill as typeof ReadableStream;

import edgeFunction from './bundle.js'

export interface FetchEventResult {
    response: Response
    waitUntil: Promise<any>
}
  
const handler = async (request: Request, context: Context) => {
    const res = await edgeFunction({ request })
    return buildResponse(res)
}

export default handler
`
