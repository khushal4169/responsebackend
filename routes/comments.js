const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Tenant = require('../models/Tenant');
const InstagramService = require('../services/instagramService');
const FacebookService = require('../services/facebookService');
const { generateAIReply } = require('../services/aiReply');
const { protect } = require('../middleware/auth');
const { requireTenant, isolateTenantData } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// @route   GET /api/tenants/:tenantId/comments
// @desc    Get all comments for a tenant (filtered by agent if not admin)
router.get(
  '/:tenantId/comments',
  protect,
  requireTenant,
  isolateTenantData,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { status, sentiment, platform, page = 1, limit = 20, myComments = false } = req.query;
      const query = { tenant: req.tenantId };

      // If user is an agent (not super_admin or tenant_admin), filter by assignedTo
      if (req.user.userType === 'agent' || myComments === 'true') {
        query.assignedTo = req.user.id;
      }

      if (status) query.status = status;
      if (sentiment) query.sentiment = sentiment;
      if (platform) query.platform = platform;

      const comments = await Comment.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) || 20)
        .skip((parseInt(page) - 1) * (parseInt(limit) || 20))
        .populate('assignedTo', 'firstName lastName email')
        .populate('leadId')
        .lean();

      const total = await Comment.countDocuments(query);

      res.json({
        comments,
        totalPages: Math.ceil(total / (parseInt(limit) || 20)),
        currentPage: parseInt(page) || 1,
        total,
      });
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/tenants/:tenantId/comments/:commentId
// @desc    Get a single comment
router.get(
  '/:tenantId/comments/:commentId',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const comment = await Comment.findOne({
        _id: req.params.commentId,
        tenant: req.tenantId,
      })
        .populate('assignedTo', 'firstName lastName email')
        .populate('leadId');

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/comments/:commentId/reply
// @desc    Reply to a comment
router.post(
  '/:tenantId/comments/:commentId/reply',
  protect,
  requireTenant,
  checkPermission('comments', 'reply'),
  async (req, res) => {
    try {
      const { replyText, autoReply = false } = req.body;
      const comment = await Comment.findOne({
        _id: req.params.commentId,
        tenant: req.tenantId,
      });

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (comment.isReplied) {
        return res.status(400).json({ message: 'Comment already replied to' });
      }

      const tenant = await Tenant.findById(req.tenantId);
      let replyMessage = replyText;

      // Generate AI reply if auto-reply is enabled
      if (autoReply && tenant.settings.autoReplyEnabled) {
        replyMessage = await generateAIReply(comment.commentText, tenant.aiConfig, {
          sentiment: comment.sentiment,
        });
      }

      // Send reply via platform API
      let service;
      if (comment.platform === 'instagram') {
        service = new InstagramService(tenant.instagramConfig);
        await service.replyToComment(comment.commentId, replyMessage);
      } else if (comment.platform === 'facebook') {
        service = new FacebookService(tenant.facebookConfig);
        await service.replyToComment(comment.commentId, replyMessage);
      }

      // Update comment
      comment.isReplied = true;
      comment.replyText = replyMessage;
      comment.replySentAt = Date.now();
      comment.isAutoReply = autoReply;
      comment.status = 'replied';
      await comment.save();

      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/tenants/:tenantId/comments/:commentId
// @desc    Update comment (assign, update status, etc.)
router.put(
  '/:tenantId/comments/:commentId',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { status, assignedTo, isLead } = req.body;
      const comment = await Comment.findOne({
        _id: req.params.commentId,
        tenant: req.tenantId,
      });

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (status) comment.status = status;
      if (assignedTo) comment.assignedTo = assignedTo;
      if (isLead !== undefined) comment.isLead = isLead;

      await comment.save();

      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/tenants/:tenantId/comments/sync
// @desc    Manually sync comments from social media
router.post(
  '/:tenantId/comments/sync',
  protect,
  requireTenant,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { postId, platform } = req.body;
      const tenant = await Tenant.findById(req.tenantId);

      let processedComments = [];

      if (platform === 'instagram' && tenant.settings.instagramEnabled) {
        const service = new InstagramService(tenant.instagramConfig);
        processedComments = await service.processNewComments(req.tenantId, postId);
      } else if (platform === 'facebook' && tenant.settings.facebookEnabled) {
        const service = new FacebookService(tenant.facebookConfig);
        processedComments = await service.processNewComments(req.tenantId, postId);
      }

      res.json({
        message: 'Comments synced successfully',
        count: processedComments.length,
        comments: processedComments,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

