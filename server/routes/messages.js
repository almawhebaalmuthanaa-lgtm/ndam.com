const express = require('express');
const InternalMessage = require('../models/InternalMessage');
const { authenticate } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Send new message
router.post('/', authenticate, async (req, res) => {
  try {
    const { sender, receiver, subject, content, priority, isAuto } = req.body;

    const message = new InternalMessage({
      sender,
      receiver,
      subject,
      content,
      priority: priority || 'عادي',
      isAuto: isAuto || false
    });

    await message.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'SEND_MESSAGE',
      details: `إرسال رسالة من ${sender} إلى ${receiver}: ${subject}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get all messages
router.get('/', authenticate, async (req, res) => {
  try {
    const { receiver, priority, isRead } = req.query;
    let filter = {};

    if (receiver) {
      filter.$or = [
        { receiver: { $regex: receiver, $options: 'i' } },
        { receiver: { $regex: 'جميع', $options: 'i' } }
      ];
    }
    if (priority) filter.priority = priority;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const messages = await InternalMessage.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Get messages by receiver
router.get('/receiver/:receiver', authenticate, async (req, res) => {
  try {
    const receiver = req.params.receiver;
    const messages = await InternalMessage.find({
      $or: [
        { receiver: { $regex: receiver, $options: 'i' } },
        { receiver: { $regex: 'جميع', $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    const unreadCount = messages.filter(m => !m.isRead).length;

    res.status(200).json({
      success: true,
      count: messages.length,
      unreadCount,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// Mark message as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const message = await InternalMessage.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'الرسالة غير موجودة'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث الرسالة',
      data: message
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