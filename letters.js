const express = require('express');
const OfficialLetter = require('../models/OfficialLetter');
const { authenticate, authorize } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Archive new letter
router.post('/', authenticate, authorize('admin', 'registrar', 'dept_head', 'finance_manager'), async (req, res) => {
  try {
    const { letterNumber, title, source, destination, dateIssued, expiryDate, category, summary } = req.body;

    // Check if letter number is unique
    const existingLetter = await OfficialLetter.findOne({ letterNumber });
    if (existingLetter) {
      return res.status(400).json({ success: false, message: 'الرقم الإداري موجود بالفعل' });
    }

    const letterId = 'LET-' + Date.now().toString().slice(-6);
    const letter = new OfficialLetter({
      letterId,
      letterNumber,
      title,
      source,
      destination,
      dateIssued: new Date(dateIssued),
      expiryDate: new Date(expiryDate),
      category,
      summary,
      archivedBy: req.user._id
    });

    await letter.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ARCHIVE_LETTER',
      details: `أرشفة كتاب: ${letterId} - ${letterNumber} - ${title}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم أرشفة الكتاب بنجاح',
      letter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get all letters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, search, startDate, endDate } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { letterNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filter.dateIssued = {};
      if (startDate) filter.dateIssued.$gte = new Date(startDate);
      if (endDate) filter.dateIssued.$lte = new Date(endDate);
    }

    const letters = await OfficialLetter.find(filter)
      .populate('archivedBy', 'fullName username')
      .sort({ dateIssued: -1 });

    // Update status for expired letters
    const today = new Date();
    letters.forEach(letter => {
      if (letter.expiryDate < today && letter.status !== 'expired') {
        letter.status = 'expired';
        letter.save();
      }
    });

    res.status(200).json({
      success: true,
      count: letters.length,
      letters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get letter by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const letter = await OfficialLetter.findById(req.params.id)
      .populate('archivedBy', 'fullName username');

    if (!letter) {
      return res.status(404).json({
        success: false,
        message: 'الكتاب غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      letter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get expiring letters (within 30 days)
router.get('/alerts/expiring', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringLetters = await OfficialLetter.find({
      expiryDate: { $gte: today, $lte: thirtyDaysFromNow },
      status: { $ne: 'expired' }
    }).sort({ expiryDate: 1 });

    res.status(200).json({
      success: true,
      count: expiringLetters.length,
      message: `يوجد ${expiringLetters.length} كتب ستنتهي صلاحيتها خلال 30 يوم`,
      letters: expiringLetters
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