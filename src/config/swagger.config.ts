import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Multi tenancy",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
      {
        url: "http://example.com",
      },
    ],
  },
  apis: ["./src/app.ts", "./src/routes/*.ts"], // Path to files containing OpenAPI annotations
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
