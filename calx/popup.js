'use strict';

// ─── State ────────────────────────────────────────────────────────────────
const state = {
  current:        '0',
  previous:       null,
  operator:       null,
  waitingForNext: false,
  justCalculated: false,
  history:        []
};

// ─── DOM refs ─────────────────────────────────────────────────────────────
const currentValEl  = document.getElementById('currentVal');
const expressionEl  = document.getElementById('expression');
const historyPanel  = document.getElementById('historyPanel');
const historyToggle = document.getElementById('historyToggle');
const historyList   = document.getElementById('historyList');
const clearHistBtn  = document.getElementById('clearHistory');

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatNumber(num) {
  if (typeof num === 'string' && (num === 'Error' || num === 'Infinity' || num === '-Infinity')) return num;
  const n = parseFloat(num);
  if (isNaN(n)) return 'Error';
  if (!isFinite(n)) return n > 0 ? '∞' : '−∞';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return n.toExponential(4).replace('e+', 'e');
  }
  return parseFloat(n.toPrecision(10)).toString();
}

function setExpression(text) {
  expressionEl.textContent = text || '\u00a0';
}

function updateClearLabel() {
  const acBtn = document.querySelector('[data-action="clear"]');
  if (!acBtn) return;
  acBtn.textContent = (!state.justCalculated && state.current !== '0' && state.current !== 'Error') ? 'C' : 'AC';
}

function updateDisplay() {
  const val = state.current;
  currentValEl.textContent = val;

  currentValEl.classList.remove('size-md', 'size-sm', 'size-xs', 'error', 'has-result');
  if (val === 'Error' || val === '∞' || val === '−∞') {
    currentValEl.classList.add('error');
  } else if (val.length > 13) {
    currentValEl.classList.add('size-xs');
  } else if (val.length > 10) {
    currentValEl.classList.add('size-sm');
  } else if (val.length > 7) {
    currentValEl.classList.add('size-md');
  }
  if (state.justCalculated) currentValEl.classList.add('has-result');

  updateClearLabel();
}

function popAnimation() {
  currentValEl.classList.remove('pop');
  void currentValEl.offsetWidth;
  currentValEl.classList.add('pop');
  setTimeout(() => currentValEl.classList.remove('pop'), 200);
}

// ─── History ──────────────────────────────────────────────────────────────
function addHistory(expr, result) {
  state.history.unshift({ expr, result });
  if (state.history.length > 20) state.history.pop();
  renderHistory();
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHistory() {
  if (state.history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
    return;
  }
  historyList.innerHTML = state.history.map((item, i) =>
    `<div class="history-item" data-index="${i}">
      <span class="h-expr">${escapeHtml(item.expr)}</span>
      <span class="h-result">${escapeHtml(item.result)}</span>
    </div>`
  ).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = state.history[parseInt(el.dataset.index)];
      state.current        = item.result;
      state.justCalculated = true;
      state.waitingForNext = false;
      state.previous       = null;
      state.operator       = null;
      setExpression(item.expr);
      updateDisplay();
    });
  });
}

// ─── Core logic ───────────────────────────────────────────────────────────
function calculate(a, op, b) {
  const x = parseFloat(a), y = parseFloat(b);
  switch (op) {
    case '+': return x + y;
    case '−': return x - y;
    case '×': return x * y;
    case '÷': return y === 0 ? 'Error' : x / y;
    default:  return y;
  }
}

function inputDigit(digit) {
  if (state.current === 'Error') reset();
  if (state.waitingForNext || state.justCalculated) {
    state.current        = digit;
    state.waitingForNext = false;
    state.justCalculated = false;
  } else {
    if (state.current.replace('-', '').replace('.', '').length >= 15) return;
    state.current = state.current === '0' ? digit : state.current + digit;
  }
  updateDisplay();
}

function inputDecimal() {
  if (state.current === 'Error') reset();
  if (state.waitingForNext || state.justCalculated) {
    state.current        = '0.';
    state.waitingForNext = false;
    state.justCalculated = false;
    updateDisplay();
    return;
  }
  if (!state.current.includes('.')) {
    state.current += '.';
    updateDisplay();
  }
}

function inputOperator(op) {
  if (state.current === 'Error') return;
  if (state.operator && !state.waitingForNext && !state.justCalculated) {
    const rs = formatNumber(calculate(state.previous, state.operator, state.current));
    setExpression(`${state.previous} ${state.operator} ${state.current} ${op}`);
    state.previous = rs;
    state.current  = rs;
  } else {
    state.previous = state.current;
    setExpression(`${state.current} ${op}`);
  }
  state.operator       = op;
  state.waitingForNext = true;
  state.justCalculated = false;
  document.querySelectorAll('.btn.op').forEach(b => {
    b.classList.toggle('active-op', b.dataset.op === op);
  });
  updateDisplay();
}

