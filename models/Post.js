const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['instagram', 'facebook', 'other'],
    default: 'other',
    index: true,
  },
  externalId: { type: String, index: true },
  caption: String,
  mediaUrl: String,
  mediaType: { type: String, enum: ['image', 'video', 'carousel', 'text', 'other'], default: 'other' },
  permalink: String,
  postedAt: Date,
  metrics: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

postSchema.index({ tenant: 1, platform: 1, postedAt: -1 });

postSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Post', postSchema);

