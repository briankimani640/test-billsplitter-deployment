const router   = require('express').Router();
const ctrl     = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/summary',     ctrl.summary);
router.get('/by-category', ctrl.byCategory);
router.get('/by-month',    ctrl.byMonth);
router.get('/by-group',    ctrl.byGroup);

module.exports = router;
