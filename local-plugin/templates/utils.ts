export interface FetchEventResult {
  response: Response
  waitUntil: Promise<any>
}

export const buildResponse = (result: FetchEventResult) => {
  const res = new Response(result.response.body, result.response)
  // TODO Check for rewrites etc
  return res
}
