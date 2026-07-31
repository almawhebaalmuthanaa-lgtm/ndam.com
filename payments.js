const express = require('express');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { authenticate, authorize } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Add new payment
router.post('/', authenticate, authorize('admin', 'finance_manager', 'accounting'), async (req, res) => {
  try {
    const { student, amount, receiptNumber, category, method, notes } = req.body;

    // Validate student exists
    const studentDoc = await Student.findById(student);
    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // Check if receipt number is unique
    const existingPayment = await Payment.findOne({ receiptNumber });
    if (existingPayment) {
      return res.status(400).json({ success: false, message: 'رقم الوصل موجود بالفعل' });
    }

    const paymentId = 'PAY-' + Date.now().toString().slice(-6);
    const payment = new Payment({
      paymentId,
      student,
      amount,
      receiptNumber,
      category,
      method,
      notes,
      recordedBy: req.user._id
    });

    await payment.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ADD_PAYMENT',
      details: `إضافة دفع: ${paymentId} - ${amount} د.ع للطالب ${studentDoc.studentId}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم ��سجيل الدفع بنجاح',
      payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get all payments
router.get('/', authenticate, async (req, res) => {
  try {
    const { student, category, method, startDate, endDate } = req.query;
    let filter = {};

    if (student) filter.student = student;
    if (category) filter.category = category;
    if (method) filter.method = method;
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
      .populate('student')
      .populate('recordedBy', 'fullName username')
      .sort({ paymentDate: -1 });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      count: payments.length,
      totalAmount,
      payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get payment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('student')
      .populate('recordedBy', 'fullName username');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'الدفع غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get student payments summary
router.get('/student/:studentId', authenticate, async (req, res) => {
  try {
    const payments = await Payment.find({ student: req.params.studentId })
      .sort({ paymentDate: -1 });

    const student = await Student.findById(req.params.studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'الطالب غير موجود'
      });
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, student.totalFee - totalPaid);

    res.status(200).json({
      success: true,
      summary: {
        student: {
          id: student._id,
          studentId: student.studentId,
          fullName: student.fullName
        },
        totalFee: student.totalFee,
        totalPaid,
        remainingBalance,
        percentagePaid: ((totalPaid / student.totalFee) * 100).toFixed(2)
      },
      payments
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