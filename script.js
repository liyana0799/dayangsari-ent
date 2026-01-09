// ========================================
// FIREBASE IMPORTS
// ========================================
import { 
  firebaseSignUp,
  firebaseSignIn,
  firebaseSignOut,
  getCurrentUser as getFirebaseUser,
  onAuthChange,
  isAdmin
} from './firebase-functions.js';

import {
    updateProfile as updateProfileAuth,
    updatePassword as updatePasswordAuth,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// ========================================
// PAGE LOADER
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.style.display = 'flex';
    }
});

window.addEventListener('load', function() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        setTimeout(function() {
            loader.classList.add('loaded');
            setTimeout(function() {
                loader.style.display = 'none';
            }, 500);
        }, 0);
    }
});

// ========================================
// 🆕 ENHANCED LOADER LOGIC (From v9)
// Put this right here!
// ========================================
document.addEventListener('click', function(e) {
    // Find the nearest link element (<a>) from the click target
    const target = e.target.closest('a');
    
    // Only trigger if it's an internal link and not a special action
    if (target && target.href && !target.target && !target.getAttribute('onclick')) {
        const url = new URL(target.href);
        
        // Check if the link is on the same website (Dayangsari Ent)
        if (url.origin === window.location.origin) {
            const loader = document.getElementById('pageLoader');
            if (loader) {
                // Remove the 'loaded' class to make it visible again
                loader.classList.remove('loaded');
                loader.style.display = 'flex';
            }
        }
    }
});

// ========================================
// AUTHENTICATION STATE LISTENER
// ========================================
let currentUser = null;
let authReady = false;

// Listen for authentication state changes
onAuthChange((user) => {
    currentUser = user;
    authReady = true;
    console.log('Auth state changed:', user ? user.email : 'No user');
    updateNavigation();
    updateCartBadge();
    
    // Check if we need to redirect to signin
    checkAuthRequired();
});

// ========================================
// GET CURRENT USER
// ========================================
function getCurrentUser() {
    return currentUser;
}

// Check if user is logged in
function isUserLoggedIn() {
    return currentUser !== null;
}

