
// deno-lint-ignore no-explicit-any
export type JSObject = any

export type Event = {
  view: {
      qid: string;
  }
  request: {
      body: JSObject;
  }
  project: {
      apiKey: string;
  }
  logging: {
    http:'none'|'single'|'headers'|'body',
    event: 'none'|'request'|'response'|'request+response'
  }
}

export type EpsilonInit = {
    testing?:boolean
}


