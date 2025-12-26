const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const InboxItem = require('../models/InboxItem');

// GET verification hook by tenant ID (e.g., Facebook hub.challenge)
router.get('/:tenantId/webhooks/:platform', async (req, res) => {
  const { 'hub.challenge': challenge } = req.query;
  if (challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(200).json({ status: 'ok' });
});

// GET verification hook by tenant slug (e.g., Facebook hub.challenge)
router.get('/slug/:tenantSlug/webhooks/:platform', async (req, res) => {
  try {
    const { tenantSlug, platform } = req.params;
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    const { 'hub.challenge': challenge } = req.query;
    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST webhook receiver per tenant and platform (by tenant ID)
router.post('/:tenantId/webhooks/:platform', async (req, res) => {
  try {
    const { tenantId, platform } = req.params;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Simple normalization placeholder
    const body = req.body || {};
    const itemType = body.type || body.itemType || 'comment'; // comment|dm|reaction|mention (placeholder)
    const messageText = body.message || body.text || body.body || '';
    const author = body.from || body.author || {};
    const direction = body.direction || 'inbound';
    const urgency = 'medium';

    await InboxItem.create({
      tenant: tenantId,
      type: itemType,
      platform: platform?.toLowerCase() || 'other',
      postId: body.postId || body.post_id,
      externalId: body.id || body.externalId,
      threadId: body.threadId || body.conversation_id,
      messageText,
      direction,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
      },
      to: body.to,
      read: false,
      status: 'open',
      urgency,
      metadata: body,
    });

    return res.status(200).json({ received: true, tenantId: tenant._id });
  } catch (error) {
    console.error('Webhook ingest error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST webhook receiver per tenant and platform (by tenant slug) - Unique URL approach
router.post('/slug/:tenantSlug/webhooks/:platform', async (req, res) => {
  try {
    const { tenantSlug, platform } = req.params;
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Simple normalization placeholder
    const body = req.body || {};
    const itemType = body.type || body.itemType || 'comment'; // comment|dm|reaction|mention (placeholder)
    const messageText = body.message || body.text || body.body || '';
    const author = body.from || body.author || {};
    const direction = body.direction || 'inbound';
    const urgency = 'medium';

    await InboxItem.create({
      tenant: tenant._id,
      type: itemType,
      platform: platform?.toLowerCase() || 'other',
      postId: body.postId || body.post_id,
      externalId: body.id || body.externalId,
      threadId: body.threadId || body.conversation_id,
      messageText,
      direction,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
      },
      to: body.to,
      read: false,
      status: 'open',
      urgency,
      metadata: body,
    });

    return res.status(200).json({ received: true, tenantId: tenant._id, tenantSlug: tenant.slug });
  } catch (error) {
    console.error('Webhook ingest error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

