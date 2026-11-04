/* ==========================================================
   ONLINE PREVIEW ONLY
   The real assessment site uses PHP on the server for the cart,
   checkout and contact form. This preview host cannot run PHP,
   so this script does the same jobs in the browser instead.
   Nothing typed into the forms is sent or saved anywhere.
   ========================================================== */
'use strict';

(function () {
    var KEY = 'vinterra-cart';
    var memoryCart = {};

    function loadCart() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return memoryCart; }
    }
    function saveCart(c) {
        memoryCart = c;
        try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* storage unavailable */ }
    }
    function money(n) { return '$' + n.toFixed(2); }
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function lines() {
        var c = loadCart(), out = [];
        Object.keys(c).forEach(function (id) {
            var p = PRODUCTS[id];
            if (p && c[id] > 0) out.push({ id: id, name: p.name, price: p.price, qty: c[id], subtotal: p.price * c[id] });
        });
        return out;
    }
    function totals() {
        var sub = lines().reduce(function (a, l) { return a + l.subtotal; }, 0);
        var ship = (sub === 0 || sub >= FREE_SHIPPING_OVER) ? 0 : SHIPPING_FEE;
        return { subtotal: sub, shipping: ship, total: sub + ship, gst: (sub + ship) / 11 };
    }
    function count() { return lines().reduce(function (a, l) { return a + l.qty; }, 0); }

    function setQty(id, qty) {
        var c = loadCart();
        if (!PRODUCTS[id]) return;
        if (qty <= 0) delete c[id]; else c[id] = Math.min(qty, 48);
        saveCart(c);
    }

    function flash(msg) {
        var main = document.getElementById('main');
        var el = main.querySelector('.flash');
        if (!el) {
            el = document.createElement('p');
            el.className = 'flash';
            el.setAttribute('role', 'status');
            main.insertBefore(el, main.firstChild);
        }
        el.textContent = msg;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function updateHeaderCount() {
        var n = count();
        document.querySelectorAll('.cart-count').forEach(function (el) { el.textContent = n; });
        var link = document.querySelector('.cart-link');
        if (link) link.setAttribute('aria-label', 'Shopping cart, ' + n + ' items');
    }

    /* ---- Cellar door open/closed (Sydney time) ---- */
    function cellarDoor() {
        var el = document.querySelector('.door-status');
        if (!el) return;
        var parts = {};
        new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true })
            .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
        var hour24 = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
        var open = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(parts.weekday) !== -1 && hour24 >= 10 && hour24 < 17;
        el.textContent = open ? 'Open now' : 'Closed now';
        el.className = 'door-status ' + (open ? 'open' : 'closed');
        var t = document.querySelector('.door-time');
        if (t) t.textContent = parts.weekday + ' ' + parts.hour + ':' + parts.minute + ' ' + (parts.dayPeriod || '').toLowerCase();
    }

    /* ---- Add to cart buttons on every page ---- */
    function setupAddForms() {
        document.querySelectorAll('form input[name=action][value=add]').forEach(function (hidden) {
            var form = hidden.form;
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var id = form.querySelector('[name=id]').value;
                var qty = parseInt(form.querySelector('[name=qty]').value, 10) || 1;
                setQty(id, (loadCart()[id] || 0) + Math.max(1, qty));
                updateHeaderCount();
                flash(PRODUCTS[id].name + ' added to your cart.');
            });
        });
    }

    /* ---- Cart page ---- */
    function renderCart() {
        var table = document.querySelector('.cart-table');
        if (!table) return;
        var updateForm = table.closest('form');
        var clearForm = document.querySelector('form input[name=action][value=clear]').form;
        var empty = document.getElementById('cart-empty');
        var ls = lines(), t = totals();

        if (!ls.length) {
            updateForm.hidden = true; clearForm.hidden = true; empty.hidden = false;
            return;
        }
        updateForm.hidden = false; clearForm.hidden = false; empty.hidden = true;
        table.querySelector('tbody').innerHTML = ls.map(function (l) {
            return '<tr><td>' + esc(l.name) + '</td><td>' + money(l.price) + '</td>' +
                '<td><label class="visually-hidden" for="q-' + l.id + '">Quantity of ' + esc(l.name) + '</label>' +
                '<input type="number" id="q-' + l.id + '" name="qty[' + l.id + ']" value="' + l.qty + '" min="0" max="48"></td>' +
                '<td>' + money(l.subtotal) + '</td></tr>';
        }).join('');
        table.querySelector('tfoot').innerHTML =
            '<tr><th scope="row" colspan="3">Subtotal</th><td>' + money(t.subtotal) + '</td></tr>' +
            '<tr><th scope="row" colspan="3">Shipping</th><td>' + (t.shipping ? money(t.shipping) : 'FREE') + '</td></tr>' +
            '<tr class="total"><th scope="row" colspan="3">Total (incl. ' + money(t.gst) + ' GST)</th><td>' + money(t.total) + '</td></tr>';
    }

    function setupCart() {
        var table = document.querySelector('.cart-table');
        if (!table) return;
        var updateForm = table.closest('form');
        updateForm.addEventListener('submit', function (e) {
            e.preventDefault();
            updateForm.querySelectorAll('input[type=number]').forEach(function (inp) {
                setQty(inp.id.replace(/^q-/, ''), Math.max(0, parseInt(inp.value, 10) || 0));
            });
            renderCart(); updateHeaderCount(); flash('Cart updated.');
        });
        document.querySelector('form input[name=action][value=clear]').form.addEventListener('submit', function (e) {
            e.preventDefault();
            saveCart({}); renderCart(); updateHeaderCount(); flash('Your cart is now empty.');
        });
        renderCart();
    }

    /* ---- Checkout page ---- */
    function setupCheckout() {
        var form = document.getElementById('checkout-form');
        if (!form) return;
        var main = document.getElementById('main');
        var ls = lines(), t = totals();

        if (!ls.length) {
            main.innerHTML = '<h1>Checkout</h1><p class="notice">Your cart is empty. Please ' +
                '<a href="red-wines.html">add some wine</a> before checking out.</p>';
            return;
        }
        var totalEl = document.getElementById('order-total');
        if (totalEl) totalEl.textContent = money(t.total);
        var summary = document.querySelector('.summary');
        if (summary) {
            summary.innerHTML = ls.map(function (l) {
                return '<li>' + l.qty + ' &times; ' + esc(l.name) + ' &ndash; ' + money(l.subtotal) + '</li>';
            }).join('') + '<li>Shipping &ndash; ' + (t.shipping ? money(t.shipping) : 'FREE') + '</li>';
        }

        // Runs AFTER main.js validation. If validation blocked the submit, do nothing.
        form.addEventListener('submit', function (e) {
            if (e.defaultPrevented) return;
            e.preventDefault();
            var v = function (id) { return document.getElementById(id).value.trim(); };
            var orderNo = 'VV' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' +
                Math.random().toString(16).slice(2, 8).toUpperCase();
            saveCart({});
            updateHeaderCount();
            main.innerHTML =
                '<h1>Thank You for Your Order</h1>' +
                '<p class="notice success">Order <strong>' + orderNo + '</strong> has been received.</p>' +
                '<p>Thank you, ' + esc(v('first_name')) + '. A confirmation will be sent to <strong>' + esc(v('email')) +
                '</strong>. Your order total is <strong>' + money(t.total) + '</strong> and it will be delivered to ' +
                esc(v('street')) + ', ' + esc(v('suburb')) + ' ' + esc(v('state')) + ' ' + esc(v('postcode')) + '.</p>' +
                '<p class="small">Online preview: this order was not sent or saved anywhere.</p>' +
                '<p><a class="btn" href="index.html">Back to home</a></p>';
            window.scrollTo(0, 0);
        });
    }

    /* ---- Contact form ---- */
    function setupContact() {
        var msg = document.getElementById('message');
        if (!msg) return;
        var form = msg.form;
        form.addEventListener('submit', function (e) {
            if (e.defaultPrevented) return;
            e.preventDefault();
            form.reset();
            flash('Thank you! Your message has been received. (Online preview: nothing was actually sent.)');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        updateHeaderCount();
        cellarDoor();
        setupAddForms();
        setupCart();
        setupCheckout();
        setupContact();
    });
})();
