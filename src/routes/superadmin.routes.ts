import { Router } from 'express';
import { listOrgs, approveOrg } from '../controllers/superadmin.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireSuperAdmin);

/**
 * @openapi
 * /api/superadmin/orgs:
 *   get:
 *     tags:
 *       - SuperAdmin
 *     summary: List organizations available for superadmin review.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, all]
 *         description: Filter organizations by status. Defaults to inactive.
 *     responses:
 *       '200':
 *         description: List of organizations.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *                   example: 1
 */
router.get('/orgs', listOrgs);

/**
 * @openapi
 * /api/superadmin/orgs/{id}/approve:
 *   patch:
 *     tags:
 *       - SuperAdmin
 *     summary: Approve or reject a pending organization by its numeric org record ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization UUID (`tenant_id`) from registration response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               remarks:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Organization review completed.
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
 *         description: Invalid request data.
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
 *       '404':
 *         description: Organization not found.
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
router.patch('/orgs/:id/approve', approveOrg);

export default router;
