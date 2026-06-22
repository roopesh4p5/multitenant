import { Request, Response } from 'express';
import { getTenantId } from '../utils/tenant.util';
import {
  createSchemaField,
  deleteSchemaField,
  getSchemaField,
  listSchemaFields,
  updateSchemaField,
} from '../services/schema.service';

const handleSchemaError = (res: Response, err: unknown): void => {
  const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';

  if (message === 'SCHEMA_FIELD_NOT_FOUND') {
    res.status(404).json({ success: false, message: 'Schema field not found' });
    return;
  }

  if (message === 'SCHEMA_FIELD_DUPLICATE') {
    res.status(409).json({
      success: false,
      message: 'A schema field with this name already exists for this tenant',
    });
    return;
  }

  if (
    message === 'TENANT_ACCESS_REQUIRED' ||
    message === 'CROSS_TENANT_ACCESS_DENIED'
  ) {
    res.status(403).json({ success: false, message: 'Tenant access required' });
    return;
  }

  if (
    message.includes('field_') ||
    message.includes('validation_rules') ||
    message.includes('group nesting') ||
    message.includes('must be') ||
    message.includes('cannot be empty')
  ) {
    res.status(400).json({ success: false, message });
    return;
  }

  console.error('[schema]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
};

export const listFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const fields = await listSchemaFields(getTenantId(req));
    res.status(200).json({ success: true, data: fields, count: fields.length });
  } catch (err) {
    handleSchemaError(res, err);
  }
};

export const getField = async (req: Request, res: Response): Promise<void> => {
  try {
    const field = await getSchemaField(getTenantId(req), String(req.params.id));
    res.status(200).json({ success: true, data: field });
  } catch (err) {
    handleSchemaError(res, err);
  }
};

export const createField = async (req: Request, res: Response): Promise<void> => {
  try {
    const field = await createSchemaField(getTenantId(req), req.body);
    res.status(201).json({ success: true, data: field });
  } catch (err) {
    handleSchemaError(res, err);
  }
};

export const updateField = async (req: Request, res: Response): Promise<void> => {
  try {
    const field = await updateSchemaField(getTenantId(req), String(req.params.id), req.body);
    res.status(200).json({ success: true, data: field });
  } catch (err) {
    handleSchemaError(res, err);
  }
};

export const removeField = async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteSchemaField(getTenantId(req), String(req.params.id));
    res.status(204).send();
  } catch (err) {
    handleSchemaError(res, err);
  }
};
