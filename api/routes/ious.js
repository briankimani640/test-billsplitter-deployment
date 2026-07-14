const router   = require('express').Router();
const ctrl     = require('../controllers/iouController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',           ctrl.listAll);
router.get('/i-owe',      ctrl.iOwe);
router.get('/owed-to-me', ctrl.owedToMe);

module.exports = router;
