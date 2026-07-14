const router      = require('express').Router();
const ctrl        = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',            ctrl.listSettlements);
router.get('/suggested',   ctrl.getSuggested);
router.get('/pending',     ctrl.getPending);
router.post('/',           ctrl.createSettlement);
router.put('/:id/confirm', ctrl.confirmSettlement);
router.put('/:id/paid',    ctrl.markPaid); // back-compat

module.exports = router;
