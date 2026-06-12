// Global Application State
const state = {
    cartId: getOrCreateCartId(),
    products: [],
    cart: { items: {} },
    currentView: 'store',
    adminTab: 'products',
    user: null,
    authMode: 'login' // 'login' or 'register'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check for token in URL query string (from Google OAuth Success redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
        localStorage.setItem('jwt_token', urlToken);
        // Clean URL query parameters so user doesn't see token
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    // 2. Load User Profile from JWT token if available
    await loadUserProfile();

    // 3. Determine initial view (hash or default)
    const hash = window.location.hash.replace('#', '');
    if (['store', 'cart', 'checkout', 'confirmation', 'orders', 'admin', 'login'].includes(hash)) {
        switchView(hash);
    } else {
        // Redirect to admin dashboard if Admin logs in, else store
        if (state.user && state.user.role === 'ROLE_ADMIN') {
            switchView('admin');
        } else {
            switchView('store');
        }
    }

    // Set up window popstate/hashchange behavior for native history navigation
    window.addEventListener('hashchange', () => {
        const h = window.location.hash.replace('#', '');
        if (h && h !== state.currentView) {
            switchView(h, false);
        }
    });

    // Update cart badge count initially
    fetchCartCount();
});

// --- API FETCH WRAPPER ---
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, options);
}

// --- USER SESSION MANAGEMENT ---
async function loadUserProfile() {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        state.user = null;
        updateNavbarUI();
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            state.user = await response.json();
        } else {
            // Token is invalid/expired
            localStorage.removeItem('jwt_token');
            state.user = null;
        }
    } catch (err) {
        console.error('Error loading user profile:', err);
        state.user = null;
    }
    updateNavbarUI();
}

function updateNavbarUI() {
    const loginLink = document.getElementById('link-login');
    const profileItem = document.getElementById('profile-nav-item');
    const adminLink = document.getElementById('link-admin');
    const ordersLink = document.getElementById('link-orders');
    const cartLink = document.getElementById('link-cart');
    const userNameSpan = document.getElementById('nav-user-name');

    if (state.user) {
        // User logged in
        loginLink.style.display = 'none';
        profileItem.style.display = 'block';
        userNameSpan.innerText = state.user.name;

        if (state.user.role === 'ROLE_ADMIN') {
            // Admin user
            adminLink.style.display = 'block';
            ordersLink.style.display = 'none'; // Admin has dedicated Sales Log
            cartLink.style.display = 'none';
        } else {
            // Regular customer user
            adminLink.style.display = 'none';
            ordersLink.style.display = 'block';
            cartLink.style.display = 'block';
        }
    } else {
        // Guest user
        loginLink.style.display = 'block';
        profileItem.style.display = 'none';
        adminLink.style.display = 'none';
        ordersLink.style.display = 'none';
        cartLink.style.display = 'block';
    }
}

// Handle Traditional authentication form submit
async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;

    const button = document.getElementById('btn-auth-submit');
    button.disabled = true;

    if (state.authMode === 'login') {
        button.innerText = 'Signing In...';
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('jwt_token', data.token);
                state.user = data.user;
                showToast(`Welcome back, ${data.user.name}!`);
                updateNavbarUI();
                
                // Clear form
                document.getElementById('auth-form').reset();
                
                // Route to appropriate view
                if (data.user.role === 'ROLE_ADMIN') {
                    switchView('admin');
                } else {
                    switchView('store');
                }
            } else {
                const errData = await response.json();
                showToast(errData.message || 'Login failed. Check credentials.', 'error');
            }
        } catch (err) {
            console.error('Login error:', err);
            showToast('Connection to auth server failed.', 'error');
        } finally {
            button.disabled = false;
            button.innerText = 'Sign In';
        }
    } else {
        button.innerText = 'Creating Account...';
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('jwt_token', data.token);
                state.user = data.user;
                showToast(`Account registered successfully. Welcome, ${data.user.name}!`);
                updateNavbarUI();

                // Clear form
                document.getElementById('auth-form').reset();
                switchView('store');
            } else {
                const errData = await response.json();
                showToast(errData.message || 'Registration failed.', 'error');
            }
        } catch (err) {
            console.error('Registration error:', err);
            showToast('Connection to auth server failed.', 'error');
        } finally {
            button.disabled = false;
            button.innerText = 'Sign Up';
        }
    }
}

