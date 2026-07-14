const router   = require('express').Router();
const ctrl     = require('../controllers/groupController');
const expCtrl  = require('../controllers/expenseController');
const { protect, groupMember, groupAdmin } = require('../middleware/auth');

router.use(protect);

router.get('/',    ctrl.listGroups);
router.post('/',   ctrl.createGroup);

router.get('/:id',           groupMember, ctrl.getGroup);
router.put('/:id',           groupMember, groupAdmin, ctrl.updateGroup);
router.delete('/:id',        groupMember, groupAdmin, ctrl.deleteGroup);
router.get('/:id/balances',  groupMember, ctrl.getBalances);
router.post('/:id/leave',    groupMember, ctrl.leaveGroup);

router.post('/:id/members',              groupMember, groupAdmin, ctrl.addMember);
router.delete('/:id/members/:userId',    groupMember, groupAdmin, ctrl.removeMember);

// Expenses nested under group
router.get('/:groupId/expenses', expCtrl.listExpenses);

module.exports = router;
