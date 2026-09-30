const isMeaningfulValue = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s === '—' || s === '-') return false;
  return true;
};

/**
 * Extracts visible, meaningful data from the current screen.
 * Only reads elements marked with data-chatbot="...".
 *
 * Returns: { [label: string]: string }
 */
export function extractChatbotScreenData(root = document) {
  try {
    const nodes = root.querySelectorAll?.('[data-chatbot]') || [];
    const out = {};
    const counts = {};

    nodes.forEach((el) => {
      const key = el.getAttribute('data-chatbot');
      if (!key) return;

      let value = '';
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        value = el.value;
      } else {
        value = el.textContent;
      }

      const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
      if (!isMeaningfulValue(trimmed)) return;

      // If same key appears multiple times, store as array
      if (out[key] === undefined) {
        out[key] = trimmed;
        counts[key] = 1;
      } else {
        // Convert to array on second occurrence
        if (counts[key] === 1) {
          out[key] = [out[key]];
        }
        out[key].push(trimmed);
        counts[key]++;
      }
    });

    return out;
  } catch (e) {
    return {};
  }
}

// Expose globally so ChatBot components can call it without refactors.
// This is safe because it’s a pure function.
if (typeof window !== 'undefined') {
  window.__chatbotExtractScreenData = () => extractChatbotScreenData(document);
}

