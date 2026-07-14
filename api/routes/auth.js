const router = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

// Phone: optional, but if present must be exactly 10 digits (e.g. 0712345678)
const phoneRule = body('phone')
  .optional({ checkFalsy: true })
  .customSanitizer(v => String(v).replace(/\D/g, ''))   // strip non-digits
  .isLength({ min: 10, max: 10 }).withMessage('Phone number must be exactly 10 digits');

router.post('/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username').optional({ checkFalsy: true }).trim()
    .matches(/^[a-zA-Z0-9_]{3,20}$/).withMessage('Username must be 3-20 letters, numbers or underscores'),
  phoneRule,
  validate,
  ctrl.register
);

router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  validate,
  ctrl.login
);

router.post('/refresh', ctrl.refresh);
router.post('/logout',  ctrl.logout);
router.get('/me', protect, ctrl.me);

// Password reset
router.post('/forgot-password',
  body('email').isEmail().withMessage('Valid email required'),
  validate,
  ctrl.forgotPassword
);
router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  ctrl.resetPassword
);

// Email verification
router.post('/verify-email', body('token').notEmpty(), validate, ctrl.verifyEmail);
router.post('/resend-verification', body('email').isEmail(), validate, ctrl.resendVerification);

module.exports = router;
