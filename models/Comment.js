const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['instagram', 'facebook'],
    required: true,
  },
  postId: {
    type: String,
    required: true,
  },
  postUrl: {
    type: String,
  },
  commentId: {
    type: String,
    required: true,
  },
  commentText: {
    type: String,
    required: true,
  },
  author: {
    id: String,
    username: String,
    name: String,
    profilePicture: String,
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral',
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
  },
  isLead: {
    type: Boolean,
    default: false,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
  },
  isReplied: {
    type: Boolean,
    default: false,
  },
  replyText: {
    type: String,
  },
  replySentAt: {
    type: Date,
  },
  isAutoReply: {
    type: Boolean,
    default: false,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'replied', 'resolved', 'archived'],
    default: 'new',
  },
  metadata: {
    likes: Number,
    replies: Number,
    timestamp: Date,
    rawData: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

commentSchema.index({ tenant: 1, commentId: 1 }, { unique: true });
commentSchema.index({ tenant: 1, createdAt: -1 });
commentSchema.index({ tenant: 1, status: 1 });
commentSchema.index({ tenant: 1, sentiment: 1 });

commentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Comment', commentSchema);


