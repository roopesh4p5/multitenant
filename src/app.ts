import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { sequelize } from './config/dbconfig';
import './models';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';

// Routes
import authRoutes from './routes/auth.routes';
import superadminRoutes from './routes/superadmin.routes';
import schemaRoutes from './routes/schema.routes';
import publicRoutes from './routes/public.routes';
import employeeRoutes from './routes/employee.routes';
import viewRoutes from './routes/view.routes';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());

app.use('/', viewRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/public', publicRoutes);

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
