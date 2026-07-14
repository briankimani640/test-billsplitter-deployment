const router      = require('express').Router();
const ctrl        = require('../controllers/disputeController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',             ctrl.listDisputes);
router.post('/',            ctrl.createDispute);
router.put('/:id/resolve',  ctrl.resolveDispute);

module.exports = router;
