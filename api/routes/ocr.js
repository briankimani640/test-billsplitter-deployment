const router   = require('express').Router();
const ctrl     = require('../controllers/ocrController');
const { protect } = require('../middleware/auth');
const upload   = require('../middleware/upload');

router.use(protect);
router.post('/receipt', upload.single('receipt'), ctrl.processReceipt);

module.exports = router;
