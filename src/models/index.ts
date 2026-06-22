/**
 * models/index.ts — Central model registry and association hub.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 * 1. Initializing all Sequelize models (calling model.initModel(sequelize))
 * 2. Defining all model associations (prevents circular import issues)
 * 3. Exporting all models for use across the application
 *
 * Import order matters — models with no FKs must be initialized before models
 * that reference them. The order below follows dependency depth:
 *   Layer 0 (no deps):   Permission, Organization
 *   Layer 1 (deps L0):   Role, DynamicField
 *   Layer 2 (deps L1):   RolePermission, User
 *   Layer 3 (deps L2):   Invitation, EmployeeProfile, ApprovalHistory
 *   Layer 4 (deps L3):   FieldValue
 */

import { sequelize } from '../config/dbconfig';

import { Permission } from './permission.model';
import { Organization } from './organization.model';
import { Role } from './role.model';
import { RolePermission } from './role-permission.model';
import { DynamicField } from './dynamic-field.model';
import { User } from './user.model';
import { Invitation } from './invitation.model';
import { EmployeeProfile } from './employee-profile.model';
import { FieldValue } from './field-value.model';
import { ApprovalHistory } from './approval-history.model';

// ─── 1. INITIALIZE ALL MODELS ──────────────────────────────────────────────

Permission.initModel(sequelize);
Organization.initModel(sequelize);
Role.initModel(sequelize);
RolePermission.initModel(sequelize);
DynamicField.initModel(sequelize);
User.initModel(sequelize);
Invitation.initModel(sequelize);
EmployeeProfile.initModel(sequelize);
FieldValue.initModel(sequelize);
ApprovalHistory.initModel(sequelize);

// ─── 2. DEFINE ALL ASSOCIATIONS ───────────────────────────────────────────
//
// Association strategy:
//   - BelongsTo  → adds FK to the calling model (source has the FK column)
//   - HasOne/HasMany → reverse of BelongsTo (no FK added, just the query helper)
//   - BelongsToMany → through a junction model
//
// All associations are defined here to avoid circular imports between model files.

// ── RBAC ──────────────────────────────────────────────────────────────────

// Role ↔ Permission (many-to-many via RolePermission)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles',
});

// RolePermission direct associations (for include queries on the junction)
RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
Role.hasMany(RolePermission, { foreignKey: 'role_id', as: 'rolePermissions' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id', as: 'rolePermissions' });

// ── USER & ROLE ───────────────────────────────────────────────────────────

// A user belongs to one role
User.belongsTo(Role, {
  foreignKey: 'role_id',
  as: 'role',
  // role_id SET NULL on delete is defined in the model — no cascade here
});
// A role can have many users
Role.hasMany(User, {
  foreignKey: 'role_id',
  as: 'users',
});

// ── INVITATIONS ───────────────────────────────────────────────────────────

// Invitation → Role (what role will the invitee receive)
Invitation.belongsTo(Role, {
  foreignKey: 'role_id',
  as: 'invitedRole',
});
Role.hasMany(Invitation, {
  foreignKey: 'role_id',
  as: 'invitations',
});

// Invitation → User (who sent the invite)
Invitation.belongsTo(User, {
  foreignKey: 'invited_by',
  as: 'inviter',
});
User.hasMany(Invitation, {
  foreignKey: 'invited_by',
  as: 'sentInvitations',
});

// ── ORGANIZATION & DYNAMIC FIELDS ─────────────────────────────────────────

// Organization → DynamicFields (one org defines many dynamic fields)
Organization.hasMany(DynamicField, {
  foreignKey: 'tenant_id',       // joined on tenant_id (not org.id)
  sourceKey: 'tenant_id',
  as: 'dynamicFields',
});
DynamicField.belongsTo(Organization, {
  foreignKey: 'tenant_id',
  targetKey: 'tenant_id',
  as: 'organization',
});

// Organization → Roles
Organization.hasMany(Role, {
  foreignKey: 'tenant_id',
  sourceKey: 'tenant_id',
  as: 'roles',
});
Role.belongsTo(Organization, {
  foreignKey: 'tenant_id',
  targetKey: 'tenant_id',
  as: 'organization',
});

// Organization → Invitations
Organization.hasMany(Invitation, {
  foreignKey: 'tenant_id',
  sourceKey: 'tenant_id',
  as: 'invitations',
});
Invitation.belongsTo(Organization, {
  foreignKey: 'tenant_id',
  targetKey: 'tenant_id',
  as: 'organization',
});

// Organization → Users
Organization.hasMany(User, {
  foreignKey: 'tenant_id',
  sourceKey: 'tenant_id',
  as: 'users',
});
User.belongsTo(Organization, {
  foreignKey: 'tenant_id',
  targetKey: 'tenant_id',
  as: 'organization',
});

// ── EMPLOYEE PROFILE ──────────────────────────────────────────────────────

// User → EmployeeProfile (one-to-one)
User.hasOne(EmployeeProfile, {
  foreignKey: 'user_id',
  as: 'employeeProfile',
});
EmployeeProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// EmployeeProfile → User (approver — self-referential via different alias)
EmployeeProfile.belongsTo(User, {
  foreignKey: 'approved_by',
  as: 'approver',
});
User.hasMany(EmployeeProfile, {
  foreignKey: 'approved_by',
  as: 'approvedProfiles',
});

// ── FIELD VALUES ──────────────────────────────────────────────────────────

// EmployeeProfile → FieldValues (one profile has many field values)
EmployeeProfile.hasMany(FieldValue, {
  foreignKey: 'employee_id',
  as: 'fieldValues',
});
FieldValue.belongsTo(EmployeeProfile, {
  foreignKey: 'employee_id',
  as: 'employeeProfile',
});

// DynamicField → FieldValues (one field schema has many stored values)
DynamicField.hasMany(FieldValue, {
  foreignKey: 'field_id',
  as: 'fieldValues',
});
FieldValue.belongsTo(DynamicField, {
  foreignKey: 'field_id',
  as: 'field',
});

// ── APPROVAL HISTORY ─────────────────────────────────────────────────────

// User → ApprovalHistory (user is the subject of approvals)
User.hasMany(ApprovalHistory, {
  foreignKey: 'user_id',
  as: 'approvalHistory',
});
ApprovalHistory.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'subject',
});

// ApprovalHistory → User (performed_by — the admin actor)
ApprovalHistory.belongsTo(User, {
  foreignKey: 'performed_by',
  as: 'actor',
});
User.hasMany(ApprovalHistory, {
  foreignKey: 'performed_by',
  as: 'performedApprovals',
});

// ─── 3. EXPORTS ───────────────────────────────────────────────────────────

export {
  Permission,
  Organization,
  Role,
  RolePermission,
  DynamicField,
  User,
  Invitation,
  EmployeeProfile,
  FieldValue,
  ApprovalHistory,
};

// Re-export enums for convenience
export { OrgStatus } from './organization.model';
export { UserStatus } from './user.model';
export { InvitationStatus } from './invitation.model';
export { DynamicFieldType } from './dynamic-field.model';
export { ApprovalAction } from './approval-history.model';
export type { ValidationRules } from './dynamic-field.model';