// ========================================
// SIGN UP HANDLER
// ========================================
async function handleSignUp(event) {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate all fields are filled
    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error', 3000);
        return;
    }

    // Validate email format - must be @gmail.com
    const emailRegex = /^[^\s@]+@gmail\.com$/i;
    if (!emailRegex.test(email)) {
        showToast('Please use a valid Gmail address (@gmail.com)', 'error', 3000);
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error', 3000);
        return;
    }

    // Validate password requirements
    if (password.length < 8) {
        showToast('Password must be at least 8 characters long', 'error', 3000);
        return;
    }

    if (!/[A-Z]/.test(password)) {
        showToast('Password must contain at least one uppercase letter', 'error', 3000);
        return;
    }

    if (!/[a-z]/.test(password)) {
        showToast('Password must contain at least one lowercase letter', 'error', 3000);
        return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        showToast('Password must contain at least one special character (!@#$%^&*)', 'error', 3000);
        return;
    }

    // Prevent registration with admin email
    if (email.toLowerCase() === 'admin@dayangsari.com') {
        showToast('This email cannot be used for customer registration', 'error', 3000);
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
        // Call Firebase signup
        const result = await firebaseSignUp(email, password, name);

        if (result.success) {
            showToast('Account created successfully!', 'success', 2000);
            
            setTimeout(() => {
                alert(`Welcome ${name}! Your account has been created.\n\nPlease sign in to continue.`);
                window.location.href = 'signin.html';
            }, 1000);
        } else {
            // Handle specific Firebase errors
            let errorMessage = 'Failed to create account';
            
            if (result.error.includes('email-already-in-use')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (result.error.includes('weak-password')) {
                errorMessage = 'Password is too weak. Please use a stronger password.';
            } else if (result.error.includes('invalid-email')) {
                errorMessage = 'Invalid email address format.';
            }
            
            showToast(errorMessage, 'error', 4000);
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('An error occurred. Please try again.', 'error', 3000);
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Make handleSignUp available globally
window.handleSignUp = handleSignUp;

// ========================================
// SIGN IN HANDLER
// ========================================
async function handleSignIn(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate inputs
    if (!email || !password) {
        showToast('Please enter both email and password', 'error', 3000);
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';

    try {
        // Call Firebase signin
        const result = await firebaseSignIn(email, password);

        if (result.success) {
            // Check if user is admin
            const userIsAdmin = await isAdmin();
            
            if (userIsAdmin) {
                showToast('Admin logged in successfully!', 'success', 2000);
                setTimeout(() => {
                    window.location.href = 'Admin/admin.html';
                }, 1000);
            } else {
                showToast(`Welcome back, ${result.userData.name}!`, 'success', 2000);
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        } else {
            // Handle specific Firebase errors
            let errorMessage = 'Failed to sign in';
            
            if (result.error.includes('user-not-found')) {
                errorMessage = 'Account not found. Please sign up first!';
            } else if (result.error.includes('wrong-password')) {
                errorMessage = 'Incorrect password. Please try again.';
            } else if (result.error.includes('invalid-email')) {
                errorMessage = 'Invalid email address format.';
            } else if (result.error.includes('too-many-requests')) {
                errorMessage = 'Too many failed attempts. Please try again later.';
            }
            
            showToast(errorMessage, 'error', 4000);
        }
    } catch (error) {
        console.error('Signin error:', error);
        showToast('An error occurred. Please try again.', 'error', 3000);
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Make handleSignIn available globally
window.handleSignIn = handleSignIn;

// ========================================
// LOGOUT HANDLER
// ========================================
async function logout() {
    const confirmLogout = confirm('Are you sure you want to log out?');
    
    if (!confirmLogout) return;

    try {
        const result = await firebaseSignOut();
        
        if (result.success) {
            showToast('You have been logged out successfully!', 'info', 3000);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showToast('Failed to log out. Please try again.', 'error', 3000);
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('An error occurred during logout.', 'error', 3000);
    }
}

// Make logout available globally
window.logout = logout;

// ========================================
// NAVIGATION UPDATE
// ========================================
async function updateNavigation() {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks) return;
    
    console.log('🔄 Updating navigation, user:', currentUser ? currentUser.email : 'none');
    
    if (isUserLoggedIn() && currentUser) {
        // Get cart count from Firebase
        let totalItems = 0;
        try {
            const cart = await getCart();
            totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        } catch (error) {
            console.error('❌ Error getting cart for navigation:', error);
        }
        
        // Use Display Name if available, otherwise use email prefix
        const userName = currentUser.displayName || currentUser.email.split('@')[0];
        
        // User is logged in - show full navigation
        navLinks.innerHTML = `
            <li><a href="index.html">Home</a></li>
            <li><a href="product.html">Products</a></li>
            <li><a href="about.html">About Us</a></li>
            <li class="nav-dropdown">
                <a href="#" class="dropdown-trigger" onclick="event.preventDefault();">
                    <img src="asset/user.png" alt="User" class="nav-icon" style="width:20px; vertical-align:middle; margin-right:5px;">
                    ${userName} ▾
                </a>
                <ul class="dropdown-menu">
                    <li><a href="myaccount.html"><i class="fas fa-user-circle"></i> My Account</a></li>
                    <li><hr></li>
                    <li><a href="#" onclick="logout(); return false;"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
                </ul>
            </li>
            <li>
                <a href="cart.html" class="cart-link">
                    <img src="asset/shopping-bag.png" alt="Cart" class="cart-icon" onerror="this.parentElement.innerHTML='Cart'">
                    <span class="cart-badge" id="cartBadge" style="display: ${totalItems > 0 ? 'inline-flex' : 'none'}">
                        ${totalItems}
                    </span>
                </a>
            </li>
        `;
        
        // Setup dropdown handlers
        setTimeout(setupDropdownHandlers, 0);
    } else {
        // User is NOT logged in - simple navigation
        navLinks.innerHTML = `
            <li><a href="index.html">Home</a></li>
            <li><a href="product.html">Products</a></li>
            <li><a href="about.html">About Us</a></li>
            <li><a href="signin.html" class="login-btn">Sign In</a></li>
        `;
    }
}

// ========================================
// DROPDOWN HANDLER
// ========================================
function setupDropdownHandlers() {
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');
    
    dropdownTriggers.forEach(trigger => {
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        newTrigger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const dropdown = this.closest('.nav-dropdown');
            const isActive = dropdown.classList.contains('active');
            
            document.querySelectorAll('.nav-dropdown').forEach(d => {
                d.classList.remove('active');
            });
            
            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function ensureToastContainer() {
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    return container;
}

function showToast(message, type = 'success', duration = 3000) {
    const container = ensureToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon;
    switch(type) {
        case 'success':
            icon = '✔';
            break;
        case 'error':
            icon = '✕';
            break;
        case 'warning':
            icon = '⚠';
            break;
        case 'info':
            icon = 'ℹ';
            break;
        default:
            icon = '✔';
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// Make showToast available globally
window.showToast = showToast;

// ========================================
// PASSWORD VISIBILITY TOGGLE
// ========================================
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.classList.add('toggled');
        
        if (eyeOpen && eyeClosed) {
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        }
    } else {
        input.type = 'password';
        button.classList.remove('toggled');
        
        if (eyeOpen && eyeClosed) {
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    }
}

// Make togglePasswordVisibility available globally
window.togglePasswordVisibility = togglePasswordVisibility;

// ========================================
// PASSWORD MATCH INDICATOR
// ========================================
function setupPasswordMatchIndicator() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const indicator = document.getElementById('passwordMatchIndicator');
    
    if (!password || !confirmPassword || !indicator) return;
    
    function checkPasswordMatch() {
        const pass = password.value;
        const confirm = confirmPassword.value;
        
        if (confirm === '') {
            indicator.style.display = 'none';
            return;
        }
        
        if (pass === confirm) {
            indicator.className = 'password-match-indicator match';
            indicator.textContent = '✓ Passwords match';
        } else {
            indicator.className = 'password-match-indicator no-match';
            indicator.textContent = '✗ Passwords do not match';
        }
    }
    
    confirmPassword.addEventListener('input', checkPasswordMatch);
    password.addEventListener('input', checkPasswordMatch);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function toggleMenu() {
    document.getElementById("navLinks").classList.toggle("active");
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function submitForm(event) {
    event.preventDefault();
    showToast('Thank you for reaching out! We will get back to you soon.', 'success', 4000);
    event.target.reset();
}

// ========================================
// EMAIL VALIDATION
// ========================================
function setupEmailValidation() {
    const emailInput = document.getElementById('email');
    if (!emailInput) return;
    
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (!email) return;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return; // Invalid format
        }
    });
}

// ========================================
// PAYMENT PAGE ACCESS CONTROL
// ========================================
function preventPaymentPageAccess() {
    const paymentPages = ['payment_fpx.html', 'payment_ewallet.html'];
    const currentPage = window.location.pathname;
    
    const isOnPaymentPage = paymentPages.some(page => currentPage.includes(page));
    
    if (isOnPaymentPage) {
        const orderData = JSON.parse(localStorage.getItem('lastOrder'));
        
        if (!orderData || orderData.paymentCompleted === true || orderData.status === 'completed') {
            alert('This payment session is no longer valid.');
            window.location.replace('index.html');
            return false;
        }
    }
    
    return true;
}

// Make utility functions available globally
window.toggleMenu = toggleMenu;
window.scrollToTop = scrollToTop;
window.submitForm = submitForm;

// ========================================
// SCROLL TO TOP BUTTON
// ========================================
const scrollTopBtn = document.getElementById('scrollTop');

window.addEventListener('scroll', function() {
    if (scrollTopBtn) {
        if (window.pageYOffset > 300) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    }
});

// ========================================
// FIREBASE PRODUCTS INTEGRATION
// ========================================
import { getProducts as getFirebaseProducts } from './firebase-functions.js';

let allProducts = [];
let currentCategory = "all";

// Category name mapping
const categoryNames = {
    cookies: "Traditional Biscuits",
    snacks: "Snacks & Crackers",
    cakes: "Layered Cakes"
};

// Load products from Firebase
async function loadProductsFromFirebase() {
    try {
        console.log('📦 Loading products from Firebase...');
        const products = await getFirebaseProducts();
        
        if (products && products.length > 0) {
            allProducts = products;
            console.log(`✅ Loaded ${products.length} products from Firebase`);
            return products;
        } else {
            console.warn('⚠️ No products found in Firebase');
            return [];
        }
    } catch (error) {
        console.error('❌ Error loading products:', error);
        return [];
    }
}

// Initialize products page
async function initializeProductsPage() {
    if (!window.location.pathname.includes('product.html')) return;
    
    console.log('🛍️ Initializing products page...');
    
    // Load products from Firebase
    const products = await loadProductsFromFirebase();
    
    if (products.length > 0) {
        displayProducts(products);
    } else {
        const grid = document.getElementById('productGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📦</div>
                    <h3>No products available</h3>
                    <p>Please check back later</p>
                </div>
            `;
        }
    }
}

// Display products on the page
function displayProducts(productsToDisplay) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    if (productsToDisplay.length === 0) {
        grid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3>No products found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = productsToDisplay.map(product => {
        // Determine price display
        let priceDisplay;
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            const prices = product.variants.map(v => v.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            if (minPrice === maxPrice) {
                priceDisplay = `RM ${minPrice.toFixed(2)}`;
            } else {
                priceDisplay = `RM ${minPrice.toFixed(2)} - RM ${maxPrice.toFixed(2)}`;
            }
        } else {
            priceDisplay = `RM ${product.price.toFixed(2)}`;
        }
        
        return `
            <div class="product-card" style="position: relative;">
                <div class="product-image" onclick="location.href='product-detail.html?id=${product.id}'" style="cursor: pointer;">
                    <img src="${product.image}" alt="${product.name}" onerror="this.parentElement.innerHTML='<div class=\\'product-image-placeholder\\'>🥮</div>'">
                </div>
                <span class="product-category-badge">${product.category}</span>
                <h3 onclick="location.href='product-detail.html?id=${product.id}'" style="cursor: pointer;">${product.name}</h3>
                <p>${priceDisplay}</p>
                <button onclick="location.href='product-detail.html?id=${product.id}'">See More</button>
            </div>
        `;
    }).join('');
}

// Select category filter
function selectCategory(category) {
    currentCategory = category;
    
    // Update active tab
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    filterProducts();
}

// Filter products
function filterProducts() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    
    if (!searchInput || !sortSelect) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = sortSelect.value;
    
    // Filter by category
    let filtered = currentCategory === "all" 
        ? [...allProducts] 
        : allProducts.filter(p => p.categoryId === currentCategory);
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Sort products
    switch(sortValue) {
        case 'price-low':
            filtered.sort((a, b) => {
                const priceA = a.hasVariants && a.variants && a.variants[0] ? a.variants[0].price : a.price;
                const priceB = b.hasVariants && b.variants && b.variants[0] ? b.variants[0].price : b.price;
                return priceA - priceB;
            });
            break;
        case 'price-high':
            filtered.sort((a, b) => {
                const priceA = a.hasVariants && a.variants ? Math.max(...a.variants.map(v => v.price)) : a.price;
                const priceB = b.hasVariants && b.variants ? Math.max(...b.variants.map(v => v.price)) : b.price;
                return priceB - priceA;
            });
            break;
        case 'name-az':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-za':
            filtered.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }
    
    displayProducts(filtered);
}

// Make functions globally available
window.selectCategory = selectCategory;
window.filterProducts = filterProducts;

/**
 * Calculates Best Sellers by scanning the entire Firebase 'orders' collection
 * Handles both 'items' and 'cart' field names for compatibility
 * @param {number} limit - Number of top products to return
 */
async function getFirebaseBestSellers(limit = 3) {
    try {
        const productPurchaseCount = {};
        
        // Get all orders from Firestore
        const ordersSnapshot = await getDocs(collection(db, "orders"));

        console.log(`📊 Analyzing ${ordersSnapshot.size} orders for bestsellers...`);

        ordersSnapshot.forEach(doc => {
            const orderData = doc.data();
            
            // ✅ Handle both 'items' and 'cart' field names
            const orderItems = orderData.items || orderData.cart || [];
            
            if (Array.isArray(orderItems) && orderItems.length > 0) {
                orderItems.forEach(item => {
                    // Get product ID (handle both string and number IDs)
                    const pid = item.id ? item.id.toString() : null;
                    
                    if (!pid) {
                        console.warn('⚠️ Order item missing ID:', item);
                        return;
                    }
                    
                    const qty = parseInt(item.quantity) || 1;
                    
                    // Accumulate purchase counts
                    productPurchaseCount[pid] = (productPurchaseCount[pid] || 0) + qty;
                });
            }
        });

        // Convert to sorted array
        const sortedProducts = Object.keys(productPurchaseCount)
            .map(id => ({
                id: id,
                purchaseCount: productPurchaseCount[id]
            }))
            .sort((a, b) => b.purchaseCount - a.purchaseCount);

        console.log('🏆 Bestsellers:', sortedProducts.slice(0, limit));

        return sortedProducts.slice(0, limit);
    } catch (error) {
        console.error("❌ Error calculating best sellers:", error);
        return [];
    }
}

// ========================================
// FEATURED PRODUCTS FOR HOME PAGE (FIREBASE RANKING)
// ========================================
async function loadFeaturedProducts() {
    // Only run on the home page
    if (!window.location.pathname.includes('index.html') && 
        window.location.pathname !== '/' && 
        window.location.pathname !== '/index' &&
        !window.location.pathname.endsWith('/')) {
        return;
    }
    
    const container = document.getElementById('featuredProductsGrid');
    if (!container) return;
    
    try {
        console.log('🏠 Loading featured products...');
        
        // 1. Get the purchase rankings from the Orders collection
        const rankings = await getFirebaseBestSellers(3);
        
        // 2. Load all product data
        const allProducts = await loadProductsFromFirebase();
        
        if (!allProducts || allProducts.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📦</div>
                    <h3>No products available</h3>
                    <p>Please check back later</p>
                </div>
            `;
            return;
        }

        let featuredProducts;

        // 3. Logic: If we have orders, use rankings. If brand new store, use first 3.
        if (rankings.length > 0) {
            console.log('✅ Using bestseller rankings');
            
            featuredProducts = rankings.map(rank => {
                // Find product details by ID (handle both string and number IDs)
                const details = allProducts.find(p => p.id.toString() === rank.id.toString());
                
                if (!details) {
                    console.warn(`⚠️ Product ${rank.id} not found in products list`);
                    return null;
                }
                
                return { ...details, purchaseCount: rank.purchaseCount };
            }).filter(p => p !== null); // Remove any null entries
            
            // If we don't have 3 products, fill with random products
            if (featuredProducts.length < 3) {
                console.log('⚠️ Not enough bestsellers, adding random products');
                const remainingCount = 3 - featuredProducts.length;
                const usedIds = featuredProducts.map(p => p.id);
                const remainingProducts = allProducts
                    .filter(p => !usedIds.includes(p.id))
                    .slice(0, remainingCount);
                
                featuredProducts = [...featuredProducts, ...remainingProducts];
            }
        } else {
            // Fallback for new stores with no orders yet
            console.log('ℹ️ No orders yet, using first 3 products');
            featuredProducts = allProducts.slice(0, 3);
        }
        
        // 4. Render the cards
        container.innerHTML = featuredProducts.map((product, index) => {
            // Dynamic Badges based on Rank
            let badge = 'Featured';
            if (product.purchaseCount) {
                // Has actual purchase data
                if (index === 0) badge = 'Bestseller';
                else if (index === 1) badge = 'Popular';
                else if (index === 2) badge = 'Trending';
            } else {
                // No purchase data (new store)
                badge = 'Featured';
            }
            
            let priceDisplay;
            if (product.hasVariants && product.variants && product.variants.length > 0) {
                const minPrice = Math.min(...product.variants.map(v => v.price));
                priceDisplay = `RM ${minPrice.toFixed(2)}`;
            } else {
                priceDisplay = `RM ${product.price.toFixed(2)}`;
            }
            
            return `
                <div class="product-card" onclick="location.href='product-detail.html?id=${product.id}'">
                    <div class="product-image">
                        <img src="${product.image}" alt="${product.name}" onerror="this.parentElement.innerHTML='<div class=\\'product-image-placeholder\\'>🥮</div><span class=\\'product-badge\\'>${badge}</span>'">
                        <span class="product-badge">${badge}</span>
                    </div>
                    <div class="product-info">
                        <div class="product-category">${product.category}</div>
                        <h3>${product.name}</h3>
                        ${product.purchaseCount ? `<p style="color: #e67e22; font-weight: bold; font-size: 0.85rem;">🔥 ${product.purchaseCount} sold</p>` : ''}
                        <p>${product.description ? product.description.substring(0, 60) + '...' : ''}</p>
                        <div class="product-price">${priceDisplay}</div>
                        <button class="product-btn">See More</button>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Featured products loaded successfully');

    } catch (error) {
        console.error("❌ Error loading featured products:", error);
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <h3>Unable to load products</h3>
                <p>Please refresh the page</p>
            </div>
        `;
    }
}

// ========================================
// PRODUCT DETAIL PAGE
// ========================================
async function loadProductDetails() {
    if (!window.location.pathname.includes('product-detail.html')) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        window.location.href = 'product.html';
        return;
    }
    
    console.log('📦 Loading product details for ID:', productId);
    
    // Load all products first
    const products = await loadProductsFromFirebase();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        alert('Product not found');
        window.location.href = 'product.html';
        return;
    }
    
    // Display product details
    const productImageDiv = document.getElementById('productImage');
    if (productImageDiv) {
        productImageDiv.innerHTML = `
            <img src="${product.image}" alt="${product.name}" 
                 onerror="this.parentElement.innerHTML='<div class=\\'detail-product-image-placeholder\\'>🥮</div>'">
        `;
    }
    
    const productTitle = document.getElementById('productTitle');
    if (productTitle) productTitle.textContent = product.name;
    
    const productName = document.getElementById('productName');
    if (productName) productName.textContent = product.name;
    
    const productCategory = document.getElementById('productCategory');
    if (productCategory) productCategory.textContent = product.category;
    
    // Handle price and variants
    const priceDiv = document.getElementById('productPrice');
    if (priceDiv) {
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            const firstPrice = product.variants[0].price;
            
            priceDiv.innerHTML = `
                <div class="variant-selector">
                    <label for="variantSelect">Choose Variant:</label>
                    <select id="variantSelect" onchange="updatePrice()">
                        ${product.variants.map((variant, index) => {
                            return `<option value="${index}">${variant.name} - RM ${variant.price.toFixed(2)}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="selected-price" id="selectedPrice">RM ${firstPrice.toFixed(2)}</div>
            `;
            
            window.currentProductVariants = product.variants;
        } else {
            let priceText = `RM ${product.price.toFixed(2)}`;
            if (product.size) {
                priceText += ` (${product.size})`;
            }
            priceDiv.textContent = priceText;
        }
    }
    
    const productDesc = document.getElementById('productDescription');
    if (productDesc) {
        const descPara = productDesc.querySelector('p');
        if (descPara) descPara.textContent = product.description || 'No description available';
    }
    
    const featuresList = document.getElementById('productFeatures');
    if (featuresList && product.features) {
        featuresList.innerHTML = product.features.map(feature => `<li>${feature}</li>`).join('');
    }
    
    // Store product data for cart
    const firstVariantPrice = (product.hasVariants && product.variants && product.variants[0]) 
        ? product.variants[0].price 
        : product.price;

    window.currentProduct = {
        id: productId,
        name: product.name,
        price: firstVariantPrice,
        image: product.image,
        hasVariants: product.hasVariants || false,
        selectedVariant: (product.hasVariants && product.variants) ? 0 : null
    };
    
    console.log('✅ Product details loaded');
}

// Update price when variant is selected
function updatePrice() {
    const variantSelect = document.getElementById('variantSelect');
    if (!variantSelect) return;
    
    const selectedIndex = parseInt(variantSelect.value);
    const selectedVariant = window.currentProductVariants[selectedIndex];
    
    const selectedPrice = document.getElementById('selectedPrice');
    if (selectedPrice) {
        selectedPrice.textContent = `RM ${selectedVariant.price.toFixed(2)}`;
    }
    
    // Update current product price and variant
    if (window.currentProduct) {
        window.currentProduct.price = selectedVariant.price;
        window.currentProduct.selectedVariant = selectedIndex;
        window.currentProduct.variantName = selectedVariant.name;
    }
}

window.updatePrice = updatePrice;

// Quantity controls
function increaseQuantity() {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return;
    
    const currentValue = parseInt(quantityInput.value);
    if (currentValue < 10) {
        quantityInput.value = currentValue + 1;
    }
}

function decreaseQuantity() {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return;
    
    const currentValue = parseInt(quantityInput.value);
    if (currentValue > 1) {
        quantityInput.value = currentValue - 1;
    }
}

window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;

// ========================================
// SHOPPING CART FUNCTIONALITY WITH FIREBASE
// ========================================

// Get user's cart from Firestore
async function getCart() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const cartRef = doc(db, 'carts', user.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (cartDoc.exists()) {
            return cartDoc.data().items || [];
        }
        return [];
    } catch (error) {
        console.error('❌ Error loading cart:', error);
        return [];
    }
}

// Save cart to Firestore
async function saveCart(cartItems) {
    const user = getCurrentUser();
    if (!user) return false;
    
    try {
        const cartRef = doc(db, 'carts', user.uid);
        await setDoc(cartRef, {
            userId: user.uid,
            items: cartItems,
            updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Cart saved to Firebase');
        await updateCartBadge();
        return true;
    } catch (error) {
        console.error('❌ Error saving cart:', error);
        return false;
    }
}

// Add item to cart
async function addToCart(item) {
    if (!isUserLoggedIn()) {
        const userWantsToSignIn = confirm("You need to sign in to add items to cart. Would you like to sign in now?");
        if (userWantsToSignIn) {
            window.location.href = 'signin.html';
        }
        return false;
    }
    
    let cart = await getCart();
    
    // Check if item already exists (compare id and variant)
    const existingIndex = cart.findIndex(cartItem => 
        cartItem.id === item.id && 
        (item.variantIndex === null || cartItem.variantIndex === item.variantIndex)
    );
    
    if (existingIndex > -1) {
        // Update quantity if item exists
        cart[existingIndex].quantity += item.quantity;
    } else {
        // Add new item
        cart.push(item);
    }
    
    await saveCart(cart);
    await updateCartBadge();
    return true;
}

// ========================================
// CART LOGIC
// ========================================

window.addToCart = function(id, name, price, image) {
    // 1. AUTH CHECK (The part you just shared)
    if (!isUserLoggedIn()) {
        const userWantsToSignIn = confirm("You need to sign in to add items to your cart. Sign in now?");
        if (userWantsToSignIn) {
            window.location.href = 'signin.html';
        }
        return; 
    }

    // 2. CORE CART LOGIC
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItemIndex = cart.findIndex(item => item.id === id);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            quantity: 1
        });
    }

    // 3. SAVE & UPDATE UI
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Trigger the badge update we discussed earlier
    if (typeof updateCartBadge === 'function') {
        updateCartBadge();
    }

    // Optional: Show success message
    alert(`${name} added to cart!`);
};

// Update cart badge count
async function updateCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    if (!cartBadge) return;
    
    // Check if user is logged in
    if (!isUserLoggedIn()) {
        cartBadge.style.display = 'none';
        return;
    }
    
    try {
        // ✅ Get cart from Firebase instead of localStorage
        const cart = await getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update badge text
        cartBadge.textContent = totalItems;
        
        // Update visibility and animation
        if (totalItems === 0) {
            cartBadge.style.display = 'none';
            cartBadge.classList.remove('has-items');
        } else {
            cartBadge.style.display = 'inline-flex';
            
            // Add pop animation
            cartBadge.classList.add('has-items');
            
            // Remove animation class after it plays
            setTimeout(() => {
                cartBadge.classList.remove('has-items');
            }, 500);
        }
        
        console.log('🛒 Cart badge updated:', totalItems, 'items');
    } catch (error) {
        console.error('❌ Error updating cart badge:', error);
        // Hide badge on error
        cartBadge.style.display = 'none';
    }
}

// Add to cart from product detail page
async function addToCartFromDetail() {
    if (!isUserLoggedIn()) {
        const userWantsToSignIn = confirm("You need to sign in to add items to cart. Would you like to sign in now?");
        if (userWantsToSignIn) {
            window.location.href = 'signin.html';
        }
        return;
    }
    
    const quantity = parseInt(document.getElementById('quantity').value);
    const product = window.currentProduct;
    
    if (!product) {
        showToast('Product not found', 'error', 2000);
        return;
    }
    
    let displayName = product.name;
    
    // Add variant name to display if applicable
    if (product.hasVariants && product.variantName) {
        displayName += ` (${product.variantName})`;
    }
    
    const cartItem = {
        id: product.id,
        name: displayName,
        baseProductName: product.name,
        price: product.price,
        quantity: quantity,
        image: product.image,
        variantIndex: product.selectedVariant,
        addedAt: new Date().toISOString()
    };
    
    const success = await addToCart(cartItem);
    
    if (success) {
        showToast(`${quantity} × ${displayName} added to cart!`, 'success', 3000);
    }
}

// Remove item from cart
async function removeFromCart(index) {
    const confirmRemove = confirm("Remove this item from cart?");
    if (!confirmRemove) return;
    
    let cart = await getCart();
    cart.splice(index, 1);
    await saveCart(cart);
    await updateCartBadge();
    
    showToast('Item removed from cart', 'info', 2000);
    
    // Reload cart page
    await loadCartPage();
}

// Update cart item quantity
async function updateCartQuantity(index, newQuantity) {
    if (newQuantity < 1) {
        await removeFromCart(index);
        return;
    }
    
    if (newQuantity > 10) {
        showToast('Maximum quantity is 10 per item', 'warning', 2000);
        return;
    }
    
    let cart = await getCart();
    cart[index].quantity = newQuantity;
    await saveCart(cart);
    await updateCartBadge();
    
    // Reload cart page
    await loadCartPage();
}

// Clear entire cart
async function clearCart() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const cartRef = doc(db, 'carts', user.uid);
        await setDoc(cartRef, {
            userId: user.uid,
            items: [],
            updatedAt: new Date().toISOString()
        });
        
        await updateCartBadge();
        console.log('✅ Cart cleared');
        return true;
    } catch (error) {
        console.error('❌ Error clearing cart:', error);
        return false;
    }
}

// Load and display cart page
async function loadCartPage() {
    if (!window.location.pathname.includes('cart.html')) return;
    
    console.log('🛒 Loading cart page...');
    
    // Wait for auth to be ready
    let attempts = 0;
    while (!authReady && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!isUserLoggedIn()) {
        console.log('❌ Not logged in, redirecting...');
        alert("Please sign in to view your cart.");
        window.location.href = 'signin.html';
        return;
    }
    
    console.log('✅ User authenticated for cart');
    
    const cart = await getCart();
    const container = document.getElementById('cartItemsContainer');
    
    if (!container) return;
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <h3>Your cart is empty</h3>
                <p>Add some delicious kuih to your cart!</p>
                <button class="btn btn-primary" onclick="window.location.href='product.html'">
                    Start Shopping
                </button>
            </div>
        `;
        
        // Update summary
        document.getElementById('subtotal').textContent = 'RM 0.00';
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }
    
    container.innerHTML = '';
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-image">
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}" onerror="this.parentElement.textContent='🥮'">` 
                    : '🥮'
                }
            </div>
            <div class="cart-item-details">
                <h3>${item.name}</h3>
                <p class="cart-item-price">RM ${item.price.toFixed(2)} each</p>
            </div>
            <div class="cart-item-quantity">
                <button onclick="updateCartQuantity(${index}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQuantity(${index}, ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-total">
                <p>RM ${itemTotal.toFixed(2)}</p>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">×</button>
        `;
        container.appendChild(cartItem);
    });
    
    // Update summary
    document.getElementById('subtotal').textContent = `RM ${subtotal.toFixed(2)}`;
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.disabled = false;
    
        // 🆕 ADD EVENT LISTENER
        checkoutBtn.onclick = proceedToCheckout;
    }

    console.log('✅ Cart page loaded with', cart.length, 'items');
}

// Proceed to checkout
function proceedToCheckout() {
    window.location.href = 'checkout.html';
}

// Make cart functions globally available
window.addToCartFromDetail = addToCartFromDetail;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.proceedToCheckout = proceedToCheckout;

import { db } from './firebase-config.js';
import { 
    collection,
    addDoc,
    serverTimestamp,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ========================================
// CHECKOUT INITIALIZATION
// ========================================

async function initializeCheckout() {
    if (!window.location.pathname.includes('checkout.html')) {
        return;
    }

    console.log('🛒 Initializing checkout page...');

    // Wait for auth to be ready
    let attempts = 0;
    while (!authReady && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!isUserLoggedIn()) {
        console.log('❌ Not logged in, redirecting...');
        alert("Please sign in before checkout.");
        window.location.href = 'signin.html';
        return;
    }

    const user = getCurrentUser();
    console.log('✅ User authenticated for checkout:', user.email);

    // Auto-fill user info
    const nameInput = document.getElementById('checkoutName');
    const emailInput = document.getElementById('checkoutEmail');
    
    if (nameInput) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';

    // Initialize variables
    window.promoDiscount = 0;
    window.shippingCost = 0;

    // Load saved addresses
    await loadCheckoutSavedAddresses();

    // Load initial summary
    await loadCheckoutSummary();

    // Add event listeners
    setupCheckoutEventListeners();

    console.log('✅ Checkout initialized');
}

// ========================================
// EVENT LISTENERS SETUP
// ========================================

function setupCheckoutEventListeners() {
    // State change listener
    const stateSelect = document.getElementById('state');
    if (stateSelect) {
        stateSelect.addEventListener('change', async function() {
            await calculateShipping();
            checkCODAvailability();
        });
    }

    // City input listener
    const cityInput = document.getElementById('city');
    if (cityInput) {
        cityInput.addEventListener('input', checkCODAvailability);
        cityInput.addEventListener('blur', checkCODAvailability);
    }

    // Promo code button
    const promoBtn = document.querySelector('.promo-section button');
    if (promoBtn) {
        promoBtn.addEventListener('click', applyPromo);
    }

    // Phone number input restriction
    const phoneInput = document.getElementById('checkoutPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
        });

        phoneInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numbersOnly = pastedText.replace(/[^0-9]/g, '').slice(0, 10);
            this.value = numbersOnly;
        });
    }

    // Postcode input restriction (5 digits)
    const postcodeInput = document.getElementById('postcode');
    if (postcodeInput) {
        postcodeInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 5) {
                this.value = this.value.slice(0, 5);
            }
        });

        postcodeInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numbersOnly = pastedText.replace(/[^0-9]/g, '').slice(0, 5);
            this.value = numbersOnly;
        });
    }
}

// ========================================
// SHIPPING CALCULATION
// ========================================

async function calculateShipping() {
    const stateValue = document.getElementById("state")?.value?.trim();
    
    let cost = 0;

    if (stateValue === "") {
        cost = 0;
    } else if (stateValue === "sarawak") {
        cost = 8.00;
    } else if (stateValue === "sabah" || stateValue === "labuan") {
        cost = 11.00;
    } else {
        cost = 18.00;
    }

    window.shippingCost = cost;
    await loadCheckoutSummary();
}

// ========================================
// COD AVAILABILITY CHECK
// ========================================

function checkCODAvailability() {
    const city = document.getElementById("city")?.value?.trim().toLowerCase();
    const state = document.getElementById("state")?.value?.trim();
    
    const codCard = document.getElementById("codPaymentCard");
    const codRadio = document.getElementById("codPaymentRadio");
    const codMsg = document.getElementById("codUnavailableMsg");
    
    if (!codCard || !codRadio || !codMsg) return;
    
    const isSarawak = state === "sarawak";
    const isKuching = city === "kuching";
    const isKotaSamarahan = city === "kota samarahan" || city === "samarahan";
    
    const codAvailable = isSarawak && (isKuching || isKotaSamarahan);
    
    if (codAvailable) {
        codCard.classList.remove("disabled");
        codRadio.disabled = false;
        codMsg.style.display = "none";
    } else {
        codCard.classList.add("disabled");
        codRadio.disabled = true;
        codRadio.checked = false;
        codMsg.style.display = "block";
        
        if (codRadio.checked) {
            alert("Cash on Delivery is only available in Kuching and Kota Samarahan, Sarawak. Please select another payment method.");
        }
    }
}

// ========================================
// CALCULATE CART TOTALS
// ========================================

async function calculateCartTotals() {
    const cart = await getCart();
    
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const total = subtotal + window.shippingCost - window.promoDiscount;

    return {
        subtotal,
        shipping: window.shippingCost,
        promoDiscount: window.promoDiscount,
        final: total < 0 ? 0 : total
    };
}

// ========================================
// LOAD CHECKOUT SUMMARY
// ========================================

async function loadCheckoutSummary() {
    const totals = await calculateCartTotals();

    const subtotalEl = document.getElementById("subtotal");
    const shippingEl = document.getElementById("shipping");
    const promoDiscountEl = document.getElementById("promoDiscount");
    const finalTotalEl = document.getElementById("finalTotal");

    if (subtotalEl) subtotalEl.textContent = `RM ${totals.subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = `RM ${totals.shipping.toFixed(2)}`;
    if (promoDiscountEl) promoDiscountEl.textContent = `RM ${totals.promoDiscount.toFixed(2)}`;
    if (finalTotalEl) finalTotalEl.textContent = `RM ${totals.final.toFixed(2)}`;
}

// ========================================
// PROMO CODE MANAGEMENT
// ========================================

function getPromoData(code) {
    const promoCodes = {
        'RAYA2025': { discount: 20.00, description: 'RM20 off for Raya' },
        'WELCOME10': { discount: 10.00, description: 'RM10 off for new customers' },
        'FESTIVE15': { discount: 15.00, description: 'RM15 off festive special' }
    };
    
    return promoCodes[code.toUpperCase()] || null;
}

async function applyPromo() {
    const codeInput = document.getElementById("promoCode")?.value?.trim();
    const code = codeInput?.toLowerCase();
    const msg = document.getElementById("promoMessage");

    if (!msg) return;

    if (!code || code === "" || code === "-" || code === "na" || code === "n/a" || code === "none") {
        window.promoDiscount = 0;
        
        msg.textContent = "ℹ️ No code applied.";
        msg.style.color = "#004085";
        msg.style.backgroundColor = "#cce5ff";
        msg.style.borderColor = "#b8daff";
        msg.style.display = "block";
        
        await loadCheckoutSummary();
        return;
    }

    const promo = getPromoData(codeInput);

    if (!promo) {
        window.promoDiscount = 0;
        msg.textContent = "❌ Invalid promo code";
        msg.style.color = "#721c24";
        msg.style.backgroundColor = "#f8d7da";
        msg.style.borderColor = "#f5c6cb";
        msg.style.display = "block";
    } else {
        window.promoDiscount = promo.discount;
        msg.textContent = `✔ Promo applied: RM ${promo.discount.toFixed(2)} OFF`;
        msg.style.color = "#155724";
        msg.style.backgroundColor = "#d4edda";
        msg.style.borderColor = "#c3e6cb";
        msg.style.display = "block";
    }

    await loadCheckoutSummary();
}

function validatePromoCode(code) {
    const promoCodes = {
        'RAYA2025': { discount: 20.00, description: 'RM20 off for Raya', minOrder: 50 },
        'WELCOME10': { discount: 10.00, description: 'RM10 off for new customers', minOrder: 30 },
        'FESTIVE15': { discount: 15.00, description: 'RM15 off festive special', minOrder: 40 }
    };
    
    const promo = promoCodes[code.toUpperCase()];
    
    if (!promo) {
        return { valid: false, error: 'Invalid promo code' };
    }
    
    return { valid: true, ...promo };
}

// ========================================
// SAVED ADDRESSES
// ========================================

async function loadCheckoutSavedAddresses() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        const dropdown = document.getElementById('savedAddressesDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">-- Select a saved address --</option>';
        
        if (!addressDoc.exists()) {
            dropdown.innerHTML = '<option value="">-- No saved addresses --</option>';
            dropdown.disabled = true;
            return;
        }
        
        const addresses = addressDoc.data().addresses || [];
        
        if (addresses.length === 0) {
            dropdown.innerHTML = '<option value="">-- No saved addresses --</option>';
            dropdown.disabled = true;
            return;
        }
        
        addresses.forEach((address, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${address.label} - ${address.city}`;
            dropdown.appendChild(option);
        });
        
        dropdown.disabled = false;
        console.log('✅ Loaded', addresses.length, 'saved addresses');
    } catch (error) {
        console.error('❌ Error loading saved addresses:', error);
    }
}

async function useSavedAddress() {
    const user = getCurrentUser();
    if (!user) return;
    
    const dropdown = document.getElementById('savedAddressesDropdown');
    const selectedIndex = dropdown?.value;
    
    if (selectedIndex === '') return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        if (!addressDoc.exists()) return;
        
        const addresses = addressDoc.data().addresses || [];
        const selectedAddress = addresses[selectedIndex];
        
        if (!selectedAddress) return;
        
        // Fill the form fields
        const addrLine1 = document.getElementById('addrLine1');
        const postcode = document.getElementById('postcode');
        const city = document.getElementById('city');
        const state = document.getElementById('state');
        
        if (addrLine1) addrLine1.value = selectedAddress.address;
        if (postcode) postcode.value = selectedAddress.postcode;
        if (city) city.value = selectedAddress.city;
        if (state) state.value = selectedAddress.state.toLowerCase();
        
        // Trigger change events
        if (state) state.dispatchEvent(new Event('change'));
        if (city) city.dispatchEvent(new Event('input'));
        
        showToast('Address filled successfully!', 'success', 2000);
    } catch (error) {
        console.error('❌ Error using saved address:', error);
        showToast('Failed to load address', 'error', 2000);
    }
}

async function saveCurrentCheckoutAddress() {
    const user = getCurrentUser();
    if (!user) {
        alert('Please sign in to save addresses');
        return;
    }
    
    const address = document.getElementById('addrLine1')?.value?.trim();
    const postcode = document.getElementById('postcode')?.value?.trim();
    const city = document.getElementById('city')?.value?.trim();
    const state = document.getElementById('state')?.value?.trim();
    
    if (!address || !postcode || !city || !state) {
        alert('Please fill in all address fields before saving');
        return;
    }
    
    if (!/^\d{5}$/.test(postcode)) {
        alert('Please enter a valid 5-digit postcode');
        return;
    }
    
    const label = prompt('Label this address (e.g., Home, Office):');
    if (!label || label.trim() === '') return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        let addresses = [];
        if (addressDoc.exists()) {
            addresses = addressDoc.data().addresses || [];
        }
        
        // Check if address already exists
        const exists = addresses.some(addr => 
            addr.address === address && 
            addr.postcode === postcode && 
            addr.city === city
        );
        
        if (exists) {
            alert('This address is already saved');
            return;
        }
        
        // Ask if this should be default
        const makeDefault = addresses.length === 0 || confirm('Set this as your default checkout address?');
        
        const newAddress = {
            label: label.trim(),
            address: address,
            postcode: postcode,
            city: city,
            state: state,
            isDefault: makeDefault,
            dateAdded: new Date().toISOString()
        };
        
        // If making this default, remove default from others
        if (makeDefault) {
            addresses.forEach(addr => addr.isDefault = false);
        }
        
        addresses.push(newAddress);
        
        await setDoc(addressRef, {
            userId: user.uid,
            addresses: addresses,
            updatedAt: new Date().toISOString()
        });
        
        showToast('Address saved successfully!', 'success', 3000);
        await loadCheckoutSavedAddresses();
    } catch (error) {
        console.error('❌ Error saving address:', error);
        showToast('Failed to save address', 'error', 3000);
    }
}

// ========================================
// PLACE ORDER
// ========================================

async function placeOrder() {
    const cart = await getCart();
    const user = getCurrentUser();
    
    if (!cart || cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    // Get all form values
    const name = document.getElementById("checkoutName")?.value?.trim();
    const email = document.getElementById("checkoutEmail")?.value?.trim();
    const phone = document.getElementById("checkoutPhone")?.value?.trim();
    const addr1 = document.getElementById("addrLine1")?.value?.trim();
    const postcode = document.getElementById("postcode")?.value?.trim();
    const city = document.getElementById("city")?.value?.trim();
    const state = document.getElementById("state")?.value?.trim();

    // Validation
    if (!name || !email || !phone || !addr1 || !postcode || !city || !state) {
        alert("Please fill in all required fields");
        return;
    }

    if (!/^\d{9,10}$/.test(phone)) {
        alert("Please enter a valid phone number (9-10 digits)");
        return;
    }

    if (!/^\d{5}$/.test(postcode)) {
        alert("Please enter a valid 5-digit postcode");
        return;
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    if (!paymentMethod) {
        alert("Please select a payment method.");
        return;
    }

    await calculateShipping();
    
    const capitalizedState = capitalizeStateName(state);
    const fullAddress = `${addr1}, ${postcode} ${city}, ${capitalizedState}`;
    const totals = await calculateCartTotals();

    const orderData = {
        userId: user.uid,
        customerName: name,
        customerEmail: email,
        customerPhone: '+60' + phone,
        shippingAddress: fullAddress,
        items: cart, // ← Make sure this is 'items'
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        promoDiscount: totals.promoDiscount,
        total: totals.final,
        paymentMethod: paymentMethod.value,
        status: paymentMethod.value === "Cash on Delivery" ? 'processing' : 'pending',
        paymentCompleted: paymentMethod.value === "Cash on Delivery",
        createdAt: serverTimestamp(),
        orderDate: new Date().toISOString()
    };

    try {
        // Save order to Firestore
        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        console.log('✅ Order saved to Firestore:', orderRef.id);

        // 🆕 IMPORTANT: Save to localStorage for checkout success page
        // Use the same field names for consistency
        const orderForDisplay = {
            id: orderRef.id,
            customerName: name,
            customerEmail: email,
            customerPhone: '+60' + phone,
            shippingAddress: fullAddress,
            items: cart, // Use 'items' not 'cart'
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            promoDiscount: totals.promoDiscount,
            total: totals.final,
            paymentMethod: paymentMethod.value,
            status: orderData.status,
            paymentCompleted: orderData.paymentCompleted,
            orderDate: new Date().toISOString()
        };

        localStorage.setItem("lastOrder", JSON.stringify(orderForDisplay));
        console.log('✅ Order saved to localStorage for display');

        // Clear cart
        await clearCart();

        // Redirect based on payment method
        if (paymentMethod.value === "Cash on Delivery") {
            window.location.href = "checkout_success.html";
        } else if (paymentMethod.value === "FPX (Online Banking)") {
            window.location.href = "payment_fpx.html";
        } else if (paymentMethod.value === "E-Wallet") {
            window.location.href = "payment_ewallet.html";
        }
    } catch (error) {
        console.error('❌ Error placing order:', error);
        alert('Failed to place order. Please try again.');
    }
}

// ========================================
// CHECKOUT SUCCESS PAGE
// ========================================

// Initialize checkout success page
function initializeCheckoutSuccess() {
    if (!window.location.pathname.includes('checkout_success.html')) {
        return;
    }

    console.log('🎉 Initializing checkout success page...');

    // CRITICAL: Replace payment pages in history
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
    }

    loadOrderSummary();
    
    // Clear lastOrder after a short delay
    setTimeout(() => {
        localStorage.removeItem('lastOrder');
    }, 3000);
}

// Load and display order summary
function loadOrderSummary() {
    const order = JSON.parse(localStorage.getItem("lastOrder"));
    const summaryDiv = document.getElementById("orderSummary");

    if (!summaryDiv) {
        console.error('❌ orderSummary element not found');
        return;
    }

    if (!order) {
        console.warn('⚠️ No order found in localStorage');
        summaryDiv.innerHTML = `
            <p style="text-align: center; color: #999;">
                No order found. <a href="index.html" style="color: var(--accent-color);">Return to home</a>
            </p>
        `;
        return;
    }

    console.log('✅ Loading order summary:', order);

    // Format the order details
    summaryDiv.innerHTML = `
        <h3>Order Summary</h3>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Customer Name:</span>
            <span class="order-detail-value">${order.customerName || order.name || 'N/A'}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Email:</span>
            <span class="order-detail-value">${order.customerEmail || order.email || 'N/A'}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Phone:</span>
            <span class="order-detail-value">${order.customerPhone || order.phone || 'N/A'}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Delivery Address:</span>
            <span class="order-detail-value">${order.shippingAddress || order.address || 'N/A'}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Payment Method:</span>
            <span class="order-detail-value">${order.paymentMethod || 'N/A'}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Order Date:</span>
            <span class="order-detail-value">${order.orderDate ? new Date(order.orderDate).toLocaleString() : new Date().toLocaleString()}</span>
        </div>
        
        <hr class="order-detail-divider">
        
        <div class="order-detail-row">
            <span class="order-detail-label">Subtotal:</span>
            <span class="order-detail-value">RM ${order.subtotal.toFixed(2)}</span>
        </div>
        
        <div class="order-detail-row">
            <span class="order-detail-label">Shipping:</span>
            <span class="order-detail-value">RM ${order.shipping.toFixed(2)}</span>
        </div>
        
        ${order.promoDiscount > 0 ? `
        <div class="order-detail-row">
            <span class="order-detail-label">Promo Discount:</span>
            <span class="order-detail-value" style="color: var(--accent-color);">-RM ${order.promoDiscount.toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="order-detail-total">
            <span>Total Amount:</span>
            <span>RM ${order.total.toFixed(2)}</span>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-light); border-radius: 8px;">
            <p style="margin: 0; text-align: center; color: #666; font-size: 0.9rem;">
                <strong>📦 Order Items:</strong> ${order.items ? order.items.length : (order.cart ? order.cart.length : 0)} item${(order.items?.length || order.cart?.length) > 1 ? 's' : ''}
            </p>
            <div style="margin-top: 0.5rem; text-align: center; color: #888; font-size: 0.85rem;">
                ${(order.items || order.cart || []).map(item => `${item.quantity}x ${item.name}`).join(' • ')}
            </div>
        </div>
    `;

    console.log('✅ Order summary displayed');
}

// Make functions globally available
window.initializeCheckoutSuccess = initializeCheckoutSuccess;
window.loadOrderSummary = loadOrderSummary;

// ========================================
// HELPER FUNCTIONS
// ========================================

function capitalizeStateName(stateName) {
    if (!stateName) return '';
    
    const stateNameMap = {
        'sarawak': 'Sarawak',
        'sabah': 'Sabah',
        'labuan': 'Labuan',
        'johor': 'Johor',
        'kedah': 'Kedah',
        'kelantan': 'Kelantan',
        'melaka': 'Melaka',
        'negeri-sembilan': 'Negeri Sembilan',
        'pahang': 'Pahang',
        'penang': 'Penang',
        'perak': 'Perak',
        'perlis': 'Perlis',
        'selangor': 'Selangor',
        'terengganu': 'Terengganu',
        'kuala-lumpur': 'Kuala Lumpur',
        'putrajaya': 'Putrajaya'
    };

    const normalized = stateName.toLowerCase().trim();
    return stateNameMap[normalized] || stateName;
}

// ========================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ========================================

window.initializeCheckout = initializeCheckout;
window.calculateShipping = calculateShipping;
window.checkCODAvailability = checkCODAvailability;
window.loadCheckoutSummary = loadCheckoutSummary;
window.applyPromo = applyPromo;
window.useSavedAddress = useSavedAddress;
window.saveCurrentCheckoutAddress = saveCurrentCheckoutAddress;
window.placeOrder = placeOrder;

// ========================================
// WISHLIST FUNCTIONALITY WITH FIREBASE
// ========================================
import {  
    getDoc,  
    updateDoc, 
    deleteDoc,
    arrayUnion, 
    arrayRemove,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Get user's wishlist from Firestore
async function getWishlist() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const wishlistRef = doc(db, 'wishlists', user.uid);
        const wishlistDoc = await getDoc(wishlistRef);
        
        if (wishlistDoc.exists()) {
            return wishlistDoc.data().items || [];
        }
        return [];
    } catch (error) {
        console.error('❌ Error loading wishlist:', error);
        return [];
    }
}

// Check if product is in wishlist
async function isInWishlist(productId) {
    const wishlist = await getWishlist();
    return wishlist.some(item => item.id === productId);
}

// Add product to wishlist
async function addToWishlist(productData) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please sign in to add to wishlist', 'error', 3000);
        return false;
    }
    
    try {
        const wishlistRef = doc(db, 'wishlists', user.uid);
        const wishlistDoc = await getDoc(wishlistRef);
        
        const wishlistItem = {
            id: productData.id,
            name: productData.name,
            price: productData.price,
            image: productData.image,
            hasVariants: productData.hasVariants || false,
            addedAt: new Date().toISOString()
        };
        
        if (wishlistDoc.exists()) {
            // Update existing wishlist
            await updateDoc(wishlistRef, {
                items: arrayUnion(wishlistItem)
            });
        } else {
            // Create new wishlist
            await setDoc(wishlistRef, {
                userId: user.uid,
                items: [wishlistItem],
                createdAt: new Date().toISOString()
            });
        }
        
        console.log('✅ Added to wishlist:', productData.name);
        return true;
    } catch (error) {
        console.error('❌ Error adding to wishlist:', error);
        return false;
    }
}

// Remove product from wishlist
async function removeFromWishlist(productId) {
    const user = getCurrentUser();
    if (!user) return false;
    
    try {
        const wishlist = await getWishlist();
        const itemToRemove = wishlist.find(item => item.id === productId);
        
        if (!itemToRemove) return false;
        
        const wishlistRef = doc(db, 'wishlists', user.uid);
        await updateDoc(wishlistRef, {
            items: arrayRemove(itemToRemove)
        });
        
        console.log('✅ Removed from wishlist');
        return true;
    } catch (error) {
        console.error('❌ Error removing from wishlist:', error);
        return false;
    }
}

// Toggle wishlist (add/remove)
async function toggleWishlist() {
    if (!isUserLoggedIn()) {
        const userWantsToSignIn = confirm("You need to sign in to add items to wishlist. Would you like to sign in now?");
        if (userWantsToSignIn) {
            window.location.href = 'signin.html';
        }
        return;
    }
    
    const product = window.currentProduct;
    if (!product) return;
    
    const inWishlist = await isInWishlist(product.id);
    
    if (inWishlist) {
        // Remove from wishlist
        const success = await removeFromWishlist(product.id);
        if (success) {
            showToast(`${product.name} removed from wishlist`, 'info', 2000);
        }
    } else {
        // Add to wishlist
        const success = await addToWishlist(product);
        if (success) {
            showToast(`${product.name} added to wishlist!`, 'success', 2000);
        }
    }
    
    // Update button appearance with animation
    const wishlistBtn = document.getElementById('wishlistBtn');
    if (wishlistBtn) {
        wishlistBtn.style.animation = 'none';
        setTimeout(() => {
            wishlistBtn.style.animation = '';
        }, 10);
    }
    
    await updateWishlistButton();
}

// Update wishlist button appearance
async function updateWishlistButton() {
    const wishlistBtn = document.getElementById('wishlistBtn');
    if (!wishlistBtn) return;
    
    const product = window.currentProduct;
    if (!product) return;
    
    const heartOutline = wishlistBtn.querySelector('.heart-outline');
    const heartFilled = wishlistBtn.querySelector('.heart-filled');
    
    const inWishlist = await isInWishlist(product.id);
    
    if (inWishlist) {
        // Product is in wishlist - show filled heart
        wishlistBtn.classList.add('active');
        
        if (heartOutline && heartFilled) {
            heartOutline.style.display = 'none';
            heartFilled.style.display = 'block';
        } else {
            wishlistBtn.textContent = '❤️';
        }
    } else {
        // Product is not in wishlist - show outline heart
        wishlistBtn.classList.remove('active');
        
        if (heartOutline && heartFilled) {
            heartOutline.style.display = 'block';
            heartFilled.style.display = 'none';
        } else {
            wishlistBtn.textContent = '🤍';
        }
    }
}

// Load wishlist items for display (on account page)
async function loadWishlistItems() {
    const container = document.getElementById('wishlistGrid');
    if (!container) return;
    
    const wishlist = await getWishlist();
    
    if (wishlist.length === 0) {
        container.innerHTML = '<p class="no-data">Your wishlist is empty</p>';
        return;
    }
    
    // Load full product details for each wishlist item
    const products = await loadProductsFromFirebase();
    
    container.innerHTML = wishlist.map(item => {
        const product = products.find(p => p.id === item.id);
        
        // Determine price display
        let priceDisplay;
        if (product && product.hasVariants && product.variants && product.variants.length > 0) {
            const prices = product.variants.map(v => v.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            if (minPrice === maxPrice) {
                priceDisplay = `RM ${minPrice.toFixed(2)}`;
            } else {
                priceDisplay = `RM ${minPrice.toFixed(2)} - RM ${maxPrice.toFixed(2)}`;
            }
        } else {
            priceDisplay = `RM ${item.price.toFixed(2)}`;
        }
        
        return `
            <div class="wishlist-item">
                <button class="wishlist-remove" onclick="removeFromWishlistAndReload('${item.id}')">×</button>
                <div class="wishlist-item-image">
                    ${item.image 
                        ? `<img src="${item.image}" alt="${item.name}" onerror="this.parentElement.innerHTML='<div style=\\'font-size: 4rem;\\'>🥮</div>'">` 
                        : `<div style="font-size: 4rem;">🥮</div>`
                    }
                </div>
                <h4>${item.name}</h4>
                <p>${priceDisplay}</p>
                <button class="wishlist-btn" onclick="window.location.href='product-detail.html?id=${item.id}'">
                    View Product
                </button>
            </div>
        `;
    }).join('');
}

// Remove from wishlist and reload the display
async function removeFromWishlistAndReload(productId) {
    const confirmRemove = confirm("Remove this item from wishlist?");
    if (!confirmRemove) return;
    
    const success = await removeFromWishlist(productId);
    
    if (success) {
        showToast('Item removed from wishlist', 'info', 2000);
        // Reload wishlist
        await loadWishlistItems();
        
        // Update overview if we're on account page
        const overviewSection = document.getElementById('overview-section');
        if (overviewSection && overviewSection.classList.contains('active')) {
            await loadOverviewData();
        }
    }
}

// Get wishlist count
async function getWishlistCount() {
    const wishlist = await getWishlist();
    return wishlist.length;
}

// Make wishlist functions globally available
window.toggleWishlist = toggleWishlist;
window.removeFromWishlistAndReload = removeFromWishlistAndReload;
window.loadWishlistItems = loadWishlistItems;

// ========================================
// ORDERS MANAGEMENT WITH FIREBASE
// ========================================
import {
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ========================================
// GET USER'S ORDERS FROM FIRESTORE
// ========================================
async function getUserOrders() {
    const user = getCurrentUser();
    if (!user) {
        console.log('❌ No user logged in');
        return [];
    }
    
    try {
        console.log('📦 Loading orders for user:', user.uid);
        
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const orders = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to ISO string
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                orderDate: data.orderDate || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt)
            });
        });
        
        console.log(`✅ Loaded ${orders.length} orders`);
        return orders;
    } catch (error) {
        console.error('❌ Error loading orders:', error);
        return [];
    }
}

// ========================================
// GET SINGLE ORDER BY ID
// ========================================
async function getOrderById(orderId) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await getDoc(orderRef);
        
        if (orderDoc.exists()) {
            const data = orderDoc.data();
            return {
                id: orderDoc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                orderDate: data.orderDate || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt)
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Error loading order:', error);
        return null;
    }
}

// ========================================
// UPDATE ORDER STATUS
// ========================================
async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Order ${orderId} status updated to: ${newStatus}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating order status:', error);
        return false;
    }
}

// ========================================
// LOAD RECENT ORDERS (FOR DASHBOARD)
// ========================================
async function loadRecentOrders(orders = null) {
    const container = document.getElementById('recentOrdersList');
    if (!container) return;
    
    // If orders not provided, fetch them
    if (!orders) {
        orders = await getUserOrders();
    }
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p class="no-data">No recent orders</p>';
        return;
    }
    
    // Show last 3 orders
    const recentOrders = orders.slice(0, 3);
    
    container.innerHTML = recentOrders.map(order => {
        const orderDate = order.orderDate || order.createdAt;
        const displayDate = orderDate ? new Date(orderDate).toLocaleString() : 'N/A';
        const itemCount = order.items?.length || 0;
        
        return `
            <div class="order-item">
                <h4>Order #${order.id.substring(0, 8)}</h4>
                <p><strong>Date:</strong> ${displayDate}</p>
                <p><strong>Total:</strong> RM ${(order.total || 0).toFixed(2)}</p>
                <p><strong>Items:</strong> ${itemCount} item(s)</p>
                <span class="order-status status-${order.status || 'pending'}">${getStatusLabel(order.status)}</span>
            </div>
        `;
    }).join('');
}

// ========================================
// LOAD ALL ORDERS (FOR ORDERS TAB)
// ========================================
async function loadOrders() {
    try {
        const orders = await getUserOrders();
        
        // Load past orders (completed/delivered)
        await loadPastOrders(orders);
        
        // Load pending orders
        await loadPendingOrders(orders);
        
        // Load returns/cancellations
        await loadReturnsOrders(orders);
        
        console.log('✅ All orders loaded');
    } catch (error) {
        console.error('❌ Error loading orders:', error);
    }
}

// ========================================
// LOAD PAST ORDERS (COMPLETED/DELIVERED)
// ========================================
async function loadPastOrders(orders = null) {
    const container = document.getElementById('pastOrdersList');
    if (!container) return;
    
    // If orders not provided, fetch them
    if (!orders) {
        orders = await getUserOrders();
    }
    
    // Filter completed/delivered orders
    const completedOrders = orders.filter(o => 
        o.status === 'processing' || 
        o.status === 'shipped' || 
        o.status === 'delivered'
    );
    
    if (completedOrders.length === 0) {
        container.innerHTML = '<p class="no-data">No past orders</p>';
        return;
    }
    
    container.innerHTML = completedOrders.map((order) => {
        const orderDate = order.orderDate || order.createdAt;
        const displayDate = orderDate ? new Date(orderDate).toLocaleString() : 'N/A';
        
        return `
            <div class="order-item">
                <h4>Order #${order.id.substring(0, 8)}</h4>
                <p><strong>Date:</strong> ${displayDate}</p>
                <p><strong>Total:</strong> RM ${(order.total || 0).toFixed(2)}</p>
                <p><strong>Payment:</strong> ${order.paymentMethod || 'N/A'}</p>
                <p><strong>Items:</strong> ${order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'N/A'}</p>
                <span class="order-status status-${order.status}">${getStatusLabel(order.status)}</span>
                <button class="btn-primary track-order-btn" onclick="viewOrderTracking('${order.id}')">
                    Track Order
                </button>
            </div>
        `;
    }).join('');
}

// ========================================
// LOAD PENDING ORDERS (AWAITING PAYMENT)
// ========================================
async function loadPendingOrders(orders = null) {
    const container = document.getElementById('pendingOrdersList');
    if (!container) return;
    
    // If orders not provided, fetch them
    if (!orders) {
        orders = await getUserOrders();
    }
    
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
        container.innerHTML = '<p class="no-data">No pending orders</p>';
        return;
    }
    
    container.innerHTML = pendingOrders.map((order) => {
        const orderDate = order.orderDate || order.createdAt;
        const displayDate = orderDate ? new Date(orderDate).toLocaleString() : 'N/A';
        
        return `
            <div class="order-item">
                <div class="order-info">
                    <h4>Order #${order.id.substring(0, 8)}</h4>
                    <p><strong>Date:</strong> ${displayDate}</p>
                    <p><strong>Total:</strong> RM ${(order.total || 0).toFixed(2)}</p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Not selected'}</p>
                    <p><strong>Items:</strong> ${order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'N/A'}</p>
                    <p style="color: #ff9800; font-size: 0.9rem; margin-top: 0.5rem;">
                        ⚠️ Payment not completed. Please complete payment to process your order.
                    </p>
                    <span class="order-status status-pending">Pending Payment</span>
                </div>
                <button class="btn-primary track-order-btn" style="margin-top: 1rem;" onclick="completePendingOrder('${order.id}')">
                    Complete Payment
                </button>
            </div>
        `;
    }).join('');
}