function inputEquals() {
  if (state.current === 'Error') return;
  if (!state.operator) {
    setExpression(`${state.current} =`);
    state.justCalculated = true;
    updateDisplay();
    return;
  }
  const expr = `${state.previous} ${state.operator} ${state.current}`;
  const rs   = formatNumber(calculate(state.previous, state.operator, state.current));
  addHistory(`${expr} =`, rs);
  setExpression(`${expr} =`);
  state.current        = rs;
  state.previous       = null;
  state.operator       = null;
  state.waitingForNext = false;
  state.justCalculated = true;
  document.querySelectorAll('.btn.op').forEach(b => b.classList.remove('active-op'));
  popAnimation();
  updateDisplay();
}

function inputPercent() {
  if (state.current === 'Error') return;
  const val = parseFloat(state.current);
  state.current = (state.previous !== null && state.operator)
    ? formatNumber(parseFloat(state.previous) * val / 100)
    : formatNumber(val / 100);
  updateDisplay();
}

function inputNegate() {
  if (state.current === 'Error' || state.current === '0') return;
  state.current = state.current.startsWith('-') ? state.current.slice(1) : '-' + state.current;
  updateDisplay();
}

function inputBackspace() {
  if (state.current === 'Error') { reset(); return; }
  if (state.justCalculated || state.waitingForNext) return;
  if (state.current.length > 1) {
    state.current = state.current.slice(0, -1);
    if (state.current === '-') state.current = '0';
  } else {
    state.current = '0';
  }
  updateDisplay();
}

function inputSqrt() {
  if (state.current === 'Error') return;
  const val = parseFloat(state.current);
  const expr = `√(${state.current})`;
  state.current        = val < 0 ? 'Error' : formatNumber(Math.sqrt(val));
  state.justCalculated = true;
  state.waitingForNext = false;
  if (state.current !== 'Error') addHistory(expr, state.current);
  setExpression(expr + ' =');
  popAnimation();
  updateDisplay();
}

function inputSquare() {
  if (state.current === 'Error') return;
  const val = parseFloat(state.current);
  const expr = `(${state.current})²`;
  state.current        = formatNumber(val * val);
  state.justCalculated = true;
  state.waitingForNext = false;
  addHistory(expr, state.current);
  setExpression(expr + ' =');
  popAnimation();
  updateDisplay();
}

function inputInverse() {
  if (state.current === 'Error') return;
  const val = parseFloat(state.current);
  const expr = `1/(${state.current})`;
  state.current        = val === 0 ? 'Error' : formatNumber(1 / val);
  state.justCalculated = true;
  state.waitingForNext = false;
  if (state.current !== 'Error') addHistory(expr, state.current);
  setExpression(expr + ' =');
  popAnimation();
  updateDisplay();
}

function reset() {
  state.current        = '0';
  state.previous       = null;
  state.operator       = null;
  state.waitingForNext = false;
  state.justCalculated = false;
  setExpression('');
  document.querySelectorAll('.btn.op').forEach(b => b.classList.remove('active-op'));
  updateDisplay();
}

// ─── Ripple ───────────────────────────────────────────────────────────────
function addRipple(btn, e) {
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height) * 1.2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ─── Click events ─────────────────────────────────────────────────────────
document.querySelector('.keypad').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  addRipple(btn, e);
  switch (btn.dataset.action) {
    case 'digit':     inputDigit(btn.dataset.digit); break;
    case 'decimal':   inputDecimal();                break;
    case 'op':        inputOperator(btn.dataset.op); break;
    case 'equals':    inputEquals();                 break;
    case 'clear':     reset();                       break;
    case 'negate':    inputNegate();                 break;
    case 'percent':   inputPercent();                break;
    case 'backspace': inputBackspace();              break;
    case 'sqrt':      inputSqrt();                   break;
    case 'square':    inputSquare();                 break;
    case 'inverse':   inputInverse();                break;
  }
});

// ─── Keyboard ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if ('0123456789'.includes(k))        { inputDigit(k);     return; }
  if (k === '.')                        { inputDecimal();    return; }
  if (k === '+')                        { inputOperator('+'); return; }
  if (k === '-')                        { inputOperator('−'); return; }
  if (k === '*')                        { inputOperator('×'); return; }
  if (k === '/') { e.preventDefault();   inputOperator('÷'); return; }
  if (k === 'Enter' || k === '=')       { inputEquals();     return; }
  if (k === 'Backspace')                { inputBackspace();  return; }
  if (k === 'Escape')                   { reset();           return; }
  if (k === '%')                        { inputPercent();    return; }
  if (k === 's' || k === 'S')           { inputSqrt();       return; }
});

// ─── History toggle ───────────────────────────────────────────────────────
historyToggle.addEventListener('click', () => {
  const open = historyPanel.classList.toggle('open');
  historyToggle.classList.toggle('active', open);
});

clearHistBtn.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

// ─── Init ─────────────────────────────────────────────────────────────────
updateDisplay();
renderHistory();
