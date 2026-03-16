import { appendDataFastTracking } from './tracking.js';

export function initCreemDataFast() {
  if (typeof window === 'undefined') return;

  const updateLinks = () => {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="checkout.creem.io"]');
    for (const link of links) {
      try {
        const originalUrl = link.href;
        const newUrl = appendDataFastTracking(originalUrl);
        if (newUrl !== originalUrl) {
          link.href = newUrl;
        }
      } catch (e) {}
    }
  };

  updateLinks();
  const observer = new MutationObserver(updateLinks);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== 'undefined' && (window as any).CREEM_DATAFAST_AUTO_INIT) {
  initCreemDataFast();
}