// ========================================
// COMPLETE PENDING ORDER (RETRY PAYMENT)
// ========================================
async function completePendingOrder(orderId) {
    const user = getCurrentUser();
    if (!user) {
        alert('Please sign in to complete payment.');
        window.location.href = 'signin.html';
        return;
    }
    
    try {
        // Get the order from Firestore
        const order = await getOrderById(orderId);
        
        if (!order) {
            alert('Order not found.');
            return;
        }
        
        if (order.status !== 'pending') {
            alert('This order has already been processed.');
            return;
        }
        
        // Confirm with user
        const confirmPayment = confirm(
            `Complete payment for order ${order.id.substring(0, 8)}?\n\n` +
            `Total Amount: RM ${(order.total || 0).toFixed(2)}\n` +
            `Items: ${order.items?.length || 0} item(s)\n\n` +
            `Click OK to proceed to payment.`
        );
        
        if (!confirmPayment) return;
        
        // Store the order data for payment (convert to format expected by payment pages)
        const orderForPayment = {
            id: order.id,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            shippingAddress: order.shippingAddress,
            items: order.items,
            subtotal: order.subtotal,
            shipping: order.shipping,
            promoDiscount: order.promoDiscount || 0,
            total: order.total,
            paymentMethod: order.paymentMethod,
            status: order.status,
            paymentCompleted: false,
            orderDate: order.orderDate,
            isRetryingPayment: true
        };
        
        localStorage.setItem("lastOrder", JSON.stringify(orderForPayment));
        
        // Redirect to payment page based on payment method
        const paymentMethod = order.paymentMethod || '';
        
        if (paymentMethod.includes('FPX') || paymentMethod.includes('Online Banking')) {
            window.location.href = 'payment_fpx.html';
        } else if (paymentMethod.includes('E-Wallet')) {
            window.location.href = 'payment_ewallet.html';
        } else {
            alert('Payment method not recognized. Please contact support.');
        }
    } catch (error) {
        console.error('❌ Error completing pending order:', error);
        alert('Failed to load order. Please try again.');
    }
}

