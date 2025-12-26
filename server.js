const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize cron jobs
require('./services/cronJobs');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://responsemanagemment.vercel.app',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - IMPORTANT: Mount specific routes BEFORE generic routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/super-admin', require('./routes/superAdmin'));
// Mount tenant-specific routes FIRST (before generic /:tenantId route)
app.use('/api/tenants', require('./routes/comments'));
app.use('/api/tenants', require('./routes/leads'));
app.use('/api/tenants', require('./routes/users'));
app.use('/api/tenants', require('./routes/roles'));
app.use('/api/tenants', require('./routes/inbox'));
app.use('/api/tenants', require('./routes/posts'));
app.use('/api/tenants', require('./routes/webhooks'));
// Generic tenant routes LAST (GET /, POST /, GET /:tenantId, etc.)
app.use('/api/tenants', require('./routes/tenants'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

