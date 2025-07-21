import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { Express } from 'express';
import { Server } from 'http';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createContext } from './context';
import { GraphQLError } from 'graphql';

// Custom error formatting
function formatError(error: GraphQLError) {
  // Remove stack trace in production
  if (process.env.NODE_ENV === 'production') {
    delete (error as any).stack;
  }
  
  // Add custom error codes
  const code = (error.extensions?.code as string) || 'INTERNAL_ERROR';
  
  return {
    message: error.message,
    code,
    path: error.path,
    extensions: {
      ...error.extensions,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function createGraphQLServer(app: Express, httpServer?: Server) {
  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });
  
  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    formatError,
    plugins: httpServer ? [
      ApolloServerPluginDrainHttpServer({ httpServer }),
    ] : [],
    introspection: process.env.NODE_ENV !== 'production',
  });
  
  // Start Apollo Server
  await server.start();
  
  // Apply GraphQL middleware
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: createContext,
    })
  );
  
  return server;
}