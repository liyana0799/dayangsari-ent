// ========================================
// FIREBASE IMPORTS
// ========================================
import { auth, db, storage } from '../firebase-config.js';
import { 
  signOut 
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { 
  collection, 
  getDocs, 
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { 
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js';

// ========================================
// GLOBAL STATE
// ========================================
let productsData = [];
let filteredProducts = [];
let variantCounter = 0;

// ========================================
// UTILITY FUNCTIONS
// ========================================
function showToast(message, type = 'info', duration = 3000) {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDateShort(date) {
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

// ========================================
// GLOBAL LOGOUT FUNCTION
// ========================================
async function logout() {
  const confirmLogout = confirm('Are you sure you want to log out?');
  if (!confirmLogout) return;
  
  try {
    await signOut(auth);
    sessionStorage.clear();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
    window.location.href = '../index.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error logging out. Please try again.');
  }
}

// ========================================
// DASHBOARD FUNCTIONS
// ========================================
function initializeDashboard() {
  if (!window.location.pathname.includes('admin.html')) return;
  
  console.log('📊 Initializing Firebase dashboard...');
  
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  
  const salesChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Sales (RM)',
        data: [0, 0, 0, 0],
        borderColor: '#8b4513',
        backgroundColor: 'rgba(212,165,116,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { 
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return 'RM ' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: { 
        y: { 
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'RM ' + value.toFixed(0);
            }
          }
        }
      }
    }
  });
  
  window.dashboardSalesChart = salesChart;
  loadDashboardData();
  
  console.log('✅ Dashboard initialized');
}

async function loadDashboardData() {
  console.log('📈 Loading dashboard data from Firebase...');
  
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const startOfMonth = new Date(currentMonth + '-01');
    
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('createdAt', '>=', startOfMonth), orderBy('createdAt', 'desc'));
    const ordersSnapshot = await getDocs(ordersQuery);
    
    let monthRevenue = 0;
    let monthOrders = 0;
    let pendingOrders = 0;
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      monthRevenue += order.total || 0;
      monthOrders++;
      if (order.status === 'pending') pendingOrders++;
    });
    
    const usersRef = collection(db, 'users');
    const customersQuery = query(usersRef, where('role', '==', 'customer'));
    const customersSnapshot = await getDocs(customersQuery);
    const totalCustomers = customersSnapshot.size;
    
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
    let inStockProducts = 0;
    
    productsSnapshot.forEach(doc => {
      const product = doc.data();
      if (product.stock > 0) inStockProducts++;
    });
    
    updateDashboardCards({
      revenue: monthRevenue,
      orders: monthOrders,
      pending: pendingOrders,
      customers: totalCustomers,
      products: inStockProducts
    });
    
    await updateDashboardSalesChart();
    await loadRecentOrders();
    
    console.log('✅ Dashboard data loaded');
    
  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    showToast('Error loading dashboard data', 'error', 3000);
  }
}

function updateDashboardCards(data) {
  const totalSalesEl = document.getElementById('total-sales');
  const totalOrdersEl = document.getElementById('total-orders');
  const totalCustomersEl = document.getElementById('total-customers');
  const totalProductsEl = document.getElementById('total-products');
  
  if (totalSalesEl) totalSalesEl.textContent = `RM ${data.revenue.toFixed(2)}`;
  
  if (totalOrdersEl) {
    totalOrdersEl.textContent = data.orders;
    const subtitle = totalOrdersEl.nextElementSibling;
    if (subtitle && subtitle.classList.contains('card-subtitle')) {
      subtitle.textContent = `Pending: ${data.pending}`;
    }
  }
  
  if (totalCustomersEl) totalCustomersEl.textContent = data.customers;
  if (totalProductsEl) totalProductsEl.textContent = data.products;
}

async function updateDashboardSalesChart() {
  if (!window.dashboardSalesChart) return;
  
  try {
    const today = new Date();
    const ordersRef = collection(db, 'orders');
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const ordersQuery = query(ordersRef, where('createdAt', '>=', fourWeeksAgo), orderBy('createdAt', 'asc'));
    const ordersSnapshot = await getDocs(ordersQuery);
    
    const weeklyTotals = [0, 0, 0, 0];
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const orderDate = order.createdAt.toDate();
      const daysDiff = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.min(Math.floor(daysDiff / 7), 3);
      weeklyTotals[3 - weekIndex] += order.total || 0;
    });
    
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    window.dashboardSalesChart.data.labels = labels;
    window.dashboardSalesChart.data.datasets[0].data = weeklyTotals;
    window.dashboardSalesChart.update();
    
  } catch (error) {
    console.error('Error updating sales chart:', error);
  }
}

async function loadRecentOrders() {
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody) return;
  
  try {
    const ordersRef = collection(db, 'orders');
    const recentQuery = query(ordersRef, orderBy('createdAt', 'desc'), limit(5));
    const snapshot = await getDocs(recentQuery);
    
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">No recent orders</td></tr>`;
      return;
    }
    
    const ordersHTML = [];
    
    for (const docSnap of snapshot.docs) {
      const order = docSnap.data();
      const orderId = docSnap.id;
      
      let customerName = 'Unknown';
      let customerEmail = 'N/A';
      
      if (order.userId) {
        try {
          const userDocRef = doc(db, 'users', order.userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            customerName = userData.name || userData.email;
            customerEmail = userData.email;
          }
        } catch (e) {
          console.warn('Could not fetch user data:', e);
        }
      }
      
      const orderDate = order.createdAt ? order.createdAt.toDate() : new Date();
      
      ordersHTML.push(`
        <tr>
          <td><strong>${orderId.substring(0, 12).toUpperCase()}</strong></td>
          <td>${customerName}<br><small style="color: #666;">${customerEmail}</small></td>
          <td><strong>RM ${(order.total || 0).toFixed(2)}</strong></td>
          <td><span class="status-badge status-${order.status || 'pending'}">${capitalizeFirst(order.status || 'pending')}</span></td>
          <td>${formatDateShort(orderDate)}</td>
        </tr>
      `);
    }
    
    tbody.innerHTML = ordersHTML.join('');
    
  } catch (error) {
    console.error('Error loading recent orders:', error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">Error loading orders</td></tr>`;
  }
}

// ========================================
// PRODUCTS MANAGEMENT
// ========================================
function initializeProducts() {
  if (!window.location.pathname.includes('admin-products.html')) return;
  
  console.log('🔧 Initializing products page with Firebase...');
  
  loadProducts();
  
  const addProductBtn = document.getElementById('add-product-btn');
  if (addProductBtn) {
    addProductBtn.addEventListener('click', addNewProduct);
  }
  
  const searchInput = document.getElementById('search-products');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  
  const categoryFilter = document.getElementById('filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
  }
  
  const stockFilter = document.getElementById('filter-stock');
  if (stockFilter) {
    stockFilter.addEventListener('change', applyFilters);
  }
  
  console.log('✅ Products page initialized');
}

