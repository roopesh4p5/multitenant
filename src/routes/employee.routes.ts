import { Router } from 'express';
import multer from 'multer';
import {
  employeeSignup,
  employeeLogin,
  getProfile
} from '../controllers/employee.controller';
import {
  bulkUploadEmployees,
  downloadErrorReport,
} from '../controllers/bulk-upload.controller';
import {
  authenticate,
  requireTenant,
  restrictTenantAccess,
} from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/employee/signup:
 *   post:
 *     tags:
 *       - Employee
 *     summary: Register a new employee with a tenant.
 *     description: |
 *       Employee registers with their email and creates their account.
 *       Tenant is resolved from subdomain or ?tenant=slug query parameter.
 *       Employee account is activated immediately after signup.
 *     parameters:
 *       - in: query
 *         name: tenant
 *         required: false
 *         schema:
 *           type: string
 *           example: pacewisdom
 *         description: Employee registered successfully.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - fieldValues
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               fieldValues:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Tenant-specific dynamic form values returned by /api/public/bootstrap
 *             example:
 *               email: john.doe@example.com
 *               password: SecurePass123!
 *               name: John Doe
 *               phone: 9876543210
 *               fieldValues:
 *                 full_name: John Doe
 *                 gender: Male
 *                 current_address:
 *                   address_line_1: 123 Main Street
 *                   city: Bangalore
 *                   pincode: 560001
 *                   country: India
 *     responses:
 *       '201':
 *         description: Employee registered successfully. Awaiting approval.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
*                 message:
 *                   type: string
*                   example: Employee registered successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: number
 *                     profile_id:
 *                       type: number
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
*                       example: active
 *       '400':
 *         description: Invalid request payload.
 *       '409':
 *         description: Email already registered with this tenant.
 */
router.post('/signup', employeeSignup);

/**
 * @openapi
 * /api/employee/login:
 *   post:
 *     tags:
 *       - Employee
 *     summary: Authenticate an employee and get JWT token.
 *     description: |
 *       Employee must be in ACTIVE status and profile must be approved.
 *       Tenant is resolved from subdomain or ?tenant=slug query parameter.
 *     parameters:
 *       - in: query
 *         name: tenant
 *         required: false
 *         schema:
 *           type: string
 *           example: pacewisdom
 *         description: Optional tenant slug for local development.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *             example:
 *               email: john.doe@example.com
 *               password: SecurePass123!
 *     responses:
 *       '200':
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       format: jwt
 *                     user:
 *                       type: object
 *                       properties:
 *                         user_id:
 *                           type: number
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *       '401':
 *         description: Invalid credentials.
 *       '403':
 *         description: Account not activated or profile not approved.
 */
router.post('/login', employeeLogin);

/**
 * @openapi
 * /api/employee/profile:
 *   get:
 *     tags:
 *       - Employee
 *     summary: Get current employee's profile.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Profile retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: number
 *                     profile_id:
 *                       type: number
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     status:
 *                       type: string
 *                     approved:
 *                       type: boolean
 *       '401':
 *         description: Not authenticated.
 */
router.get('/profile', authenticate, getProfile);


/**
 * @openapi
 * /api/employee/bulk-upload:
 *   post:
 *     tags:
 *       - Employee
 *     summary: Bulk upload employees via Excel.
 *     description: |
 *       Allows tenant admin to upload an Excel file containing list of employees.
 *       The Excel file must contain `name`, `email`, `password`, `phone` (optional), and any tenant-defined fields.
 *       Valid rows will be processed and created as pending employees.
 *       Invalid rows will be collected into an error report Excel sheet.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file containing employee records (.xlsx)
 *     responses:
 *       '200':
 *         description: Bulk upload completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRows:
 *                       type: integer
 *                     successCount:
 *                       type: integer
 *                     errorCount:
 *                       type: integer
 *                     errorReportId:
 *                       type: string
 *                       nullable: true
 *       '400':
 *         description: Bad request (e.g. missing file).
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden (Tenant access required).
 */
router.post(
  '/bulk-upload',
  authenticate,
  requireTenant,
  restrictTenantAccess,
  upload.single('file'),
  bulkUploadEmployees
);

/**
 * @openapi
 * /api/employee/bulk-upload/errors/{reportId}:
 *   get:
 *     tags:
 *       - Employee
 *     summary: Download generated bulk upload error report.
 *     description: Downloads the Excel error report containing validation failures per row.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the error report.
 *     responses:
 *       '200':
 *         description: Excel report file.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: Report not found.
 */
router.get(
  '/bulk-upload/errors/:reportId',
  authenticate,
  requireTenant,
  downloadErrorReport
);

export default router;
