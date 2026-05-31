/* ============================================
   BOXGYM — CALENDAR.JS
   Interactive booking calendar + time slots
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const calGrid    = document.getElementById('calendarGrid');
  const calTitle   = document.getElementById('calendarTitle');
  const prevBtn    = document.getElementById('prevMonth');
  const nextBtn    = document.getElementById('nextMonth');
  const slotsPanel = document.getElementById('slotsPanel');
  const slotsGrid  = document.getElementById('slotsGrid');
  const slotDateLabel = document.getElementById('slotDateLabel');
  const sessionList   = document.getElementById('sessionList');
  const cartTotal     = document.getElementById('cartTotal');
  const proceedBtn    = document.getElementById('proceedBtn');
  const cartBadge     = document.getElementById('cartBadge');
  const planBar       = document.getElementById('planBar');
  const planUsed      = document.getElementById('planUsed');

  if (!calGrid) return;

  const now = new Date(); // exact current time

  const today = new Date();
  today.setHours(0,0,0,0);

  // Minimum bookable time = EXACTLY 24 hours from now
  const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // For calendar day-level check: earliest selectable day
  const minDate = new Date(minDateTime);
  minDate.setHours(0,0,0,0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = null;

  // Fake occupancy: seed some slots as taken (deterministic by date+slot hash)
  function isTaken(dateStr, hour) {
    const hash = (dateStr + hour).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xfff, 0);
    return hash % 7 === 0; // ~14% taken
  }

  // Availability level for a date (0=none, 1=full, 2=mid, 3=high)
  function dayAvail(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    if (d < minDate || d > maxDate) return 0; // past or beyond 30d
    // Count taken out of all slots (06-23, skip 05)
    const slots = Array.from({length: 23}, (_, i) => i + 1).filter(h => h !== 5);
    const dateStr = toISO(date);
    const taken = slots.filter(h => isTaken(dateStr, h)).length;
    const ratio = taken / slots.length;
    if (ratio > 0.7) return 1; // full
    if (ratio > 0.4) return 2; // mid
    return 3; // high
  }

  function toISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function renderCalendar() {
    calTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay  = new Date(viewYear, viewMonth + 1, 0);

    // Monday-first: 0=Mon … 6=Sun
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    calGrid.innerHTML = '';

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      const el = document.createElement('div');
      el.className = 'cal-day empty';
      calGrid.appendChild(el);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = toISO(date);
      const avail = dayAvail(date);
      const isPast   = date < minDate;  // before the earliest bookable day
      const isFuture = date > maxDate;
      const isToday  = date.toDateString() === today.toDateString();
      const isSel    = selectedDate === dateStr;

      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = d;

      if (isToday) el.classList.add('today');
      if (isPast || isFuture) {
        el.classList.add(isPast ? 'past' : 'disabled');
      } else {
        const dot = document.createElement('div');
        dot.className = 'cal-day-dot';
        el.appendChild(dot);

        if (avail === 1)      el.classList.add('avail-full');
        else if (avail === 2) el.classList.add('avail-mid');
        else                  el.classList.add('avail-high');

        el.addEventListener('click', () => selectDate(dateStr));
      }
      if (isSel) el.classList.add('selected');

      calGrid.appendChild(el);
    }

    // Prev/next navigation bounds
    const prevMonth = new Date(viewYear, viewMonth - 1, 1);
    prevBtn.disabled = prevMonth < new Date(today.getFullYear(), today.getMonth(), 1);

    const nextMonth = new Date(viewYear, viewMonth + 1, 1);
    nextBtn.disabled = nextMonth > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  }

  function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderSlots(dateStr);
    slotsPanel.style.display = 'block';
    slotDateLabel.textContent = fmtDate(dateStr);
    slotsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderSlots(dateStr) {
    slotsGrid.innerHTML = '';
    const cartItems = Cart.get();

    // Hours 6–23, 0–4 (skip 5 = cleaning)
    const hours = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4];

    hours.forEach(hour => {
      const info = getSlotPrice(hour);
      if (!info) return; // blocked (hour 5)

      const hStr = String(hour).padStart(2,'0');
      const hEnd = String((hour + 1) % 24).padStart(2,'0');
      const taken = isTaken(dateStr, hour);
      const inCart = cartItems.find(i => i.date === dateStr && i.slot === hour);

      // Check if this specific slot is at least 24h away from now
      const [y, m, d] = dateStr.split('-').map(Number);
      const slotDateTime = new Date(y, m - 1, d, hour, 0, 0, 0);
      const tooSoon = slotDateTime < minDateTime;

      const btn = document.createElement('button');
      btn.className = `slot-btn${taken ? ' slot-taken' : ''}${tooSoon ? ' slot-blocked' : ''}${inCart ? ' slot-selected' : ''}`;
      btn.disabled = taken || tooSoon;
      btn.title = tooSoon ? 'Fora do prazo — mínimo 24h de antecedência' : '';
      btn.innerHTML = `
        <span class="slot-time">${hStr}h</span>
        <span class="slot-period">${tooSoon ? '< 24h' : info.label}</span>
        <span class="slot-price">${tooSoon ? '—' : fmtPrice(info.price)}</span>
      `;

      if (!taken && !tooSoon) {
        btn.addEventListener('click', () => {
          if (inCart) {
            Cart.remove(dateStr, hour);
            Toast.show(`Sessão das ${hStr}h removida`, 'info');
          } else {
            const added = Cart.add({ date: dateStr, slot: hour, price: info.price, label: info.label });
            if (added) Toast.show(`Sessão das ${hStr}h adicionada!`, 'success');
            else Toast.show('Esta sessão já está no carrinho', 'warning');
          }
          renderSlots(dateStr);
          renderCart();
        });
      }

      slotsGrid.appendChild(btn);
    });
  }

  function renderCart() {
    if (!sessionList) return;
    const items = Cart.get();
    const user  = Account.get();
    const hasPlan = user && user.plan;
    const planAllowanceTotal = 11;
    const planUsedSoFar = user ? (user.planSessions || 0) : 0;
    let planCovered = 0;

    if (items.length === 0) {
      sessionList.innerHTML = `
        <div class="sessions-empty">
          <span>📅</span>
          Nenhuma sessão selecionada ainda.
        </div>`;
    } else {
      sessionList.innerHTML = '';
      items.forEach(item => {
        const isFree = hasPlan && (planUsedSoFar + planCovered) < planAllowanceTotal;
        if (isFree) planCovered++;

        const el = document.createElement('div');
        el.className = 'session-item';
        const hStr = String(item.slot).padStart(2,'0');
        const displayPrice = isFree ? 0 : item.price;
        const companion = item.companion || false;
        el.innerHTML = `
          <div class="session-item-header">
            <span class="session-item-date">${fmtDate(item.date)}</span>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span class="session-item-price">${isFree ? '<span style="color:var(--green);font-size:0.72rem;">PLANO</span>' : fmtPrice(displayPrice)}</span>
              <button class="session-remove" title="Remover" data-date="${item.date}" data-slot="${item.slot}">✕</button>
            </div>
          </div>
          <div class="session-item-meta">
            <span>${hStr}h00 — ${item.label}</span>
            <button class="session-companion-btn ${companion ? 'active' : ''}" data-date="${item.date}" data-slot="${item.slot}">
              ${companion ? '👥 +1,50€ Acompanhante' : '+ 1,50€ Acompanhante'}
            </button>
          </div>
        `;
        sessionList.appendChild(el);
      });

      // Remove handlers
      sessionList.querySelectorAll('.session-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          Cart.remove(btn.dataset.date, parseInt(btn.dataset.slot));
          if (selectedDate) renderSlots(selectedDate);
          renderCart();
        });
      });

      // Companion handlers
      sessionList.querySelectorAll('.session-companion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Cart.toggleCompanion(btn.dataset.date, parseInt(btn.dataset.slot));
          renderCart();
        });
      });
    }

    // Total
    const total = Cart.total();
    if (cartTotal) cartTotal.textContent = fmtPrice(total);

    // Cart badge
    if (cartBadge) {
      const count = Cart.count();
      if (count > 0) {
        cartBadge.style.display = 'inline-flex';
        cartBadge.textContent = count;
      } else {
        cartBadge.style.display = 'none';
      }
    }

    // Proceed button
    if (proceedBtn) {
      if (Cart.count() > 0) {
        proceedBtn.style.opacity = '1';
        proceedBtn.style.pointerEvents = 'auto';
      } else {
        proceedBtn.style.opacity = '0.4';
        proceedBtn.style.pointerEvents = 'none';
      }
    }

    // Plan progress
    if (planBar && planUsed && hasPlan) {
      const newUsed = Math.min(planUsedSoFar + planCovered, planAllowanceTotal);
      planBar.style.width = `${(newUsed / planAllowanceTotal) * 100}%`;
      planUsed.textContent = `${newUsed}/${planAllowanceTotal}`;
    }
  }

  // Nav handlers
  prevBtn.addEventListener('click', () => {
    if (viewMonth === 0) { viewMonth = 11; viewYear--; }
    else viewMonth--;
    renderCalendar();
  });
  nextBtn.addEventListener('click', () => {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; }
    else viewMonth++;
    renderCalendar();
  });

  renderCalendar();
  renderCart();
});