async function loadProducts() {
  console.log('📦 Loading products from Firebase...');
  
  // DEBUG: Check what db actually is
  console.log('🔍 DEBUG: db =', db);
  console.log('🔍 DEBUG: db type =', typeof db);
  console.log('🔍 DEBUG: db constructor =', db?.constructor?.name);
  
  try {
    const productsRef = collection(db, 'products');
    console.log('✅ Collection reference created:', productsRef);
    
    const productsSnapshot = await getDocs(productsRef);
    
    productsData = [];
    
    productsSnapshot.forEach(doc => {
      productsData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Loaded ${productsData.length} products from Firebase`);
    
    filteredProducts = [...productsData];
    renderProductsTable();
    updateProductStats();
    
  } catch (error) {
    console.error('❌ Error loading products:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    showToast('Error loading products', 'error', 3000);
    productsData = [];
    filteredProducts = [];
    renderProductsTable();
  }
}

function updateProductStats() {
  const total = filteredProducts.length;
  const inStock = filteredProducts.filter(p => p.stock > 10).length;
  const lowStock = filteredProducts.filter(p => p.stock > 0 && p.stock <= 10).length;
  const outStock = filteredProducts.filter(p => p.stock === 0).length;
  
  const statsTotal = document.getElementById('stats-total');
  const statsInStock = document.getElementById('stats-in-stock');
  const statsLowStock = document.getElementById('stats-low-stock');
  const statsOutStock = document.getElementById('stats-out-stock');
  
  if (statsTotal) statsTotal.textContent = total;
  if (statsInStock) statsInStock.textContent = inStock;
  if (statsLowStock) statsLowStock.textContent = lowStock;
  if (statsOutStock) statsOutStock.textContent = outStock;
}

function addNewProduct() {
  showAddProductModal();
}

function showAddProductModal() {
  const modal = document.createElement('div');
  modal.className = 'product-modal-overlay';
  modal.id = 'addProductModal';
  
  modal.innerHTML = `
    <div class="product-modal">
      <div class="product-modal-header">
        <h2>Add New Product</h2>
        <button class="modal-close-btn" onclick="closeProductModal()">×</button>
      </div>
      <div class="product-modal-body">
        <form id="addProductForm" onsubmit="submitNewProduct(event)">
          <div class="form-group">
            <label>Product Image</label>
            <div class="image-upload-container">
              <div class="image-preview" id="imagePreview">
                <span class="upload-placeholder">📷 Click to upload image</span>
              </div>
              <input type="file" id="productImage" accept="image/*" onchange="previewProductImage(event)" style="display: none;">
              <button type="button" class="btn-upload" onclick="document.getElementById('productImage').click()">Choose Image</button>
              <small>Supported: JPG, PNG, JPEG (Max 5MB)</small>
            </div>
          </div>
          <div class="form-group">
            <label for="productName">Product Name *</label>
            <input type="text" id="productName" required placeholder="e.g., Biskut Chocolate Chip">
          </div>
          <div class="form-group">
            <label for="productCategory">Category *</label>
            <select id="productCategory" required>
              <option value="">-- Select Category --</option>
              <option value="cookies">Traditional Biscuits</option>
              <option value="snacks">Snacks & Crackers</option>
              <option value="cakes">Layered Cakes</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="productPrice">Price (RM) *</label>
              <input type="number" id="productPrice" step="0.01" min="0" required placeholder="25.00">
            </div>
            <div class="form-group">
              <label for="productStock">Stock Quantity *</label>
              <input type="number" id="productStock" min="0" required placeholder="100">
            </div>
          </div>
          <div class="form-group">
            <label for="productDescription">Description</label>
            <textarea id="productDescription" rows="3" placeholder="Enter product description..."></textarea>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="hasVariants" onchange="toggleVariantsSection()">
              <span>This product has variants (e.g., Regular/Premium)</span>
            </label>
          </div>
          <div id="variantsSection" style="display: none;">
            <div class="variants-header">
              <h4>Product Variants</h4>
              <button type="button" class="btn-add-variant" onclick="addVariantField()">+ Add Variant</button>
            </div>
            <div id="variantsList"></div>
          </div>
          <div class="product-modal-footer">
            <button type="button" class="btn-cancel" onclick="closeProductModal()">Cancel</button>
            <button type="submit" class="btn-save">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function previewProductImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size must be less than 5MB');
    event.target.value = '';
    return;
  }
  
  if (!file.type.match('image.*')) {
    alert('Please select a valid image file');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
  };
  reader.readAsDataURL(file);
}

function toggleVariantsSection() {
  const hasVariants = document.getElementById('hasVariants').checked;
  const variantsSection = document.getElementById('variantsSection');
  
  if (hasVariants) {
    variantsSection.style.display = 'block';
    if (document.getElementById('variantsList').children.length === 0) {
      addVariantField();
    }
  } else {
    variantsSection.style.display = 'none';
    document.getElementById('variantsList').innerHTML = '';
  }
}

function addVariantField() {
  variantCounter++;
  const variantsList = document.getElementById('variantsList');
  
  const variantDiv = document.createElement('div');
  variantDiv.className = 'variant-item';
  variantDiv.id = `variant-${variantCounter}`;
  variantDiv.innerHTML = `
    <div class="variant-fields">
      <input type="text" placeholder="Variant name (e.g., Regular)" class="variant-name" required>
      <input type="number" step="0.01" min="0" placeholder="Price (RM)" class="variant-price" required>
      <button type="button" class="btn-remove-variant" onclick="removeVariant(${variantCounter})">×</button>
    </div>
  `;
  
  variantsList.appendChild(variantDiv);
}

function removeVariant(variantId) {
  const variantDiv = document.getElementById(`variant-${variantId}`);
  if (variantDiv) variantDiv.remove();
}

function closeProductModal() {
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
  variantCounter = 0;
}

async function submitNewProduct(event) {
  event.preventDefault();
  
  const name = document.getElementById('productName').value.trim();
  const categoryId = document.getElementById('productCategory').value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const stock = parseInt(document.getElementById('productStock').value);
  const description = document.getElementById('productDescription').value.trim();
  const hasVariants = document.getElementById('hasVariants').checked;
  
  const categoryMap = {
    'cookies': 'Traditional Biscuits',
    'snacks': 'Snacks & Crackers',
    'cakes': 'Layered Cakes'
  };
  const categoryName = categoryMap[categoryId];
  
  const imageFile = document.getElementById('productImage').files[0];
  
  try {
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Uploading...';
    submitBtn.disabled = true;
    
    let imageUrl = null;
    if (imageFile) {
      const imageRef = storageRef(storage, `products/${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(imageRef);
    }
    
    let variants = [];
    if (hasVariants) {
      const variantItems = document.querySelectorAll('.variant-item');
      variantItems.forEach(item => {
        const variantName = item.querySelector('.variant-name').value.trim();
        const variantPrice = parseFloat(item.querySelector('.variant-price').value);
        if (variantName && !isNaN(variantPrice)) {
          variants.push({ name: variantName, price: variantPrice });
        }
      });
      
      if (variants.length === 0) {
        alert('Please add at least one variant or uncheck "Has Variants"');
        submitBtn.textContent = 'Add Product';
        submitBtn.disabled = false;
        return;
      }
    }
    
    const productData = {
      name,
      category: categoryName,
      categoryId,
      price,
      stock,
      description: description || `Delicious ${name} made fresh daily.`,
      image: imageUrl,
      hasVariants,
      variants,
      features: ['✓ Fresh ingredients', '✓ Handmade with love', '✓ Halal certified', '✓ Perfect for any occasion'],
      status: stock > 0 ? 'in-stock' : 'out-of-stock',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const productsRef = collection(db, 'products');
    await addDoc(productsRef, productData);
    
    console.log('✅ Product added to Firebase');
    alert(`✅ ${name} added successfully!`);
    closeProductModal();
    await loadProducts();
    
  } catch (error) {
    console.error('❌ Error adding product:', error);
    alert('❌ Failed to add product: ' + error.message);
  }
}

async function editProduct(productId) {
  try {
    const product = productsData.find(p => p.id === productId);
    if (!product) {
      alert('Product not found');
      return;
    }
    
    const newName = prompt('Edit product name:', product.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('Edit price (RM):', product.price));
    if (isNaN(newPrice)) {
      alert('Invalid price');
      return;
    }
    
    const newStock = parseInt(prompt('Edit stock:', product.stock));
    if (isNaN(newStock)) {
      alert('Invalid stock quantity');
      return;
    }
    
    const newDescription = prompt('Edit description:', product.description || '');
    
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      name: newName,
      price: newPrice,
      stock: newStock,
      description: newDescription,
      status: newStock > 0 ? 'in-stock' : 'out-of-stock',
      updatedAt: Timestamp.now()
    });
    
    console.log('✅ Product updated');
    alert('✅ Product updated successfully!');
    await loadProducts();
    
  } catch (error) {
    console.error('❌ Error updating product:', error);
    alert('❌ Failed to update product: ' + error.message);
  }
}

async function deleteProduct(productId) {
  try {
    const product = productsData.find(p => p.id === productId);
    if (!product) {
      alert('Product not found');
      return;
    }
    
    const confirmDelete = confirm(
      `⚠️ Delete Product?\n\nName: ${product.name}\nPrice: RM ${product.price}\nStock: ${product.stock}\n\nThis action cannot be undone!`
    );
    
    if (!confirmDelete) return;
    
    if (product.image && product.image.includes('firebase')) {
      try {
        const imageRef = storageRef(storage, product.image);
        await deleteObject(imageRef);
      } catch (imgError) {
        console.warn('Could not delete image:', imgError);
      }
    }
    
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
    
    console.log('✅ Product deleted');
    alert('✅ Product deleted successfully!');
    await loadProducts();
    
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    alert('❌ Failed to delete product: ' + error.message);
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  
  if (filteredProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #999;">No products found. Click "Add New Product" to get started.</td></tr>`;
    updateProductStats();
    return;
  }
  
  tbody.innerHTML = filteredProducts.map(product => {
    const lastUpdated = product.updatedAt 
      ? product.updatedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'N/A';
    
    return `
      <tr>
        <td><strong>${product.id.substring(0, 8).toUpperCase()}</strong></td>
        <td>${product.image ? `<img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">` : '<div style="width: 50px; height: 50px; background: #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📦</div>'}</td>
        <td><strong>${product.name}</strong></td>
        <td>${product.category}</td>
        <td><strong>RM ${product.price.toFixed(2)}</strong></td>
        <td><span class="stock-indicator ${getStockClass(product.stock)}">${product.stock} units</span></td>
        <td><span class="status-badge ${getStockStatusClass(product.stock)}">${getStockStatus(product.stock)}</span></td>
        <td><small>${lastUpdated}</small></td>
        <td>
          <button class="edit-btn" onclick="editProduct('${product.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteProduct('${product.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
  
  updateProductStats();
}

function getStockClass(stock) {
  if (stock === 0) return 'stock-out';
  if (stock < 10) return 'stock-low';
  return 'stock-in';
}

function getStockStatus(stock) {
  if (stock === 0) return 'Out of Stock';
  if (stock < 10) return 'Low Stock';
  return 'In Stock';
}

function getStockStatusClass(stock) {
  if (stock === 0) return 'status-out-of-stock';
  if (stock < 10) return 'status-low-stock';
  return 'status-in-stock';
}

function applyFilters() {
  const searchQuery = document.getElementById('search-products')?.value || '';
  const categoryFilter = document.getElementById('filter-category')?.value || '';
  const stockFilter = document.getElementById('filter-stock')?.value || '';
  
  let filtered = [...productsData];
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query)
    );
  }
  
  if (categoryFilter) {
    filtered = filtered.filter(p => p.categoryId === categoryFilter);
  }
  
  if (stockFilter) {
    filtered = filtered.filter(product => {
      const stockStatus = getStockStatus(product.stock).toLowerCase().replace(/\s+/g, '-');
      return stockStatus === stockFilter;
    });
  }
  
  filteredProducts = filtered;
  renderProductsTable();
}

// ========================================
// ORDERS MANAGEMENT (FIREBASE VERSION)
// ========================================
let ordersData = [];
let filteredOrders = [];

function initializeOrders() {
  if (!window.location.pathname.includes('admin-orders.html')) return;
  
  console.log('📦 Initializing orders page with Firebase...');
  
  loadOrders();
  
  const exportBtn = document.getElementById('export-orders-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportOrders);
  }
  
  const searchInput = document.getElementById('search-orders');
  if (searchInput) {
    searchInput.addEventListener('input', applyOrderFilters);
  }
  
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyOrderFilters);
  }
  
  const dateFromFilter = document.getElementById('filter-date-from');
  const dateToFilter = document.getElementById('filter-date-to');
  
  if (dateFromFilter) {
    dateFromFilter.addEventListener('change', applyOrderFilters);
  }
  if (dateToFilter) {
    dateToFilter.addEventListener('change', applyOrderFilters);
  }
  
  console.log('✅ Orders page initialized');
}

async function loadOrders() {
  console.log('📦 Loading orders from Firebase...');
  
  try {
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));
    const ordersSnapshot = await getDocs(ordersQuery);
    
    ordersData = [];
    
    // Fetch all orders with user data
    for (const docSnap of ordersSnapshot.docs) {
      const order = docSnap.data();
      const orderId = docSnap.id;
      
      let customerName = 'Unknown';
      let customerEmail = 'N/A';
      
      // Fetch customer info
      if (order.userId) {
        try {
          const userDocRef = doc(db, 'users', order.userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            customerName = userData.name || userData.email;
            customerEmail = userData.email;
          }
        } catch (e) {
          console.warn('Could not fetch user data:', e);
        }
      }
      
      // Safely convert Timestamps to Dates
      let createdAt = new Date();
      let updatedAt = new Date();
      
      try {
        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
          createdAt = order.createdAt.toDate();
        } else if (order.createdAt) {
          createdAt = new Date(order.createdAt);
        }
      } catch (e) {
        console.warn('Error parsing createdAt:', e);
      }
      
      try {
        if (order.updatedAt && typeof order.updatedAt.toDate === 'function') {
          updatedAt = order.updatedAt.toDate();
        } else if (order.updatedAt) {
          updatedAt = new Date(order.updatedAt);
        } else {
          updatedAt = createdAt;
        }
      } catch (e) {
        console.warn('Error parsing updatedAt:', e);
        updatedAt = createdAt;
      }
      
      ordersData.push({
        id: orderId,
        customer: customerName,
        customerEmail: customerEmail,
        userId: order.userId,
        items: order.items || [],
        total: order.total || 0,
        subtotal: order.subtotal || 0,
        shipping: order.shipping || 0,
        tax: order.tax || 0,
        payment: order.paymentStatus || 'pending',
        paymentMethod: order.paymentMethod || 'N/A',
        status: order.status || 'pending',
        shippingAddress: order.shippingAddress || 'Not provided',
        billingAddress: order.billingAddress || order.shippingAddress || 'Not provided',
        trackingInfo: order.trackingInfo || null,
        createdAt: createdAt,
        updatedAt: updatedAt
      });
    }
    
    console.log(`✅ Loaded ${ordersData.length} orders from Firebase`);
    
    filteredOrders = [...ordersData];
    renderOrdersTable();
    
  } catch (error) {
    console.error('❌ Error loading orders:', error);
    showToast('Error loading orders', 'error', 3000);
    ordersData = [];
    filteredOrders = [];
    renderOrdersTable();
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;
  
  if (filteredOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #999;">
          No orders found.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filteredOrders.map(order => `
    <tr>
      <td><strong>${order.id.substring(0, 12).toUpperCase()}</strong></td>
      <td>
        ${order.customer}<br>
        <small style="color: #666;">${order.customerEmail}</small>
      </td>
      <td>
        <small>${order.items.length} item${order.items.length > 1 ? 's' : ''}</small>
      </td>
      <td><strong>RM ${order.total.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${order.payment === 'paid' ? 'status-delivered' : 'status-pending'}">
          ${capitalizeFirst(order.payment)}
        </span>
      </td>
      <td>
        <span class="status-badge status-${order.status}">
          ${capitalizeFirst(order.status)}
        </span>
      </td>
      <td>${formatDate(order.createdAt)}</td>
      <td>
        <button class="view-btn" onclick="viewOrderDetails('${order.id}')">View</button>
        <button class="edit-btn" onclick="updateOrderStatus('${order.id}')">Update</button>
        <button class="delete-btn" onclick="deleteOrder('${order.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function applyOrderFilters() {
  const searchQuery = document.getElementById('search-orders')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';
  
  let filtered = [...ordersData];
  
  if (searchQuery) {
    filtered = filtered.filter(order => 
      order.id.toLowerCase().includes(searchQuery) ||
      order.customer.toLowerCase().includes(searchQuery) ||
      order.customerEmail.toLowerCase().includes(searchQuery)
    );
  }
  
  if (statusFilter) {
    filtered = filtered.filter(order => order.status === statusFilter);
  }
  
  if (dateFrom) {
    filtered = filtered.filter(order => order.createdAt >= new Date(dateFrom));
  }
  
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(order => order.createdAt <= endDate);
  }
  
  filteredOrders = filtered;
  renderOrdersTable();
}

async function viewOrderDetails(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }
  
  const itemsList = order.items.map(item => 
    `  • ${item.name} (x${item.quantity}) - RM ${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');
  
  const trackingInfo = order.trackingInfo 
    ? `\n\nTracking Information:\n  Carrier: ${order.trackingInfo.carrier}\n  Tracking #: ${order.trackingInfo.trackingNumber}\n  From: ${order.trackingInfo.fromLocation}\n  To: ${order.trackingInfo.toLocation}`
    : '';
  
  const orderDetails = `
╔════════════════════════════════════╗
      ORDER DETAILS
╚════════════════════════════════════╝

Order ID: ${order.id.toUpperCase()}
Customer: ${order.customer}
Email: ${order.customerEmail}

Status: ${order.status.toUpperCase()}
Payment: ${order.payment.toUpperCase()}
Payment Method: ${order.paymentMethod}

Date: ${formatDate(order.createdAt)}

Items:
${itemsList}

Subtotal: RM ${order.subtotal.toFixed(2)}
Shipping: RM ${order.shipping.toFixed(2)}
Tax: RM ${(order.tax || 0).toFixed(2)}
─────────────────────────────────
Total: RM ${order.total.toFixed(2)}

Shipping Address:
${order.shippingAddress}
${trackingInfo}
════════════════════════════════════
  `;
  
  alert(orderDetails);
}

function updateOrderStatus(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }
  
  showTrackingModal(order);
}

function showTrackingModal(order) {
  const modal = document.createElement('div');
  modal.className = 'tracking-modal-overlay';
  modal.id = 'trackingModal';
  
  modal.innerHTML = `
    <div class="tracking-modal">
      <div class="tracking-modal-header">
        <h2>Update Shipping Status - ${order.id.substring(0, 12).toUpperCase()}</h2>
        <button class="modal-close-btn" onclick="closeTrackingModal()">×</button>
      </div>
      
      <div class="tracking-modal-body">
        <div class="package-info-card">
          <div class="package-icon">📦</div>
          <div class="package-details">
            <h3>${order.id.substring(0, 12).toUpperCase()}</h3>
            <p>Customer: ${order.customer}</p>
            <p>Email: ${order.customerEmail}</p>
            <p>${order.items.length} item(s) • RM ${order.total.toFixed(2)}</p>
          </div>
          <div class="package-status-badge status-${order.status}">
            ${capitalizeFirst(order.status)}
          </div>
        </div>
        
        <div class="shipping-form">
          <h3>Shipping Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>From Location</label>
              <input type="text" id="fromLocation" value="${order.trackingInfo?.fromLocation || 'Kuching, Sarawak'}" required>
            </div>
            
            <div class="form-group">
              <label>To Location</label>
              <input type="text" id="toLocation" value="${order.trackingInfo?.toLocation || order.shippingAddress}" required>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Carrier</label>
              <select id="carrier">
                <option value="poslaju" ${order.trackingInfo?.carrier === 'poslaju' ? 'selected' : ''}>Pos Laju</option>
                <option value="fedex" ${order.trackingInfo?.carrier === 'fedex' ? 'selected' : ''}>FedEx</option>
                <option value="dhl" ${order.trackingInfo?.carrier === 'dhl' ? 'selected' : ''}>DHL</option>
                <option value="gdex" ${order.trackingInfo?.carrier === 'gdex' ? 'selected' : ''}>GDEx</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Tracking Number</label>
              <input type="text" id="trackingNumber" value="${order.trackingInfo?.trackingNumber || ''}" placeholder="Enter tracking number" required>
            </div>
          </div>
          
          <div class="form-group">
            <label>Order Status</label>
            <select id="orderStatus" onchange="updateStatusPreview()">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Additional Notes</label>
            <textarea id="shippingNotes" rows="3" placeholder="Add any special notes or instructions...">${order.trackingInfo?.notes || ''}</textarea>
          </div>
        </div>
        
        <div class="status-preview" id="statusPreview">
          <h3>Status Badge Preview</h3>
          <span class="preview-badge status-${order.status}">${order.status.toUpperCase()}</span>
        </div>
      </div>
      
      <div class="tracking-modal-footer">
        <button class="btn-cancel" onclick="closeTrackingModal()">Cancel</button>
        <button class="btn-save" onclick="saveShippingInfo('${order.id}')">Save & Update</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function closeTrackingModal() {
  const modal = document.getElementById('trackingModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
}

function updateStatusPreview() {
  const statusSelect = document.getElementById('orderStatus');
  const preview = document.getElementById('statusPreview');
  const selectedStatus = statusSelect.value;
  
  const statusTexts = {
    'pending': 'PENDING',
    'processing': 'PROCESSING',
    'shipped': 'SHIPPED',
    'delivered': 'DELIVERED',
    'cancelled': 'CANCELLED'
  };
  
  preview.querySelector('.preview-badge').className = `preview-badge status-${selectedStatus}`;
  preview.querySelector('.preview-badge').textContent = statusTexts[selectedStatus];
}

async function saveShippingInfo(orderId) {
  const fromLocation = document.getElementById('fromLocation').value;
  const toLocation = document.getElementById('toLocation').value;
  const carrier = document.getElementById('carrier').value;
  const trackingNumber = document.getElementById('trackingNumber').value;
  const orderStatus = document.getElementById('orderStatus').value;
  const notes = document.getElementById('shippingNotes').value;
  
  if (!fromLocation || !toLocation || !trackingNumber) {
    alert('Please fill in all required fields');
    return;
  }
  
  try {
    const orderRef = doc(db, 'orders', orderId);
    
    const updateData = {
      status: orderStatus,
      trackingInfo: {
        fromLocation,
        toLocation,
        carrier,
        trackingNumber,
        notes,
        updatedAt: Timestamp.now()
      },
      updatedAt: Timestamp.now()
    };
    
    if (orderStatus === 'shipped' && !ordersData.find(o => o.id === orderId).trackingInfo) {
      updateData.shippedAt = Timestamp.now();
    }
    
    await updateDoc(orderRef, updateData);
    
    console.log('✅ Order updated in Firebase');
    alert(`✅ Order ${orderId.substring(0, 12).toUpperCase()} updated to: ${orderStatus.toUpperCase()}\n\nTracking: ${trackingNumber}`);
    
    closeTrackingModal();
    await loadOrders();
    
  } catch (error) {
    console.error('❌ Error updating order:', error);
    alert('❌ Failed to update order: ' + error.message);
  }
}

async function deleteOrder(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }
  
  const confirmDelete = confirm(
    `⚠️ Delete Order?\n\n` +
    `Order ID: ${orderId.substring(0, 12).toUpperCase()}\n` +
    `Customer: ${order.customer}\n` +
    `Total: RM ${order.total.toFixed(2)}\n\n` +
    `This action cannot be undone!`
  );
  
  if (!confirmDelete) return;
  
  try {
    const orderRef = doc(db, 'orders', orderId);
    await deleteDoc(orderRef);
    
    console.log('✅ Order deleted from Firebase');
    alert('✅ Order deleted successfully!');
    await loadOrders();
    
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    alert('❌ Failed to delete order: ' + error.message);
  }
}

function exportOrders() {
  if (filteredOrders.length === 0) {
    alert('No orders to export');
    return;
  }
  
  const headers = ['Order ID', 'Customer', 'Email', 'Items', 'Total (RM)', 'Payment', 'Status', 'Date'];
  const csvContent = [
    headers.join(','),
    ...filteredOrders.map(order => {
      const itemsText = order.items.map(item => `${item.name} (x${item.quantity})`).join('; ');
      return [
        order.id,
        `"${order.customer}"`,
        order.customerEmail,
        `"${itemsText}"`,
        order.total.toFixed(2),
        order.payment,
        order.status,
        formatDate(order.createdAt)
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  alert(`✅ Exported ${filteredOrders.length} orders successfully!`);
}

// ========================================
// CUSTOMERS MANAGEMENT (FIREBASE VERSION)
// ========================================
let customersData = [];
let filteredCustomers = [];

function initializeCustomers() {
  if (!window.location.pathname.includes('admin-customers.html')) return;
  
  console.log('👥 Initializing customers page with Firebase...');
  
  loadCustomers();
  
  const exportBtn = document.getElementById('export-customers-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCustomers);
  }
  
  const searchInput = document.getElementById('search-customers');
  if (searchInput) {
    searchInput.addEventListener('input', applyCustomerFilters);
  }
  
  const typeFilter = document.getElementById('filter-customer-type');
  if (typeFilter) {
    typeFilter.addEventListener('change', applyCustomerFilters);
  }
  
  console.log('✅ Customers page initialized');
}

async function loadCustomers() {
  console.log('👥 Loading customers from Firebase...');
  
  try {
    const usersRef = collection(db, 'users');
    const customersQuery = query(usersRef, where('role', '==', 'customer'));
    const customersSnapshot = await getDocs(customersQuery);
    
    customersData = [];
    
    const ordersRef = collection(db, 'orders');
    const allOrdersSnapshot = await getDocs(ordersRef);
    
    const ordersByUser = {};
    allOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.userId) {
        if (!ordersByUser[order.userId]) {
          ordersByUser[order.userId] = [];
        }
        ordersByUser[order.userId].push(order);
      }
    });
    
    for (const docSnap of customersSnapshot.docs) {
      const customer = docSnap.data();
      const customerId = docSnap.id;
      
      const customerOrders = ordersByUser[customerId] || [];
      const totalOrders = customerOrders.length;
      const totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      
      let lastOrderDate = null;
      if (customerOrders.length > 0) {
        const sortedOrders = customerOrders.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        const lastOrder = sortedOrders[0];
        lastOrderDate = lastOrder.createdAt?.toDate ? lastOrder.createdAt.toDate() : new Date(lastOrder.createdAt);
      }
      
      let customerType = 'new';
      if (totalOrders === 0) {
        customerType = 'new';
      } else if (totalOrders >= 1 && totalOrders < 5) {
        customerType = 'regular';
      } else if (totalOrders >= 5) {
        customerType = 'vip';
      }
      
      let joinedDate = new Date();
      try {
        if (customer.createdAt && typeof customer.createdAt.toDate === 'function') {
          joinedDate = customer.createdAt.toDate();
        } else if (customer.createdAt) {
          joinedDate = new Date(customer.createdAt);
        }
      } catch (e) {
        console.warn('Error parsing customer createdAt:', e);
      }
      
      let address = customer.address || 'Not provided';
      if (customerOrders.length > 0 && !customer.address) {
        const recentOrder = customerOrders[0];
        address = recentOrder.shippingAddress || 'Not provided';
      }
      
      customersData.push({
        id: customerId,
        name: customer.name || customer.displayName || 'N/A',
        email: customer.email,
        phone: customer.phone || customer.phoneNumber || 'Not provided',
        totalOrders: totalOrders,
        totalSpent: totalSpent,
        type: customerType,
        joined: joinedDate,
        lastOrder: lastOrderDate,
        address: address,
        photoURL: customer.photoURL || null
      });
    }
    
    customersData.sort((a, b) => b.totalSpent - a.totalSpent);
    
    console.log(`✅ Loaded ${customersData.length} customers from Firebase`);
    
    filteredCustomers = [...customersData];
    renderCustomersTable();
    updateCustomerStats();
    
  } catch (error) {
    console.error('❌ Error loading customers:', error);
    showToast('Error loading customers', 'error', 3000);
    customersData = [];
    filteredCustomers = [];
    renderCustomersTable();
  }
}

function renderCustomersTable() {
  const tbody = document.getElementById('customers-table-body');
  if (!tbody) return;
  
  if (filteredCustomers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: #999;">
          No customers found.
        </td>
      </tr>
    `;
    updateCustomerStats();
    return;
  }
  
  tbody.innerHTML = filteredCustomers.map(customer => `
    <tr>
      <td><strong>${customer.id.substring(0, 8).toUpperCase()}</strong></td>
      <td>${customer.name}</td>
      <td>
        <a href="mailto:${customer.email}" style="color: #8b4513; text-decoration: none;">
          ${customer.email}
        </a>
      </td>
      <td>${customer.phone}</td>
      <td><strong>${customer.totalOrders}</strong></td>
      <td><strong>RM ${customer.totalSpent.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${getCustomerTypeClass(customer.type)}">
          ${capitalizeFirst(customer.type)}
        </span>
      </td>
      <td>${formatDate(customer.joined)}</td>
      <td>
        <button class="view-btn" onclick="viewCustomerDetails('${customer.id}')">View</button>
        <button class="delete-btn" onclick="deleteCustomer('${customer.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
  
  updateCustomerStats();
}

function updateCustomerStats() {
  const totalCustomersEl = document.getElementById('total-customers');
  if (totalCustomersEl) {
    totalCustomersEl.textContent = customersData.length;
  }
}

function getCustomerTypeClass(type) {
  switch(type) {
    case 'vip':
      return 'status-delivered';
    case 'new':
      return 'status-processing';
    case 'regular':
    default:
      return 'status-pending';
  }
}

function applyCustomerFilters() {
  const searchQuery = document.getElementById('search-customers')?.value.toLowerCase() || '';
  const typeFilter = document.getElementById('filter-customer-type')?.value || '';
  
  let filtered = [...customersData];
  
  if (searchQuery) {
    filtered = filtered.filter(customer => 
      customer.name.toLowerCase().includes(searchQuery) ||
      customer.email.toLowerCase().includes(searchQuery) ||
      customer.phone.toLowerCase().includes(searchQuery) ||
      customer.id.toLowerCase().includes(searchQuery)
    );
  }
  
  if (typeFilter) {
    filtered = filtered.filter(customer => customer.type === typeFilter);
  }
  
  filteredCustomers = filtered;
  renderCustomersTable();
}

async function viewCustomerDetails(customerId) {
  const customer = customersData.find(c => c.id === customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }
  
  const ordersRef = collection(db, 'orders');
  const customerOrdersQuery = query(ordersRef, where('userId', '==', customerId));
  const ordersSnapshot = await getDocs(customerOrdersQuery);
  
  const avgOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;
  
  const productCounts = {};
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const productName = item.name;
        productCounts[productName] = (productCounts[productName] || 0) + item.quantity;
      });
    }
  });
  
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `  • ${name} (${count}x)`)
    .join('\n');
  
  const customerDetails = `
╔════════════════════════════════════╗
      CUSTOMER DETAILS
╚════════════════════════════════════╝

📋 BASIC INFO
────────────────────────────────────
Customer ID: ${customer.id.toUpperCase()}
Name: ${customer.name}
Email: ${customer.email}
Phone: ${customer.phone}

👤 CUSTOMER TYPE
────────────────────────────────────
Status: ${customer.type.toUpperCase()}
Member Since: ${formatDate(customer.joined)}
Last Order: ${customer.lastOrder ? formatDate(customer.lastOrder) : 'No orders yet'}

💰 PURCHASE HISTORY
────────────────────────────────────
Total Orders: ${customer.totalOrders}
Total Spent: RM ${customer.totalSpent.toFixed(2)}
Average Order Value: RM ${avgOrderValue.toFixed(2)}

${topProducts ? `🏆 TOP PRODUCTS PURCHASED
────────────────────────────────────
${topProducts}
` : ''}
📍 DELIVERY ADDRESS
────────────────────────────────────
${customer.address}

════════════════════════════════════
  `;
  
  alert(customerDetails);
}

async function deleteCustomer(customerId) {
  const customer = customersData.find(c => c.id === customerId);
  if (!customer) {
    alert('Customer not found');
    return;
  }
  
  const confirmDelete = confirm(
    `⚠️ DELETE CUSTOMER ACCOUNT?\n\n` +
    `Customer: ${customer.name}\n` +
    `Email: ${customer.email}\n` +
    `Total Orders: ${customer.totalOrders}\n` +
    `Total Spent: RM ${customer.totalSpent.toFixed(2)}\n\n` +
    `This will permanently delete:\n` +
    `• Customer account\n` +
    `• Order history (${customer.totalOrders} orders)\n` +
    `• All customer data\n\n` +
    `⚠️ THIS CANNOT BE UNDONE!\n\n` +
    `Type the customer's email to confirm deletion.`
  );
  
  if (!confirmDelete) return;
  
  const emailConfirm = prompt(`Type "${customer.email}" to confirm deletion:`);
  
  if (emailConfirm !== customer.email) {
    alert('❌ Email does not match. Deletion cancelled.');
    return;
  }
  
  try {
    const ordersRef = collection(db, 'orders');
    const customerOrdersQuery = query(ordersRef, where('userId', '==', customerId));
    const ordersSnapshot = await getDocs(customerOrdersQuery);
    
    const deletePromises = [];
    ordersSnapshot.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    const customerRef = doc(db, 'users', customerId);
    deletePromises.push(deleteDoc(customerRef));
    
    await Promise.all(deletePromises);
    
    console.log('✅ Customer and orders deleted from Firebase');
    alert(`✅ Customer "${customer.name}" has been permanently deleted.`);
    
    await loadCustomers();
    
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    alert('❌ Failed to delete customer: ' + error.message);
  }
}

function exportCustomers() {
  if (filteredCustomers.length === 0) {
    alert('No customers to export');
    return;
  }
  
  const headers = [
    'Customer ID', 
    'Name', 
    'Email', 
    'Phone', 
    'Total Orders', 
    'Total Spent (RM)', 
    'Type', 
    'Joined Date',
    'Last Order',
    'Address'
  ];
  
  const csvContent = [
    headers.join(','),
    ...filteredCustomers.map(customer => [
      customer.id,
      `"${customer.name}"`,
      customer.email,
      customer.phone,
      customer.totalOrders,
      customer.totalSpent.toFixed(2),
      customer.type,
      formatDate(customer.joined),
      customer.lastOrder ? formatDate(customer.lastOrder) : 'N/A',
      `"${customer.address}"`
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  alert(`✅ Exported ${filteredCustomers.length} customers successfully!`);
}

async function getCustomerStatistics() {
  const stats = {
    total: customersData.length,
    new: customersData.filter(c => c.type === 'new').length,
    regular: customersData.filter(c => c.type === 'regular').length,
    vip: customersData.filter(c => c.type === 'vip').length,
    totalRevenue: customersData.reduce((sum, c) => sum + c.totalSpent, 0),
    avgOrderValue: 0,
    totalOrders: customersData.reduce((sum, c) => sum + c.totalOrders, 0)
  };
  
  stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
  
  console.log('👥 CUSTOMER STATISTICS');
  console.log('╔════════════════════════════════════╗');
  console.table({
    'Total Customers': stats.total,
    'New Customers': stats.new,
    'Regular Customers': stats.regular,
    'VIP Customers': stats.vip,
    'Total Orders': stats.totalOrders,
    'Total Revenue': `RM ${stats.totalRevenue.toFixed(2)}`,
    'Avg Order Value': `RM ${stats.avgOrderValue.toFixed(2)}`
  });
  console.log('╚════════════════════════════════════╝');
  
  return stats;
}
// ========================================
// ANALYTICS MANAGEMENT (FIREBASE VERSION)
// ========================================
let revenueChart, ordersChart, productsChart, customersChart;

function initializeAnalytics() {
  if (!window.location.pathname.includes('admin-analytics.html')) return;
  
  console.log('📊 Initializing analytics page with Firebase...');
  
  initializeCharts();
  loadAnalyticsData();
  
  const timeRangeSelect = document.getElementById('time-range');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', function() {
      updateChartsData(this.value);
    });
  }
  
  const downloadBtn = document.getElementById('download-report-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadReport);
  }
  
  console.log('✅ Analytics page initialized');
}

function initializeCharts() {
  initRevenueChart();
  initOrdersChart();
  initProductsChart();
  initCustomersChart();
}

function initRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  
  revenueChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Revenue (RM)',
        data: [0, 0, 0, 0],
        borderColor: '#8b4513',
        backgroundColor: 'rgba(212,165,116,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'RM ' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'RM ' + value;
            }
          }
        }
      }
    }
  });
}

