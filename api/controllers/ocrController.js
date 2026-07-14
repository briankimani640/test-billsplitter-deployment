const Tesseract = require('tesseract.js');
const path      = require('path');
const fs        = require('fs');

// ── POST /api/ocr/receipt ─────────────────────────────────
exports.processReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const filePath   = req.file.path;
    const receiptUrl = `/uploads/${req.file.filename}`;

    console.log('🔍 Running OCR on:', req.file.filename);

    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {}, // suppress logs
    });

    // ── Parse total amount ────────────────────────────────
    // Look for patterns like: TOTAL 1,250.00 / KSH 850 / Amount: 500
    const amountPatterns = [
      /(?:total|amount|ksh|kes|sh\.?|amount due)[\s:]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:ksh|kes|ksh\.)/i,
      /(?:grand total|total amount)[\s:]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    ];

    let amount = null;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // ── Parse merchant / description ──────────────────────
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2 && !/^\d+$/.test(l));

    const merchant = lines[0] || 'Unknown Merchant';

    // ── Detect category ───────────────────────────────────
    const lower = text.toLowerCase();
    let category = 'Other';
    let emoji = '📦';

    if (/restaurant|cafe|coffee|pizza|burger|food|meal|lunch|dinner|breakfast|kfc|java|subway|chicken|bar/i.test(lower)) {
      category = 'Food'; emoji = '🍽️';
    } else if (/supermarket|grocery|shopping|mart|store|shop/i.test(lower)) {
      category = 'Shopping'; emoji = '🛍️';
    } else if (/petrol|fuel|shell|total|kenol|oil|station|litre/i.test(lower)) {
      category = 'Transport'; emoji = '⛽';
    } else if (/uber|bolt|taxi|matatu|bus|transit|transport/i.test(lower)) {
      category = 'Transport'; emoji = '🚌';
    } else if (/hotel|airbnb|accommodation|lodge|resort|inn|guest/i.test(lower)) {
      category = 'Housing'; emoji = '🏨';
    } else if (/cinema|movie|ticket|event|concert|show|game/i.test(lower)) {
      category = 'Entertainment'; emoji = '🎭';
    } else if (/hospital|pharmacy|clinic|medical|doctor|health|drug/i.test(lower)) {
      category = 'Health'; emoji = '💊';
    } else if (/safaricom|airtel|telkom|internet|wifi|broadband/i.test(lower)) {
      category = 'Utilities'; emoji = '📶';
    }

    // Clean up temp file if needed (optional — keep for history)

    return res.json({
      success:    true,
      rawText:    text,
      amount:     amount,
      merchant:   merchant,
      category:   category,
      emoji:      emoji,
      receiptUrl: receiptUrl,
    });
  } catch (err) {
    console.error('OCR error:', err.message);
    next(err);
  }
};
