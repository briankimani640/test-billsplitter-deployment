// Browser Contact Picker API helper.
// Supported on Chrome/Android and some mobile browsers over HTTPS.
// Returns [{ name, phones: [...] }] or throws a friendly error.

export function contactsSupported() {
  return typeof navigator !== 'undefined' &&
         'contacts' in navigator &&
         'ContactsManager' in window;
}

export async function pickContacts({ multiple = true } = {}) {
  if (!contactsSupported()) {
    const e = new Error('Contact picker is not supported on this device/browser.');
    e.code = 'UNSUPPORTED';
    throw e;
  }
  // Ask for name + tel. The browser shows its own permission UI.
  const props = ['name', 'tel'];
  const selected = await navigator.contacts.select(props, { multiple });
  return (selected || []).map(c => ({
    name:   Array.isArray(c.name) ? c.name[0] : (c.name || ''),
    phones: (c.tel || []).map(t => String(t)),
  }));
}

// Normalise a phone to the last 10 digits (matches backend lookup).
export function normalizePhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}
