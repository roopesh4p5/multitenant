import { Router } from 'express';
import {
  createField,
  getField,
  listFields,
  removeField,
  updateField,
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
 * components:
 *   schemas:
 *     ValidationRules:
 *       type: object
 *       additionalProperties: true
 *       properties:
 *         minLength:
 *           type: integer
 *           example: 2
 *         maxLength:
 *           type: integer
 *           example: 120
 *         pattern:
 *           type: string
 *           example: "^[A-Za-z ]+$"
 *         min:
 *           type: number
 *           example: 0
 *         max:
 *           type: number
 *           example: 100
 *         integer:
 *           type: boolean
 *           example: true
 *         countryCode:
 *           type: string
 *           example: IN
 *         length:
 *           type: integer
 *           example: 6
 *         allowedDomains:
 *           type: array
 *           items:
 *             type: string
 *           example: [company.com]
 *         blockedDomains:
 *           type: array
 *           items:
 *             type: string
 *         fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/GroupFieldDefinition'
 *         allowMultiple:
 *           type: boolean
 *         minItems:
 *           type: integer
 *         maxItems:
 *           type: integer
 *         options:
 *           type: array
 *           items:
 *             type: string
 *           example: [Engineering, Sales]
 *     GroupFieldDefinition:
 *       type: object
 *       required:
 *         - field_name
 *         - field_type
 *       properties:
 *         field_name:
 *           type: string
 *           example: emergency_contact
 *         field_type:
 *           type: string
 *           enum: [text, number, phone, email, pincode, group, date, dropdown, file]
 *           example: phone
 *         required:
 *           type: boolean
 *           example: true
 *         validation_rules:
 *           $ref: '#/components/schemas/ValidationRules'
 *     SchemaField:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         tenant_id:
 *           type: string
 *           format: uuid
 *         field_name:
 *           type: string
 *           example: personal_email
 *         field_type:
 *           type: string
 *           enum: [text, number, phone, email, pincode, group, date, dropdown, file]
 *           example: email
 *         required:
 *           type: boolean
 *           example: true
 *         display_order:
 *           type: integer
 *           example: 1
 *         active:
 *           type: boolean
 *           example: true
 *         validation_rules:
 *           $ref: '#/components/schemas/ValidationRules'
 *         created_at:
 *           type: string
 *           format: date-time
 *     SchemaFieldInput:
 *       type: object
 *       required:
 *         - field_name
 *         - field_type
 *       properties:
 *         field_name:
 *           type: string
 *           example: personal_email
 *         field_type:
 *           type: string
 *           enum: [text, number, phone, email, pincode, group, date, dropdown, file]
 *           example: email
 *         required:
 *           type: boolean
 *           example: true
 *         display_order:
 *           type: integer
 *           example: 1
 *         active:
 *           type: boolean
 *           example: true
 *         validation_rules:
 *           $ref: '#/components/schemas/ValidationRules'
 */

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
 * /api/schema/fields/{id}:
 *   get:
 *     tags:
 *       - Schema
 *     summary: Get one tenant schema field.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schema field ID.
 *     responses:
 *       '200':
 *         description: Schema field.
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
 *       '404':
 *         description: Schema field not found for this tenant.
 */
router.get('/fields/:id', getField);

/**
 * @openapi
 * /api/schema/fields:
 *   post:
 *     tags:
 *       - Schema
 *     summary: Create a tenant schema field.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SchemaFieldInput'
 *           examples:
 *             emailField:
 *               summary: Email field
 *               value:
 *                 field_name: personal_email
 *                 field_type: email
 *                 required: true
 *                 display_order: 1
 *                 validation_rules:
 *                   allowedDomains: [company.com]
 *             groupField:
 *               summary: Group field
 *               value:
 *                 field_name: emergency_contact
 *                 field_type: group
 *                 required: false
 *                 validation_rules:
 *                   fields:
 *                     - field_name: name
 *                       field_type: text
 *                       required: true
 *                     - field_name: phone
 *                       field_type: phone
 *                       required: true
 *                       validation_rules:
 *                         countryCode: IN
 *                         minLength: 10
 *                         maxLength: 10
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

/**
 * @openapi
 * /api/schema/fields/{id}:
 *   patch:
 *     tags:
 *       - Schema
 *     summary: Update a tenant schema field.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schema field ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SchemaFieldInput'
 *           example:
 *             required: false
 *             active: true
 *             display_order: 2
 *     responses:
 *       '200':
 *         description: Schema field updated.
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
 *       '404':
 *         description: Schema field not found for this tenant.
 *       '409':
 *         description: Duplicate field name for this tenant.
 */
router.patch('/fields/:id', updateField);

/**
 * @openapi
 * /api/schema/fields/{id}:
 *   delete:
 *     tags:
 *       - Schema
 *     summary: Delete a tenant schema field.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schema field ID.
 *     responses:
 *       '204':
 *         description: Schema field deleted.
 *       '404':
 *         description: Schema field not found for this tenant.
 */
router.delete('/fields/:id', removeField);

export default router;
