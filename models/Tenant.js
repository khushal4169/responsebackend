const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'inactive'],
    default: 'active',
  },
  settings: {
    instagramEnabled: {
      type: Boolean,
      default: false,
    },
    facebookEnabled: {
      type: Boolean,
      default: false,
    },
    autoReplyEnabled: {
      type: Boolean,
      default: true,
    },
    sentimentAnalysisEnabled: {
      type: Boolean,
      default: true,
    },
    leadGenerationEnabled: {
      type: Boolean,
      default: true,
    },
  },
  instagramConfig: {
    appId: String,
    appSecret: String,
    accessToken: String,
    pageId: String,
    lastSyncAt: Date,
  },
  facebookConfig: {
    appId: String,
    appSecret: String,
    accessToken: String,
    pageId: String,
    lastSyncAt: Date,
  },
  aiConfig: {
    provider: {
      type: String,
      enum: ['openai', 'anthropic', 'custom'],
      default: 'openai',
    },
    apiKey: String,
    model: String,
    temperature: {
      type: Number,
      default: 0.7,
    },
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

tenantSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);


