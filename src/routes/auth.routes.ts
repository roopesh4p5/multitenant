import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new organization admin and request superadmin approval.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - org_name
 *               - gst_no
 *               - admin_name
 *               - email
 *               - password
 *             properties:
 *               org_name:
 *                 type: string
 *                 description: Used to generate the tenant slug. "Pace Wisdom" becomes "pacewisdom".
 *                 example: Pace Wisdom
 *               gst_no:
 *                 type: string
 *               employee_count:
 *                 type: integer
 *                 example: 10
 *               description:
 *                 type: string
 *                 example: "My tenant organization"
 *               admin_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *             example:
 *               org_name: Pace Wisdom
 *               gst_no: 27AAPFU0939F1ZV
 *               employee_count: 10
 *               description: "My tenant organization"
 *               admin_name: John Doe
 *               email: john@pacewisdom.com
 *               password: Password123!
 *               phone: 9876543210
 *     responses:
 *       '201':
 *         description: Registration successful and under review.
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
 *                     tenant_id:
 *                       type: string
 *                       format: uuid
 *                     organization:
 *                       type: object
 *                       properties:
 *                         org_name:
 *                           type: string
 *                           example: Pace Wisdom
 *                         slug:
 *                           type: string
 *                           example: pacewisdom
 *       '400':
 *         description: Invalid request payload.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '409':
 *         description: Email, GST number, or generated tenant slug already registered.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/register', register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login as an organization admin or superadmin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Successfully authenticated.
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
 *       '400':
 *         description: Missing email or password.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       '401':
 *         description: Invalid credentials.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       '403':
 *         description: Organization not approved or user not active.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 */
router.post('/login', login);

export default router;
