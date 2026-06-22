'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dynamic_fields', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'tenant_id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      field_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      field_type: {
        type: Sequelize.ENUM(
          'text',
          'number',
          'phone',
          'email',
          'pincode',
          'group',
          'date',
          'dropdown',
          'file'
        ),
        allowNull: false,
      },
      required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      validation_rules: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('dynamic_fields', ['tenant_id', 'field_name'], {
      unique: true,
      name: 'uq_dynamic_fields_tenant_field_name',
    });

    await queryInterface.addIndex('dynamic_fields', ['tenant_id', 'active', 'display_order'], {
      name: 'idx_dynamic_fields_tenant_active_order',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('dynamic_fields');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_dynamic_fields_field_type";');
  },
};