function initOrdersChart() {
  const ctx = document.getElementById('ordersChart');
  if (!ctx) return;
  
  ordersChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      datasets: [{
        label: 'Orders',
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          '#FFC107',
          '#2196F3',
          '#9C27B0',
          '#4CAF50',
          '#F44336'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function initProductsChart() {
  const ctx = document.getElementById('productsChart');
  if (!ctx) return;
  
  productsChart = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#ddd'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function initCustomersChart() {
  const ctx = document.getElementById('customersChart');
  if (!ctx) return;
  
  customersChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'New Customers',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76,175,80,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

async function loadAnalyticsData() {
  console.log('📈 Loading analytics data from Firebase...');
  
  try {
    const timeRange = document.getElementById('time-range')?.value || '30days';
    
    // Load all data in parallel
    await Promise.all([
      updateRevenueChart(timeRange),
      updateOrdersChart(),
      updateProductsChart(),
      updateCustomersChart(timeRange),
      updateMetrics()
    ]);
    
    console.log('✅ Analytics data loaded');
    
  } catch (error) {
    console.error('❌ Error loading analytics:', error);
    showToast('Error loading analytics data', 'error', 3000);
  }
}

async function updateRevenueChart(timeRange) {
  if (!revenueChart) return;
  
  try {
    const { labels, startDate } = getTimeRangeParams(timeRange);
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('createdAt', '>=', startDate), orderBy('createdAt', 'asc'));
    const ordersSnapshot = await getDocs(ordersQuery);
    
    const revenueData = new Array(labels.length).fill(0);
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const orderDate = order.createdAt.toDate();
      const index = getTimeIndex(orderDate, startDate, timeRange);
      
      if (index >= 0 && index < revenueData.length) {
        revenueData[index] += order.total || 0;
      }
    });
    
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = revenueData;
    revenueChart.update();
    
  } catch (error) {
    console.error('Error updating revenue chart:', error);
  }
}

async function updateOrdersChart() {
  if (!ordersChart) return;
  
  try {
    const ordersRef = collection(db, 'orders');
    const ordersSnapshot = await getDocs(ordersRef);
    
    const statusCounts = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const status = order.status || 'pending';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });
    
    ordersChart.data.datasets[0].data = [
      statusCounts.pending,
      statusCounts.processing,
      statusCounts.shipped,
      statusCounts.delivered,
      statusCounts.cancelled
    ];
    ordersChart.update();
    
  } catch (error) {
    console.error('Error updating orders chart:', error);
  }
}

