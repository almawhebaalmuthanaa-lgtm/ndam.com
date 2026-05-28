const express = require('express');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const OfficialLetter = require('../models/OfficialLetter');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Dashboard statistics
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ status: 'active' });
    const totalPayments = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalLetters = await OfficialLetter.countDocuments();
    const activeLetters = await OfficialLetter.countDocuments({ status: 'active' });
    const expiredDocuments = await Student.countDocuments({
      'documents.expiryDate': { $lt: new Date() }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalPayments: totalPayments[0]?.total || 0,
        totalLetters,
        activeLetters,
        expiredDocuments,
        inactiveLetters: totalLetters - activeLetters
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Financial report
router.get('/financial', authenticate, authorize('admin', 'finance_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const paymentsByCategory = await Payment.aggregate([
      { $match: filter },
      { $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    const paymentsByMethod = await Payment.aggregate([
      { $match: filter },
      { $group: {
        _id: '$method',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    const dailyPayments = await Payment.aggregate([
      { $match: filter },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    const totalAmount = paymentsByCategory.reduce((sum, item) => sum + item.total, 0);
    const totalTransactions = paymentsByCategory.reduce((sum, item) => sum + item.count, 0);

    res.status(200).json({
      success: true,
      report: {
        summary: {
          totalAmount,
          totalTransactions,
          period: {
            startDate: startDate || 'البداية',
            endDate: endDate || 'النهاية'
          }
        },
        byCategory: paymentsByCategory,
        byMethod: paymentsByMethod,
        daily: dailyPayments
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Student report
router.get('/students', authenticate, async (req, res) => {
  try {
    const { department, shift, status } = req.query;
    let filter = {};

    if (department) filter.department = department;
    if (shift) filter.shift = shift;
    if (status) filter.status = status;

    const studentsByStatus = await Student.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    const studentsByDepartment = await Student.aggregate([
      { $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'dept'
      }},
      { $group: {
        _id: { $arrayElemAt: ['$dept.name', 0] },
        count: { $sum: 1 },
        totalFee: { $sum: '$totalFee' }
      }}
    ]);

    const totalStudents = await Student.countDocuments(filter);
    const students = await Student.find(filter).populate('department');

    res.status(200).json({
      success: true,
      report: {
        totalStudents,
        byStatus: studentsByStatus,
        byDepartment: studentsByDepartment,
        students
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخاد��',
      error: error.message
    });
  }
});

// System alerts report
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const today = new Date();

    // Expired documents
    const expiredDocuments = await Student.aggregate([
      { $unwind: '$documents' },
      { $match: {
        'documents.provided': true,
        'documents.expiryDate': { $lt: today }
      }},
      { $project: {
        studentId: 1,
        fullName: 1,
        document: '$documents.documentName',
        expiryDate: '$documents.expiryDate'
      }}
    ]);

    // Expiring documents (within 30 days)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringDocuments = await Student.aggregate([
      { $unwind: '$documents' },
      { $match: {
        'documents.provided': true,
        'documents.expiryDate': { $gte: today, $lte: thirtyDaysFromNow }
      }},
      { $project: {
        studentId: 1,
        fullName: 1,
        document: '$documents.documentName',
        expiryDate: '$documents.expiryDate'
      }}
    ]);

    // Expired letters
    const expiredLetters = await OfficialLetter.find({
      expiryDate: { $lt: today },
      status: { $ne: 'expired' }
    });

    // Expiring letters (within 30 days)
    const expiringLetters = await OfficialLetter.find({
      expiryDate: { $gte: today, $lte: thirtyDaysFromNow },
      status: { $ne: 'expired' }
    });

    // Students with pending balance
    const studentsWithBalance = await Student.aggregate([
      { $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'student',
        as: 'payments'
      }},
      { $project: {
        studentId: 1,
        fullName: 1,
        totalFee: 1,
        totalPaid: { $sum: '$payments.amount' },
        status: 1
      }},
      { $match: {
        $expr: { $gt: ['$totalFee', '$totalPaid'] }
      }}
    ]);

    res.status(200).json({
      success: true,
      alerts: {
        expiredDocuments: {
          count: expiredDocuments.length,
          items: expiredDocuments
        },
        expiringDocuments: {
          count: expiringDocuments.length,
          items: expiringDocuments
        },
        expiredLetters: {
          count: expiredLetters.length,
          items: expiredLetters
        },
        expiringLetters: {
          count: expiringLetters.length,
          items: expiringLetters
        },
        studentsWithBalance: {
          count: studentsWithBalance.length,
          items: studentsWithBalance
        }
      }
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