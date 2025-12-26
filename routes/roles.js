const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const { protect } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// @route   GET /api/tenants/:tenantId/roles
// @desc    Get all roles for a tenant
router.get(
  '/:tenantId/roles',
  protect,
  requireTenant,
  checkPermission('team', 'view'),
  async (req, res) => {
    try {
      const roles = await Role.find({
        tenant: req.tenantId,
        isActive: true,
      }).sort({ level: -1 });

      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/roles
// @desc    Create a new role for a tenant
router.post(
  '/:tenantId/roles',
  protect,
  requireTenant,
  checkPermission('team', 'manageRoles'),
  async (req, res) => {
    try {
      const { name, level, permissions } = req.body;

      const existingRole = await Role.findOne({
        tenant: req.tenantId,
        name,
      });

      if (existingRole) {
        return res.status(400).json({ message: 'Role with this name already exists' });
      }

      const role = await Role.create({
        tenant: req.tenantId,
        name,
        level,
        permissions,
        isSystemRole: false,
      });

      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/tenants/:tenantId/roles/:roleId
// @desc    Update a role
router.put(
  '/:tenantId/roles/:roleId',
  protect,
  requireTenant,
  checkPermission('team', 'manageRoles'),
  async (req, res) => {
    try {
      const { name, level, permissions, isActive } = req.body;

      const role = await Role.findOne({
        _id: req.params.roleId,
        tenant: req.tenantId,
      });

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      if (role.isSystemRole) {
        // System roles can only have permissions updated
        if (permissions) {
          role.permissions = { ...role.permissions, ...permissions };
        }
      } else {
        if (name) role.name = name;
        if (level !== undefined) role.level = level;
        if (permissions) role.permissions = permissions;
      }

      if (isActive !== undefined) role.isActive = isActive;

      await role.save();

      res.json(role);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/tenants/:tenantId/roles/:roleId
// @desc    Delete a role (only custom roles)
router.delete(
  '/:tenantId/roles/:roleId',
  protect,
  requireTenant,
  checkPermission('team', 'manageRoles'),
  async (req, res) => {
    try {
      const role = await Role.findOne({
        _id: req.params.roleId,
        tenant: req.tenantId,
      });

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      if (role.isSystemRole) {
        return res.status(400).json({ message: 'Cannot delete system role' });
      }

      role.isActive = false;
      await role.save();

      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;