async function updateProductsChart() {
  if (!productsChart) return;
  
  try {
    const ordersRef = collection(db, 'orders');
    const ordersSnapshot = await getDocs(ordersRef);
    
    const productSales = {};
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const productName = item.name;
          productSales[productName] = (productSales[productName] || 0) + (item.quantity || 0);
        });
      }
    });
    
    if (Object.keys(productSales).length === 0) {
      productsChart.data.labels = ['No Data'];
      productsChart.data.datasets[0].data = [1];
      productsChart.data.datasets[0].backgroundColor = ['#ddd'];
    } else {
      const sortedProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      const colors = ['#8b4513', '#d4a574', '#4CAF50', '#2196F3', '#FF9800'];
      
      productsChart.data.labels = sortedProducts.map(([name]) => name);
      productsChart.data.datasets[0].data = sortedProducts.map(([, quantity]) => quantity);
      productsChart.data.datasets[0].backgroundColor = colors.slice(0, sortedProducts.length);
    }
    
    productsChart.update();
    
  } catch (error) {
    console.error('Error updating products chart:', error);
  }
}

async function updateCustomersChart(timeRange) {
  if (!customersChart) return;
  
  try {
    const { labels, startDate } = getTimeRangeParams(timeRange);
    const usersRef = collection(db, 'users');
    const customersQuery = query(usersRef, where('role', '==', 'customer'), where('createdAt', '>=', startDate), orderBy('createdAt', 'asc'));
    const customersSnapshot = await getDocs(customersQuery);
    
    const customerData = new Array(labels.length).fill(0);
    
    customersSnapshot.forEach(doc => {
      const customer = doc.data();
      const joinDate = customer.createdAt ? customer.createdAt.toDate() : new Date();
      const index = getTimeIndex(joinDate, startDate, timeRange);
      
      if (index >= 0 && index < customerData.length) {
        customerData[index]++;
      }
    });
    
    customersChart.data.labels = labels;
    customersChart.data.datasets[0].data = customerData;
    customersChart.update();
    
  } catch (error) {
    console.error('Error updating customers chart:', error);
  }
}

