'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('approval_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      action: {
        type: Sequelize.ENUM('approved', 'rejected', 'pending'),
        allowNull: false,
      },
      performed_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('approval_history', ['user_id', 'created_at'], {
      name: 'idx_approval_history_user_created',
    });
    await queryInterface.addIndex('approval_history', ['performed_by'], {
      name: 'idx_approval_history_performed_by',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('approval_history');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_approval_history_action";');
  },
};