function handleLogout() {
    localStorage.removeItem('jwt_token');
    state.user = null;
    showToast('Logged out successfully.');
    updateNavbarUI();
    switchView('store');
}

function toggleAuthMode(event) {
    event.preventDefault();
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const nameGroup = document.getElementById('group-name');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const nameInput = document.getElementById('auth-name');

    if (state.authMode === 'login') {
        state.authMode = 'register';
        title.innerText = 'Create an Account';
        subtitle.innerText = 'Register to purchase groceries and track orders';
        nameGroup.style.display = 'block';
        nameInput.required = true;
        submitBtn.innerText = 'Sign Up';
        toggleText.innerText = 'Already have an account?';
        toggleLink.innerText = 'Sign In';
    } else {
        state.authMode = 'login';
        title.innerText = 'Welcome to Verdant Provisions';
        subtitle.innerText = 'Sign in to your account to place orders and view history';
        nameGroup.style.display = 'none';
        nameInput.required = false;
        submitBtn.innerText = 'Sign In';
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = 'Sign Up';
    }
}

// --- HELPER FUNCTIONS ---

function getOrCreateCartId() {
    let id = localStorage.getItem('nebula_cart_id');
    if (!id) {
        id = 'cart_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('nebula_cart_id', id);
    }
    return id;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '⚡';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';
    
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount);
}

function getProductById(id) {
    return state.products.find(p => p.id === parseInt(id));
}

// --- VIEW NAVIGATION ---

function switchView(viewName, updateHash = true) {
    // 1. Authentication guards for protected views
    if (viewName === 'checkout' || viewName === 'orders') {
        if (!state.user) {
            showToast('Please sign in to access this page.', 'error');
            state.currentView = 'login';
            window.location.hash = 'login';
            
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById('view-login').classList.add('active');
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            document.getElementById('link-login').classList.add('active');
            return;
        }
    }

    if (viewName === 'admin') {
        if (!state.user || state.user.role !== 'ROLE_ADMIN') {
            showToast('Admin authorization required.', 'error');
            state.currentView = 'store';
            window.location.hash = 'store';
            
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById('view-store').classList.add('active');
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            document.getElementById('link-store').classList.add('active');
            loadProductsCatalog();
            return;
        }
    }

    state.currentView = viewName;
    if (updateHash) {
        window.location.hash = viewName;
    }

    // Hide all views, display the selected one
    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Deactivate all nav links, activate selected
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Fix highlighting
    const activeLink = document.getElementById(`link-${viewName}`);
    if (activeLink) activeLink.classList.add('active');

    // Load necessary view data
    if (viewName === 'store') {
        loadProductsCatalog();
    } else if (viewName === 'cart') {
        loadCartDetails();
    } else if (viewName === 'checkout') {
        loadCheckoutPreview();
    } else if (viewName === 'orders') {
        loadOrdersHistory();
    } else if (viewName === 'admin') {
        loadAdminDashboard();
    }
}

function switchAdminTab(tabName) {
    state.adminTab = tabName;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-admin-${tabName}`).classList.add('active');

    document.querySelectorAll('.admin-content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`admin-sec-${tabName}`).classList.add('active');

    if (tabName === 'products') {
        loadAdminProducts();
    } else if (tabName === 'orders') {
        loadAdminOrders();
    }
}

// --- API ACTIONS & RENDERING ---

// 1. Fetch Cart Count Badge
async function fetchCartCount() {
    try {
        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}`);
        if (response.ok) {
            const cart = await response.json();
            state.cart = cart;
            let totalItems = 0;
            if (cart.items) {
                Object.values(cart.items).forEach(qty => {
                    totalItems += qty;
                });
            }
            document.getElementById('cart-count').innerText = totalItems;
        } else {
            document.getElementById('cart-count').innerText = 0;
        }
    } catch (err) {
        console.error('Error fetching cart count:', err);
    }
}

