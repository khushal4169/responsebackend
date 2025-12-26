require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

const createSuperAdmin = async () => {
  try {
    await connectDB();

    const email = process.argv[2] || 'admin@responsema.com';
    const password = process.argv[3] || 'admin123456';
    const firstName = process.argv[4] || 'Super';
    const lastName = process.argv[5] || 'Admin';

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ 
      email,
      userType: 'super_admin'
    });

    if (existingAdmin) {
      console.log('Super admin already exists with this email');
      process.exit(0);
    }

    const superAdmin = await User.create({
      email,
      password,
      firstName,
      lastName,
      userType: 'super_admin',
      isActive: true,
    });

    console.log('Super admin created successfully!');
    console.log('Email:', superAdmin.email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();


