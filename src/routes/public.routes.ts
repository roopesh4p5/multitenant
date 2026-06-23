import { Router } from 'express';
import { tenantBootstrap } from '../controllers/public.controller';

const router = Router();

/**
 * @openapi
 * /api/public/bootstrap:
 *   get:
 *     tags:
 *       - Public
 *     summary: Resolve tenant by subdomain or slug and return registration bootstrap data.
 *     description: |
 *       Use this from tenant-specific frontend URLs in local development.
 *     parameters:
 *       - in: query
 *         name: tenant
 *         required: false
 *         schema:
 *           type: string
 *           example: pacewisdom
 *         description: Optional tenant slug override for local development.
 *     responses:
 *       '200':
 *         description: Tenant bootstrap data.
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
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         tenant_id:
 *                           type: string
 *                           format: uuid
 *                         org_name:
 *                           type: string
 *                           example: Pace Wisdom
 *                         slug:
 *                           type: string
 *                           example: pacewisdom
 *                     schema_fields:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SchemaField'
 *       '400':
 *         description: Tenant slug could not be resolved.
 *       '404':
 *         description: Tenant not found or inactive.
 */
router.get('/bootstrap', tenantBootstrap);

export default router;