// 2. Load Products for Store View
async function loadProductsCatalog() {
    const loader = document.getElementById('catalog-loading');
    const grid = document.getElementById('products-grid');
    loader.style.display = 'block';
    grid.innerHTML = '';

    try {
        const response = await authFetch('/api/ecommerce/products');
        if (response.ok) {
            state.products = await response.json();
            loader.style.display = 'none';

            if (state.products.length === 0) {
                grid.innerHTML = '<div class="empty-state"><p>No products available at this time.</p></div>';
                return;
            }

            state.products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';
                
                const isOutOfStock = product.stock <= 0;
                const stockBadgeText = isOutOfStock ? 'OUT OF STOCK' : `Stock: ${product.stock}`;
                const badgeClass = isOutOfStock ? 'product-stock-badge out-of-stock' : 'product-stock-badge';

                card.innerHTML = `
                    <div class="product-img-container">
                        <img src="${product.imageUrl || '/images/placeholder.png'}" alt="${product.name}" class="product-img" onerror="this.src='https://placehold.co/600x400/0f111a/ffffff?text=${encodeURIComponent(product.name)}'">
                        <span class="${badgeClass}">${stockBadgeText}</span>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <p class="product-desc">${product.description || 'No description provided.'}</p>
                        <div class="product-footer">
                            <span class="product-price">${formatCurrency(product.price)}</span>
                            <button class="btn" onclick="addProductToCart(${product.id})" ${isOutOfStock ? 'disabled' : ''}>
                                ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            loader.style.display = 'none';
            grid.innerHTML = '<div class="empty-state"><p>Failed to retrieve products. Please refresh.</p></div>';
        }
    } catch (err) {
        console.error('Error loading products catalog:', err);
        loader.style.display = 'none';
        grid.innerHTML = '<div class="empty-state"><p>Error connecting to server.</p></div>';
    }
}

// 3. Add Item to Cart
async function addProductToCart(productId) {
    try {
        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}/add?productId=${productId}&quantity=1`, {
            method: 'POST'
        });
        if (response.ok) {
            showToast('Item successfully added to your cart.');
            fetchCartCount();
        } else {
            const data = await response.json();
            showToast(data.message || 'Failed to add item. Check stock limits.', 'error');
        }
    } catch (err) {
        console.error('Error adding product to cart:', err);
        showToast('Error connecting to backend server.', 'error');
    }
}

