# road-to-graphql
Implements server side code of the book 'The Road to GraphQL'  using twintag structured and unstructured data.


## Test Epsilon

    deno test --allow-net epsilon/epsilon_function.test.ts

## Rebuild cache

    deno cache --reload epsilon/deps.ts 

## Tools

### uuid

Prints a new 32-character hex string universally unique identifier

#### build

    deno compile tools/uuid.ts


#### run

    ./uuid

example:

    ./uuid
    fd4121f6719bd3e52997152f8e4e195b 

   



## References

[Content Server Example](https://medium.com/deno-the-complete-reference/learn-deno-by-example-part-1-introduction-to-content-server-e3c77bbf9c2d)
