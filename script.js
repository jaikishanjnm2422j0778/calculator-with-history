'use strict';

/* ==========================================================
   Calculator logic (no eval, no libraries)

   The calculator keeps all of its data in one `state` object:
     current        the number being typed, as a string ("" while waiting for the 2nd number)
     previous       the first number of a pending calculation, as a string
     operator       the pending operator (+ − × ÷) or null
     lastExpression small text shown above the result, e.g. "25 + 15 ="
     errorMessage   text shown when something went wrong ("" when everything is fine)
     replaceOnInput true when the next digit typed should replace the number on screen
                    (after "=" or "%")
   ========================================================== */

/* ---------- Constants and DOM references ---------- */

const MAX_DIGITS = 15; // Longest number a user can type
const KEY_TO_OPERATOR = { '+': '+', '-': '−', '*': '×', '/': '÷' }; // Keyboard key → on-screen operator

const expressionElement = document.getElementById('expression');
const resultElement = document.getElementById('result');
const keypad = document.querySelector('.keypad');
const allKeys = Array.from(keypad.querySelectorAll('.key'));
const operatorKeys = allKeys.filter((key) => key.dataset.action === 'operator');

const historyToggle = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyClearButton = document.getElementById('history-clear');
const historyCloseButton = document.getElementById('history-close');

const HISTORY_STORAGE_KEY = 'calculator-history'; // Where the history is saved in the browser
const MAX_HISTORY_ITEMS = 50; // Oldest entries are dropped after this many

/* ---------- State ---------- */

// Returns a fresh "empty calculator" state.
function getInitialState() {
  return {
    current: '0',
    previous: '',
    operator: null,
    lastExpression: '',
    errorMessage: '',
    replaceOnInput: false,
  };
}

const state = getInitialState();

// Resets the state object without touching the screen.
function clearState() {
  Object.assign(state, getInitialState());
}

/* ---------- History ---------- */

// Each history entry looks like { expression: "25 + 15 =", result: "40" }, newest first.
let historyItems = loadHistory();

// Reads the saved history from the browser. Returns an empty list if nothing valid is saved
// or if the browser blocks storage (private mode, etc.), so the calculator never breaks.
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item && typeof item.expression === 'string' && typeof item.result === 'string')
      .slice(0, MAX_HISTORY_ITEMS);
  } catch (error) {
    return [];
  }
}

// Saves the history so it is still there after a page refresh (fails quietly if storage is blocked).
function saveHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems));
  } catch (error) {
    // Storage unavailable: history still works for this visit, it just won't be remembered.
  }
}

// Adds a finished calculation to the top of the history.
function addHistoryEntry(expression, result) {
  historyItems.unshift({ expression, result });
  historyItems = historyItems.slice(0, MAX_HISTORY_ITEMS);
  saveHistory();
  renderHistory();
}

// Rebuilds the history list on screen. Text is set with textContent, never innerHTML.
function renderHistory() {
  historyList.replaceChildren();

  historyItems.forEach((item, index) => {
    const entry = document.createElement('li');
    const button = document.createElement('button');
    const expression = document.createElement('span');
    const result = document.createElement('span');

    button.type = 'button';
    button.className = 'history__item';
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `Use result ${item.result} from ${item.expression}`);
    expression.className = 'history__expression';
    expression.textContent = item.expression;
    result.className = 'history__result';
    result.textContent = formatNumber(item.result);

    button.append(expression, result);
    entry.append(button);
    historyList.append(entry);
  });

  const isEmpty = historyItems.length === 0;
  historyEmpty.hidden = !isEmpty;
  historyList.hidden = isEmpty;
  historyClearButton.disabled = isEmpty;
}

// Returns true while the history panel is showing.
function isHistoryOpen() {
  return !historyPanel.hidden;
}

// Shows the history panel and moves keyboard focus into it.
function openHistory() {
  historyPanel.hidden = false;
  historyToggle.setAttribute('aria-expanded', 'true');
  historyCloseButton.focus();
}

// Hides the history panel and returns focus to the button that opened it.
function closeHistory() {
  historyPanel.hidden = true;
  historyToggle.setAttribute('aria-expanded', 'false');
  historyToggle.focus();
}

// Deletes every saved calculation.
function clearHistory() {
  historyItems = [];
  saveHistory();
  renderHistory();
}

// Puts a past result back on the display so the user can keep calculating with it.
function useHistoryEntry(index) {
  const item = historyItems[index];
  if (!item) return;

  clearState();
  state.current = item.result;
  state.lastExpression = item.expression;
  state.replaceOnInput = true; // typing a digit starts a new number; an operator continues from this one
  updateDisplay();
  closeHistory();
}

/* ---------- Formatting helpers ---------- */

// Counts only the digits in a number string (ignores "-" and ".").
function countDigits(text) {
  return text.replace(/[^0-9]/g, '').length;
}