// 4. Cart View Details
async function loadCartDetails() {
    const loader = document.getElementById('cart-loading');
    const emptyDiv = document.getElementById('cart-empty');
    const itemsList = document.getElementById('cart-items-list');
    const summaryCard = document.getElementById('cart-summary-card');

    loader.style.display = 'block';
    itemsList.innerHTML = '';
    emptyDiv.style.display = 'none';
    itemsList.style.display = 'none';
    summaryCard.style.display = 'none';

    try {
        // Ensure products catalog is loaded first to map details
        if (state.products.length === 0) {
            const prodRes = await authFetch('/api/ecommerce/products');
            if (prodRes.ok) state.products = await prodRes.json();
        }

        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}`);
        loader.style.display = 'none';

        if (response.ok) {
            const cart = await response.json();
            state.cart = cart;
            
            const hasItems = cart.items && Object.keys(cart.items).length > 0;
            if (!hasItems) {
                emptyDiv.style.display = 'block';
                return;
            }

            itemsList.style.display = 'flex';
            summaryCard.style.display = 'block';

            let subtotal = 0;

            for (const [prodIdStr, quantity] of Object.entries(cart.items)) {
                const prodId = parseInt(prodIdStr);
                const product = getProductById(prodId);
                
                if (!product) continue;

                const itemTotal = product.price * quantity;
                subtotal += itemTotal;

                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <img src="${product.imageUrl || '/images/placeholder.png'}" alt="${product.name}" class="cart-item-img" onerror="this.src='https://placehold.co/100?text=item'">
                    <div class="cart-item-details">
                        <h4 class="cart-item-name">${product.name}</h4>
                        <div class="cart-item-price">${formatCurrency(product.price)} each</div>
                    </div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQuantity(${prodId}, ${quantity - 1})">-</button>
                        <span class="quantity-val">${quantity}</span>
                        <button class="quantity-btn" onclick="changeQuantity(${prodId}, ${quantity + 1})" ${quantity >= product.stock ? 'disabled' : ''}>+</button>
                    </div>
                    <div style="font-weight: 700; width: 80px; text-align: right;">
                        ${formatCurrency(itemTotal)}
                    </div>
                    <button class="btn btn-secondary" style="padding: 0.5rem; border-radius: 8px;" onclick="removeCartItem(${prodId})">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                `;
                itemsList.appendChild(itemElement);
            }

            document.getElementById('cart-subtotal').innerText = formatCurrency(subtotal);
            document.getElementById('cart-total').innerText = formatCurrency(subtotal);
        } else {
            emptyDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Error rendering cart view:', err);
        loader.style.display = 'none';
        emptyDiv.style.display = 'block';
    }
}

