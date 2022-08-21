
import { twintag, gql } from "./deps.ts";
import type { JSObject } from "./types.ts";
import { type Uuid, type Hash, hash } from "../lib/uuid.ts";

type Context = {
  project: twintag.Project,
  view: twintag.View
}

interface User {
  id: Uuid
  username: string
  password: Hash
  email: string|null
}

interface TTAppUser extends User {
  // TWINTAG: having to specify a dataScope is weird
  $dataScope?:string 
  // TWINTAG: $qid is called Id in the API, UUID in admin console, $qid in the record 
  // yet it is really a rowId or objectId when a row represents and object
  $qid?: string 
}

const schemaText = `
  scalar Uuid

  type Query {
    users: [User!]
    user(id: Uuid!) : User
  }

  type User {
    id: Uuid!
    username: String!
    password: String!
    email: String
  }

  type Mutation {
    createUser(username:String!, password: String): User
    removeUser(id:Uuid!): Boolean
  }
`;

const rootValue = {
    user: async (args:{id:Uuid}, context:Context, _info:gql.GraphQLResolveInfo) => {
      const users = await context.view.object('appusers')
      const user = await users.get<TTAppUser>(args.id)
      return { 
        id: user.$qid, 
        username: user.username, 
        password: user.password 
      } 
    },

    users: async (_args:never, context:Context, _info:gql.GraphQLResolveInfo) => {
      const users = await context.view.object('appusers')
      const all = await users.get<TTAppUser[]>('')
      const result = all.map((user)=>{
        return {
          id: user.$qid, 
          username: user.username, 
          password: user.password,
          email: user.email
        } 
      })
      return result
    },
    
    createUser: async (args:{username:string, password:string, email:string|null}, context:Context, _info:gql.GraphQLResolveInfo) => {
      const data = await context.view.data()
      const users = context.project.object('appusers')
      const appUser:TTAppUser = {
        $dataScope: data.bagQid, // TWINTAG: Should not have to do this.
        id: '',
        username: args.username,
        password: hash(args.password),
        email: args.email,
      }
      const user = await users.insert<TTAppUser>(appUser)
      return { 
        id: user.$qid, 
        username: user.username, 
        password: user.password,
        email: user.email 
      } 
    },

    removeUser: async (args:{id:string}, context:Context, _info:gql.GraphQLResolveInfo) => {
      const data = await context.view.data()
      const users = context.project.object('appusers')
      await users.delete(args.id, data.bagQid)
      return true
    },
}

export const epsilonHandler = async (project: twintag.Project, view: twintag.View, body:string): Promise<JSObject> => {
  try {
    const schema = gql.buildSchema(schemaText)
    const parsed = JSON.parse(body)
    const source = parsed["query"]
    const variables = parsed["variables"]
    return await gql.graphql(schema, source, rootValue, {project: project, view: view}, variables)
  } catch(err) {
    return { errors: [{message:`${err}`}]}
  }
}
