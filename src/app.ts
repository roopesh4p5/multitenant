import express, {Request, Response} from 'express';
import dotenv from 'dotenv';
import { sequelize } from './config/dbconfig';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';

dotenv.config();
const app = express();
const PORT =  3000;

app.use(express.json());

sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch((err) => console.error('Unable to connect to the database:', err));  


app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
 