// 5. Change Cart Quantity
async function changeQuantity(productId, newQty) {
    try {
        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}/update?productId=${productId}&quantity=${newQty}`, {
            method: 'POST'
        });
        if (response.ok) {
            loadCartDetails();
            fetchCartCount();
        } else {
            const data = await response.json();
            showToast(data.message || 'Cannot increase quantity past inventory limits.', 'error');
        }
    } catch (err) {
        console.error('Error changing item quantity:', err);
        showToast('Error editing cart.', 'error');
    }
}

// 6. Delete Item from Cart
async function removeCartItem(productId) {
    try {
        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}/product/${productId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast('Item removed from cart.');
            loadCartDetails();
            fetchCartCount();
        } else {
            showToast('Failed to delete item.', 'error');
        }
    } catch (err) {
        console.error('Error deleting cart item:', err);
    }
}

// 7. Clear Entire Cart
async function clearCart() {
    try {
        const response = await authFetch(`/api/ecommerce/cart/${state.cartId}/clear`, {
            method: 'POST'
        });
        if (response.ok) {
            showToast('Shopping cart cleared.');
            loadCartDetails();
            fetchCartCount();
        }
    } catch (err) {
        console.error('Error clearing cart:', err);
    }
}

// 8. Load Checkout Page Details
async function loadCheckoutPreview() {
    const listDiv = document.getElementById('checkout-preview-list');
    listDiv.innerHTML = '';
    
    let subtotal = 0;
    const hasItems = state.cart.items && Object.keys(state.cart.items).length > 0;
    if (!hasItems) {
        switchView('cart');
        return;
    }

    // Prepopulate name and email if logged in
    if (state.user) {
        document.getElementById('checkout-name').value = state.user.name || '';
        document.getElementById('checkout-email').value = state.user.email || '';
    }

    for (const [prodIdStr, quantity] of Object.entries(state.cart.items)) {
        const prodId = parseInt(prodIdStr);
        const product = getProductById(prodId);
        
        if (!product) continue;

        const itemTotal = product.price * quantity;
        subtotal += itemTotal;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justify = 'space-between';
        row.style.alignItems = 'center';
        row.style.fontSize = '0.92rem';
        row.innerHTML = `
            <div>
                <span style="font-weight:600;">${product.name}</span>
                <span style="color:var(--text-secondary); margin-left: 0.5rem;">x${quantity}</span>
            </div>
            <span>${formatCurrency(itemTotal)}</span>
        `;
        listDiv.appendChild(row);
    }

    document.getElementById('checkout-total').innerText = formatCurrency(subtotal);
}

// 9. Handle Order Checkout Submission
async function handleCheckout(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('btn-submit-order');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Processing simulated payment...';

    const name = document.getElementById('checkout-name').value;
    const email = document.getElementById('checkout-email').value;
    const address = document.getElementById('checkout-address').value;
    const payment = document.getElementById('checkout-payment').value;

    const payload = {
        customerName: name,
        customerEmail: email,
        shippingAddress: address,
        paymentMethod: payment
    };

    try {
        const response = await authFetch(`/api/ecommerce/orders/checkout/${state.cartId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        submitBtn.disabled = false;
        submitBtn.innerText = 'Confirm and Pay';

        if (response.ok) {
            const order = await response.json();
            showToast('Simulated payment approved! Order confirmed.');
            
            // Populating Receipt Summary Page
            document.getElementById('receipt-id').innerText = `#ORDER-00${order.id}`;
            document.getElementById('receipt-date').innerText = new Date(order.orderDate).toLocaleString();
            document.getElementById('receipt-name').innerText = order.customerName;
            document.getElementById('receipt-address').innerText = order.shippingAddress;
            document.getElementById('receipt-payment').innerText = order.paymentMethod;
            document.getElementById('receipt-total').innerText = formatCurrency(order.totalAmount);

            // Re-fetch cart count (which should be 0)
            fetchCartCount();
            
            // Switch views
            switchView('confirmation');
            
            // Reset form
            document.getElementById('checkout-form').reset();
        } else {
            const data = await response.json();
            showToast(data.message || 'Checkout failed. An item may have gone out of stock.', 'error');
        }
    } catch (err) {
        console.error('Error during checkout:', err);
        showToast('Server connection failed.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Confirm and Pay';
    }
}

// 10. Load Order History View
async function loadOrdersHistory() {
    const loader = document.getElementById('orders-loading');
    const emptyDiv = document.getElementById('orders-empty');
    const listDiv = document.getElementById('order-history-list');

    loader.style.display = 'block';
    emptyDiv.style.display = 'none';
    listDiv.style.display = 'none';
    listDiv.innerHTML = '';

    try {
        const response = await authFetch('/api/ecommerce/orders');
        loader.style.display = 'none';

        if (response.ok) {
            const orders = await response.json();
            
            if (orders.length === 0) {
                emptyDiv.style.display = 'block';
                return;
            }

            listDiv.style.display = 'flex';
            
            // Sort orders descending (most recent first)
            orders.sort((a,b) => b.id - a.id);

            orders.forEach(order => {
                const card = document.createElement('div');
                card.className = 'order-group-card';

                let itemsHtml = '';
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        itemsHtml += `
                            <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; font-size:0.9rem;">
                                <span>${item.productName} <span style="color:var(--text-secondary); margin-left: 0.5rem;">x${item.quantity}</span></span>
                                <span>${formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        `;
                    });
                }

                card.innerHTML = `
                    <div class="order-header">
                        <div class="order-meta">
                            <span class="order-id">Order ID: #ORDER-00${order.id}</span>
                            <span class="order-date">${new Date(order.orderDate).toLocaleString()}</span>
                        </div>
                        <div class="order-price-status">
                            <div style="font-weight:800; font-size:1.15rem; margin-bottom:0.25rem;">${formatCurrency(order.totalAmount)}</div>
                            <span class="status-badge paid">${order.status}</span>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">Items Ordered</div>
                        ${itemsHtml}
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top:1px dashed var(--border-color); font-size:0.85rem; color:var(--text-secondary);">
                            <strong>Shipping Details:</strong> ${order.customerName} | ${order.customerEmail} | ${order.shippingAddress}
                        </div>
                    </div>
                `;
                listDiv.appendChild(card);
            });
        } else {
            emptyDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Error fetching order history:', err);
        loader.style.display = 'none';
        emptyDiv.style.display = 'block';
    }
}

