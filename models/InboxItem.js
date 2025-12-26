const mongoose = require('mongoose');

const inboxItemSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['comment', 'dm', 'reaction', 'mention'],
    required: true,
  },
  platform: {
    type: String,
    enum: ['instagram', 'facebook', 'other'],
    default: 'other',
  },
  postId: String,
  externalId: String,
  threadId: String, // for DMs
  messageText: String,
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound',
  },
  author: {
    id: String,
    name: String,
    username: String,
  },
  to: {
    id: String,
    name: String,
    username: String,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'closed'],
    default: 'open',
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  metadata: mongoose.Schema.Types.Mixed,
  firstResponseAt: Date,
  closedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

inboxItemSchema.index({ tenant: 1, type: 1, createdAt: -1 });
inboxItemSchema.index({ tenant: 1, platform: 1 });

inboxItemSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('InboxItem', inboxItemSchema);

