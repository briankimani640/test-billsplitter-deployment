const router   = require('express').Router();
const ctrl     = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const upload   = require('../middleware/upload');

router.use(protect);

router.post('/',       upload.single('receipt'), ctrl.createExpense);
router.get('/:id',     ctrl.getExpense);
router.put('/:id',     ctrl.updateExpense);
router.delete('/:id',  ctrl.deleteExpense);

module.exports = router;
