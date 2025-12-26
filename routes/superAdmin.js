const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Comment = require('../models/Comment');
const Lead = require('../models/Lead');
const Role = require('../models/Role');
const { protect, requireSuperAdmin } = require('../middleware/auth');

// All routes require super admin
router.use(protect);
router.use(requireSuperAdmin);

// ==================== TENANT MANAGEMENT ====================

// @route   DELETE /api/super-admin/tenants/:tenantId
// @desc    Delete a tenant (Super Admin only)
router.delete('/tenants/:tenantId', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    await Tenant.findByIdAndDelete(req.params.tenantId);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/super-admin/tenants/:tenantId
// @desc    Update any tenant (Super Admin can update all fields)
router.put('/tenants/:tenantId', async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id;

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

// ==================== USER/AGENT MANAGEMENT ====================

// @route   GET /api/super-admin/users
// @desc    Get all users across all tenants (Super Admin)
router.get('/users', async (req, res) => {
  try {
    const { tenantId, userType, isActive } = req.query;
    const query = {};

    if (tenantId) {
      query['tenants.tenant'] = tenantId;
    }
    if (userType) {
      query.userType = userType;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const users = await User.find(query)
      .select('-password')
      .populate('tenants.tenant', 'name slug')
      .populate('tenants.role', 'name level')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/super-admin/tenants/:tenantId/users
// @desc    Get all agents/users for a specific tenant
router.get('/tenants/:tenantId/users', async (req, res) => {
  try {
    const users = await User.find({
      'tenants.tenant': req.params.tenantId,
    })
      .select('-password')
      .populate('tenants.role', 'name level permissions')
      .sort({ createdAt: -1 });

    // Filter to show only relevant tenant info
    const formattedUsers = users.map(user => {
      const tenantMembership = user.tenants.find(
        t => t.tenant.toString() === req.params.tenantId.toString()
      );
      return {
        ...user.toObject(),
        tenantMembership,
      };
    });

    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/super-admin/users/:userId
// @desc    Update any user (Super Admin)
router.put('/users/:userId', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, isActive, userType } = req.body;
    
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;
    if (userType) updates.userType = userType;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/super-admin/users/:userId
// @desc    Delete a user (Super Admin)
router.delete('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== COMMENTS MANAGEMENT ====================

// @route   GET /api/super-admin/comments
// @desc    Get all comments across all tenants (Super Admin)
router.get('/comments', async (req, res) => {
  try {
    const {
      tenantId,
      status,
      sentiment,
      platform,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};
    if (tenantId) query.tenant = tenantId;
    if (status) query.status = status;
    if (sentiment) query.sentiment = sentiment;
    if (platform) query.platform = platform;

    const comments = await Comment.find(query)
      .populate('tenant', 'name slug')
      .populate('assignedTo', 'firstName lastName email')
      .populate('leadId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/super-admin/tenants/:tenantId/comments
// @desc    Get all comments for a specific tenant
router.get('/tenants/:tenantId/comments', async (req, res) => {
  try {
    const { status, sentiment, platform, page = 1, limit = 50 } = req.query;
    const query = { tenant: req.params.tenantId };

    if (status) query.status = status;
    if (sentiment) query.sentiment = sentiment;
    if (platform) query.platform = platform;

    const comments = await Comment.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('leadId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== LEADS MANAGEMENT ====================

// @route   GET /api/super-admin/leads
// @desc    Get all leads across all tenants (Super Admin)
router.get('/leads', async (req, res) => {
  try {
    const {
      tenantId,
      status,
      priority,
      source,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};
    if (tenantId) query.tenant = tenantId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (source) query.source = source;

    const leads = await Lead.find(query)
      .populate('tenant', 'name slug')
      .populate('assignedTo', 'firstName lastName email')
      .populate('commentId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/super-admin/tenants/:tenantId/leads
// @desc    Get all leads for a specific tenant
router.get('/tenants/:tenantId/leads', async (req, res) => {
  try {
    const { status, priority, source, page = 1, limit = 50 } = req.query;
    const query = { tenant: req.params.tenantId };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (source) query.source = source;

    const leads = await Lead.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('commentId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ANALYTICS & STATS ====================

// @route   GET /api/super-admin/stats
// @desc    Get platform-wide statistics (Super Admin)
router.get('/stats', async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    const totalComments = await Comment.countDocuments();
    const newComments = await Comment.countDocuments({ status: 'new' });
    const repliedComments = await Comment.countDocuments({ isReplied: true });

    const totalLeads = await Lead.countDocuments();
    const newLeads = await Lead.countDocuments({ status: 'new' });
    const qualifiedLeads = await Lead.countDocuments({ status: 'qualified' });

    // Sentiment breakdown
    const sentimentStats = await Comment.aggregate([
      {
        $group: {
          _id: '$sentiment',
          count: { $sum: 1 },
        },
      },
    ]);

    // Platform breakdown
    const platformStats = await Comment.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
        },
      },
    ]);

    // Tenant stats
    const tenantStats = await Tenant.aggregate([
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'tenant',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'tenant',
          as: 'leads',
        },
      },
      {
        $project: {
          name: 1,
          slug: 1,
          status: 1,
          plan: 1,
          commentCount: { $size: '$comments' },
          leadCount: { $size: '$leads' },
        },
      },
      { $sort: { commentCount: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      tenants: {
        total: totalTenants,
        active: activeTenants,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      comments: {
        total: totalComments,
        new: newComments,
        replied: repliedComments,
        sentiment: sentimentStats,
        platform: platformStats,
      },
      leads: {
        total: totalLeads,
        new: newLeads,
        qualified: qualifiedLeads,
      },
      topTenants: tenantStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;


