const express = require('express');
const router = express.Router();
const InboxItem = require('../models/InboxItem');
const { protect } = require('../middleware/auth');
const { requireTenant, isolateTenantData } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// GET /api/tenants/:tenantId/inbox
// Unified inbox listing with filters
router.get(
  '/:tenantId/inbox',
  protect,
  requireTenant,
  isolateTenantData,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const {
        type,
        platform,
        read,
        urgency,
        status,
        assignedTo,
        mine = false,
        page = 1,
        limit = 20,
      } = req.query;

      const query = { tenant: req.tenantId };

      if (type) query.type = type;
      if (platform) query.platform = platform;
      if (urgency) query.urgency = urgency;
      if (status) query.status = status;
      if (read === 'true') query.read = true;
      if (read === 'false') query.read = false;

      if (assignedTo) {
        query.assignedTo = assignedTo;
      } else if (mine === 'true' && req.user) {
        query.assignedTo = req.user.id;
      }

      const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

      const [items, total] = await Promise.all([
        InboxItem.find(query)
          .sort({ createdAt: -1 })
          .limit(parsedLimit)
          .skip((parsedPage - 1) * parsedLimit)
          .populate('assignedTo', 'firstName lastName email')
          .lean(),
        InboxItem.countDocuments(query),
      ]);

      res.json({
        items,
        total,
        totalPages: Math.ceil(total / parsedLimit),
        currentPage: parsedPage,
      });
    } catch (error) {
      console.error('Inbox list error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// PATCH /api/tenants/:tenantId/inbox/:itemId/read
router.patch(
  '/:tenantId/inbox/:itemId/read',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { read = true } = req.body;
      const item = await InboxItem.findOneAndUpdate(
        { _id: req.params.itemId, tenant: req.tenantId },
        { read: !!read, updatedAt: Date.now() },
        { new: true }
      );

      if (!item) {
        return res.status(404).json({ message: 'Inbox item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// PATCH /api/tenants/:tenantId/inbox/:itemId/assign
router.patch(
  '/:tenantId/inbox/:itemId/assign',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { userId } = req.body;
      const assignee = userId || req.user.id;

      const item = await InboxItem.findOneAndUpdate(
        { _id: req.params.itemId, tenant: req.tenantId },
        { assignedTo: assignee, updatedAt: Date.now() },
        { new: true }
      ).populate('assignedTo', 'firstName lastName email');

      if (!item) {
        return res.status(404).json({ message: 'Inbox item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// POST /api/tenants/:tenantId/inbox/seed (placeholder to create sample data)
router.post(
  '/:tenantId/inbox/seed',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const sample = await InboxItem.create({
        tenant: req.tenantId,
        type: req.body.type || 'comment',
        platform: req.body.platform || 'instagram',
        messageText: req.body.messageText || 'Sample message placeholder',
        author: req.body.author || { name: 'Sample User', username: 'sample' },
        read: false,
        status: 'open',
        urgency: 'medium',
      });
      res.status(201).json(sample);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

