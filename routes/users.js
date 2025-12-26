const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const { protect, requireSuperAdmin, requireTenantAdmin } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// @route   GET /api/tenants/:tenantId/users
// @desc    Get all users in a tenant
router.get(
  '/:tenantId/users',
  protect,
  requireTenant,
  checkPermission('team', 'view'),
  async (req, res) => {
    try {
      const users = await User.find({
        'tenants.tenant': req.tenantId,
        'tenants.status': 'active',
      })
        .select('-password')
        .populate('tenants.role', 'name level')
        .lean();

      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/users
// @desc    Create a new agent/user for tenant
router.post(
  '/:tenantId/users',
  protect,
  requireTenant,
  requireTenantAdmin,
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, roleId } = req.body;

      // Check if user already exists
      let user = await User.findOne({ email });

      if (user) {
        // User exists, check if already member
        const existingMembership = user.tenants.find(
          t => t.tenant.toString() === req.tenantId.toString()
        );

        if (existingMembership && existingMembership.status === 'active') {
          return res.status(400).json({ message: 'User is already a member of this tenant' });
        }

        // Add tenant membership
        if (existingMembership) {
          existingMembership.status = 'active';
          existingMembership.role = roleId;
        } else {
          user.tenants.push({
            tenant: req.tenantId,
            role: roleId,
            status: 'active',
          });
        }
        await user.save();
      } else {
        // Create new user
        if (!password) {
          return res.status(400).json({ message: 'Password is required for new users' });
        }

        user = await User.create({
          email,
          password,
          firstName,
          lastName,
          phone,
          userType: 'agent',
          tenants: [
            {
              tenant: req.tenantId,
              role: roleId,
              status: 'active',
            },
          ],
          isActive: true,
        });
      }

      const populatedUser = await User.findById(user._id)
        .select('-password')
        .populate('tenants.role', 'name level');

      res.status(201).json({
        message: 'Agent created/invited successfully',
        user: populatedUser,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/users/invite
// @desc    Invite an existing user to tenant
router.post(
  '/:tenantId/users/invite',
  protect,
  requireTenant,
  requireTenantAdmin,
  async (req, res) => {
    try {
      const { userId, roleId } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is already a member
      const existingMembership = user.tenants.find(
        t => t.tenant.toString() === req.tenantId.toString()
      );

      if (existingMembership) {
        if (existingMembership.status === 'active') {
          return res.status(400).json({ message: 'User is already a member' });
        }
        existingMembership.status = 'active';
        existingMembership.role = roleId;
      } else {
        user.tenants.push({
          tenant: req.tenantId,
          role: roleId,
          status: 'active',
        });
      }

      await user.save();

      res.json({ message: 'User invited successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/tenants/:tenantId/users/:userId/role
// @desc    Update user role in tenant
router.put(
  '/:tenantId/users/:userId/role',
  protect,
  requireTenant,
  requireTenantAdmin,
  async (req, res) => {
    try {
      const { roleId } = req.body;

      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const tenantMembership = user.tenants.find(
        t => t.tenant.toString() === req.tenantId.toString()
      );

      if (!tenantMembership) {
        return res.status(404).json({ message: 'User is not a member of this tenant' });
      }

      tenantMembership.role = roleId;
      await user.save();

      res.json({ message: 'User role updated successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/tenants/:tenantId/users/:userId
// @desc    Remove user from tenant
router.delete(
  '/:tenantId/users/:userId',
  protect,
  requireTenant,
  requireTenantAdmin,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const tenantMembership = user.tenants.find(
        t => t.tenant.toString() === req.tenantId.toString()
      );

      if (!tenantMembership) {
        return res.status(404).json({ message: 'User is not a member of this tenant' });
      }

      tenantMembership.status = 'inactive';
      await user.save();

      res.json({ message: 'User removed from tenant successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

