const router   = require('express').Router();
const ctrl     = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',              ctrl.list);
router.get('/unread-count',  ctrl.unreadCount);
router.put('/read-all',      ctrl.markAllRead);
router.put('/:id/read',      ctrl.markRead);
router.delete('/:id',        ctrl.remove);

module.exports = router;
