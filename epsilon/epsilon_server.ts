import { Application } from "./deps.ts";
import { type Event } from "./types.ts";
import { VIEW_QID,  API_KEY} from "./environment.ts";
import { root } from "./epsilon_function.ts";


export const app = new Application();

app.use(async (ctx) => {
  try {
    const reqBody = await ctx.request.body({type:'json'}).value

    const event = {
      view: {
        qid: VIEW_QID
      },
      request : {
        body: reqBody
      },
      project: {
        apiKey: API_KEY


      }
    } as Event

    //  deno-lint-ignore no-explicit-any
    const rspBody = await (root as any).epsilon(event)
    console.log('RSPBODY', rspBody)
    ctx.response.body = rspBody
    ctx.response.status = 200
  } catch (err) {
    console.error(err)
    ctx.response.body = `${err}`
    ctx.response.status = 500
  }

})

app.addEventListener("listen", e => {
  console.log(e.hostname, e.port)
})

app.addEventListener("error", e => {
  console.error(e.message)
})


const PORT = 8080;
const HOST = "localhost";

await app.listen({hostname:HOST, port:PORT})
