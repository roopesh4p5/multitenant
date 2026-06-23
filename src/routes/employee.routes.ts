import { Router } from 'express';
import {
  employeeSignup,
  employeeLogin,
  getProfile,
  updateProfile,
  validateData,
} from '../controllers/employee.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

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
 *       Employee starts in PENDING status, awaiting admin approval.
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
 *                   example: Employee registered successfully. Awaiting admin approval.
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
 *                       example: pending
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
 * /api/employee/profile:
 *   put:
 *     tags:
 *       - Employee
 *     summary: Update employee's personal information.
 *     description: |
 *       Updates name and/or phone.
 *       Schema field values are updated via schema API.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *             example:
 *               name: John Doe Updated
 *               phone: 9876543211
 *     responses:
 *       '200':
 *         description: Profile updated.
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
 *                   example: Profile updated successfully
 *       '400':
 *         description: No fields to update.
 *       '401':
 *         description: Not authenticated.
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @openapi
 * /api/employee/validate:
 *   post:
 *     tags:
 *       - Employee
 *     summary: Validate employee field values against schema.
 *     description: |
 *       Validates field values without saving them.
 *       Used for form validation before bulk upload or submission.
 *       Returns validation errors if any.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fieldValues
 *             properties:
 *               fieldValues:
 *                 type: object
 *                 description: Field name to value mapping
 *                 additionalProperties: true
 *                 example:
 *                   first_name: John
 *                   department: Sales
 *                   employee_id: 12345
 *     responses:
 *       '200':
 *         description: Validation result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_name:
 *                             type: string
 *                           field_id:
 *                             type: number
 *                           error:
 *                             type: string
 *       '400':
 *         description: Invalid request.
 *       '401':
 *         description: Not authenticated.
 */
router.post('/validate', authenticate, validateData);

export default router;
