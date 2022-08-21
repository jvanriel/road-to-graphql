import { serve } from "https://deno.land/std@0.151.0/http/server.ts";
import { type ServeInit } from "https://deno.land/std@0.151.0/http/server.ts";
import { readAll } from "https://deno.land/std@0.151.0/streams/conversion.ts";
import { readerFromStreamReader } from "https://deno.land/std@0.152.0/streams/mod.ts";
import { VIEW_QID, API_KEY } from "./environment.ts";
import type { Event } from "./types.ts"
import { epsilon } from "./epsilon_function.ts";

const decoder = new TextDecoder();

type onListenProps = {
  port: number
  hostname: string
}

const createEvent = (body: string): Event => {
  return {
    view: { qid: VIEW_QID },
    request: { body: body},
    project: { apiKey: API_KEY},
    logging: {http: 'none', event:'none' }
  }
}

const handleRequest = async (req:Request) => {
  if (req.body) {
    const readableStreamDefaultReader = req.body.getReader({ mode: undefined })
    const denoReader = readerFromStreamReader(readableStreamDefaultReader)
      const body = await readAll(denoReader)
      const text = decoder.decode(body)
      return await epsilon(createEvent(text), { testing: true})
  } else {
    throw Error("missing body")
  }
}

const serveInit:ServeInit = {
  onListen(props:onListenProps) {
    const { hostname, port } = props 
    console.log(`Server started at http://${hostname}:${port}`);
  },
  onError(error: unknown) {
    return new Response(`${error}`)
  }
}

serve(handleRequest, serveInit);