async function updateMetrics() {
  try {
    const ordersRef = collection(db, 'orders');
    const ordersSnapshot = await getDocs(ordersRef);
    
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let thisMonthRevenue = 0;
    let thisMonthOrders = 0;
    let lastMonthRevenue = 0;
    let lastMonthOrders = 0;
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const orderDate = order.createdAt ? order.createdAt.toDate() : new Date();
      
      if (orderDate >= thisMonth) {
        thisMonthRevenue += order.total || 0;
        thisMonthOrders++;
      } else if (orderDate >= lastMonth && orderDate < thisMonth) {
        lastMonthRevenue += order.total || 0;
        lastMonthOrders++;
      }
    });
    
    const avgOrderValue = thisMonthOrders > 0 ? thisMonthRevenue / thisMonthOrders : 0;
    const lastMonthAvgOrderValue = lastMonthOrders > 0 ? lastMonthRevenue / lastMonthOrders : 0;
    const avgOrderChange = lastMonthAvgOrderValue > 0 
      ? ((avgOrderValue - lastMonthAvgOrderValue) / lastMonthAvgOrderValue * 100)
      : 0;
    
    // Get customer retention (customers with 2+ orders)
    const usersRef = collection(db, 'users');
    const customersSnapshot = await getDocs(query(usersRef, where('role', '==', 'customer')));
    
    let repeatCustomers = 0;
    const totalCustomers = customersSnapshot.size;
    
    for (const customerDoc of customersSnapshot.docs) {
      const customerId = customerDoc.id;
      const customerOrdersQuery = query(ordersRef, where('userId', '==', customerId));
      const customerOrdersSnapshot = await getDocs(customerOrdersQuery);
      
      if (customerOrdersSnapshot.size >= 2) {
        repeatCustomers++;
      }
    }
    
    const customerRetention = totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100) : 0;
    
    // Revenue growth
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0;
    
    // Conversion rate (simplified - orders vs total customers)
    const conversionRate = totalCustomers > 0 ? (thisMonthOrders / totalCustomers * 100) : 0;
    
    // Update metrics cards
    const metricsCards = document.querySelectorAll('.metrics-section .card');
    
    if (metricsCards.length >= 4) {
      metricsCards[0].querySelector('p').textContent = `RM ${avgOrderValue.toFixed(2)}`;
      metricsCards[0].querySelector('.card-subtitle').textContent = 
        `${avgOrderChange >= 0 ? '↑' : '↓'} ${Math.abs(avgOrderChange).toFixed(1)}% from last month`;
      
      metricsCards[1].querySelector('p').textContent = `${conversionRate.toFixed(1)}%`;
      metricsCards[1].querySelector('.card-subtitle').textContent = 
        `Based on customer activity`;
      
      metricsCards[2].querySelector('p').textContent = `${customerRetention.toFixed(1)}%`;
      metricsCards[2].querySelector('.card-subtitle').textContent = 
        `${repeatCustomers} repeat customers`;
      
      metricsCards[3].querySelector('p').textContent = `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`;
      metricsCards[3].querySelector('.card-subtitle').textContent = 
        `${revenueGrowth >= 0 ? '↑' : '↓'} ${Math.abs(revenueGrowth).toFixed(1)}% from last month`;
    }
    
  } catch (error) {
    console.error('Error updating metrics:', error);
  }
}

