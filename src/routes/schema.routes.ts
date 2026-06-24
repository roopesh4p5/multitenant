import { Router } from 'express';
import {
  createField,
  listFields,
} from '../controllers/schema.controller';
import {
  authenticate,
  requireTenant,
  restrictTenantAccess,
} from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireTenant, restrictTenantAccess);

/**
 * @openapi
 * /api/schema/fields:
 *   get:
 *     tags:
 *       - Schema
 *     summary: List tenant schema fields.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Tenant schema fields.
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
 *                     $ref: '#/components/schemas/SchemaField'
 *                 count:
 *                   type: integer
 *                   example: 2
 *       '401':
 *         description: Missing or invalid token.
 *       '403':
 *         description: Tenant access required.
 */
router.get('/fields', listFields);


/**
 * @openapi
 * /api/schema/fields:
 *   post:
 *     tags:
 *       - Schema
 *     summary: Create tenant schema fields (bulk).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/SchemaFieldInput'
 *           examples:
 *             bulkSchema:
 *               summary: Create full tenant signup schema
 *               value:
 *                 - field_name: personal_email
 *                   field_type: email
 *                   required: true
 *                   display_order: 1
 *                   validation_rules:
 *                     allowedDomains: [company.com]
 *                 - field_name: gender
 *                   field_type: dropdown
 *                   required: true
 *                   display_order: 2
 *                   validation_rules:
 *                     options: [Male, Female, Other]
 *     responses:
 *       '201':
 *         description: Schema field created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SchemaField'
 *       '400':
 *         description: Invalid field payload.
 *       '409':
 *         description: Duplicate field name for this tenant.
 */
router.post('/fields', createField);


export default router;