// ========================================
// LOAD RETURNS/CANCELLATIONS
// ========================================
async function loadReturnsOrders(orders = null) {
    const container = document.getElementById('returnsOrdersList');
    if (!container) return;
    
    // If orders not provided, fetch them
    if (!orders) {
        orders = await getUserOrders();
    }
    
    const returnedOrders = orders.filter(o => 
        o.status === 'returned' || 
        o.status === 'cancelled'
    );
    
    if (returnedOrders.length === 0) {
        container.innerHTML = '<p class="no-data">No returns or cancellations</p>';
        return;
    }
    
    container.innerHTML = returnedOrders.map((order) => {
        const orderDate = order.orderDate || order.createdAt;
        const displayDate = orderDate ? new Date(orderDate).toLocaleString() : 'N/A';
        
        return `
            <div class="order-item">
                <h4>Order #${order.id.substring(0, 8)}</h4>
                <p><strong>Date:</strong> ${displayDate}</p>
                <p><strong>Total:</strong> RM ${(order.total || 0).toFixed(2)}</p>
                <p><strong>Items:</strong> ${order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'N/A'}</p>
                <span class="order-status status-cancelled">${order.status === 'cancelled' ? 'Cancelled' : 'Returned'}</span>
            </div>
        `;
    }).join('');
}