function getTimeRangeParams(timeRange) {
  const now = new Date();
  let labels = [];
  let startDate = new Date();
  
  switch(timeRange) {
    case '7days':
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90days':
      labels = ['Month 1', 'Month 2', 'Month 3'];
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1year':
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { labels, startDate };
}

function getTimeIndex(date, startDate, timeRange) {
  const diffTime = date - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  switch(timeRange) {
    case '7days':
      return diffDays;
    case '30days':
      return Math.floor(diffDays / 7);
    case '90days':
      return Math.floor(diffDays / 30);
    case '1year':
      return date.getMonth();
    default:
      return Math.floor(diffDays / 7);
  }
}

async function updateChartsData(timeRange) {
  console.log(`📊 Updating charts for ${timeRange}...`);
  
  try {
    await Promise.all([
      updateRevenueChart(timeRange),
      updateCustomersChart(timeRange)
    ]);
    
    showToast('Charts updated!', 'success', 2000);
  } catch (error) {
    console.error('Error updating charts:', error);
    showToast('Error updating charts', 'error', 3000);
  }
}

async function downloadReport() {
  const timeRange = document.getElementById('time-range')?.value || '30days';
  
  console.log(`📥 Generating ${timeRange} report...`);
  
  try {
    const ordersRef = collection(db, 'orders');
    const { startDate } = getTimeRangeParams(timeRange);
    const ordersQuery = query(ordersRef, where('createdAt', '>=', startDate), orderBy('createdAt', 'desc'));
    const ordersSnapshot = await getDocs(ordersQuery);
    
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    let report = `DAYANGSARI ENTERPRISE - ANALYTICS REPORT\n`;
    report += `Report Period: ${timeRange}\n`;
    report += `Generated: ${reportDate}\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    let totalRevenue = 0;
    let totalOrders = 0;
    const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      totalRevenue += order.total || 0;
      totalOrders++;
      const status = order.status || 'pending';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });
    
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    report += `📊 SUMMARY\n`;
    report += `${'-'.repeat(60)}\n`;
    report += `Total Revenue: RM ${totalRevenue.toFixed(2)}\n`;
    report += `Total Orders: ${totalOrders}\n`;
    report += `Average Order Value: RM ${avgOrderValue.toFixed(2)}\n\n`;
    
    report += `📦 ORDERS BY STATUS\n`;
    report += `${'-'.repeat(60)}\n`;
    report += `Pending: ${statusCounts.pending}\n`;
    report += `Processing: ${statusCounts.processing}\n`;
    report += `Shipped: ${statusCounts.shipped}\n`;
    report += `Delivered: ${statusCounts.delivered}\n`;
    report += `Cancelled: ${statusCounts.cancelled}\n\n`;
    
    report += `${'='.repeat(60)}\n`;
    report += `End of Report\n`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast('✅ Report downloaded successfully!', 'success', 3000);
    
  } catch (error) {
    console.error('Error generating report:', error);
    showToast('Error generating report', 'error', 3000);
  }
}

// ========================================
// ACCOUNT MANAGEMENT (FIREBASE VERSION)
// ========================================
function initializeAccount() {
  if (!window.location.pathname.includes('admin-account.html')) return;
  
  console.log('👤 Initializing account page with Firebase...');
  
  // Load current admin info
  loadCurrentAdminInfo();
  
  console.log('✅ Account page initialized');
}

async function loadCurrentAdminInfo() {
  try {
    const user = auth.currentUser;
    
    if (user) {
      const currentEmailEl = document.getElementById('current-email');
      if (currentEmailEl) {
        currentEmailEl.textContent = user.email;
      }
      
      console.log('✅ Loaded admin info:', user.email);
    }
  } catch (error) {
    console.error('Error loading admin info:', error);
  }
}

async function changeEmail() {
  const newEmail = document.getElementById('new-email').value.trim();
  
  if (!newEmail) {
    alert('Please enter a new email address');
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    alert('Please enter a valid email address');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    alert('No user is currently signed in');
    return;
  }
  
  if (newEmail === user.email) {
    alert('New email must be different from current email');
    return;
  }
  
  const confirmChange = confirm(
    `Change email from:\n${user.email}\n\nTo:\n${newEmail}\n\nYou will need to verify your new email address and sign in again. Continue?`
  );
  
  if (!confirmChange) return;
  
  try {
    // Import necessary functions
    const { updateEmail, sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js');
    
    // Update email in Firebase Auth
    await updateEmail(user, newEmail);
    
    // Send verification email
    await sendEmailVerification(user);
    
    // Update UI
    const currentEmailEl = document.getElementById('current-email');
    if (currentEmailEl) {
      currentEmailEl.textContent = newEmail;
    }
    
    document.getElementById('new-email').value = '';
    
    alert('✅ Email updated successfully!\n\nA verification email has been sent to your new address.\n\nPlease verify your email and sign in again.');
    
    // Sign out after email change
    setTimeout(async () => {
      await signOut(auth);
      window.location.href = '../index.html';
    }, 2000);
    
  } catch (error) {
    console.error('Error updating email:', error);
    
    if (error.code === 'auth/requires-recent-login') {
      alert('❌ For security reasons, you need to sign in again before changing your email.\n\nPlease log out and log back in, then try again.');
    } else if (error.code === 'auth/email-already-in-use') {
      alert('❌ This email is already in use by another account.');
    } else {
      alert('❌ Failed to update email: ' + error.message);
    }
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Please fill in all password fields');
    return;
  }
  
  if (newPassword.length < 8) {
    alert('New password must be at least 8 characters long');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  if (currentPassword === newPassword) {
    alert('New password must be different from current password');
    return;
  }
  
  const confirmChange = confirm('Are you sure you want to change your password?');
  
  if (!confirmChange) return;
  
  const user = auth.currentUser;
  if (!user) {
    alert('No user is currently signed in');
    return;
  }
  
  try {
    // Import necessary functions
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js');
    
    // Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    // Clear form
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    
    alert('✅ Password updated successfully!');
    
    console.log('✅ Password changed for:', user.email);
    
  } catch (error) {
    console.error('Error updating password:', error);
    
    if (error.code === 'auth/wrong-password') {
      alert('❌ Current password is incorrect');
    } else if (error.code === 'auth/weak-password') {
      alert('❌ Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/requires-recent-login') {
      alert('❌ For security reasons, you need to sign in again before changing your password.\n\nPlease log out and log back in, then try again.');
    } else {
      alert('❌ Failed to update password: ' + error.message);
    }
  }
}

async function toggleWebsiteStatus() {
  const checkbox = document.getElementById('website-status');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');
  const statusDot = document.getElementById('status-dot');
  
  const isOpen = checkbox.checked;
  
  try {
    // Store website status in Firestore
    const settingsRef = doc(db, 'settings', 'website');
    await updateDoc(settingsRef, {
      isOpen: isOpen,
      updatedAt: Timestamp.now(),
      updatedBy: auth.currentUser?.email || 'admin'
    }).catch(async (error) => {
      // If document doesn't exist, create it
      if (error.code === 'not-found') {
        await setDoc(settingsRef, {
          isOpen: isOpen,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: auth.currentUser?.email || 'admin'
        });
      } else {
        throw error;
      }
    });
    
    if (isOpen) {
      statusText.textContent = 'Open';
      statusIndicator.className = 'status-indicator open';
      statusDot.className = 'status-dot open';
      statusIndicator.querySelector('strong').textContent = 'Website is currently accessible to customers';
      statusIndicator.querySelector('.status-description').textContent = 'Customers can browse and place orders';
      
      showToast('✅ Store is now OPEN for business!', 'success', 3000);
    } else {
      statusText.textContent = 'Closed';
      statusIndicator.className = 'status-indicator closed';
      statusDot.className = 'status-dot closed';
      statusIndicator.querySelector('strong').textContent = 'Website is currently closed to customers';
      statusIndicator.querySelector('.status-description').textContent = 'Visitors will see: "Sorry for the inconvenience. We\'re currently baking something new!"';
      
      showToast('🔒 Store is now CLOSED. Customers will see the maintenance message.', 'info', 3000);
    }
    
    console.log('✅ Website status updated:', isOpen ? 'OPEN' : 'CLOSED');
    
  } catch (error) {
    console.error('Error updating website status:', error);
    alert('❌ Failed to update website status: ' + error.message);
    
    // Revert checkbox state
    checkbox.checked = !isOpen;
  }
}

async function deleteWebsite() {
  const confirmStep1 = confirm(
    '⚠️ DANGER ZONE ⚠️\n\n' +
    'You are about to DELETE the ENTIRE WEBSITE!\n\n' +
    'This will permanently delete:\n' +
    '• All products and inventory\n' +
    '• All customer data\n' +
    '• All order history\n' +
    '• All analytics data\n' +
    '• All website content\n\n' +
    'THIS CANNOT BE UNDONE!\n\n' +
    'Do you want to continue?'
  );
  
  if (!confirmStep1) return;
  
  const confirmStep2 = confirm(
    '🚨 FINAL WARNING 🚨\n\n' +
    'This is your LAST CHANCE to cancel!\n\n' +
    'Are you ABSOLUTELY SURE you want to delete everything?\n\n' +
    'Click OK to proceed with deletion.\n' +
    'Click Cancel to keep your website safe.'
  );
  
  if (!confirmStep2) {
    alert('✅ Deletion cancelled. Your website is safe.');
    return;
  }
  
  const typedConfirmation = prompt(
    'To confirm deletion, type exactly:\nDELETE EVERYTHING\n\n' +
    '(Type carefully - this is case sensitive)'
  );
  
  if (typedConfirmation !== 'DELETE EVERYTHING') {
    alert('❌ Confirmation text did not match. Deletion cancelled.');
    return;
  }
  
  try {
    showToast('💥 Starting website deletion...', 'error', 5000);
    
    // Delete all collections
    const collections = ['products', 'orders', 'users', 'settings'];
    
    for (const collectionName of collections) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      console.log(`Deleting ${snapshot.size} documents from ${collectionName}...`);
      
      const deletePromises = [];
      snapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(docSnapshot.ref));
      });
      
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${collectionName}`);
    }
    
    // Delete images from storage (if any)
    try {
      const storageListRef = ref(storage, 'products/');
      const fileList = await listAll(storageListRef);
      
      const deleteFilePromises = fileList.items.map(fileRef => deleteObject(fileRef));
      await Promise.all(deleteFilePromises);
      
      console.log('✅ Deleted product images');
    } catch (storageError) {
      console.warn('Storage deletion error (may be empty):', storageError);
    }
    
    alert(
      '💥 WEBSITE DELETION COMPLETE\n\n' +
      'All data has been permanently deleted.\n\n' +
      'You will now be logged out.'
    );
    
    // Sign out and redirect
    await signOut(auth);
    window.location.href = '../index.html';
    
  } catch (error) {
    console.error('❌ Error deleting website:', error);
    alert('❌ Error during deletion: ' + error.message + '\n\nSome data may still exist. Please check the console.');
  }
}

