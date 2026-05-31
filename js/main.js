/* ============================================
   BOXGYM — MAIN.JS
   Nav, animations, toasts, account, cart
   ============================================ */

// ── NAV ──────────────────────────────────────
const nav = document.querySelector('.nav');
const burger = document.querySelector('.nav-burger');
const mobileMenu = document.querySelector('.nav-mobile');

if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  });
}

if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!burger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
    }
  });
}

// Highlight active nav link
document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
  if (a.getAttribute('href') === location.pathname.split('/').pop()) {
    a.classList.add('active');
  }
});

// ── FADE-UP OBSERVER ────────────────────────
const fadeEls = document.querySelectorAll('.fade-up');
if (fadeEls.length) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  fadeEls.forEach(el => obs.observe(el));
}

// ── COUNTER ANIMATION ────────────────────────
function animateCounter(el, target, duration = 1200) {
  let start = 0;
  const step = ts => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}
document.querySelectorAll('[data-counter]').forEach(el => {
  const target = parseInt(el.dataset.counter, 10);
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { animateCounter(el, target); obs.disconnect(); }
  });
  obs.observe(el);
});

// ── TOAST ────────────────────────────────────
const Toast = (() => {
  const container = document.querySelector('.toast-container');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors = { success: 'var(--green)', error: 'var(--red)', warning: 'var(--yellow)', info: 'var(--blue)' };

  function show(msg, type = 'success', duration = 3200) {
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span style="color:${colors[type]};font-weight:700;font-size:1rem;">${icons[type]}</span>
      <span>${msg}</span>
    `;
    container.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      t.addEventListener('animationend', () => t.remove());
    }, duration);
  }
  return { show };
})();

// ── ACCOUNT ──────────────────────────────────
const Account = (() => {
  const KEY = 'bg_account';

  function get() {
    try {
      const u = JSON.parse(localStorage.getItem(KEY));
      // Merge shop orders from standalone storage so orders are visible
      // even if they were created while logged out or in a different flow.
      try {
        const ordersRaw = localStorage.getItem('boxgym_shop_orders');
        const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
        if (u) {
          u.shopOrders = Array.isArray(orders) && orders.length ? orders : (Array.isArray(u.shopOrders) ? u.shopOrders : []);
        }
      } catch (e) {}
      return u;
    } catch { return null; }
  }
  function set(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function logout() {
    localStorage.removeItem(KEY);
    location.reload();
  }
  function hasPlan() {
    const u = get();
    return u && u.plan === true;
  }
  function planSessions() {
    const u = get();
    return u ? (u.planSessions || 0) : 0;
  }

  // Update nav account link state
  function updateNav() {
    const u = get();
    const links = document.querySelectorAll('.nav-account');
    links.forEach(el => {
      if (u) {
        const dot = el.querySelector('.dot');
        el.innerHTML = '';
        if (dot) el.appendChild(dot);
        el.insertAdjacentText('beforeend', ` ${u.name ? u.name.split(' ')[0] : 'Conta'}`);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', updateNav);
  return { get, set, logout, hasPlan, planSessions };
})();

// ── CART ─────────────────────────────────────
const Cart = (() => {
  const KEY = 'bg_cart';

  function get() {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(items) {
    sessionStorage.setItem(KEY, JSON.stringify(items));
  }
  function add(item) {
    const items = get();
    // Prevent duplicate slot
    if (items.find(i => i.date === item.date && i.slot === item.slot)) return false;
    items.push(item);
    save(items);
    return true;
  }
  function remove(date, slot) {
    save(get().filter(i => !(i.date === date && i.slot === slot)));
  }
  function toggleCompanion(date, slot) {
    const items = get();
    const idx = items.findIndex(i => i.date === date && i.slot === slot);
    if (idx >= 0) {
      items[idx].companion = !items[idx].companion;
      save(items);
    }
  }
  function clear() { sessionStorage.removeItem(KEY); }

  function total() {
    const user = Account.get();
    const hasPlan = user && user.plan;
    const used = user ? (user.planSessions || 0) : 0;
    const planAllowance = hasPlan ? Math.max(0, 11 - used) : 0;
    let covered = 0;
    return get().reduce((sum, item) => {
      let price = item.price;
      if (hasPlan && covered < planAllowance) {
        price = 0; // session covered by plan
        covered++;
      }
      // Companion always costs 1.50€, regardless of plan coverage
      if (item.companion) price += 1.5;
      return sum + price;
    }, 0);
  }

  // Returns how many sessions in cart are covered by the plan
  function coveredByPlan() {
    const user = Account.get();
    if (!user || !user.plan) return 0;
    const allowance = Math.max(0, 11 - (user.planSessions || 0));
    return Math.min(get().length, allowance);
  }

  function count() { return get().length; }

  return { get, add, remove, toggleCompanion, clear, total, count, coveredByPlan };
})();

// ── PRICING ──────────────────────────────────
function getSlotPrice(hour) {
  // 05h–06h blocked (cleaning)
  if (hour === 5) return null;
  if (hour >= 6 && hour < 9)   return { price: 4.00, label: 'Off-Peak', badge: 'badge-low' };
  if (hour >= 9 && hour < 17)  return { price: 7.00, label: 'Standard', badge: 'badge-mid' };
  if (hour >= 17 && hour < 23) return { price: 9.00, label: 'Premium',  badge: 'badge-high' };
  // 22–24 and 0–5
  return { price: 4.00, label: 'Off-Peak', badge: 'badge-night' };
}

function fmtPrice(n) {
  return n.toFixed(2).replace('.', ',') + '€';
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${days[dt.getDay()]}, ${d} ${months[m-1]} ${y}`;
}

// ── CARD INPUT MASKS ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const cardNum = document.getElementById('cardNumber');
  if (cardNum) {
    cardNum.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  const expiry = document.getElementById('cardExpiry');
  if (expiry) {
    expiry.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
      e.target.value = v;
    });
  }
  const cvv = document.getElementById('cardCVV');
  if (cvv) {
    cvv.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
  }
});

// ── ACCOUNT TAB SWITCHING ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.account-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.account-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = document.getElementById(target);
      if (content) content.classList.add('active');
    });
  });
});