const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user and create tenant automatically
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('tenantName').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, tenantName } = req.body;

      // Check if user already exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Generate slug from tenant name
      const slug = tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if tenant with this slug or email already exists
      const existingTenant = await Tenant.findOne({ $or: [{ slug }, { email }] });
      if (existingTenant) {
        return res.status(400).json({
          message: 'Tenant with this name or email already exists. Please choose a different name.',
        });
      }

      // Create tenant
      const tenant = await Tenant.create({
        name: tenantName,
        slug,
        email,
        status: 'active',
      });

      // Create default roles for the tenant
      const defaultRoles = [
        { name: 'Manager', level: 10, isSystemRole: true },
        { name: 'Leader', level: 8, isSystemRole: true },
        { name: 'Senior Agent', level: 6, isSystemRole: true },
        { name: 'Agent', level: 4, isSystemRole: true },
        { name: 'Associate', level: 2, isSystemRole: true },
        { name: 'Intern', level: 1, isSystemRole: true },
      ];

      const getDefaultPermissions = (level) => {
        return {
          comments: { view: level >= 2, reply: level >= 4, delete: level >= 8, moderate: level >= 10 },
          leads: { view: level >= 2, create: level >= 4, update: level >= 6, delete: level >= 10 },
          team: { view: level >= 6, invite: level >= 8, remove: level >= 10, manageRoles: level >= 10 },
          settings: { view: level >= 8, update: level >= 10 },
          analytics: { view: level >= 4 },
        };
      };

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
      const managerRole = createdRoles.find((r) => r.name === 'Manager');

      // Create tenant admin user
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
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

      const token = generateToken(user._id);

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          tenants: user.tenants,
        },
        tenant: {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is inactive' });
      }

      user.lastLogin = Date.now();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          tenants: user.tenants,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('tenants.tenant', 'name slug')
      .populate('tenants.role', 'name level permissions')
      .select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

