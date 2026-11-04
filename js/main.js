/* ==========================================================
   Vinterra Valley Winery - client-side JavaScript
   1. Mobile navigation toggle
   2. Mouseover / mouseout styles for buttons and links
   3. Form validation (checkout and contact forms)
   ========================================================== */
'use strict';

document.addEventListener('DOMContentLoaded', function () {
    setupNavToggle();
    setupHoverEffects();
    document.querySelectorAll('form.validate-form').forEach(setupValidation);
});

/* ---------- 1. Mobile navigation ---------- */
function setupNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    var list = document.getElementById('nav-list');
    if (!toggle || !list) return;
    toggle.addEventListener('click', function () {
        var open = list.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
}

/* ---------- 2. Mouseover / mouseout styles ---------- */
var HOVER = {
    primary:   { backgroundColor: '#b8893b', borderColor: '#b8893b', color: '#000000', transform: 'translateY(-2px)' },
    secondary: { backgroundColor: '#5b1a2e', borderColor: '#5b1a2e', color: '#ffffff', transform: 'translateY(-2px)' },
    navLink:   { backgroundColor: '#b8893b', color: '#000000' },
    textLink:  { color: '#b8893b', textDecoration: 'none' }
};

function applyHover(el, styles) {
    // Remember the element's original inline styles so mouseout can restore them.
    var saved = {};
    Object.keys(styles).forEach(function (prop) { saved[prop] = el.style[prop]; });

    function over() { Object.keys(styles).forEach(function (p) { el.style[p] = styles[p]; }); }
    function out()  { Object.keys(saved).forEach(function (p) { el.style[p] = saved[p]; }); }

    el.addEventListener('mouseover', over);
    el.addEventListener('mouseout', out);
    // Same effect for keyboard users (accessibility).
    el.addEventListener('focus', over);
    el.addEventListener('blur', out);
}

function setupHoverEffects() {
    // Submit, reset and all other buttons
    document.querySelectorAll('button, input[type=submit], input[type=reset], a.btn').forEach(function (el) {
        if (el.classList.contains('nav-toggle')) return applyHover(el, HOVER.navLink);
        if (el.classList.contains('btn-link')) return applyHover(el, HOVER.textLink);
        var isSecondary = el.classList.contains('btn-alt') || el.type === 'reset';
        applyHover(el, isSecondary ? HOVER.secondary : HOVER.primary);
    });
    // Navigation panel links
    document.querySelectorAll('.main-nav a, .cart-link').forEach(function (el) {
        applyHover(el, HOVER.navLink);
    });
    // All other links in the page
    document.querySelectorAll('main a:not(.btn), aside a, footer a').forEach(function (el) {
        applyHover(el, HOVER.textLink);
    });
}

/* ---------- 3. Form validation ---------- */
function setupValidation(form) {
    var fields = form.querySelectorAll('input[data-pattern], textarea[data-pattern], select[required], input[type=checkbox][required]');

    fields.forEach(function (field) {
        field.addEventListener('blur', function () { validateField(form, field); });
        field.addEventListener('input', function () {
            if (field.closest('.field').classList.contains('has-error')) validateField(form, field);
        });
        field.addEventListener('change', function () { validateField(form, field); });
    });

    // Radio groups (gender)
    form.querySelectorAll('[data-required-group]').forEach(function (group) {
        group.addEventListener('change', function () { validateRadioGroup(form, group); });
    });

    // Re-check the postcode when the state changes
    var state = form.querySelector('#state');
    var postcode = form.querySelector('#postcode');
    if (state && postcode) {
        state.addEventListener('change', function () { if (postcode.value) validateField(form, postcode); });
    }

    form.addEventListener('submit', function (event) {
        var firstInvalid = null;
        fields.forEach(function (f) {
            if (!validateField(form, f) && !firstInvalid) firstInvalid = f;
        });
        form.querySelectorAll('[data-required-group]').forEach(function (g) {
            if (!validateRadioGroup(form, g) && !firstInvalid) firstInvalid = g.querySelector('input');
        });
        if (firstInvalid) {
            event.preventDefault();
            firstInvalid.focus();
        }
    });

    form.addEventListener('reset', function () {
        // Clear all error messages and styles when the Reset button is pressed.
        form.querySelectorAll('.field').forEach(function (div) { div.classList.remove('has-error', 'valid'); });
        form.querySelectorAll('.error').forEach(function (span) { span.textContent = ''; });
        form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    });
}

function validateField(form, field) {
    var value = field.value.trim();
    var message = '';

    if (field.type === 'checkbox') {
        if (!field.checked) message = field.dataset.msg;
    } else if (field.tagName === 'SELECT') {
        if (!value) message = field.dataset.msg;
    } else {
        if (field.type === 'tel') value = value.replace(/\s+/g, '');
        var label = form.querySelector('label[for="' + field.id + '"]');
        var name = label ? label.firstChild.textContent.trim() : 'This field';
        var pattern = new RegExp('^(?:' + field.dataset.pattern + ')$');

        if (value === '') {
            message = name + ' is required.';
        } else if (value.length > Number(field.maxLength > 0 ? field.maxLength : 9999) || !pattern.test(value)) {
            message = field.dataset.msg;
        } else if (field.dataset.match) {
            var other = form.querySelector('#' + field.dataset.match);
            if (other && other.value !== field.value) message = field.dataset.msg;
        }

        // Postcode must belong to the selected state
        if (!message && field.id === 'postcode' && window.POSTCODE_RANGES) {
            var state = form.querySelector('#state').value;
            if (state && !postcodeInState(Number(value), window.POSTCODE_RANGES[state])) {
                message = 'Postcode ' + value + ' is not in ' + state + '.';
            }
        }
    }

    // When the password changes, re-check the confirm password field
    if (field.id === 'password') {
        var confirm = form.querySelector('#confirm_password');
        if (confirm && confirm.value) setTimeout(function () { validateField(form, confirm); }, 0);
    }

    showResult(field, message);
    return message === '';
}

function validateRadioGroup(form, group) {
    var name = group.dataset.requiredGroup;
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    var message = checked ? '' : 'Please select a ' + name + ' option.';
    showResult(group, message);
    return !message;
}

function postcodeInState(pc, ranges) {
    return (ranges || []).some(function (r) { return pc >= r[0] && pc <= r[1]; });
}

function showResult(field, message) {
    var wrapper = field.closest('.field');
    var errorId = field.getAttribute('aria-describedby');
    var errorEl = errorId ? document.getElementById(errorId) : null;
    if (wrapper) {
        wrapper.classList.toggle('has-error', !!message);
        wrapper.classList.toggle('valid', !message);
    }
    if (errorEl) errorEl.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
}
