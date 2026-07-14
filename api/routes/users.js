const router   = require('express').Router();
const ctrl     = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',                ctrl.getProfile);
router.get('/me',              ctrl.getProfile);
router.put('/me',              ctrl.updateProfile);
router.delete('/me',           ctrl.deleteAccount);
router.put('/me/password',     ctrl.changePassword);
router.get('/search',          ctrl.searchUsers);

router.get('/preferences',     ctrl.getPreferences);
router.put('/preferences',     ctrl.updatePreferences);
router.post('/lookup-contacts', ctrl.lookupContacts);

module.exports = router;
