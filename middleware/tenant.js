const Tenant = require('../models/Tenant');

const requireTenant = async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId || req.body.tenant || req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID format' });
    }

    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    if (tenant.status !== 'active') {
      return res.status(403).json({ message: 'Tenant is not active' });
    }

    // Super admin can access any tenant without membership check
    if (req.user && req.user.userType === 'super_admin') {
      req.tenantMembership = { role: null, status: 'active' }; // Super admin has full access
    } else if (req.user) {
      // Check if user is member of this tenant
      const tenantMembership = req.user.tenants?.find(
        t => {
          const tId = t.tenant?._id || t.tenant || t.tenant?.toString();
          return tId.toString() === tenantId.toString() && t.status === 'active';
        }
      );

      if (!tenantMembership) {
        return res.status(403).json({ message: 'Not a member of this tenant' });
      }

      req.tenantMembership = tenantMembership;
    }

    req.tenant = tenant;
    req.tenantId = tenantId;
    next();
  } catch (error) {
    console.error('requireTenant middleware error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const isolateTenantData = (req, res, next) => {
  // Ensure all queries are scoped to the tenant
  if (!req.query) req.query = {};
  if (!req.body) req.body = {};
  req.query.tenant = req.tenantId;
  req.body.tenant = req.tenantId;
  next();
};

module.exports = {
  requireTenant,
  isolateTenantData,
};

