const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: Number,
    required: true,
    min: 0,
  },
  permissions: {
    comments: {
      view: { type: Boolean, default: false },
      reply: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      moderate: { type: Boolean, default: false },
    },
    leads: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    team: {
      view: { type: Boolean, default: false },
      invite: { type: Boolean, default: false },
      remove: { type: Boolean, default: false },
      manageRoles: { type: Boolean, default: false },
    },
    settings: {
      view: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
    },
    analytics: {
      view: { type: Boolean, default: false },
    },
  },
  isSystemRole: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
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

roleSchema.index({ tenant: 1, name: 1 }, { unique: true });

roleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Role', roleSchema);