// 11. Load Admin Portal dashboard
function loadAdminDashboard() {
    switchAdminTab(state.adminTab);
}

// 12. Load Admin Products Inventory
async function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-table');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Retrieving products catalog...</td></tr>';

    try {
        const response = await authFetch('/api/ecommerce/products');
        if (response.ok) {
            state.products = await response.json();
            tbody.innerHTML = '';

            if (state.products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Inventory is empty.</td></tr>';
                return;
            }

            state.products.forEach(product => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:700;">${product.id}</td>
                    <td><img src="${product.imageUrl || '/images/placeholder.png'}" alt="Thumb" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.src='https://placehold.co/40'"></td>
                    <td style="font-weight:600;">${product.name}</td>
                    <td>${formatCurrency(product.price)}</td>
                    <td>
                        <span style="font-weight:600; color: ${product.stock <= 0 ? 'var(--danger-color)' : 'inherit'}">
                            ${product.stock}
                        </span>
                    </td>
                    <td>
                        <div class="admin-action-btn-group">
                            <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="openProductModal(${product.id})">
                                Edit
                            </button>
                            <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="deleteProduct(${product.id})">
                                Delete
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Error loading admin products:', err);
    }
}

// 13. Load Admin Sales Logs
async function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-table');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Retrieving sales history...</td></tr>';

    try {
        const response = await authFetch('/api/ecommerce/orders');
        if (response.ok) {
            const orders = await response.json();
            tbody.innerHTML = '';
            
            // Sort orders descending
            orders.sort((a,b) => b.id - a.id);

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No sales logs recorded yet.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:700;">#ORDER-00${order.id}</td>
                    <td style="font-size:0.82rem;">${new Date(order.orderDate).toLocaleString()}</td>
                    <td style="font-weight:600;">${order.customerName}</td>
                    <td style="font-size:0.85rem; color:var(--text-secondary);">${order.customerEmail}</td>
                    <td style="font-size:0.85rem; color:var(--text-secondary); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${order.shippingAddress}">${order.shippingAddress}</td>
                    <td style="font-weight:700;">${formatCurrency(order.totalAmount)}</td>
                    <td><span class="status-badge paid">${order.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Error loading admin orders:', err);
    }
}

// 14. Admin Product Creation and Edits
function openProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');

    form.reset();
    document.getElementById('prod-id').value = '';

    if (productId) {
        title.innerText = 'Edit Product Details';
        const product = getProductById(productId);
        if (product) {
            document.getElementById('prod-id').value = product.id;
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-price').value = product.price;
            document.getElementById('prod-stock').value = product.stock;
            document.getElementById('prod-desc').value = product.description || '';
            document.getElementById('prod-image').value = product.imageUrl || '';
        }
    } else {
        title.innerText = 'Add New Product';
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

async function handleProductSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const description = document.getElementById('prod-desc').value;
    const imageUrl = document.getElementById('prod-image').value;

    const payload = {
        name,
        price,
        stock,
        description,
        imageUrl
    };

    let url = '/api/ecommerce/products';
    let method = 'POST';

    if (id) {
        url = `/api/ecommerce/products/${id}`;
        method = 'PUT';
        payload.id = parseInt(id);
    }

    try {
        const response = await authFetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(id ? 'Product details updated successfully.' : 'New product created.');
            closeProductModal();
            loadAdminProducts();
            loadProductsCatalog(); // refresh catalog cache
        } else {
            showToast('Failed to save product. Verify fields.', 'error');
        }
    } catch (err) {
        console.error('Error saving product:', err);
        showToast('Server connection failed.', 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to permanently delete this product? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await authFetch(`/api/ecommerce/products/${productId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Product successfully deleted.');
            loadAdminProducts();
            loadProductsCatalog(); // refresh catalog cache
        } else {
            showToast('Failed to delete product. It may be part of past order line-items.', 'error');
        }
    } catch (err) {
        console.error('Error deleting product:', err);
    }
}
