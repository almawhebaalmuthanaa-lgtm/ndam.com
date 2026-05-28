const express = require('express');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');
const { authenticate, authorize } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// ==================== USERS ====================

// Add new user
router.post('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { fullName, username, password, role, department, college, allowedIP } = req.body;

    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم موجود بالفعل' });
    }

    const user = new User({
      fullName,
      username,
      password,
      role,
      department: department || null,
      college: college || null,
      allowedIP: allowedIP || null
    });

    await user.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ADD_USER',
      details: `إضافة مستخدم جديد: ${username} - الدور: ${role}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة المستخدم بنجاح',
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get all users
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, isActive } = req.query;
    let filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .populate('department')
      .populate('college')
      .select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Update user
router.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { fullName, role, allowedIP, isActive } = req.body;
    const updateData = {};

    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;
    if (allowedIP !== undefined) updateData.allowedIP = allowedIP;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_USER',
      details: `تحديث بيانات المستخدم: ${user.username}`,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث المستخدم بنجاح',
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Change password
router.put('/users/:id/password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_USER',
      details: `تغيير كلمة مرور المستخدم: ${user.username}`,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// ==================== COLLEGES ====================

router.post('/colleges', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { collegeId, name, description } = req.body;

    const existingCollege = await College.findOne({ collegeId });
    if (existingCollege) {
      return res.status(400).json({ success: false, message: 'رمز الكلية موجود بالفعل' });
    }

    const college = new College({
      collegeId,
      name,
      description
    });

    await college.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ADD_COLLEGE',
      details: `إضافة كلية جديدة: ${name}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة الكلية بنجاح',
      college
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

router.get('/colleges', authenticate, async (req, res) => {
  try {
    const colleges = await College.find({ isActive: true });

    res.status(200).json({
      success: true,
      count: colleges.length,
      colleges
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// ==================== DEPARTMENTS ====================

router.post('/departments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { departmentId, name, college, annualFee, duration, description } = req.body;

    const existingDept = await Department.findOne({ departmentId });
    if (existingDept) {
      return res.status(400).json({ success: false, message: 'رمز القسم موجود بالفعل' });
    }

    const department = new Department({
      departmentId,
      name,
      college,
      annualFee,
      duration,
      description
    });

    await department.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ADD_DEPARTMENT',
      details: `إضافة قسم جديد: ${name}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة القسم بنجاح',
      department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

router.get('/departments', authenticate, async (req, res) => {
  try {
    const { college } = req.query;
    let filter = { isActive: true };

    if (college) filter.college = college;

    const departments = await Department.find(filter)
      .populate('college');

    res.status(200).json({
      success: true,
      count: departments.length,
      departments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// ==================== AUDIT LOG ====================

router.get('/audit-log', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, startDate, endDate, limit = 100 } = req.query;
    let filter = {};

    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

module.exports = router;