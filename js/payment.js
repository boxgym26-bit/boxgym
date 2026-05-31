/* ============================================
   BOXGYM — PAYMENT.JS
   Payment page logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Declare all DOM refs at the top — avoids any hoisting confusion
  const form        = document.getElementById('paymentForm');
  const methods     = document.querySelectorAll('.payment-method');
  const cardForm    = document.getElementById('cardForm');
  const mbwayForm   = document.getElementById('mbwayForm');
  const mbInfo      = document.getElementById('multibancoInfo');
  const confirmSect = document.getElementById('confirmSection');
  const payFormSection = document.getElementById('payFormSection'); // ← moved to top
  const payOrder    = document.getElementById('payOrderSummary');
  const orderList   = document.getElementById('payOrderList');
  const payTotal    = document.getElementById('payTotal');

  let selectedMethod = 'card';

  // ── Guard: redirect if no items ───────────
  if (Cart.count() === 0 && !document.getElementById('confId')?.textContent) {
    // Allow page to load — user may have confirmed already
  }

  // ── Load cart summary ──────────────────────
  function loadSummary() {
    const items = Cart.get();
    const user  = Account.get();
    const hasPlan = user && user.plan;
    const planUsedSoFar = user ? (user.planSessions || 0) : 0;
    let planCovered = 0;

    if (!orderList) return;
    orderList.innerHTML = '';

    if (items.length === 0) {
      orderList.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:1rem;">
        Sem sessões selecionadas.<br>
        <a href="reservar.html" style="color:var(--accent)">Voltar a reservar</a>
      </p>`;
      if (payTotal) payTotal.textContent = '0,00€';
      return;
    }

    items.forEach(item => {
      // Plan covers sessions in order until allowance runs out
      const isFree = hasPlan && (planUsedSoFar + planCovered) < 11;
      if (isFree) planCovered++;

      const hStr = String(item.slot).padStart(2,'0');
      const sessionCost = isFree ? 0 : item.price;
      const compExtra   = item.companion ? 1.5 : 0;
      const lineTotalCost = sessionCost + compExtra;

      const row = document.createElement('div');
      row.className = 'summary-item';

      // Build price display: show "PLANO" badge + companion cost separately if applicable
      let priceDisplay;
      if (isFree && item.companion) {
        // Plan covers session but companion still costs 1.50€
        priceDisplay = `<span style="color:var(--green);font-size:0.7rem;font-weight:700;">PLANO</span> + ${fmtPrice(compExtra)}`;
      } else if (isFree) {
        priceDisplay = `<span style="color:var(--green);font-size:0.72rem;font-weight:700;">PLANO</span>`;
      } else {
        priceDisplay = fmtPrice(lineTotalCost);
      }

      row.innerHTML = `
        <span class="summary-item-label" style="font-size:0.8rem;">
          ${fmtDate(item.date)}<br>
          <span style="color:var(--muted2)">${hStr}h00 · ${item.label}${item.companion ? ' · 👥 +1,50€' : ''}</span>
        </span>
        <span style="font-weight:600;white-space:nowrap;">${priceDisplay}</span>
      `;
      orderList.appendChild(row);
    });

    const total = Cart.total();
    if (payTotal) payTotal.textContent = fmtPrice(total);
  }

  loadSummary();

  // ── Payment method selection ───────────────
  methods.forEach(method => {
    method.addEventListener('click', () => {
      methods.forEach(m => m.classList.remove('selected'));
      method.classList.add('selected');
      selectedMethod = method.querySelector('input[type="radio"]').value;

      if (cardForm)   cardForm.style.display  = selectedMethod === 'card'       ? 'block' : 'none';
      if (mbwayForm)  mbwayForm.style.display  = selectedMethod === 'mbway'      ? 'block' : 'none';
      if (mbInfo)     mbInfo.style.display     = selectedMethod === 'multibanco' ? 'block' : 'none';
    });
  });

  // ── Validation ────────────────────────────
  function validateCard() {
    const num   = document.getElementById('cardNumber')?.value.replace(/\s/g,'');
    const name  = document.getElementById('cardName')?.value.trim();
    const exp   = document.getElementById('cardExpiry')?.value;
    const cvv   = document.getElementById('cardCVV')?.value;
    const terms = document.getElementById('termsCheck')?.checked;

    if (!num || num.length < 16)               { Toast.show('Número de cartão inválido', 'error'); return false; }
    if (!name || name.length < 3)              { Toast.show('Nome no cartão obrigatório', 'error'); return false; }
    if (!exp || !/^\d{2}\/\d{2}$/.test(exp))  { Toast.show('Validade inválida (ex: 12/27)', 'error'); return false; }
    if (!cvv || cvv.length < 3)                { Toast.show('CVV inválido (3-4 dígitos)', 'error'); return false; }
    if (!terms)                                { Toast.show('Deves aceitar o Regulamento para continuar', 'error'); return false; }
    return true;
  }

  function validateMBWay() {
    const phone = document.getElementById('mbwayPhone')?.value.replace(/\s/g,'');
    const terms = document.getElementById('termsCheckMBWay')?.checked;
    if (!phone || phone.length < 9) { Toast.show('Número de telemóvel inválido (9 dígitos)', 'error'); return false; }
    if (!terms)                     { Toast.show('Deves aceitar o Regulamento para continuar', 'error'); return false; }
    return true;
  }

  function validateMultibanco() {
    const terms = document.getElementById('termsCheckMB')?.checked;
    if (!terms) { Toast.show('Deves aceitar o Regulamento para continuar', 'error'); return false; }
    return true;
  }

  // ── Payment submit ─────────────────────────
  function processPayment() {
    if (Cart.count() === 0) {
      Toast.show('Não tens sessões no carrinho', 'error');
      return;
    }
    if (selectedMethod === 'card'       && !validateCard())       return;
    if (selectedMethod === 'mbway'      && !validateMBWay())      return;
    if (selectedMethod === 'multibanco' && !validateMultibanco())  return;

    // Disable all pay buttons and show loading state
    const payBtns = document.querySelectorAll('.pay-action-btn');
    payBtns.forEach(b => {
      b.disabled = true;
      b.dataset.originalText = b.innerHTML;
      b.innerHTML = '<span style="display:inline-flex;align-items:center;gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 16 16" style="animation:spin 0.7s linear infinite"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="25" stroke-dashoffset="10"/></svg>A processar…</span>';
    });

    const delay = selectedMethod === 'multibanco' ? 800 : 2200;
    setTimeout(showConfirmation, delay);
  }

  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); processPayment(); });
  }
  document.querySelectorAll('.pay-action-btn:not([type="submit"])').forEach(btn => {
    btn.addEventListener('click', processPayment);
  });

  // ── Confirmation ───────────────────────────
  function showConfirmation() {
    const ref = 'BG-' + Math.random().toString(36).slice(2,8).toUpperCase();
    const items = Cart.get();
    const total = Cart.total();
    const methodLabels = { card: 'Cartão Bancário', mbway: 'MB Way', multibanco: 'Multibanco' };

    // Populate confirmation details
    const confId   = document.getElementById('confId');
    const confSess = document.getElementById('confSessions');
    const confTot  = document.getElementById('confTotal');
    const confMeth = document.getElementById('confMethod');
    if (confId)   confId.textContent   = ref;
    if (confSess) confSess.textContent = `${items.length} sessão(ões)`;
    if (confTot)  confTot.textContent  = fmtPrice(total);
    if (confMeth) confMeth.textContent = methodLabels[selectedMethod];

    // Multibanco reference details
    if (selectedMethod === 'multibanco') {
      const mbRefEl = document.getElementById('multibancoRef');
      if (mbRefEl) {
        mbRefEl.style.display = 'block';
        document.getElementById('mbEntity').textContent = '11249';
        document.getElementById('mbRef').textContent =
          Math.floor(Math.random()*900000000+100000000)
            .toString()
            .replace(/(.{3})(.{3})(.{3})/, '$1 $2 $3');
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 5);
        document.getElementById('mbDeadline').textContent =
          deadline.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
      }
    }

    // Save bookings to account & update planSessions correctly
    const user = Account.get();
    if (user) {
      const bookings = user.bookings || [];
      items.forEach(item => {
        bookings.push({
          ref,
          date:      item.date,
          slot:      item.slot,
          label:     item.label,
          price:     item.price,
          companion: item.companion || false,
          method:    selectedMethod,
          status:    selectedMethod === 'multibanco' ? 'pending' : 'confirmed',
          createdAt: new Date().toISOString()
        });
      });
      user.bookings = bookings;

      // BUG FIX: count sessions actually covered by plan (not filtering by companion)
      if (user.plan) {
        const allowanceLeft = Math.max(0, 11 - (user.planSessions || 0));
        const newFree = Math.min(items.length, allowanceLeft); // sessions covered, max remaining allowance
        user.planSessions = (user.planSessions || 0) + newFree;
      }
      Account.set(user);
    }

    Cart.clear();

    // Swap sections
    if (payFormSection) payFormSection.style.display = 'none';
    if (payOrder)       payOrder.style.display       = 'none';
    if (confirmSect) {
      confirmSect.style.display = 'block';
      confirmSect.scrollIntoView({ behavior: 'smooth' });
    }

    Toast.show('Reserva confirmada com sucesso! 🎉', 'success', 5000);
  }
});