// ========================================
// VIEW ORDER TRACKING
// ========================================
function viewOrderTracking(orderId) {
    window.location.href = `order_tracking.html?order=${orderId}`;
}

// ========================================
// SHOW ORDER TAB
// ========================================
function showOrderTab(tab) {
    // Update tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show selected tab content
    const tabContents = document.querySelectorAll('.order-tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    const targetTab = document.getElementById(`${tab}-orders`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

// ========================================
// HELPER: GET STATUS LABEL
// ========================================
function getStatusLabel(status) {
    const statusMap = {
        'pending': 'Pending Payment',
        'processing': 'Processing',
        'shipped': 'Shipped',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'returned': 'Returned'
    };
    
    return statusMap[status] || 'Unknown';
}

// ========================================
// UPDATE loadOverviewData TO USE FIREBASE
// ========================================
// This replaces your existing loadOverviewData function
async function loadOverviewData() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        // Get orders from Firebase
        const orders = await getUserOrders();
        
        // Get wishlist count
        const wishlistCount = await getWishlistCount();
        
        // Calculate statistics
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        
        // Update overview cards
        const totalOrdersEl = document.getElementById('totalOrders');
        const pendingOrdersEl = document.getElementById('pendingOrders');
        const wishlistCountEl = document.getElementById('wishlistCount');
        
        if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
        if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders;
        if (wishlistCountEl) wishlistCountEl.textContent = wishlistCount;
        
        // Load recent orders
        await loadRecentOrders(orders);
        
        console.log('✅ Overview data loaded');
    } catch (error) {
        console.error('❌ Error loading overview:', error);
    }
}

// ========================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ========================================
window.getUserOrders = getUserOrders;
window.getOrderById = getOrderById;
window.updateOrderStatus = updateOrderStatus;
window.loadOrders = loadOrders;
window.completePendingOrder = completePendingOrder;
window.viewOrderTracking = viewOrderTracking;
window.showOrderTab = showOrderTab;

console.log('✅ Orders management (Firebase) loaded');


// ========================================
// CHECK AUTH REQUIRED PAGES
// ========================================
function checkAuthRequired() {
    // Pages that require authentication
    const authRequiredPages = [
        'myaccount.html',
        'cart.html',
        'checkout.html',
        'order_tracking.html'
    ];
    
    const currentPage = window.location.pathname;
    const requiresAuth = authRequiredPages.some(page => currentPage.includes(page));
    
    if (requiresAuth && !isUserLoggedIn() && authReady) {
        console.log('⚠️ Auth required, redirecting to signin...');
        alert("Please sign in to access this page.");
        window.location.href = 'signin.html';
    }
}

async function showSection(sectionName) {
    // Prevent default link behavior
    if (typeof event !== 'undefined') {
        event.preventDefault();
    }
    
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));

    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update active nav item in sidebar
    const navItems = document.querySelectorAll('.sidebar-menu a');
    navItems.forEach(item => {
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Load section-specific data
    switch(sectionName) {
        case 'overview':
            await loadOverviewData();  // ✅ Now uses Firebase
            break;
        case 'orders':
            await loadOrders();        // ✅ Now uses Firebase (was commented out)
            break;
        case 'wishlist':
            await loadWishlistItems(); // ✅ Already uses Firebase
            break;
        case 'settings':
            await loadProfileSettings();
            break;
    }
}

window.showSection = showSection;

// Initialize account page
async function initializeAccountPage() {
    if (!window.location.pathname.includes('myaccount.html')) return;
    
    console.log('🔐 Checking authentication for account page...');
    
    // Wait for auth to be ready
    let attempts = 0;
    while (!authReady && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!isUserLoggedIn()) {
        console.log('❌ Not logged in, redirecting...');
        alert("Please sign in to access your account.");
        window.location.href = 'signin.html';
        return;
    }
    
    const user = getCurrentUser();
    console.log('✅ User authenticated:', user.email);
    
    // Populate sidebar user info
    const sidebarName = document.getElementById('sidebarName');
    const sidebarEmail = document.getElementById('sidebarEmail');
    
    if (sidebarName) sidebarName.textContent = user.displayName || 'User';
    if (sidebarEmail) sidebarEmail.textContent = user.email || '';
    
    // Load overview data
    await loadOverviewData();

    await loadProfileSettings();
    
    // Show overview section by default
    showSection('overview');
    
    console.log('✅ Account page initialized');
}

// ========================================
// ACCOUNT SETTINGS - FIREBASE INTEGRATION
// ========================================

// Load profile settings from Firebase
async function loadProfileSettings() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        console.log('📋 Loading profile settings...');
        
        // Get user data from Firestore
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Populate profile form
            const nameInput = document.getElementById('profileName');
            const emailInput = document.getElementById('profileEmail');
            const phoneInput = document.getElementById('profilePhone');
            
            if (nameInput) nameInput.value = userData.name || user.displayName || '';
            if (emailInput) {
                emailInput.value = user.email || '';
                emailInput.disabled = true; // Email can't be changed easily in Firebase Auth
            }
            if (phoneInput) phoneInput.value = userData.phone || '';
            
            console.log('✅ Profile settings loaded');
        }
    } catch (error) {
        console.error('❌ Error loading profile settings:', error);
    }
    
    // Load saved addresses (already implemented)
    await loadSavedAddresses();
}

