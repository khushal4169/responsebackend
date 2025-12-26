const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Comment = require('../models/Comment');
const { protect } = require('../middleware/auth');
const { requireTenant, isolateTenantData } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// @route   GET /api/tenants/:tenantId/leads
// @desc    Get all leads for a tenant (filtered by agent if not admin)
router.get(
  '/:tenantId/leads',
  protect,
  requireTenant,
  isolateTenantData,
  checkPermission('leads', 'view'),
  async (req, res) => {
    try {
      const { status, priority, source, page = 1, limit = 20, myLeads = false } = req.query;
      const query = { tenant: req.tenantId };

      // If user is an agent (not super_admin or tenant_admin), filter by assignedTo
      if (req.user.userType === 'agent' || myLeads === 'true') {
        query.assignedTo = req.user.id;
      }

      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (source) query.source = source;

      const leads = await Lead.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) || 20)
        .skip((parseInt(page) - 1) * (parseInt(limit) || 20))
        .populate('assignedTo', 'firstName lastName email')
        .populate('commentId')
        .lean();

      const total = await Lead.countDocuments(query);

      res.json({
        leads,
        totalPages: Math.ceil(total / (parseInt(limit) || 20)),
        currentPage: parseInt(page) || 1,
        total,
      });
    } catch (error) {
      console.error('Get leads error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/tenants/:tenantId/leads/:leadId
// @desc    Get a single lead
router.get(
  '/:tenantId/leads/:leadId',
  protect,
  requireTenant,
  checkPermission('leads', 'view'),
  async (req, res) => {
    try {
      const lead = await Lead.findOne({
        _id: req.params.leadId,
        tenant: req.tenantId,
      })
        .populate('assignedTo', 'firstName lastName email')
        .populate('commentId');

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/leads
// @desc    Create a new lead
router.post(
  '/:tenantId/leads',
  protect,
  requireTenant,
  checkPermission('leads', 'create'),
  async (req, res) => {
    try {
      const { commentId, name, email, phone, username, status, priority, metadata } = req.body;

      const leadData = {
        tenant: req.tenantId,
        source: commentId ? 'instagram' : 'manual',
        commentId,
        name,
        email,
        phone,
        username,
        status: status || 'new',
        priority: priority || 'medium',
        metadata,
      };

      const lead = await Lead.create(leadData);

      // Update comment if linked
      if (commentId) {
        await Comment.findByIdAndUpdate(commentId, {
          isLead: true,
          leadId: lead._id,
        });
      }

      res.status(201).json(lead);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/tenants/:tenantId/leads/:leadId
// @desc    Update a lead
router.put(
  '/:tenantId/leads/:leadId',
  protect,
  requireTenant,
  checkPermission('leads', 'update'),
  async (req, res) => {
    try {
      const { status, priority, assignedTo, score, tags, notes } = req.body;
      const lead = await Lead.findOne({
        _id: req.params.leadId,
        tenant: req.tenantId,
      });

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      if (status) lead.status = status;
      if (priority) lead.priority = priority;
      if (assignedTo) lead.assignedTo = assignedTo;
      if (score !== undefined) lead.score = score;
      if (tags) lead.tags = tags;
      if (notes) {
        lead.notes.push({
          text: notes,
          createdBy: req.user.id,
        });
      }

      await lead.save();

      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/tenants/:tenantId/leads/:leadId
// @desc    Delete a lead
router.delete(
  '/:tenantId/leads/:leadId',
  protect,
  requireTenant,
  checkPermission('leads', 'delete'),
  async (req, res) => {
    try {
      const lead = await Lead.findOne({
        _id: req.params.leadId,
        tenant: req.tenantId,
      });

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      await lead.deleteOne();

      res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

