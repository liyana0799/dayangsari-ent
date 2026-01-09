// ========================================
// FIREBASE DATABASE FUNCTIONS
// firebase-functions.js - Place in project root
// ========================================

import { auth, db, storage } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { 
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

export async function firebaseSignUp(email, password, name) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: name });
    
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      role: 'customer',
      createdAt: serverTimestamp()
    });
    
    console.log('✅ User created:', user.uid);
    return { success: true, user };
  } catch (error) {
    console.error('❌ Sign up error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function firebaseSignIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    console.log('✅ User signed in:', user.uid);
    return { success: true, user, userData };
  } catch (error) {
    console.error('❌ Sign in error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function firebaseSignOut() {
  try {
    await signOut(auth);
    console.log('✅ User signed out');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out error:', error.message);
    return { success: false, error: error.message };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function isAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return userDoc.data()?.role === 'admin';
  } catch (error) {
    return false;
  }
}

// ========================================
// PRODUCTS FUNCTIONS
// ========================================

export async function getProducts() {
  try {
    const snapshot = await getDocs(query(collection(db, 'products'), orderBy('name')));
    const products = [];
    snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    console.log(`✅ Loaded ${products.length} products`);
    return products;
  } catch (error) {
    console.error('❌ Error loading products:', error);
    return [];
  }
}

export async function getProduct(productId) {
  try {
    const docSnap = await getDoc(doc(db, 'products', productId.toString()));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error('❌ Error loading product:', error);
    return null;
  }
}

export async function addProduct(productData) {
  try {
    if (!await isAdmin()) throw new Error('Admin access required');
    
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Product added:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('❌ Error adding product:', error);
    return { success: false, error: error.message };
  }
}

export async function updateProduct(productId, productData) {
  try {
    if (!await isAdmin()) throw new Error('Admin access required');
    
    await updateDoc(doc(db, 'products', productId.toString()), {
      ...productData,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Product updated:', productId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating product:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteProduct(productId) {
  try {
    if (!await isAdmin()) throw new Error('Admin access required');
    
    await deleteDoc(doc(db, 'products', productId.toString()));
    console.log('✅ Product deleted:', productId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// ORDERS FUNCTIONS
// ========================================

export async function saveOrder(orderData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const docRef = await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      customerName: orderData.name,
      customerEmail: orderData.email,
      customerPhone: orderData.phone,
      items: orderData.cart,
      subtotal: orderData.subtotal,
      shipping: orderData.shipping,
      promoDiscount: orderData.promoDiscount || 0,
      total: orderData.total,
      shippingAddress: orderData.address,
      paymentMethod: orderData.paymentMethod,
      status: orderData.status || 'pending',
      paymentCompleted: orderData.paymentCompleted || false,
      createdAt: serverTimestamp()
    });
    
    console.log('✅ Order saved:', docRef.id);
    return { success: true, orderId: docRef.id };
  } catch (error) {
    console.error('❌ Error saving order:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserOrders() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const orders = [];
    snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    
    console.log(`✅ Loaded ${orders.length} orders`);
    return orders;
  } catch (error) {
    console.error('❌ Error loading orders:', error);
    return [];
  }
}

export async function getAllOrders() {
  try {
    if (!await isAdmin()) throw new Error('Admin access required');
    
    const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    const orders = [];
    snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    
    console.log(`✅ Loaded ${orders.length} orders`);
    return orders;
  } catch (error) {
    console.error('❌ Error loading orders:', error);
    return [];
  }
}

// ========================================
// MIGRATION FUNCTION
// ========================================

export async function migrateToFirebase() {
  try {
    if (!await isAdmin()) {
      alert('Only admin can migrate data');
      return;
    }
    
    // Get products from localStorage
    const localProducts = JSON.parse(localStorage.getItem('productsDatabase') || '[]');
    
    if (localProducts.length === 0) {
      alert('No products found in localStorage');
      return;
    }
    
    let migrated = 0;
    for (const product of localProducts) {
      await setDoc(doc(db, 'products', product.id.toString()), {
        name: product.name,
        category: product.category,
        categoryId: product.categoryId,
        price: product.price,
        stock: product.stock || 100,
        image: product.image,
        description: product.description,
        features: product.features,
        hasVariants: product.hasVariants || false,
        variants: product.variants || [],
        status: product.status || 'in-stock',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      migrated++;
      console.log(`Migrated ${migrated}/${localProducts.length}: ${product.name}`);
    }
    
    alert(`✅ Successfully migrated ${migrated} products!`);
    return { success: true, count: migrated };
  } catch (error) {
    console.error('❌ Migration error:', error);
    alert('Migration error: ' + error.message);
    return { success: false, error: error.message };
  }
}

// Make migration available globally
window.migrateToFirebase = migrateToFirebase;

console.log('✅ Firebase functions loaded');
console.log('💡 Run: migrateToFirebase() to migrate data');