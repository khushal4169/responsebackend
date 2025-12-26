const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');
const { requireTenant, isolateTenantData } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/roleCheck');

// GET /api/tenants/:tenantId/posts
router.get(
  '/:tenantId/posts',
  protect,
  requireTenant,
  isolateTenantData,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const { platform, page = 1, limit = 20 } = req.query;
      const query = { tenant: req.tenantId };
      if (platform) query.platform = platform;

      const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

      const [posts, total] = await Promise.all([
        Post.find(query)
          .sort({ postedAt: -1, createdAt: -1 })
          .limit(parsedLimit)
          .skip((parsedPage - 1) * parsedLimit)
          .lean(),
        Post.countDocuments(query),
      ]);

      res.json({
        posts,
        total,
        totalPages: Math.ceil(total / parsedLimit),
        currentPage: parsedPage,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// POST /api/tenants/:tenantId/posts/seed (placeholder)
router.post(
  '/:tenantId/posts/seed',
  protect,
  requireTenant,
  isolateTenantData,
  checkPermission('comments', 'view'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const post = await Post.create({
        tenant: req.tenantId,
        platform: body.platform || 'instagram',
        externalId: body.externalId || `demo-${Date.now()}`,
        caption: body.caption || 'Sample post caption',
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType || 'image',
        postedAt: body.postedAt || new Date(),
        metrics: body.metrics || { likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 },
        metadata: body,
      });
      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

