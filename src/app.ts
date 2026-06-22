import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { sequelize } from './config/dbconfig';
import './models';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';

// Routes
import authRoutes from './routes/auth.routes';
import superadminRoutes from './routes/superadmin.routes';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

sequelize
  .authenticate()
  .then(() => console.log('Database connected'))
  .catch((err) => console.error('Unable to connect to the database:', err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});