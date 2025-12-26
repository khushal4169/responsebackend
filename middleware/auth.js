const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ message: 'User not found or inactive' });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.userType === 'super_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Super admin required.' });
  }
};

const requireTenantAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const tenantId = req.params.tenantId || req.body.tenant || req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }

    const tenantMembership = req.user.tenants.find(
      t => t.tenant.toString() === tenantId.toString() && t.status === 'active'
    );

    if (!tenantMembership) {
      return res.status(403).json({ message: 'Not a member of this tenant' });
    }

    if (req.user.userType === 'super_admin' || req.user.userType === 'tenant_admin') {
      req.tenantId = tenantId;
      req.tenantMembership = tenantMembership;
      next();
    } else {
      res.status(403).json({ message: 'Access denied. Tenant admin required.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  protect,
  requireSuperAdmin,
  requireTenantAdmin,
};


