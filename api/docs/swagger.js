// OpenAPI 3 specification for the SplitKesh / Bill Splitter API.
// Served with swagger-ui-express at GET /api/docs (raw JSON at /api/docs.json).
// Kept in sync with the routes in api/routes/*.

const bearer = [{ bearerAuth: [] }];
const R = {
  Unauthorized: { description: 'Missing or invalid access token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  NotFound:     { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  Validation:   { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'SplitKesh API',
    version: '1.0.0',
    description:
      'REST API for **SplitKesh / Bill Splitter** — group expense splitting, IOUs, partial ' +
      'settlements with confirm/dispute, and stats.\n\n' +
      '**Auth:** most endpoints need a Bearer JWT. Call `POST /api/auth/login`, copy the ' +
      '`accessToken`, click **Authorize** above and paste it. Tokens expire in ~15 min; use ' +
      '`POST /api/auth/refresh` to renew.',
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local development' },
    { url: '/', description: 'Same origin' },
  ],
  tags: [
    { name: 'Auth' }, { name: 'Users' }, { name: 'Groups' }, { name: 'Expenses' },
    { name: 'IOUs' }, { name: 'Settlements' }, { name: 'Disputes' }, { name: 'Stats' },
    { name: 'Notifications' }, { name: 'OCR' }, { name: 'System' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string', example: 'Something went wrong' } } },
      Message: { type: 'object', properties: { message: { type: 'string' } } },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Priscila' },
          username: { type: 'string', example: 'priscila_m' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', example: '0712345678' },
          initials: { type: 'string', example: 'PM' },
        },
      },
      Member: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' }, username: { type: 'string' },
          initials: { type: 'string' }, role: { type: 'string', enum: ['admin', 'member'] },
        },
      },
      Split: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          name: { type: 'string' }, initials: { type: 'string' },
          amount: { type: 'number', example: 1200 },
        },
      },
      Expense: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          group_id: { type: 'string', format: 'uuid' },
          description: { type: 'string', example: 'Dinner at Java' },
          amount: { type: 'number', example: 3600 },
          paid_by: { type: 'string', format: 'uuid' },
          paidByName: { type: 'string' },
          category: { type: 'string', example: 'Food' },
          emoji: { type: 'string', example: '🍽️' },
          date: { type: 'string', format: 'date' },
          splits: { type: 'array', items: { $ref: '#/components/schemas/Split' } },
        },
      },
      Group: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'JKUAT mates' },
          icon: { type: 'string' }, iconColor: { type: 'string' },
          memberCount: { type: 'integer', example: 5 },
          expenseCount: { type: 'integer', example: 3 },
          balance: { type: 'number', description: '>0 you are owed, <0 you owe' },
          members: { type: 'array', items: { $ref: '#/components/schemas/Member' } },
          expenses: { type: 'array', items: { $ref: '#/components/schemas/Expense' } },
        },
      },
      Settlement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          from_user_id: { type: 'string', format: 'uuid' },
          to_user_id: { type: 'string', format: 'uuid' },
          amount: { type: 'number', example: 240 },
          group_id: { type: 'string', format: 'uuid' },
          payment_method: { type: 'string', example: 'M-Pesa' },
          transaction_id: { type: 'string', example: 'SGH4X8K2LP' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'disputed'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      SuggestedSettlement: {
        type: 'object',
        properties: {
          fromUserId: { type: 'string', format: 'uuid' }, toUserId: { type: 'string', format: 'uuid' },
          fromName: { type: 'string' }, toName: { type: 'string' },
          amount: { type: 'number' }, groupId: { type: 'string', format: 'uuid' }, groupName: { type: 'string' },
          direction: { type: 'string', enum: ['owe', 'owed'] },
        },
      },
      Dispute: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          settlement_id: { type: 'string', format: 'uuid' },
          raised_by: { type: 'string', format: 'uuid' }, against_user: { type: 'string', format: 'uuid' },
          group_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' },
          reason: { type: 'string', enum: ['money_not_received', 'fake_transaction_id', 'incomplete_amount', 'other'] },
          reasonLabel: { type: 'string' }, note: { type: 'string' },
          status: { type: 'string', enum: ['open', 'resolved'] },
        },
      },
      IOU: {
        type: 'object',
        properties: {
          personId: { type: 'string', format: 'uuid' }, personName: { type: 'string' },
          personInitials: { type: 'string' }, groupId: { type: 'string', format: 'uuid' },
          groupName: { type: 'string' }, totalAmount: { type: 'number' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, type: { type: 'string' },
          title: { type: 'string' }, body: { type: 'string' },
          read: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: bearer, // default: every operation needs a token unless overridden with `security: []`
  paths: {
    // ───────── System ─────────
    '/api/health': {
      get: { tags: ['System'], summary: 'Health check', security: [], responses: { 200: { description: 'OK' } } },
    },

    // ───────── Auth ─────────
    '/api/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a new user', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string' }, email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            username: { type: 'string', example: 'priscila_m' },
            phone: { type: 'string', example: '0712345678' },
          },
        } } } },
        responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, 422: R.Validation },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['email', 'password'],
          properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
        } } } },
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, 401: R.Unauthorized },
      },
    },
    '/api/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Exchange a refresh token for a new access token', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 401: R.Unauthorized } },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Invalidate a refresh token', responses: { 200: { description: 'OK' } } } },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Current user', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, 401: R.Unauthorized } } },
    '/api/auth/forgot-password': { post: { tags: ['Auth'], summary: 'Send password-reset link', security: [], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' } } } },
    '/api/auth/reset-password': { post: { tags: ['Auth'], summary: 'Reset password with token', security: [], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, newPassword: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' }, 422: R.Validation } } },
    '/api/auth/verify-email': { post: { tags: ['Auth'], summary: 'Verify email with token', security: [], responses: { 200: { description: 'OK' } } } },
    '/api/auth/resend-verification': { post: { tags: ['Auth'], summary: 'Resend verification email', security: [], responses: { 200: { description: 'OK' } } } },

    // ───────── Users ─────────
    '/api/users/me': {
      get: { tags: ['Users'], summary: 'Get my profile', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } },
      put: { tags: ['Users'], summary: 'Update my profile', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, username: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Users'], summary: 'Delete my account', responses: { 200: { description: 'OK' } } },
    },
    '/api/users/me/password': { put: { tags: ['Users'], summary: 'Change password', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' }, 422: R.Validation } } },
    '/api/users/search': { get: { tags: ['Users'], summary: 'Search users by @username', parameters: [{ name: 'q', in: 'query', schema: { type: 'string' }, description: 'username fragment' }], responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } } } },
    '/api/users/preferences': {
      get: { tags: ['Users'], summary: 'Get preferences', responses: { 200: { description: 'OK' } } },
      put: { tags: ['Users'], summary: 'Update preferences (merged)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'OK' } } },
    },
    '/api/users/lookup-contacts': { post: { tags: ['Users'], summary: 'Match phone contacts to users', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { phones: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 200: { description: 'OK' } } } },

    // ───────── Groups ─────────
    '/api/groups': {
      get: { tags: ['Groups'], summary: 'List my groups', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Group' } } } } } } },
      post: { tags: ['Groups'], summary: 'Create a group', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, icon: { type: 'string' }, iconColor: { type: 'string' }, memberIds: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } } }, responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Group' } } } }, 422: R.Validation } },
    },
    '/api/groups/{id}': {
      get: { tags: ['Groups'], summary: 'Group detail (members + expenses w/ splits)', parameters: [idParam], responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Group' } } } }, 404: R.NotFound } },
      put: { tags: ['Groups'], summary: 'Update group (admin)', parameters: [idParam], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, icon: { type: 'string' }, iconColor: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Groups'], summary: 'Delete group (admin) — blocked if unsettled bills', parameters: [idParam], responses: { 200: { description: 'Deleted' }, 422: { description: 'Group has unsettled bills', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
    '/api/groups/{id}/balances': { get: { tags: ['Groups'], summary: 'Per-member balances', parameters: [idParam], responses: { 200: { description: 'OK' } } } },
    '/api/groups/{id}/leave': { post: { tags: ['Groups'], summary: 'Leave a group — blocked if you still owe', parameters: [idParam], responses: { 200: { description: 'Left' }, 422: { description: 'You still owe money in this group', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } } },
    '/api/groups/{id}/members': { post: { tags: ['Groups'], summary: 'Add member (admin)', parameters: [idParam], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', format: 'uuid' } } } } } }, responses: { 200: { description: 'OK' } } } },
    '/api/groups/{id}/members/{userId}': { delete: { tags: ['Groups'], summary: 'Remove member (admin)', parameters: [idParam, { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } } },
    '/api/groups/{groupId}/expenses': { get: { tags: ['Groups'], summary: 'List a group’s expenses', parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Expense' } } } } } } } },

    // ───────── Expenses ─────────
    '/api/expenses': {
      post: {
        tags: ['Expenses'], summary: 'Add an expense (optional receipt upload)',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: {
          type: 'object', required: ['groupId', 'description', 'amount', 'paidBy'],
          properties: {
            groupId: { type: 'string', format: 'uuid' }, description: { type: 'string' },
            amount: { type: 'number' }, paidBy: { type: 'string', format: 'uuid' },
            category: { type: 'string' }, emoji: { type: 'string' },
            splitType: { type: 'string', enum: ['equal', 'exact', 'percent'] },
            date: { type: 'string', format: 'date' },
            splits: { type: 'string', description: 'JSON array string: [{userId, amount}] (amount = KSh for exact, % for percent)' },
            receipt: { type: 'string', format: 'binary' },
          },
        } } } },
        responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } }, 422: R.Validation },
      },
    },
    '/api/expenses/{id}': {
      get: { tags: ['Expenses'], summary: 'Get expense + splits', parameters: [idParam], responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } }, 404: R.NotFound } },
      put: { tags: ['Expenses'], summary: 'Update expense', parameters: [idParam], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } }, responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Expenses'], summary: 'Delete expense', parameters: [idParam], responses: { 200: { description: 'OK' } } },
    },

    // ───────── IOUs ─────────
    '/api/ious': { get: { tags: ['IOUs'], summary: 'All IOUs (both directions)', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { iOwe: { type: 'array', items: { $ref: '#/components/schemas/IOU' } }, owedToMe: { type: 'array', items: { $ref: '#/components/schemas/IOU' } } } } } } } } } },
    '/api/ious/i-owe': { get: { tags: ['IOUs'], summary: 'What I owe others', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/IOU' } } } } } } } },
    '/api/ious/owed-to-me': { get: { tags: ['IOUs'], summary: 'What others owe me', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/IOU' } } } } } } } },

    // ───────── Settlements ─────────
    '/api/settlements': {
      get: { tags: ['Settlements'], summary: 'My payment history (sent & received)', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Settlement' } } } } } } },
      post: {
        tags: ['Settlements'], summary: 'Record a (partial) payment — starts as pending',
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['toUserId', 'amount'],
          properties: {
            toUserId: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 140 },
            groupId: { type: 'string', format: 'uuid' },
            paymentMethod: { type: 'string', example: 'M-Pesa' },
            transactionId: { type: 'string', example: 'SGH4X8K2LP' }, notes: { type: 'string' },
          },
        } } } },
        responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Settlement' } } } }, 422: R.Validation },
      },
    },
    '/api/settlements/suggested': { get: { tags: ['Settlements'], summary: 'Suggested payments (pairwise, net of confirmed)', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SuggestedSettlement' } } } } } } } },
    '/api/settlements/pending': { get: { tags: ['Settlements'], summary: 'Payments to confirm / awaiting the other side', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { toConfirm: { type: 'array', items: { $ref: '#/components/schemas/Settlement' } }, awaiting: { type: 'array', items: { $ref: '#/components/schemas/Settlement' } } } } } } } } } },
    '/api/settlements/{id}/confirm': { put: { tags: ['Settlements'], summary: 'Confirm a payment you received', parameters: [idParam], responses: { 200: { description: 'Confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Settlement' } } } }, 404: R.NotFound } } },
    '/api/settlements/{id}/paid': { put: { tags: ['Settlements'], summary: 'Deprecated alias for confirm', deprecated: true, parameters: [idParam], responses: { 200: { description: 'OK' } } } },

    // ───────── Disputes ─────────
    '/api/disputes': {
      get: { tags: ['Disputes'], summary: 'Disputes involving me', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Dispute' } } } } } } },
      post: {
        tags: ['Disputes'], summary: 'Raise a dispute on a payment you received',
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['settlementId', 'reason'],
          properties: {
            settlementId: { type: 'string', format: 'uuid' },
            reason: { type: 'string', enum: ['money_not_received', 'fake_transaction_id', 'incomplete_amount', 'other'] },
            note: { type: 'string' },
          },
        } } } },
        responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Dispute' } } } }, 404: R.NotFound, 422: R.Validation },
      },
    },
    '/api/disputes/{id}/resolve': { put: { tags: ['Disputes'], summary: 'Resolve a dispute (initiator only)', parameters: [idParam], responses: { 200: { description: 'Resolved', content: { 'application/json': { schema: { $ref: '#/components/schemas/Dispute' } } } }, 404: R.NotFound } } },

    // ───────── Stats ─────────
    '/api/stats/summary': { get: { tags: ['Stats'], summary: 'Totals for a period', parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'month', 'quarter', 'year'], default: 'month' } }], responses: { 200: { description: 'OK' } } } },
    '/api/stats/by-category': { get: { tags: ['Stats'], summary: 'Spending by category', responses: { 200: { description: 'OK' } } } },
    '/api/stats/by-month': { get: { tags: ['Stats'], summary: 'Last 6 months', responses: { 200: { description: 'OK' } } } },
    '/api/stats/by-group': { get: { tags: ['Stats'], summary: 'Spending per group', responses: { 200: { description: 'OK' } } } },

    // ───────── Notifications ─────────
    '/api/notifications': { get: { tags: ['Notifications'], summary: 'List notifications', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } } } } },
    '/api/notifications/unread-count': { get: { tags: ['Notifications'], summary: 'Unread count', responses: { 200: { description: 'OK' } } } },
    '/api/notifications/read-all': { put: { tags: ['Notifications'], summary: 'Mark all read', responses: { 200: { description: 'OK' } } } },
    '/api/notifications/{id}/read': { put: { tags: ['Notifications'], summary: 'Mark one read', parameters: [idParam], responses: { 200: { description: 'OK' } } } },
    '/api/notifications/{id}': { delete: { tags: ['Notifications'], summary: 'Delete one', parameters: [idParam], responses: { 200: { description: 'OK' } } } },

    // ───────── OCR ─────────
    '/api/ocr/receipt': { post: { tags: ['OCR'], summary: 'Extract amount/merchant from a receipt image', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { receipt: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'OK' } } } },
  },
};