// Update profile in Firebase
async function updateProfile(event) {
    event.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        showToast('Please sign in to update profile', 'error', 3000);
        return;
    }
    
    const name = document.getElementById('profileName')?.value?.trim();
    const phone = document.getElementById('profilePhone')?.value?.trim();
    
    if (!name) {
        showToast('Name is required', 'error', 3000);
        return;
    }
    
    // Validate phone number (optional)
    if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
        showToast('Please enter a valid phone number', 'error', 3000);
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';
    
    try {
        // Update Firestore user document
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            name: name,
            phone: phone || '',
            updatedAt: new Date().toISOString()
        });
        
        // Update Firebase Auth display name
        await updateProfileAuth(currentUser, { displayName: name });
        
        // Update sidebar display
        const sidebarName = document.getElementById('sidebarName');
        if (sidebarName) sidebarName.textContent = name;
        
        console.log('✅ Profile updated successfully');
        showToast('Profile updated successfully!', 'success', 3000);
        
        // Update navigation to reflect new name
        updateNavigation();
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showToast('Failed to update profile. Please try again.', 'error', 3000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Change password in Firebase
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields', 'error', 3000);
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match!', 'error', 3000);
        return;
    }
    
    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters!', 'error', 3000);
        return;
    }
    
    // Validate password strength
    if (!/[A-Z]/.test(newPassword)) {
        showToast('Password must contain at least one uppercase letter', 'error', 3000);
        return;
    }
    
    if (!/[a-z]/.test(newPassword)) {
        showToast('Password must contain at least one lowercase letter', 'error', 3000);
        return;
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
        showToast('Password must contain at least one special character', 'error', 3000);
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Changing Password...';
    
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        // Re-authenticate user with current password
        const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword
        );
        
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePasswordAuth(user, newPassword);
        
        console.log('✅ Password changed successfully');
        showToast('Password changed successfully!', 'success', 3000);
        
        // Clear form
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('❌ Error changing password:', error);
        
        let errorMessage = 'Failed to change password';
        
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Current password is incorrect';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'New password is too weak';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Please sign out and sign in again before changing password';
        }
        
        showToast(errorMessage, 'error', 4000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Load saved addresses from Firebase
async function loadSavedAddresses() {
    const user = getCurrentUser();
    if (!user) return;
    
    const container = document.getElementById('savedAddresses');
    if (!container) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        if (!addressDoc.exists() || !addressDoc.data().addresses || addressDoc.data().addresses.length === 0) {
            container.innerHTML = '<p class="no-data">No saved addresses</p>';
            return;
        }
        
        const addresses = addressDoc.data().addresses || [];
        
        container.innerHTML = addresses.map((address, index) => `
            <div class="address-item">
                <div class="address-info-display">
                    <div class="address-icon-display">📍</div>
                    <div class="address-details">
                        <p>
                            <strong>${address.label}</strong>
                            ${address.isDefault ? '<span class="default-badge">DEFAULT</span>' : ''}
                        </p>
                        <p>${address.address}</p>
                        <p>${address.postcode} ${address.city}, ${address.state}</p>
                    </div>
                </div>
                <div class="address-actions">
                    ${!address.isDefault ? `<button onclick="setDefaultAddress(${index})" class="btn-default" title="Set as default">Set Default</button>` : ''}
                    <button onclick="editAddress(${index})" class="btn-edit">Edit</button>
                    <button onclick="removeAddress(${index})" class="btn-remove">Remove</button>
                </div>
            </div>
        `).join('');
        
        console.log('✅ Loaded', addresses.length, 'saved addresses');
    } catch (error) {
        console.error('❌ Error loading saved addresses:', error);
        container.innerHTML = '<p class="no-data">Failed to load addresses</p>';
    }
}

// Add new address
async function addAddress() {
    const address = prompt('Enter full address:');
    if (!address || address.trim() === '') return;
    
    const postcode = prompt('Enter postcode (5 digits):');
    if (!postcode || !/^\d{5}$/.test(postcode)) {
        alert('Please enter a valid 5-digit postcode');
        return;
    }
    
    const city = prompt('Enter city:');
    if (!city || city.trim() === '') return;
    
    const state = prompt('Enter state:');
    if (!state || state.trim() === '') return;
    
    const label = prompt('Label this address (e.g., Home, Office):');
    if (!label || label.trim() === '') return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        let addresses = [];
        if (addressDoc.exists()) {
            addresses = addressDoc.data().addresses || [];
        }
        
        // Check if address already exists
        const exists = addresses.some(addr => 
            addr.address === address.trim() && 
            addr.postcode === postcode.trim() && 
            addr.city === city.trim()
        );
        
        if (exists) {
            alert('This address is already saved');
            return;
        }
        
        // Ask if this should be default
        const makeDefault = addresses.length === 0 || confirm('Set this as your default address?');
        
        const newAddress = {
            label: label.trim(),
            address: address.trim(),
            postcode: postcode.trim(),
            city: city.trim(),
            state: state.trim(),
            isDefault: makeDefault,
            dateAdded: new Date().toISOString()
        };
        
        // If making this default, remove default from others
        if (makeDefault) {
            addresses.forEach(addr => addr.isDefault = false);
        }
        
        addresses.push(newAddress);
        
        await setDoc(addressRef, {
            userId: user.uid,
            addresses: addresses,
            updatedAt: new Date().toISOString()
        });
        
        showToast('Address added successfully!', 'success', 3000);
        await loadSavedAddresses();
    } catch (error) {
        console.error('❌ Error adding address:', error);
        showToast('Failed to add address', 'error', 3000);
    }
}

// Set default address
async function setDefaultAddress(index) {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        if (!addressDoc.exists()) return;
        
        let addresses = addressDoc.data().addresses || [];
        
        // Remove default flag from all addresses
        addresses.forEach(addr => addr.isDefault = false);
        
        // Set the selected address as default
        if (addresses[index]) {
            addresses[index].isDefault = true;
            
            await setDoc(addressRef, {
                userId: user.uid,
                addresses: addresses,
                updatedAt: new Date().toISOString()
            });
            
            showToast('Default address updated!', 'success', 2000);
            await loadSavedAddresses();
        }
    } catch (error) {
        console.error('❌ Error setting default address:', error);
        showToast('Failed to update default address', 'error', 3000);
    }
}

// Edit address
async function editAddress(index) {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        if (!addressDoc.exists()) return;
        
        let addresses = addressDoc.data().addresses || [];
        
        if (index >= addresses.length) return;
        
        const currentAddress = addresses[index];
        
        const address = prompt('Enter full address:', currentAddress.address);
        if (!address || address.trim() === '') return;
        
        const postcode = prompt('Enter postcode (5 digits):', currentAddress.postcode);
        if (!postcode || !/^\d{5}$/.test(postcode)) {
            alert('Please enter a valid 5-digit postcode');
            return;
        }
        
        const city = prompt('Enter city:', currentAddress.city);
        if (!city || city.trim() === '') return;
        
        const state = prompt('Enter state:', currentAddress.state);
        if (!state || state.trim() === '') return;
        
        const label = prompt('Label this address (e.g., Home, Office):', currentAddress.label);
        if (!label || label.trim() === '') return;
        
        // Ask if this should be the default address
        const makeDefault = confirm('Set this as your default address?');
        
        addresses[index] = {
            label: label.trim(),
            address: address.trim(),
            postcode: postcode.trim(),
            city: city.trim(),
            state: state.trim(),
            isDefault: makeDefault ? true : currentAddress.isDefault || false,
            dateAdded: currentAddress.dateAdded,
            dateModified: new Date().toISOString()
        };
        
        // If making this default, remove default from others
        if (makeDefault) {
            addresses.forEach((addr, i) => {
                if (i !== index) addr.isDefault = false;
            });
        }
        
        await setDoc(addressRef, {
            userId: user.uid,
            addresses: addresses,
            updatedAt: new Date().toISOString()
        });
        
        showToast('Address updated successfully!', 'success', 3000);
        await loadSavedAddresses();
    } catch (error) {
        console.error('❌ Error updating address:', error);
        showToast('Failed to update address', 'error', 3000);
    }
}

// Remove address
async function removeAddress(index) {
    const confirmRemove = confirm('Are you sure you want to remove this address?');
    if (!confirmRemove) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const addressRef = doc(db, 'savedAddresses', user.uid);
        const addressDoc = await getDoc(addressRef);
        
        if (!addressDoc.exists()) return;
        
        let addresses = addressDoc.data().addresses || [];
        
        addresses.splice(index, 1);
        
        await setDoc(addressRef, {
            userId: user.uid,
            addresses: addresses,
            updatedAt: new Date().toISOString()
        });
        
        showToast('Address removed', 'info', 2000);
        await loadSavedAddresses();
    } catch (error) {
        console.error('❌ Error removing address:', error);
        showToast('Failed to remove address', 'error', 3000);
    }
}

// Make functions globally available
window.updateProfile = updateProfile;
window.changePassword = changePassword;
window.loadProfileSettings = loadProfileSettings;
window.addAddress = addAddress;
window.setDefaultAddress = setDefaultAddress;
window.editAddress = editAddress;
window.removeAddress = removeAddress;

console.log('✅ Account settings (Firebase) loaded');

// ========================================
// ORDER TRACKING PAGE FUNCTIONALITY
// ========================================

// Initialize order tracking if on the page
async function initializeOrderTracking() {
    if (!window.location.pathname.includes('order_tracking.html')) return;
    
    console.log('📦 Initializing order tracking page...');
    
    // Wait for auth to be ready
    let attempts = 0;
    while (!authReady && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!isUserLoggedIn()) {
        console.log('❌ Not logged in, redirecting...');
        alert("Please sign in to track your orders.");
        window.location.href = 'signin.html';
        return;
    }
    
    const user = getCurrentUser();
    console.log('✅ User authenticated:', user.email || user.uid);
    
    // Get order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    
    if (orderId) {
        await loadSpecificOrderTracking(orderId);
    } else {
        await loadMostRecentOrderTracking();
    }
}

async function loadMostRecentOrderTracking() {
    try {
        console.log('📥 Loading most recent order...');
        
        const user = getCurrentUser();
        if (!user || !user.uid) {
            throw new Error('No user ID available');
        }
        
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            alert("No orders found.");
            window.location.href = 'myaccount.html';
            return;
        }
        
        const orderDoc = querySnapshot.docs[0];
        const orderData = {
            id: orderDoc.id,
            ...orderDoc.data(),
            createdAt: orderDoc.data().createdAt?.toDate?.() || new Date(),
            orderDate: orderDoc.data().orderDate || orderDoc.data().createdAt?.toDate?.().toISOString()
        };
        
        console.log('✅ Loaded most recent order:', orderDoc.id);
        displayOrderTracking(orderData);
    } catch (error) {
        console.error('❌ Error loading recent order:', error);
        alert('Failed to load order. Please try again.');
        window.location.href = 'myaccount.html';
    }
}

async function loadSpecificOrderTracking(orderId) {
    try {
        console.log('📥 Loading order:', orderId);
        
        const user = getCurrentUser();
        if (!user || !user.uid) {
            throw new Error('No user ID available');
        }
        
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await getDoc(orderRef);
        
        if (!orderDoc.exists()) {
            alert("Order not found.");
            window.location.href = 'myaccount.html';
            return;
        }
        
        const orderData = orderDoc.data();
        if (orderData.userId !== user.uid) {
            alert("You don't have permission to view this order.");
            window.location.href = 'myaccount.html';
            return;
        }
        
        const order = {
            id: orderDoc.id,
            ...orderData,
            createdAt: orderData.createdAt?.toDate?.() || new Date(),
            orderDate: orderData.orderDate || orderData.createdAt?.toDate?.().toISOString()
        };
        
        console.log('✅ Loaded order:', orderId);
        displayOrderTracking(order);
    } catch (error) {
        console.error('❌ Error loading order:', error);
        alert('Failed to load order. Please try again.');
        window.location.href = 'myaccount.html';
    }
}

function displayOrderTracking(order) {
    console.log('🎨 Displaying order tracking:', order);
    
    const orderNumber = 'ORD-' + order.id.substring(0, 8).toUpperCase();
    const orderNumEl = document.getElementById('orderNumber');
    if (orderNumEl) orderNumEl.textContent = orderNumber;

    const orderDate = new Date(order.orderDate || order.createdAt);
    const orderDateEl = document.getElementById('orderDate');
    if (orderDateEl) orderDateEl.textContent = orderDate.toLocaleString();

    generateOrderQRCode(orderNumber);
    updateOrderStatusTracking(order);
    displayCarrierInfo(order);
    displayPackageDetails(order, orderNumber);
    displayOrderItemsTracking(order);

    const addressEl = document.getElementById('shippingAddress');
    if (addressEl) {
        addressEl.textContent = order.shippingAddress || 'Address not available';
    }
    
    console.log('✅ Order tracking displayed');
}

function generateOrderQRCode(orderNumber) {
    const canvas = document.getElementById('orderQRCode');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 150, 150);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', 75, 75);
    ctx.fillText(orderNumber, 75, 95);
}

function updateOrderStatusTracking(order) {
    const ORDER_STATUS = {
        PENDING: 'pending',
        PROCESSING: 'processing',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered'
    };
    
    const currentStatus = order.status || ORDER_STATUS.PROCESSING;
    
    const statusTexts = {
        [ORDER_STATUS.PENDING]: 'Payment pending',
        [ORDER_STATUS.PROCESSING]: 'Your order is being prepared',
        [ORDER_STATUS.SHIPPED]: 'Your order is on the way',
        [ORDER_STATUS.DELIVERED]: 'Your order has been delivered'
    };

    const statusTextEl = document.getElementById('orderStatusText');
    if (statusTextEl) {
        statusTextEl.textContent = statusTexts[currentStatus] || statusTexts[ORDER_STATUS.PROCESSING];
    }
    
    // Update timeline
    const steps = [
        { id: 'ordered', status: ORDER_STATUS.PROCESSING },
        { id: 'ready', status: 'ready' },
        { id: 'transit', status: ORDER_STATUS.SHIPPED },
        { id: 'delivered', status: ORDER_STATUS.DELIVERED }
    ];
    
    const statusOrder = [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.PROCESSING,
        'ready',
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.DELIVERED
    ];
    
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    steps.forEach((step, index) => {
        const stepElement = document.getElementById(`step-${step.id}`);
        const connector = document.getElementById(`connector-${index + 1}`);
        
        if (!stepElement) return;
        
        const stepIndex = statusOrder.indexOf(step.status);
        
        if (stepIndex < currentIndex || (stepIndex === currentIndex && currentStatus === ORDER_STATUS.DELIVERED)) {
            stepElement.classList.add('completed');
            stepElement.classList.remove('active');
            if (connector) connector.classList.add('completed');
        } else if (stepIndex === currentIndex) {
            stepElement.classList.add('active');
            stepElement.classList.remove('completed');
        } else {
            stepElement.classList.remove('completed', 'active');
            if (connector) connector.classList.remove('completed');
        }
    });
}