// Import additional Firebase functions needed for account management
async function importFirebaseAuthFunctions() {
  try {
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, sendEmailVerification } = 
      await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js');
    
    return { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, sendEmailVerification };
  } catch (error) {
    console.error('Error importing Firebase auth functions:', error);
    return null;
  }
}
window.logout = logout;
window.loadProducts = loadProducts;
window.loadOrders = loadOrders;
window.loadCustomers = loadCustomers;
window.loadDashboardData = loadDashboardData;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.closeProductModal = closeProductModal;
window.previewProductImage = previewProductImage;
window.toggleVariantsSection = toggleVariantsSection;
window.addVariantField = addVariantField;
window.removeVariant = removeVariant;
window.submitNewProduct = submitNewProduct;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.closeTrackingModal = closeTrackingModal;
window.updateStatusPreview = updateStatusPreview;
window.saveShippingInfo = saveShippingInfo;
window.viewCustomerDetails = viewCustomerDetails;
window.deleteCustomer = deleteCustomer;
window.getCustomerStatistics = getCustomerStatistics;
window.updateChartsData = updateChartsData;
window.downloadReport = downloadReport;
// ========================================
// INITIALIZE ON DOM LOAD
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Admin.js loaded');
  
  // Setup logout button on all pages
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  
  // Initialize based on current page
  const path = window.location.pathname;
  
  if (path.includes('admin.html') && !path.includes('admin-')) {
    initializeDashboard();
  } else if (path.includes('admin-products.html')) {
    initializeProducts();
  } else if (path.includes('admin-orders.html')) {
    initializeOrders();
  } else if (path.includes('admin-customers.html')) {
    initializeCustomers();
  }
  // Add more page initializations here as needed
});

console.log('✅ Admin Firebase Module Loaded');
console.log('💡 Available commands:');
console.log('  - loadProducts() - Reload products from Firebase');
console.log('  - loadOrders() - Reload orders from Firebase');
console.log('  - loadCustomers() - Reload customers from Firebase');
console.log('  - getCustomerStatistics() - View customer stats');
console.log('  - loadDashboardData() - Reload dashboard data');