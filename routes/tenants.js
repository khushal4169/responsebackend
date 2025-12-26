const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Role = require('../models/Role');
const { protect, requireSuperAdmin, requireTenantAdmin } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');

// @route   POST /api/tenants
// @desc    Create a new tenant (Super Admin only) - Also creates tenant admin user
router.post(
  '/',
  protect,
  requireSuperAdmin,
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('slug').optional().trim().matches(/^[a-z0-9-]+$/),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        slug,
        email,
        password,
        firstName,
        lastName,
      } = req.body;

      // Generate slug from name if not provided
      let tenantSlug = slug;
      if (!tenantSlug) {
        tenantSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Check if tenant already exists
      const existingTenant = await Tenant.findOne({ $or: [{ slug: tenantSlug }, { email }] });
      if (existingTenant) {
        return res.status(400).json({ message: 'Tenant with this name or email already exists' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Create tenant
      const tenant = await Tenant.create({ name, slug: tenantSlug, email });

      // Create default roles for the tenant
      const defaultRoles = [
        { name: 'Manager', level: 10, isSystemRole: true },
        { name: 'Leader', level: 8, isSystemRole: true },
        { name: 'Senior Agent', level: 6, isSystemRole: true },
        { name: 'Agent', level: 4, isSystemRole: true },
        { name: 'Associate', level: 2, isSystemRole: true },
        { name: 'Intern', level: 1, isSystemRole: true },
      ];

      const createdRoles = [];
      for (const roleData of defaultRoles) {
        const role = await Role.create({
          tenant: tenant._id,
          ...roleData,
          permissions: getDefaultPermissions(roleData.level),
        });
        createdRoles.push(role);
      }

      // Find Manager role (highest level) for tenant admin
      const managerRole = createdRoles.find(r => r.name === 'Manager');

      // Create tenant admin user
      const tenantAdminPassword = password || 'TempPassword123!'; // Default password if not provided
      const tenantAdminFirstName = firstName || name.split(' ')[0] || 'Admin';
      const tenantAdminLastName = lastName || name.split(' ').slice(1).join(' ') || 'User';

      const tenantAdmin = await User.create({
        email,
        password: tenantAdminPassword,
        firstName: tenantAdminFirstName,
        lastName: tenantAdminLastName,
        userType: 'tenant_admin',
        tenants: [
          {
            tenant: tenant._id,
            role: managerRole._id,
            status: 'active',
          },
        ],
        isActive: true,
      });

      res.status(201).json({
        tenant,
        tenantAdmin: {
          id: tenantAdmin._id,
          email: tenantAdmin.email,
          firstName: tenantAdmin.firstName,
          lastName: tenantAdmin.lastName,
          userType: tenantAdmin.userType,
          password: tenantAdminPassword, // Return password so super admin can share it
        },
        message: 'Tenant and Tenant Admin created successfully',
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/tenants
// @desc    Get all tenants (Super Admin) or user's tenants
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.userType === 'super_admin') {
      const tenants = await Tenant.find().sort({ createdAt: -1 });
      return res.json(tenants);
    } else {
      const user = await User.findById(req.user.id).populate('tenants.tenant');
      const tenants = user.tenants
        .filter(t => t.status === 'active')
        .map(t => t.tenant);
      return res.json(tenants);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/tenants/:tenantId
// @desc    Get tenant by ID
router.get('/:tenantId', protect, requireTenant, async (req, res) => {
  try {
    res.json(req.tenant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/tenants/:tenantId
// @desc    Update tenant (Tenant Admin or Super Admin)
router.put('/:tenantId', protect, async (req, res) => {
  try {
    // Super admin can update without tenant membership check
    if (req.user.userType !== 'super_admin') {
      // For non-super-admin, check tenant membership and admin rights
      const tenantId = req.params.tenantId;
      const tenantMembership = req.user.tenants.find(
        t => t.tenant.toString() === tenantId.toString() && t.status === 'active'
      );

      if (!tenantMembership) {
        return res.status(403).json({ message: 'Not a member of this tenant' });
      }

      if (req.user.userType !== 'tenant_admin') {
        return res.status(403).json({ message: 'Access denied. Tenant admin required.' });
      }
    }

    const updates = req.body;
    delete updates._id;
    // Only super admin can change slug
    if (req.user.userType !== 'super_admin') {
      delete updates.slug;
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.tenantId,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function for default permissions
function getDefaultPermissions(level) {
  const basePermissions = {
    comments: { view: level >= 2, reply: level >= 4, delete: level >= 8, moderate: level >= 10 },
    leads: { view: level >= 2, create: level >= 4, update: level >= 6, delete: level >= 10 },
    team: { view: level >= 6, invite: level >= 8, remove: level >= 10, manageRoles: level >= 10 },
    settings: { view: level >= 8, update: level >= 10 },
    analytics: { view: level >= 4 },
  };
  return basePermissions;
}

module.exports = router;