function displayCarrierInfo(order) {
    const carriers = [
        { name: 'FedEx', logo: 'asset/carriers/fedex.png' },
        { name: 'DHL', logo: 'asset/carriers/dhl.png' },
        { name: 'Pos Laju', logo: 'asset/carriers/poslaju.png' }
    ];

    const carrierIndex = parseInt(order.id.charCodeAt(0)) % carriers.length;
    const carrier = carriers[carrierIndex];
    const trackingNumber = '#1ZE8R860' + order.id.substring(0, 8);

    const carrierLogo = document.getElementById('carrierLogo');
    if (carrierLogo) {
        carrierLogo.src = carrier.logo;
        carrierLogo.alt = carrier.name;
    }

    const trackingEl = document.getElementById('trackingNumber');
    if (trackingEl) trackingEl.textContent = trackingNumber;

    const now = new Date();
    const timeStr = `Today at ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    
    const updateEl = document.getElementById('carrierUpdate');
    if (updateEl) updateEl.textContent = timeStr;
    
    let fromLocation = 'Kuching, Sarawak, Malaysia';
    const address = order.shippingAddress || '';
    
    if (address.toLowerCase().includes('kuala lumpur')) {
        fromLocation = 'Distribution Center, Selangor';
    } else if (address.toLowerCase().includes('sabah')) {
        fromLocation = 'Kota Kinabalu Hub, Sabah';
    }

    const locationEl = document.getElementById('carrierLocation');
    if (locationEl) locationEl.textContent = 'From: ' + fromLocation;
    
    const addressParts = address.split(',');
    const toCity = addressParts.length > 1 ? addressParts[1].trim() : 'Malaysia';
    
    const destEl = document.getElementById('destinationLocation');
    if (destEl) destEl.textContent = 'To: ' + toCity;
}

function displayPackageDetails(order, orderNumber) {
    const packageId = 'MS' + order.id.substring(0, 6).toUpperCase();
    const packageIdEl = document.getElementById('packageId');
    if (packageIdEl) packageIdEl.textContent = packageId;

    const items = order.items || [];
    const itemCount = items.length;
    const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    const descEl = document.getElementById('packageDescription');
    if (descEl) {
        descEl.textContent = `Package contains ${totalItems} item(s) from ${itemCount} product(s)`;
    }

    const fromEl = document.getElementById('packageFrom');
    if (fromEl) fromEl.textContent = 'From: Kuching, Sarawak';
    
    const addressParts = (order.shippingAddress || '').split(',');
    const toCity = addressParts.length > 1 ? addressParts[1].trim() : 'Malaysia';
    
    const toEl = document.getElementById('packageTo');
    if (toEl) toEl.textContent = 'To: ' + toCity;

    const orderDate = new Date(order.orderDate || order.createdAt);
    const dateEl = document.getElementById('packageDate');
    if (dateEl) dateEl.textContent = orderDate.toLocaleDateString();

    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.className = 'status-badge';
        
        if (order.status === 'delivered') {
            statusBadge.textContent = 'DELIVERED';
            statusBadge.classList.add('delivered');
        } else if (order.status === 'shipped') {
            statusBadge.textContent = 'IN TRANSIT';
            statusBadge.classList.add('shipped');
        } else if (order.status === 'processing') {
            statusBadge.textContent = 'PROCESSING';
            statusBadge.classList.add('processing');
        } else {
            statusBadge.textContent = 'TO BE SHIPPED';
            statusBadge.classList.add('pending');
        }
    }

    const amountEl = document.getElementById('packageAmount');
    if (amountEl) amountEl.textContent = '30x20x15 CM / 2KG';
}

function displayOrderItemsTracking(order) {
    const container = document.getElementById('orderItemsList');
    if (!container) return;
    
    const items = order.items || [];
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color: #999;">No items in this order</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="order-item-row">
            <div class="order-item-image">
                ${item.image 
                    ? `<img src="${item.image}" alt="${item.name}" onerror="this.parentElement.innerHTML='🥮'">` 
                    : '🥮'
                }
            </div>
            <div class="order-item-details">
                <h4>${item.name || 'Unknown Item'}</h4>
                <p>RM ${(item.price || 0).toFixed(2)} each</p>
            </div>
            <div class="order-item-quantity">
                x${item.quantity || 0}
            </div>
            <div class="order-item-price">
                RM ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}
            </div>
        </div>
    `).join('');
}

async function confirmDelivery() {
    const confirmReceived = confirm(
        "✅ Confirm Order Received?\n\n" +
        "By clicking OK, you confirm that you have received this order.\n\n" +
        "This will mark the order as DELIVERED and complete the transaction."
    );
    
    if (!confirmReceived) return;
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order');
        
        if (!orderId) {
            alert('Order ID not found.');
            return;
        }
        
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: 'delivered',
            deliveredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        alert('✅ Thank you! Your order has been marked as DELIVERED.\n\nWe hope you enjoy your products!');
        window.location.reload();
    } catch (error) {
        console.error('❌ Error confirming delivery:', error);
        alert('Failed to update order status. Please try again.');
    }
}

function viewShipmentDetails() {
    const trackingNumber = document.getElementById('trackingNumber')?.textContent;
    alert(`Tracking Number: ${trackingNumber}\n\nIn a real application, this would open the carrier's tracking page.`);
}

function viewOrderDetails() {
    window.location.href = 'myaccount.html?section=orders';
}

function contactSupport() {
    if (typeof toggleChatbot === 'function') {
        const chatbotWindow = document.getElementById('chatbotWindow');
        if (chatbotWindow && !chatbotWindow.classList.contains('active')) {
            toggleChatbot();
        }
        
        const orderNumber = document.getElementById('orderNumber')?.textContent;
        
        setTimeout(() => {
            if (typeof addChatMessage === 'function') {
                addChatMessage({ text: `I need help with order ${orderNumber}`, isBot: false });
                addChatMessage({ 
                    text: `I've noted that you're asking about ${orderNumber}. How can I help you with this specific order?`, 
                    isBot: true 
                });
            }
        }, 600);
    } else {
        window.location.href = 'about.html#contact';
    }
}

// Make functions globally available
window.confirmDelivery = confirmDelivery;
window.viewShipmentDetails = viewShipmentDetails;
window.viewOrderDetails = viewOrderDetails;
window.contactSupport = contactSupport;

console.log('✅ Order tracking functions loaded');

// ========================================
// PAYMENT GATEWAY FUNCTIONALITY (FIREBASE INTEGRATED)
// ========================================

// Global payment variables
let selectedBank = null;
let selectedWallet = null;
let paymentTimer = null;
let timeRemaining = 300; // 5 minutes

// Validate payment session
function validatePaymentSession() {
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    
    if (!orderData) {
        alert('No active order found. Please start checkout again.');
        window.location.replace('cart.html');
        return false;
    }
    
    if (orderData.paymentCompleted === true || orderData.status === 'processing') {
        alert('This order has already been paid. Redirecting...');
        window.location.replace('checkout_success.html');
        return false;
    }
    
    return true;
}

// Initialize payment page
function initializePaymentPage() {
    // Check if we're on a payment page
    const onFPXPage = window.location.pathname.includes('payment_fpx.html');
    const onEWalletPage = window.location.pathname.includes('payment_ewallet.html');
    
    if (!onFPXPage && !onEWalletPage) return;
    
    console.log('💳 Initializing payment page...');
    
    if (!validatePaymentSession()) {
        return;
    }
    
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    
    if (!orderData) {
        alert('No order data found. Redirecting to checkout...');
        window.location.href = 'checkout.html';
        return;
    }
    
    displayPaymentInfo(orderData);
    
    if (onFPXPage) {
        initializeFPXPage();
    } else if (onEWalletPage) {
        initializeEWalletPage();
    }
    
    // Setup back button prevention
    setupPaymentBackButtonPrevention();
}

// Prevent back button on payment pages
function setupPaymentBackButtonPrevention() {
    window.history.pushState(null, null, window.location.href);
    
    window.addEventListener('popstate', function() {
        const confirmLeave = confirm('Going back will cancel your payment. Are you sure?');
        if (confirmLeave) {
            localStorage.removeItem('lastOrder');
            window.location.replace('cart.html');
        } else {
            window.history.pushState(null, null, window.location.href);
        }
    });
}

// Display payment information
function displayPaymentInfo(orderData) {
    const amountElements = document.querySelectorAll('#paymentAmount, .amount-value');
    amountElements.forEach(el => {
        if (el) el.textContent = `RM ${orderData.total.toFixed(2)}`;
    });
    
    const orderIdElement = document.getElementById('orderId');
    if (orderIdElement) {
        const orderId = orderData.id 
            ? 'ORD-' + orderData.id.substring(0, 8).toUpperCase()
            : 'ORD' + Date.now().toString().slice(-10);
        orderIdElement.textContent = orderId;
    }
    
    // Show retry message if applicable
    if (orderData.isRetryingPayment) {
        const paymentDetailsBox = document.querySelector('.payment-details-box');
        if (paymentDetailsBox) {
            const retryNotice = document.createElement('div');
            retryNotice.style.cssText = `
                background: rgba(255, 193, 7, 0.15);
                border: 2px solid rgba(255, 193, 7, 0.5);
                border-radius: 10px;
                padding: 1rem;
                margin-top: 1rem;
                text-align: center;
            `;
            retryNotice.innerHTML = `
                <p style="margin: 0; color: #fff; font-weight: 600;">
                    ⚠️ Completing previous payment
                </p>
                <p style="margin: 0.5rem 0 0 0; color: rgba(255,255,255,0.8); font-size: 0.9rem;">
                    Order Date: ${new Date(orderData.orderDate || orderData.createdAt).toLocaleString()}
                </p>
            `;
            paymentDetailsBox.appendChild(retryNotice);
        }
    }
}

// ========================================
// FPX PAYMENT
// ========================================

function initializeFPXPage() {
    console.log('🏦 FPX Payment Page Initialized');
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.disabled = true;
    }
}

function selectBank(bankName) {
    selectedBank = bankName;
    
    const bankOptions = document.querySelectorAll('.bank-option');
    bankOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    event.currentTarget.classList.add('selected');
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.disabled = false;
    }
    
    console.log('Selected bank:', bankName);
}

function proceedToBank() {
    if (!selectedBank) {
        alert('Please select a bank to proceed.');
        return;
    }
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.textContent = 'Redirecting...';
        proceedBtn.disabled = true;
    }
    
    setTimeout(() => {
        alert(`Redirecting to ${selectedBank} online banking...\n\nThis is a demo - click "Simulate Successful Payment" to complete.`);
        
        setTimeout(() => {
            simulatePaymentSuccess();
        }, 2000);
    }, 1000);
}

// ========================================
// E-WALLET PAYMENT
// ========================================

function initializeEWalletPage() {
    console.log('📱 E-Wallet Payment Page Initialized');
    
    generateQRCode();
    startPaymentTimer();
    setupWalletSelection();
}

function setupWalletSelection() {
    const walletIcons = document.querySelectorAll('.wallet-icon');
    walletIcons.forEach(icon => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', function() {
            const walletName = this.getAttribute('title');
            selectWallet(walletName, this);
        });
    });
}

function selectWallet(walletName, iconElement) {
    selectedWallet = walletName;
    
    const walletIcons = document.querySelectorAll('.wallet-icon');
    walletIcons.forEach(icon => {
        icon.classList.remove('selected-wallet');
    });
    
    iconElement.classList.add('selected-wallet');
    
    updatePaymentInstruction(walletName);
    generateQRCode(walletName);
    
    console.log('Selected wallet:', walletName);
}

function updatePaymentInstruction(walletName) {
    const instruction = document.querySelector('.qr-instruction');
    if (instruction) {
        instruction.textContent = `Scan this QR code with ${walletName}`;
        instruction.style.color = '#2c3e50';
        instruction.style.fontWeight = '600';
    }
}

function generateQRCode(walletName = null) {
    const qrContainer = document.getElementById('qrCanvas');
    if (!qrContainer) return;
    
    qrContainer.innerHTML = '';
    
    if (!walletName) {
        qrContainer.innerHTML = `
            <div style="width: 200px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 2px dashed #dee2e6; color: #495057;">
                <div style="font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.6;">💳</div>
                <div style="font-size: 0.95rem; font-weight: 600; text-align: center; padding: 0 1rem; line-height: 1.4;">Please choose your preferred e-wallet</div>
            </div>
        `;
        return;
    }
    
    const qrImages = {
        "Touch 'n Go": "asset/qr/tng.jpg",
        "GrabPay": "asset/qr/grab.jpg",
        "DuitNow QR": "asset/qr/duitnow.jpg",
        "ShopeePay": "asset/qr/duitnow.jpg",
        "SarawakPay": "asset/qr/spay.jpg"
    };
    
    const img = document.createElement('img');
    img.style.width = '200px';
    img.style.height = '200px';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';
    img.src = qrImages[walletName];
    img.alt = `${walletName} QR Code`;
    
    img.onerror = function() {
        qrContainer.innerHTML = `
            <div style="width: 200px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8d7da; border-radius: 8px; border: 2px solid #f5c6cb; color: #721c24;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">⚠️</div>
                <div style="font-size: 0.9rem; font-weight: 600; text-align: center; padding: 0 1rem;">${walletName}</div>
                <div style="font-size: 0.75rem; margin-top: 0.3rem;">QR Code Not Found</div>
            </div>
        `;
    };
    
    qrContainer.appendChild(img);
}

function startPaymentTimer() {
    const timerDisplay = document.getElementById('timer');
    const timerBar = document.getElementById('timerBar');
    
    if (!timerDisplay || !timerBar) return;
    
    paymentTimer = setInterval(() => {
        timeRemaining--;
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const percentage = (timeRemaining / 300) * 100;
        timerBar.style.width = `${percentage}%`;
        
        if (timeRemaining <= 0) {
            clearInterval(paymentTimer);
            handlePaymentTimeout();
        }
        
        if (timeRemaining === 60) {
            alert('Only 1 minute remaining! Please complete your payment soon.');
        }
    }, 1000);
}

function handlePaymentTimeout() {
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status failed';
        statusDiv.innerHTML = `
            <div class="status-icon">⏰</div>
            <p>Payment session expired</p>
            <small>Please start a new payment session</small>
        `;
    }
    
    setTimeout(() => {
        if (confirm('Payment session expired. Would you like to try again?')) {
            window.location.href = 'checkout.html';
        } else {
            window.location.href = 'cart.html';
        }
    }, 2000);
}

// ========================================
// PAYMENT COMPLETION (FIREBASE INTEGRATED)
// ========================================

async function simulatePaymentSuccess() {
    if (paymentTimer) {
        clearInterval(paymentTimer);
    }
    
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status success';
        statusDiv.innerHTML = `
            <div class="status-icon">✅</div>
            <p><strong>Payment Successful!</strong></p>
            <small>Redirecting to order confirmation...</small>
        `;
    }
    
    try {
        const orderData = JSON.parse(localStorage.getItem('lastOrder'));
        
        if (!orderData) {
            throw new Error('Order data not found');
        }
        
        // Update order in Firebase
        if (orderData.id) {
            const orderRef = doc(db, 'orders', orderData.id);
            await updateDoc(orderRef, {
                status: 'processing',
                paymentCompleted: true,
                paymentTime: new Date().toISOString(),
                paymentMethod: selectedWallet 
                    ? `E-Wallet (${selectedWallet})` 
                    : selectedBank 
                    ? `FPX (${selectedBank})`
                    : orderData.paymentMethod,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Payment completed in Firebase');
        }
        
        // Update localStorage for display
        orderData.status = 'processing';
        orderData.paymentCompleted = true;
        orderData.paymentTime = new Date().toISOString();
        localStorage.setItem('lastOrder', JSON.stringify(orderData));
        
        setTimeout(() => {
            window.location.replace('checkout_success.html');
        }, 2000);
    } catch (error) {
        console.error('❌ Error completing payment:', error);
        alert('Payment processed but failed to update order. Please contact support with your order ID.');
        setTimeout(() => {
            window.location.replace('checkout_success.html');
        }, 2000);
    }
}

async function simulatePaymentFailure() {
    if (paymentTimer) {
        clearInterval(paymentTimer);
    }
    
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status failed';
        statusDiv.innerHTML = `
            <div class="status-icon">❌</div>
            <p><strong>Payment Failed</strong></p>
            <small>Please try again or use a different payment method</small>
        `;
    }
    
    setTimeout(() => {
        if (confirm('Payment failed. Would you like to try again?')) {
            window.location.href = 'checkout.html';
        } else {
            window.location.href = 'cart.html';
        }
    }, 2000);
}

