import { twintag } from "./deps.ts";
import type { Event, EpsilonInit } from "./types.ts";
import { epsilonHandler } from "./epsilon_handler.ts";

export const epsilon = async (event: Event, init?:EpsilonInit ): Promise<Response> => {
  try {
      const project = new twintag.Project(event.project.apiKey);
      const view = new twintag.View(event.view.qid);
      // this is support to be an internal metho but we still need 
      // to call it
      // Why can we set properties like project, client on the view but not
      // read/access them again?
      view._setConfig({project: project});

      if (init) {
        if (init.testing === true) {
          twintag.setHost('https://twintag.io')
          twintag.setAdminHost('https://admin.twintag.io')
        } 
      }
      twintag.setLogLevel(event.logging.http)

      if ((event.logging.event === 'request') || (event.logging.event === 'request+response')) {
        console.log('Event.request', event.request.body)
      }
      const response = await epsilonHandler(project, view, event.request.body as string);
      if ((event.logging.event === 'response') || (event.logging.event === 'request+response')) {
        console.log('Event.response', response)
      }
      return new Response(JSON.stringify(response));
  } catch (e) {
      console.error(e);
      return new Response('Failed ' + e);
  }
}

// deno-lint-ignore no-explicit-any
const root = <any>(typeof globalThis !== 'undefined' ? globalThis : window)

root.epsilon = epsilon

export { root }