// Turns a calculation result into a clean string:
// removes floating-point noise (0.1 + 0.2 → 0.3) and uses scientific notation
// for numbers that are too big or too small to fit on the display.
function formatResult(value) {
  const rounded = parseFloat(value.toPrecision(12));
  if (rounded === 0) return '0'; // also avoids showing "-0"

  const size = Math.abs(rounded);
  if (size >= 1e15 || size < 1e-9) {
    return rounded.toExponential(6).replace(/\.?0+e/, 'e'); // 1.500000e+21 → 1.5e+21
  }
  return String(rounded);
}

// Adds thousands separators for display only (1234567.5 → "1,234,567.5").
// Keeps a trailing "." so the user can see they just typed a decimal point.
function formatNumber(text) {
  if (text === '' || text.includes('e')) return text;

  const isNegative = text.startsWith('-');
  const [integerPart, decimalPart] = text.replace('-', '').split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (isNegative ? '-' : '') + grouped + (decimalPart !== undefined ? '.' + decimalPart : '');
}

// Builds the text of the pending calculation, e.g. "25 + 15".
function buildExpression() {
  return `${formatNumber(state.previous)} ${state.operator} ${formatNumber(state.current)}`;
}

/* ---------- Display ---------- */

// Picks a size bucket so long numbers shrink instead of overflowing (the CSS reads data-size).
function getSizeBucket(length) {
  if (length <= 8) return 'lg';
  if (length <= 11) return 'md';
  if (length <= 15) return 'sm';
  return 'xs';
}

// Redraws everything on screen from the current state.
function updateDisplay() {
  let mainText;
  if (state.errorMessage) {
    mainText = state.errorMessage;
  } else if (state.current === '') {
    mainText = formatNumber(state.previous); // waiting for the 2nd number: keep showing the 1st
  } else {
    mainText = formatNumber(state.current);
  }

  resultElement.textContent = mainText;
  resultElement.dataset.size = getSizeBucket(mainText.length);
  resultElement.classList.toggle('is-error', Boolean(state.errorMessage));

  expressionElement.textContent = state.operator
    ? `${formatNumber(state.previous)} ${state.operator}`
    : state.lastExpression;

  // Highlight the operator that is waiting for the second number
  operatorKeys.forEach((key) => {
    key.classList.toggle('is-active', state.operator === key.dataset.value && state.current === '');
  });
}

// Shows a friendly error message and replays the shake animation.
function showError(message, expression) {
  clearState();
  state.errorMessage = message;
  state.lastExpression = expression;
  updateDisplay();

  // Remove and re-add the class (with a reflow in between) so the animation restarts
  resultElement.classList.remove('is-error');
  void resultElement.offsetWidth;
  resultElement.classList.add('is-error');
}

/* ---------- Calculator operations ---------- */

// Does the math for one pair of numbers.
function applyOperator(a, b, operator) {
  switch (operator) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return a / b;
    default: return NaN;
  }
}

// Calculates the pending operation (previous operator current).
// Returns the result as a string, or null if an error was shown instead.
function evaluatePending() {
  const a = parseFloat(state.previous);
  const b = parseFloat(state.current);
  const expression = `${buildExpression()} =`;

  if (state.operator === '÷' && b === 0) {
    showError('Cannot divide by zero', expression);
    return null;
  }

  const result = applyOperator(a, b, state.operator);
  if (!Number.isFinite(result)) {
    showError('Invalid calculation', expression);
    return null;
  }
  return formatResult(result);
}

// Adds a digit or a decimal point to the number being typed.
function appendNumber(value) {
  if (state.errorMessage) clearState();

  // After "=" or "%", typing starts a brand-new number
  if (state.replaceOnInput) {
    state.current = '0';
    state.lastExpression = '';
    state.replaceOnInput = false;
  }
  if (state.current === '') state.current = '0'; // first digit after choosing an operator

  if (value === '.') {
    if (state.current.includes('.')) return; // only one decimal point allowed
    state.current += '.';
  } else {
    if (countDigits(state.current) >= MAX_DIGITS) return; // keep the number a sensible size
    if (state.current === '0') state.current = value; // no leading zeros ("07" → "7")
    else if (state.current === '-0') state.current = '-' + value;
    else state.current += value;
  }
  updateDisplay();
}

// Stores the chosen operator. If a calculation is already pending (5 + 3 +), it is
// calculated first so chains like 5 + 3 × 2 work left to right. Pressing two operators
// in a row simply replaces the first one.
function chooseOperator(operator) {
  if (state.errorMessage) clearState();

  if (state.current === '') {
    if (state.operator) {
      state.operator = operator; // consecutive operators: replace the previous one
      updateDisplay();
    }
    return;
  }

  if (state.operator !== null && state.previous !== '') {
    const result = evaluatePending();
    if (result === null) return; // an error is already on screen
    state.previous = result;
  } else {
    state.previous = state.current.replace(/\.$/, ''); // "5." becomes "5"
  }

  state.operator = operator;
  state.current = '';
  state.lastExpression = '';
  state.replaceOnInput = false;
  updateDisplay();
}

