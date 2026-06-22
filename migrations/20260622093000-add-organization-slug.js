'use strict';

const createSlug = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 63);

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('organizations', 'slug', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });

    const [organizations] = await queryInterface.sequelize.query(
      'SELECT id, org_name FROM organizations ORDER BY id ASC'
    );

    const usedSlugs = new Set();

    for (const org of organizations) {
      const baseSlug = createSlug(org.org_name) || `tenant${org.id}`;
      let slug = baseSlug;
      let suffix = 2;

      while (usedSlugs.has(slug)) {
        const suffixText = String(suffix);
        slug = `${baseSlug.slice(0, 63 - suffixText.length)}${suffixText}`;
        suffix += 1;
      }

      usedSlugs.add(slug);

      await queryInterface.sequelize.query(
        'UPDATE organizations SET slug = :slug WHERE id = :id',
        { replacements: { slug, id: org.id } }
      );
    }

    await queryInterface.changeColumn('organizations', 'slug', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });

    await queryInterface.addIndex('organizations', ['slug'], {
      unique: true,
      name: 'uq_organizations_slug',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('organizations', 'uq_organizations_slug');
    await queryInterface.removeColumn('organizations', 'slug');
  },
};
