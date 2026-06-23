import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multitenant SaaS API',
      version: '1.0.0',
      description:
        'Multitenant SaaS platform.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token. Obtain it from POST /api/auth/login',
        },
      },

    },
    tags: [
      {
        name: 'Auth',
        description: 'Organization admin registration and login',
      },
      {
        name: 'SuperAdmin',
        description:
          'SuperAdmin-only endpoints for reviewing and approving organizations',
      },
      {
        name: 'Schema',
        description: 'Tenant-scoped employee schema field management',
      },
      {
        name: 'Employee',
        description: 'Employee registration, authentication, profile and schema validation',
      },
      {
        name: 'Public',
        description: 'Public tenant bootstrap endpoints used by tenant frontend URLs',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