// Finishes the pending calculation and shows the result.
function calculate() {
  if (state.errorMessage || state.operator === null || state.current === '') return; // nothing to calculate

  const expression = `${buildExpression()} =`;
  const result = evaluatePending();
  if (result === null) return;

  state.current = result;
  state.previous = '';
  state.operator = null;
  state.lastExpression = expression;
  state.replaceOnInput = true;
  updateDisplay();
  addHistoryEntry(expression, result);
}

// Resets the whole calculator (AC).
function clearCalculator() {
  clearState();
  updateDisplay();
}

// Removes the last typed digit (DEL). If an operator was just pressed, DEL undoes it.
function deleteNumber() {
  if (state.errorMessage) {
    clearCalculator();
    return;
  }

  if (state.replaceOnInput) {
    // The number on screen is a result, so DEL clears it instead of trimming it
    state.current = '0';
    state.lastExpression = '';
    state.replaceOnInput = false;
  } else if (state.current === '') {
    // Undo the operator and go back to editing the first number
    state.current = state.previous;
    state.previous = '';
    state.operator = null;
  } else {
    state.current = state.current.slice(0, -1);
    if (state.current === '' || state.current === '-') state.current = '0';
  }
  updateDisplay();
}

// Flips the number between positive and negative (±).
function toggleSign() {
  if (state.errorMessage || state.current === '0') return;

  if (state.current === '') {
    state.current = '-0'; // operator just pressed: start the next number as negative
  } else if (state.current.startsWith('-')) {
    state.current = state.current.slice(1);
  } else {
    state.current = '-' + state.current;
  }
  updateDisplay();
}

// Percentage (%):
//   after + or −  →  percent OF the first number (200 + 10% → 200 + 20)
//   otherwise     →  divides the number by 100 (50% → 0.5)
function calculatePercentage() {
  if (state.errorMessage || state.current === '') return;

  const value = parseFloat(state.current);
  const isAddOrSubtract = state.operator === '+' || state.operator === '−';
  const percent = isAddOrSubtract ? (parseFloat(state.previous) * value) / 100 : value / 100;

  state.current = formatResult(percent);
  state.replaceOnInput = true; // the next digit starts a new number
  updateDisplay();
}

/* ---------- Input handling ---------- */

// Runs the right function for a button/keyboard action, so both share one code path.
function runAction(action, value) {
  switch (action) {
    case 'number': appendNumber(value); break;
    case 'operator': chooseOperator(value); break;
    case 'equals': calculate(); break;
    case 'clear': clearCalculator(); break;
    case 'delete': deleteNumber(); break;
    case 'sign': toggleSign(); break;
    case 'percent': calculatePercentage(); break;
  }
}

// Plays the press animation on the on-screen key that matches a keyboard press.
function flashKey(action, value) {
  const key = allKeys.find((k) => k.dataset.action === action && k.dataset.value === value);
  if (!key) return;
  key.classList.add('is-pressed');
  setTimeout(() => key.classList.remove('is-pressed'), 120);
}

// Translates a physical key press into an action; returns null for keys we don't use.
function getKeyboardAction(key) {
  if (/^[0-9]$/.test(key)) return { action: 'number', value: key };
  if (key === '.') return { action: 'number', value: '.' };
  if (key in KEY_TO_OPERATOR) return { action: 'operator', value: KEY_TO_OPERATOR[key] };
  if (key === 'Enter' || key === '=') return { action: 'equals' };
  if (key === 'Backspace') return { action: 'delete' };
  if (key === 'Escape') return { action: 'clear' };
  if (key === '%') return { action: 'percent' };
  return null;
}

// Handles clicks/taps on any calculator key (one listener for the whole keypad).
keypad.addEventListener('click', (event) => {
  const key = event.target.closest('.key');
  if (key) runAction(key.dataset.action, key.dataset.value);
});

// Handles keyboard input.
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return; // leave browser shortcuts alone

  // While the history panel is open the calculator keys are paused; Escape closes the panel
  if (isHistoryOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeHistory();
    }
    return;
  }

  const mapped = getKeyboardAction(event.key);
  if (!mapped) return;

  event.preventDefault(); // stops "/" quick-find and stops Enter from also "clicking" a focused key
  runAction(mapped.action, mapped.value);
  flashKey(mapped.action, mapped.value);
});

// History panel buttons
historyToggle.addEventListener('click', () => (isHistoryOpen() ? closeHistory() : openHistory()));
historyCloseButton.addEventListener('click', closeHistory);
historyClearButton.addEventListener('click', clearHistory);
historyList.addEventListener('click', (event) => {
  const item = event.target.closest('.history__item');
  if (item) useHistoryEntry(Number(item.dataset.index));
});

updateDisplay();
renderHistory();
