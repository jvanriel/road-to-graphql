import { t } from "./deps.ts"
import { epsilon } from "./epsilon_function.ts";
import { VIEW_QID, API_KEY } from "./environment.ts";
import type { Event } from "./types.ts"

const createEvent = (body: string): Event => {
  return {
    view: { qid: VIEW_QID },
    request: { body: body},
    project: { apiKey: API_KEY},
    logging: {http: 'none', event:'none' }
  }
}

let userId = ''

Deno.test("user-create", async () => {

  const body = {
    query:`mutation {
      createUser(username:"Jan Van Riel", password:"Tester") {
        id
      }
    }`,
    variables: {
    }
  }

  const response = await epsilon(createEvent(JSON.stringify(body)), {testing: true})
  t.assertEquals(response.status, 200)

  const json = await response.json()
  userId = json["data"]["createUser"]["id"]

})

Deno.test("user-list", async () => {

  const body = {
    query: `
      query {
        users {
          id
          username
        }
      }`,
    variables: {
    }
  }

  const response = await epsilon(createEvent(JSON.stringify(body)), {testing: true})
  t.assertEquals(response.status, 200)

  const json = await response.json()
  t.assert(json["data"]["users"].length > 0)
})

Deno.test("user-fetch", async () => {

  const body = {
    query: `
      query {
        user(id: "${userId}") {
          id
          username
          password
          email
        }
      }`,
    variables: {
    }
  }

  const response = await epsilon(createEvent(JSON.stringify(body)), {testing: true})
  t.assertEquals(response.status, 200)

  const json = await response.json()
  t.assertEquals(json["data"]["user"]["id"], userId)

})

Deno.test("user-remove", async () => {

  const body = {
    query: `
      mutation {
        removeUser(id: "${userId}") 
      }`,
    variables: {
    }
  }

  const response = await epsilon(createEvent(JSON.stringify(body)), {testing: true})
  t.assertEquals(response.status, 200)

  const json = await response.json()
  t.assert(json["data"]["removeUser"])
})





