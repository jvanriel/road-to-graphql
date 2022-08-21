# road-to-graphql

This repository demonstrates the combination twintag, deno and graphql.

It implements a Users database using twintag structured data.

The table is called `appusers` with columns

* username: some string
* password: hash of password really
* email: nullable

Using the object's `$qid` aka UUID in Twintag Admin as user's id.

The GraphQL Schema is 

```
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
```

Here is a Deno compatible [twintag SDK](https://github.com/jvanriel/twintag).
This SDK also features extra configurable http logging in the client.

You can run `epsilon/epsilon_server.ts` and then use desktop app `GraphiQL` against it.


## Twintag Project

Company is `Twintag Research`

Project is [Road To GraphQL](https://admin.twintag.io/#/company/Twintag%20Research/Road%20To%20GraphQL)

## Environment

You need to create epsilon/environment.ts like so:

```
export const API_KEY="eyJhbGciOiJIUzI1NiIs ... PXLOzS5ZP7Wnle1mxUlU";
export const VIEW_QID="222bb11c8f4f56e28979c7e407a6e89a"
```

## Test Epsilon

    deno test --allow-net epsilon/epsilon_function.test.ts

## Rebuild cache

    deno cache --reload epsilon/deps.ts 

## Run server

    deno run --allow-net epsilon/epsilon_server.ts

### Use GraphiQL

You can also install a GraphiQL desktop application.

For macOS

     brew install --cask graphiql

Repository [graphql/graphiql](https://github.com/graphql/graphiql) allows you to embed this as a web component.
So we could potentially extend Twintag project admin with it.