function cancelPayment() {
    const confirmCancel = confirm('Are you sure you want to cancel this payment?');
    
    if (confirmCancel) {
        if (paymentTimer) {
            clearInterval(paymentTimer);
        }
        
        localStorage.removeItem('lastOrder');
        
        alert('Payment cancelled. You can retry from your cart.');
        window.location.replace('cart.html');
    }
}

// Make payment functions globally available
window.selectBank = selectBank;
window.proceedToBank = proceedToBank;
window.selectWallet = selectWallet;
window.simulatePaymentSuccess = simulatePaymentSuccess;
window.simulatePaymentFailure = simulatePaymentFailure;
window.cancelPayment = cancelPayment;

console.log('✅ Payment gateway (Firebase) loaded');

// ========================================
// CHATBOT FUNCTIONALITY (MIGRATED & FIREBASE ENABLED)
// ========================================

let chatbotOpen = false;

// Toggle chatbot window
function toggleChatbot() {

    if (!currentUser) {
        alert("Please sign in to use the help assistant.");
        window.location.href = 'signin.html';
        return;
    }

    chatbotOpen = !chatbotOpen;
    const window = document.getElementById('chatbotWindow');
    const button = document.getElementById('chatbotButton');
    const badge = document.getElementById('chatbotBadge');
    
    if (!window || !button) return; // Safety check

    if (chatbotOpen) {
        window.classList.add('active');
        button.classList.add('active');
        if (badge) badge.style.display = 'none';
        
        // Show welcome message on first open
        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer && messagesContainer.children.length === 0) {
            showWelcomeMessage();
        }
    } else {
        window.classList.remove('active');
        button.classList.remove('active');
    }
}

// Show welcome message
function showWelcomeMessage() {
    const welcomeMsg = {
        text: "Hello, I am Cookie! 👋 Welcome to DAYANGSARI ENT! I'm here to help you with your orders, products, and any questions you might have.",
        isBot: true
    };
    
    addChatMessage(welcomeMsg);
    
    setTimeout(() => {
        const quickReplies = [
            "View Products",
            "Shipping Info",
            "Promo Codes",
            "COD Availability",
            "Return/Cancel Order",
            "Contact Us"
        ];
        addQuickReplies(quickReplies);
    }, 500);
}

// Add message to chat
function addChatMessage(message) {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${message.isBot ? 'bot' : 'user'}`;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Determine avatar content
    let avatarContent;
    if (message.isBot) {
        // Bot avatar with image
        avatarContent = `<img src="asset/DAYANGSARI ENT Transparent.png" alt="Cookie" onerror="this.style.display='none'; this.parentElement.innerHTML='🥮'">`;
    } else {
        avatarContent = `<img src="asset/user.png" alt="User" onerror="this.parentElement.innerHTML='👤'">`;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarContent}</div>
        <div class="message-content">
            <div class="message-bubble">${message.text}</div>
            <div class="message-time">${timeString}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add quick reply buttons
function addQuickReplies(replies) {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (!messagesContainer) return;

    const quickRepliesDiv = document.createElement('div');
    quickRepliesDiv.className = 'quick-replies';
    
    replies.forEach(reply => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.textContent = reply;
        button.onclick = () => handleQuickReply(reply);
        quickRepliesDiv.appendChild(button);
    });
    
    messagesContainer.appendChild(quickRepliesDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <img src="asset/DAYANGSARI ENT Transparent.png" alt="Cookie" onerror="this.style.display='none'; this.parentElement.innerHTML='🥮'">
        </div>
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Handle quick reply click
function handleQuickReply(reply) {
    // Remove quick replies after selection
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }
    
    // Add user message
    addChatMessage({ text: reply, isBot: false });
    
    // Process the reply
    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        processChatbotQuery(reply);
    }, 1000);
}

// Send message from input
function sendChatbotMessage() {
    const input = document.getElementById('chatbotInput');
    if (!input) return;

    const message = input.value.trim();
    
    if (!message) return;
    
    addChatMessage({ text: message, isBot: false });
    input.value = '';
    
    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        processChatbotQuery(message);
    }, 1000);
}

// Handle enter key press
function handleChatbotKeypress(event) {
    if (event.key === 'Enter') {
        sendChatbotMessage();
    }
}

// Process chatbot query
function processChatbotQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // Return/Cancel Request
    if (lowerQuery.includes('return') || lowerQuery.includes('cancel')) {
        handleReturnRequest();
    }
    // Products
    else if (lowerQuery.includes('product') || lowerQuery.includes('kuih') || lowerQuery.includes('cake') || lowerQuery.includes('biscuit') || lowerQuery.includes('snacks')) {
        addChatMessage({
            text: "We offer a variety of traditional Malaysian kuih and delicacies! Here are our categories:\n\n Traditional Biscuits (RM 20-25)\n Snacks & Crackers (RM 25-30)\n Layered Cakes (RM 45-200)\n\nWould you like to browse our full collection?",
            isBot: true
        });
        addQuickReplies(["View All Products", "Tell me more", "Main Menu"]);
    }
    // Shipping Info
    else if (lowerQuery.includes('shipping') || lowerQuery.includes('delivery')) {
        addChatMessage({
            text: "Our shipping rates are based on your location:\n\n• Sarawak: RM 8.00\n• Sabah & Labuan: RM 11.00\n• Peninsular Malaysia: RM 18.00\n\nDelivery takes 3-5 business days. We pack everything fresh just for you!",
            isBot: true
        });
        addQuickReplies(["COD Availability", "Track Order", "Main Menu"]);
    }
    // Promo Codes
    else if (lowerQuery.includes('promo') || lowerQuery.includes('discount')) {
        addChatMessage({
            text: "Active Promo Codes:\n\n• RAYA2025 - RM20 off\n• WELCOME10 - RM10 off for new customers\n• FESTIVE15 - RM15 off festive special\n\nJust enter the code at checkout to enjoy your discount!",
            isBot: true
        });
        addQuickReplies(["How to use codes?", "Shop Now", "Main Menu"]);
    }
    // COD Availability
    else if (lowerQuery.includes('cod') || lowerQuery.includes('cash on delivery')) {
        addChatMessage({
            text: "Cash on Delivery (COD) is available ONLY for:\n\n✅ Kuching, Sarawak\n✅ Kota Samarahan, Sarawak\n\n❌ COD is NOT available for other areas.\n\nFor other locations, please use FPX (Online Banking) or E-Wallet payment methods.",
            isBot: true
        });
        addQuickReplies(["Payment Methods", "Shipping Info", "Main Menu"]);
    }
    // Contact
    else if (lowerQuery.includes('contact') || lowerQuery.includes('phone') || lowerQuery.includes('email')) {
        addChatMessage({
            text: "📞 Contact DAYANGSARI ENT:\n\n📧 Email: ibu.kuihraya@gmail.com\n📱 Phone: +60 12-345 6789\n📍 Location: Kuching, Sarawak, Malaysia\n\n⏰ Business Hours:\nMon-Sat: 9 AM - 6 PM\nSun: Closed",
            isBot: true
        });
        addQuickReplies(["Visit About Page", "Main Menu"]);
    }
    // View All Products
    else if (lowerQuery.includes('view all products') || lowerQuery.includes('shop now')) {
        addChatMessage({
            text: "Great! Let me take you to our products page!",
            isBot: true
        });
        setTimeout(() => {
            window.location.href = 'product.html';
        }, 1000);
    }
    // Track Order
    else if (lowerQuery.includes('track') || lowerQuery.includes('status')) {
        if (!isUserLoggedIn()) {
             addChatMessage({
                text: "To track your order, please sign in first so I can find your details.",
                isBot: true
            });
            setTimeout(() => {
                window.location.href = 'signin.html';
            }, 1500);
        } else {
             addChatMessage({
                text: "You can track your order status in the My Account section.",
                isBot: true
            });
             addQuickReplies(["Go to My Account", "Main Menu"]);
        }
    }
    // Go to My Account
    else if (lowerQuery.includes('my account')) {
        window.location.href = 'myaccount.html';
    }
    // Main Menu
    else if (lowerQuery.includes('main menu') || lowerQuery.includes('menu') || lowerQuery.includes('help')) {
        addChatMessage({
            text: "How can I help you today? 😊",
            isBot: true
        });
        addQuickReplies([
            "View Products",
            "Shipping Info",
            "Promo Codes",
            "COD Availability",
            "Return/Cancel Order",
            "Contact Us"
        ]);
    }
    // Default response
    else {
        addChatMessage({
            text: "I'm here to help! You can ask me about:\n\n• Our products and prices\n• Shipping rates and delivery\n• Promo codes and discounts\n• Cash on Delivery availability\n• Returns and cancellations\n• Contact information\n\nWhat would you like to know?",
            isBot: true
        });
        addQuickReplies(["Show Main Menu"]);
    }
}

// Handle Return/Cancel Request
function handleReturnRequest() {

    if (!currentUser) {
        addChatMessage({
            text: "I'm sorry, you must be logged in to submit a return or cancellation request.",
            isBot: true
        });
        return;
    }

    // Check if user is logged in to pre-fill info
    const email = currentUser.email;
    
    addChatMessage({
        text: "I can help you with returns and cancellations! \n\nPlease fill out this form and we'll process your request within 24 hours.",
        isBot: true
    });
    
    // Create return form
    const messagesContainer = document.getElementById('chatbotMessages');
    const formDiv = document.createElement('div');
    formDiv.className = 'return-form';
    formDiv.innerHTML = `
        <div class="return-form-group">
            <label>Request Type *</label>
            <select id="returnType" required>
                <option value="">-- Select --</option>
                <option value="Return">Return</option>
                <option value="Cancellation">Cancellation</option>
            </select>
        </div>
        <div class="return-form-group">
            <label>Order Number *</label>
            <input type="text" id="returnOrderNumber" placeholder="Order ID (e.g., 5y7x9...)" required>
        </div>
        <div class="return-form-group">
            <label>Email *</label>
            <input type="email" id="returnEmail" value="${email}" placeholder="your.email@gmail.com" required>
        </div>
        <div class="return-form-group">
            <label>Phone Number *</label>
            <input type="text" id="returnPhone" placeholder="+60123456789" required>
        </div>
        <div class="return-form-group">
            <label>Reason *</label>
            <textarea id="returnReason" placeholder="Please explain the reason for your return/cancellation..." required></textarea>
        </div>
        <div class="return-form-actions">
            <button class="return-form-btn cancel" onclick="cancelReturnForm()">Cancel</button>
            <button class="return-form-btn submit" onclick="submitReturnForm()">Submit Request</button>
        </div>
    `;
    
    messagesContainer.appendChild(formDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Cancel return form
function cancelReturnForm() {
    const form = document.querySelector('.return-form');
    if (form) {
        form.remove();
    }
    
    addChatMessage({
        text: "No problem! Is there anything else I can help you with?",
        isBot: true
    });
    
    addQuickReplies(["Main Menu", "Contact Support"]);
}

// Submit return form (UPDATED FOR FIREBASE)
async function submitReturnForm() {
    const type = document.getElementById('returnType').value;
    const orderNumber = document.getElementById('returnOrderNumber').value.trim();
    const email = document.getElementById('returnEmail').value.trim();
    const phone = document.getElementById('returnPhone').value.trim();
    const reason = document.getElementById('returnReason').value.trim();
    
    // Validation
    if (!type || !orderNumber || !email || !phone || !reason) {
        alert('Please fill in all required fields.');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }
    
    // Change button text to indicate processing
    const submitBtn = document.querySelector('.return-form-btn.submit');
    if(submitBtn) {
        submitBtn.textContent = "Submitting...";
        submitBtn.disabled = true;
    }

    try {
        // --- FIREBASE INTEGRATION START ---
        // Dynamically import needed functions (safer for appended code)
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        const { db } = await import('./firebase-config.js'); // Ensure this file path is correct

        const requestData = {
            type: type,
            orderId: orderNumber,
            customerEmail: email,
            customerPhone: phone,
            reason: reason,
            status: 'pending',
            createdAt: serverTimestamp(),
            requestDate: new Date().toISOString(),
            userId: currentUser.uid
        };
        
        // Save to 'returnRequests' collection
        await addDoc(collection(db, 'returnRequests'), requestData);
        // --- FIREBASE INTEGRATION END ---

        // Remove form
        const form = document.querySelector('.return-form');
        if (form) {
            form.remove();
        }
        
        // Success message
        addChatMessage({
            text: `Your ${type} request has been submitted successfully!\n\n Order ID: ${orderNumber}\n\nWe'll review your request and contact you within 24 hours at ${email}.\n\nThank you for your patience! 🙏`,
            isBot: true
        });
        
        setTimeout(() => {
            addQuickReplies(["Main Menu", "Contact Support"]);
        }, 500);

    } catch (error) {
        console.error("Error submitting return request:", error);
        alert("There was an error submitting your request. Please try again later.");
        if(submitBtn) {
            submitBtn.textContent = "Submit Request";
            submitBtn.disabled = false;
        }
    }
}

// Global functions for chatbot
window.toggleChatbot = toggleChatbot;
window.sendChatbotMessage = sendChatbotMessage;
window.handleChatbotKeypress = handleChatbotKeypress;
window.cancelReturnForm = cancelReturnForm;
window.submitReturnForm = submitReturnForm;

// Initialize Chatbot Badge
window.addEventListener('load', function() {
    setTimeout(() => {
        const badge = document.getElementById('chatbotBadge');
        if (badge && !chatbotOpen) {
            badge.style.display = 'flex';
        }
    }, 3000);
});

// ========================================
// INITIALIZE ON DOM LOAD
// ========================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Firebase Authentication...');
    
    // Setup password match indicator on signup page
    setupPasswordMatchIndicator();

    setupEmailValidation();
    preventPaymentPageAccess();

    // ✅ Wait for auth to be ready before updating badge
    let attempts = 0;
    while (!authReady && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    // Initialize products
    await initializeProductsPage();
    await loadFeaturedProducts();
    await loadProductDetails();
    
    // Initialize cart
    await loadCartPage();
    await updateCartBadge();
    
    // Initialize account page
    await initializeAccountPage();

    await initializeCheckout();
    await initializeOrderTracking();

    initializePaymentPage();

    initializeCheckoutSuccess();

    // Update wishlist button if on product detail page
    if (window.location.pathname.includes('product-detail.html')) {
        setTimeout(updateWishlistButton, 500);
    }
    
    console.log('✅ All systems ready');
});

setInterval(async () => {
    if (isUserLoggedIn() && document.getElementById('cartBadge')) {
        await updateCartBadge();
    }
}, 30000); // Every 30 seconds

console.log('✅ Cart badge fix applied');