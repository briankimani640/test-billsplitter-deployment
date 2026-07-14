const router   = require('express').Router();
const ctrl     = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/overview',          ctrl.overview);
router.get('/metrics',           ctrl.metrics);
router.get('/users',             ctrl.listUsers);
router.put('/users/:id/admin',   ctrl.setAdmin);
router.get('/groups',            ctrl.listGroups);

module.exports = router;
