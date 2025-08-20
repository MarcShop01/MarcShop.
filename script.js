import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const db = window.firebaseDB;
const auth = window.firebaseAuth;

let currentUser = null;
let products = [];
let allProducts = [];
let filteredProducts = [];
let cart = [];
let users = [];
let orders = [];
let currentProductImages = [];
let currentImageIndex = 0;
let isAddingToCart = false;
let searchTerm = '';
let currentCategory = 'all';
let isAdmin = false;

// Options par catégorie
const SIZE_OPTIONS = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  electronics: ["Standard", "Petit", "Moyen", "Grand", "Extra Large"],
  home: ["Petit", "Moyen", "Grand", "Personnalisé"],
  sports: ["XS", "S", "M", "L", "XL", "XXL"],
  beauty: ["100ml", "200ml", "250ml", "500ml", "1L"],
  hair: ["12\"", "14\"", "16\"", "18\"", "20\"", "22\"", "24\"", "26\"", "28\"", "30\"", "32\"", "34\"", "36\""],
  default: ["Unique", "Standard", "Personnalisé"]
};

const COLORS = ["Blanc", "Noir", "Rouge", "Bleu", "Vert", "Jaune", "Rose", "Violet", "Orange", "Gris", "Marron", "Beige"];

document.addEventListener("DOMContentLoaded", () => {
  loadFirestoreProducts();
  loadFirestoreUsers();
  loadFirestoreOrders();
  loadCart();
  checkUserRegistration();
  setupEventListeners();
  setupLightbox();
  setupAdminListeners();
  window.toggleCart = toggleCart;
  window.toggleAdminPanel = toggleAdminPanel;
  
  // Vérifier si l'admin est connecté
  checkAdminStatus();
});

function loadFirestoreProducts() {
  const productsCol = collection(db, "products");
  onSnapshot(productsCol, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    // Mélanger aléatoirement les produits
    products = shuffleArray([...allProducts]);
    
    // Appliquer les filtres actuels (recherche et catégorie)
    applyFilters();
    
    // Mettre à jour la liste des produits dans l'admin
    if (isAdmin) {
      updateProductsList();
    }
  });
}

function loadFirestoreUsers() {
  const usersCol = collection(db, "users");
  onSnapshot(usersCol, (snapshot) => {
    users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    // Mettre à jour la liste des utilisateurs dans l'admin
    if (isAdmin) {
      updateActiveUsersList();
      updateStats();
    }
  });
}

function loadFirestoreOrders() {
  const ordersCol = collection(db, "orders");
  onSnapshot(ordersCol, (snapshot) => {
    orders = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    // Mettre à jour la liste des commandes dans l'admin
    if (isAdmin) {
      updateOrdersList();
      updateStats();
    }
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem("marcshop-cart")) || [];
    currentUser = JSON.parse(localStorage.getItem("marcshop-current-user"));
  } catch (e) {
    cart = [];
  }
  updateCartUI();
}

function saveCart() {
  localStorage.setItem("marcshop-cart", JSON.stringify(cart));
  if (currentUser) {
    localStorage.setItem("marcshop-current-user", JSON.stringify(currentUser));
  }
  updateCartUI();
}

function checkUserRegistration() {
  if (!currentUser) {
    setTimeout(() => {
      document.getElementById("registrationModal").classList.add("active");
    }, 1000);
  } else {
    displayUserName();
    // Mettre à jour l'activité de l'utilisateur
    updateUserActivity();
  }
}

function setupEventListeners() {
  document.getElementById("registrationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("userName").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    if (name && email && phone) {
      await registerUser(name, email, phone);
    }
  });

  // Formulaire de connexion admin
  document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();
    if (email && password) {
      try {
        await window.adminLogin(email, password);
        isAdmin = true;
        document.getElementById("adminLoginModal").classList.remove("active");
        document.getElementById("adminBtn").style.display = "block";
        // Charger les données admin
        updateActiveUsersList();
        updateOrdersList();
        updateProductsList();
        updateStats();
      } catch (error) {
        alert("Erreur de connexion admin: " + error.message);
      }
    }
  });

  document.getElementById("shareBtn").addEventListener("click", shareWebsite);

  document.querySelector(".user-logo").addEventListener("click", showUserProfile);
  document.getElementById("profileBtn").addEventListener("click", showUserProfile);
  
  // Bouton admin
  document.getElementById("adminBtn").addEventListener("click", toggleAdminPanel);

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      currentCategory = this.dataset.category;
      filterByCategory(this.dataset.category);
    });
  });

  document.getElementById("overlay").addEventListener("click", () => {
    closeAllPanels();
  });
  
  // Recherche de produits
  const searchInput = document.getElementById("searchInput");
  const clearSearch = document.getElementById("clearSearch");
  const searchIcon = document.getElementById("searchIcon");
  
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    clearSearch.style.display = searchTerm ? 'block' : 'none';
    applyFilters();
  });
  
  clearSearch.addEventListener("click", () => {
    searchInput.value = '';
    searchTerm = '';
    clearSearch.style.display = 'none';
    applyFilters();
  });
  
  searchIcon.addEventListener("click", () => {
    applyFilters();
  });
  
  // Formulaire d'ajout de produit (admin)
  const addProductForm = document.getElementById("addProductForm");
  if (addProductForm) {
    addProductForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("productName").value;
      const description = document.getElementById("productDescription").value;
      const price = parseFloat(document.getElementById("productPrice").value);
      const originalPrice = parseFloat(document.getElementById("productOriginalPrice").value) || price;
      const category = document.getElementById("productCategory").value;
      const images = document.getElementById("productImages").value.split(',').map(url => url.trim());
      
      try {
        await addDoc(collection(db, "products"), {
          name,
          description,
          price,
          originalPrice,
          category,
          images,
          createdAt: serverTimestamp()
        });
        
        addProductForm.reset();
        alert("Produit ajouté avec succès!");
      } catch (error) {
        console.error("Erreur lors de l'ajout du produit:", error);
        alert("Erreur lors de l'ajout du produit");
      }
    });
  }
}

function setupLightbox() {
  const lightbox = document.getElementById("productLightbox");
  const closeBtn = lightbox.querySelector(".close");
  const prevBtn = lightbox.querySelector(".prev");
  const nextBtn = lightbox.querySelector(".next");
  
  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", () => changeImage(-1));
  nextBtn.addEventListener("click", () => changeImage(1));
  
  window.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

function setupAdminListeners() {
  // Écouteurs pour les onglets admin
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const tabName = this.dataset.tab;
      switchTab(tabName);
    });
  });
}

function checkAdminStatus() {
  // Vérifier si l'utilisateur est admin (à adapter selon votre système d'authentification)
  const adminToken = localStorage.getItem("marcshop-admin-token");
  if (adminToken) {
    isAdmin = true;
    document.getElementById("adminBtn").style.display = "block";
  }
}

function updateUserActivity() {
  if (currentUser) {
    // Mettre à jour le timestamp de dernière activité
    const userRef = doc(db, "users", currentUser.id);
    updateDoc(userRef, {
      lastActivity: serverTimestamp(),
      isActive: true
    }).catch(error => {
      console.error("Erreur mise à jour activité:", error);
    });
  }
}

function updateActiveUsersList() {
  const usersList = document.getElementById("activeUsersList");
  if (!usersList) return;
  
  // Trier les utilisateurs par dernière activité (les plus récents en premier)
  const activeUsers = users
    .filter(user => user.isActive)
    .sort((a, b) => {
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return b.lastActivity.toDate() - a.lastActivity.toDate();
    });
  
  usersList.innerHTML = activeUsers.map(user => `
    <div class="admin-item">
      <div class="admin-item-header">
        <strong>${user.name}</strong>
        <span>${user.lastActivity ? timeAgo(user.lastActivity.toDate()) : 'Inconnu'}</span>
      </div>
      <div class="admin-item-details">
        <div>Email: ${user.email}</div>
        <div>Téléphone: ${user.phone}</div>
        <div>Inscrit le: ${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Inconnu'}</div>
      </div>
    </div>
  `).join("");
}

function updateOrdersList() {
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;
  
  // Trier les commandes par date (les plus récentes en premier)
  const sortedOrders = [...orders].sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toDate() - a.createdAt.toDate();
  });
  
  ordersList.innerHTML = sortedOrders.map(order => `
    <div class="admin-item">
      <div class="admin-item-header">
        <strong>Commande #${order.id.slice(-6)}</strong>
        <span class="status-${order.status}">${getStatusText(order.status)}</span>
      </div>
      <div class="admin-item-details">
        <div>Client: ${order.customerName} (${order.customerEmail})</div>
        <div>Total: $${order.total.toFixed(2)}</div>
        <div>Date: ${order.createdAt ? order.createdAt.toDate().toLocaleDateString() : 'Inconnue'}</div>
        ${order.shippingAddress ? `
          <div>Adresse: ${order.shippingAddress.street}, ${order.shippingAddress.city} ${order.shippingAddress.postalCode}</div>
        ` : ''}
      </div>
      <div class="order-items">
        <h5>Articles:</h5>
        ${order.items.map(item => `
          <div class="order-item">
            <img src="${item.image}" alt="${item.name}" width="40">
            <div>
              <div>${item.name}</div>
              <div>Taille: ${item.size}, Couleur: ${item.color}, Quantité: ${item.quantity}</div>
              <div>Prix: $${item.price.toFixed(2)} each</div>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="admin-item-actions">
        <select onchange="updateOrderStatus('${order.id}', this.value)">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>En attente</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmée</option>
          <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Expédiée</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Livrée</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
        </select>
        <button onclick="deleteOrder('${order.id}')" class="delete-btn">Supprimer</button>
      </div>
    </div>
  `).join("");
}

function updateProductsList() {
  const productsList = document.getElementById("productsList");
  if (!productsList) return;
  
  productsList.innerHTML = allProducts.map(product => `
    <div class="admin-item">
      <div class="admin-item-header">
        <strong>${product.name}</strong>
        <span>$${product.price.toFixed(2)}</span>
      </div>
      <div class="admin-item-details">
        <div>Catégorie: ${product.category}</div>
        <div>Créé le: ${product.createdAt ? product.createdAt.toDate().toLocaleDateString() : 'Inconnu'}</div>
      </div>
      <div class="admin-item-actions">
        <button onclick="editProduct('${product.id}')">Modifier</button>
        <button onclick="deleteProduct('${product.id}')" class="delete-btn">Supprimer</button>
      </div>
    </div>
  `).join("");
}

function updateStats() {
  // Mettre à jour les statistiques
  document.getElementById("totalUsers").textContent = users.length;
  document.getElementById("totalOrders").textContent = orders.length;
  
  // Calculer le nombre total de produits soldés
  const totalProductsSold = orders.reduce((total, order) => {
    return total + order.items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0);
  document.getElementById("totalProductsSold").textContent = totalProductsSold;
  
  // Calculer le revenu total
  const totalRevenue = orders.reduce((total, order) => total + order.total, 0);
  document.getElementById("totalRevenue").textContent = `$${totalRevenue.toFixed(2)}`;
}

function timeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return "à l'instant";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `il y a ${diffInMonths} mois`;
}

function getStatusText(status) {
  const statusTexts = {
    'pending': 'En attente',
    'confirmed': 'Confirmée',
    'shipped': 'Expédiée',
    'delivered': 'Livrée',
    'cancelled': 'Annulée'
  };
  return statusTexts[status] || status;
}

window.updateOrderStatus = async function(orderId, status) {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    console.error("Erreur mise à jour statut:", error);
    alert("Erreur lors de la mise à jour du statut");
  }
};

window.deleteOrder = async function(orderId) {
  if (confirm("Êtes-vous sûr de vouloir supprimer cette commande?")) {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error("Erreur suppression commande:", error);
      alert("Erreur lors de la suppression de la commande");
    }
  }
};

window.editProduct = function(productId) {
  // Implémenter l'édition de produit
  alert("Fonction d'édition à implémenter pour le produit: " + productId);
};

window.deleteProduct = async function(productId) {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce produit?")) {
    try {
      await deleteDoc(doc(db, "products", productId));
    } catch (error) {
      console.error("Erreur suppression produit:", error);
      alert("Erreur lors de la suppression du produit");
    }
  }
};

window.openLightbox = openLightbox;
function openLightbox(productId, imgIndex = 0) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.images || product.images.length === 0) return;
  currentProductImages = product.images;
  currentImageIndex = imgIndex;
  const lightboxImg = document.getElementById("lightboxImage");
  const descriptionDiv = document.getElementById("lightboxDescription");
  
  lightboxImg.src = currentProductImages[currentImageIndex];
  
  // Afficher la description du produit si elle existe
  if (product.description) {
    descriptionDiv.innerHTML = `
      <h3>${product.name}</h3>
      <p>${product.description}</p>
    `;
    descriptionDiv.style.display = 'block';
  } else {
    descriptionDiv.style.display = 'none';
  }
  
  document.getElementById("productLightbox").style.display = "block";
  document.getElementById("overlay").classList.add("active");
}

function closeLightbox() {
  document.getElementById("productLightbox").style.display = "none";
  document.getElementById("overlay").classList.remove("active");
}

function changeImage(direction) {
  currentImageIndex += direction;
  if (currentImageIndex < 0) {
    currentImageIndex = currentProductImages.length - 1;
  } else if (currentImageIndex >= currentProductImages.length) {
    currentImageIndex = 0;
  }
  const lightboxImg = document.getElementById("lightboxImage");
  lightboxImg.src = currentProductImages[currentImageIndex];
}

async function registerUser(name, email, phone) {
  const newUser = {
    name: name,
    email: email,
    phone: phone,
    registeredAt: new Date().toISOString(),
    isActive: true,
    lastActivity: new Date().toISOString(),
  };
  try {
    const ref = await addDoc(collection(db, "users"), newUser);
    newUser.id = ref.id;
    currentUser = newUser;
    saveCart();
    displayUserName();
    document.getElementById("registrationModal").classList.remove("active");
  } catch (e) {
    alert("Erreur lors de l'inscription. Réessayez.");
    console.error(e);
  }
}

function displayUserName() {
  const name = currentUser && currentUser.name ? currentUser.name : "MarcShop";
  document.getElementById("userNameDisplay").textContent = name;
}

function showUserProfile() {
  if (!currentUser) return;
  alert(`Bienvenue ${currentUser.name}\nEmail : ${currentUser.email}\nTéléphone : ${currentUser.phone}`);
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="no-products">
        <h3>Aucun produit trouvé</h3>
        <p>Aucun produit ne correspond à votre recherche.</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filteredProducts.map(product => {
    const discount = product.originalPrice > 0 ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const rating = 4.0 + Math.random() * 1.0;
    const reviews = Math.floor(Math.random() * 1000) + 100;
    const firstImage = product.images[0] || "https://via.placeholder.com/200?text=Image+Manquante";
    return `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image" onclick="openLightbox('${product.id}')">
          <img src="${firstImage}" alt="${product.name}" class="product-img">
          <div class="product-badge">NOUVEAU</div>
          ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
        </div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-rating">
            <span class="stars">${"★".repeat(Math.floor(rating))}${"☆".repeat(5 - Math.floor(rating))}</span>
            <span>(${reviews})</span>
          </div>
          <div class="product-price">
            <span class="current-price">$${product.price.toFixed(2)}</span>
            ${product.originalPrice > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
          </div>
          <button class="add-to-cart" onclick="addToCart('${product.id}'); event.stopPropagation()">
            <i class="fas fa-shopping-cart"></i> Ajouter
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.addToCart = function(productId) {
  if (isAddingToCart) return;
  
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  
  isAddingToCart = true;
  openProductOptions(product);
};

function openProductOptions(product) {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("active");
  
  // Déterminer les options de taille en fonction de la catégorie
  const category = product.category || 'default';
  const sizeOptions = SIZE_OPTIONS[category] || SIZE_OPTIONS.default;
  
  // Déterminer le label en fonction de la catégorie
  let sizeLabel = 'Taille/Modèle';
  if (category === 'hair') {
    sizeLabel = 'Longueur (pouces)';
  } else if (category === 'shoes') {
    sizeLabel = 'Pointure';
  } else if (category === 'beauty') {
    sizeLabel = 'Volume';
  }
  
  let modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <h3>Ajouter au panier</h3>
      <img src="${product.images[0]}" style="max-width:120px;max-height:120px;border-radius:6px;">
      <p><strong>${product.name}</strong></p>
      <form id="optionsForm">
        <label for="cartSize">${sizeLabel} :</label>
        <select id="cartSize" name="size" required>
          <option value="">Sélectionner</option>
          ${sizeOptions.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <label for="cartColor" style="margin-top:1rem;">Couleur :</label>
        <select id="cartColor" name="color" required>
          <option value="">Sélectionner</option>
          ${COLORS.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
        <label for="cartQty" style="margin-top:1rem;">Quantité :</label>
        <input type="number" id="cartQty" name="qty" min="1" value="1" style="width:60px;">
        <button type="submit" id="submitOptions" style="margin-top:1rem;background:#10b981;color:white;">Ajouter au panier</button>
        <button type="button" id="closeOptions" style="margin-top:0.5rem;">Annuler</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById("closeOptions").onclick = () => {
    modal.remove(); 
    overlay.classList.remove("active");
    isAddingToCart = false;
  };
  
  document.getElementById("optionsForm").onsubmit = function(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById("submitOptions");
    submitBtn.disabled = true;
    
    // Récupération correcte des valeurs
    const size = form.elements.size.value;
    const color = form.elements.color.value;
    const qty = parseInt(form.elements.qty.value) || 1;
    
    addProductToCart(product, size, color, qty);
    
    modal.remove();
    overlay.classList.remove("active");
    isAddingToCart = false;
  };
}

function addProductToCart(product, size, color, quantity) {
  const key = `${product.id}-${size}-${color}`;
  let existing = cart.find((item) => item.key === key);
  
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity,
      size,
      color,
      category: product.category
    });
  }
  
  saveCart();
  
  // Enregistrer l'action dans Firestore (pour l'admin)
  if (currentUser) {
    addDoc(collection(db, "cartActions"), {
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      productId: product.id,
      productName: product.name,
      action: "add",
      size,
      color,
      quantity,
      timestamp: serverTimestamp()
    });
  }
  
  // Affiche une confirmation d'ajout
  showCartNotification(`${product.name} ajouté au panier!`);
}

function showCartNotification(message) {
  const notification = document.createElement("div");
  notification.className = "cart-notification";
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Animation d'apparition
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);
  
  // Disparition après 2 secondes
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

function updateCartUI() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = totalItems;
  cartTotal.textContent = totalPrice.toFixed(2);

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-cart"></i>
        <p>Votre panier est vide</p>
      </div>
    `;
    const paypalDiv = document.getElementById("paypal-button-container");
    if (paypalDiv) paypalDiv.innerHTML = '';
  } else {
    cartItems.innerHTML = cart.map(item => {
      // Déterminer le label de taille en fonction de la catégorie
      let sizeLabel = 'Taille/Modèle';
      if (item.category === 'hair') {
        sizeLabel = 'Longueur';
      } else if (item.category === 'shoes') {
        sizeLabel = 'Pointure';
      } else if (item.category === 'beauty') {
        sizeLabel = 'Volume';
      }
      
      return `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div style="font-size:0.9em;color:#666;">
              ${item.size ? `${sizeLabel}: <b>${item.size}</b>, ` : ''}
              Couleur: <b>${item.color}</b>
            </div>
            <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            <div class="quantity-controls">
              <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity - 1})">-</button>
              <span>${item.quantity}</span>
              <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity + 1})">+</button>
              <button class="quantity-btn" onclick="removeFromCart('${item.key}')" style="margin-left: 1rem; color: #ef4444;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
    
    // Gestion PayPal améliorée
    setTimeout(() => {
      if (totalPrice > 0) {
        renderPaypalButton(totalPrice);
      }
    }, 300);
  }
}

window.updateQuantity = function(key, newQuantity) {
  let item = cart.find((i) => i.key === key);
  if (!item) return;
  if (newQuantity <= 0) {
    cart = cart.filter((i) => i.key !== key);
  } else {
    item.quantity = newQuantity;
  }
  saveCart();
};

window.removeFromCart = function(key) {
  const item = cart.find((i) => i.key === key);
  cart = cart.filter((i) => i.key !== key);
  saveCart();
  
  // Enregistrer l'action dans Firestore (pour l'admin)
  if (currentUser && item) {
    addDoc(collection(db, "cartActions"), {
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      productId: item.id,
      productName: item.name,
      action: "remove",
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      timestamp: serverTimestamp()
    });
  }
};

function renderPaypalButton(totalPrice) {
  if (!window.paypal) {
    console.warn("PayPal SDK non chargé");
    return;
  }
  
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  
  // Réinitialiser complètement le conteneur
  container.innerHTML = "";
  
  // Vérifier que le montant est valide
  if (typeof totalPrice !== 'number' || totalPrice <= 0) {
    console.error("Montant PayPal invalide:", totalPrice);
    return;
  }

  try {
    window.paypal.Buttons({
      style: { 
        layout: 'vertical', 
        color: 'gold', 
        shape: 'rect', 
        label: 'paypal' 
      },
      createOrder: function(data, actions) {
        return actions.order.create({
          purchase_units: [{
            amount: { 
              value: totalPrice.toFixed(2),
              currency_code: "USD"
            }
          }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(async function(details) {
          // Enregistrer la commande dans Firestore
          try {
            const orderData = {
              customerId: currentUser.id,
              customerName: currentUser.name,
              customerEmail: currentUser.email,
              customerPhone: currentUser.phone,
              items: cart,
              total: totalPrice,
              status: 'pending',
              paymentId: data.orderID,
              paymentDetails: details,
              createdAt: serverTimestamp(),
              shippingAddress: {
                street: details.payer.address.address_line_1,
                city: details.payer.address.admin_area_2,
                state: details.payer.address.admin_area_1,
                postalCode: details.payer.address.postal_code,
                country: details.payer.address.country_code
              }
            };
            
            await addDoc(collection(db, "orders"), orderData);
            
            alert('Paiement réussi, merci ' + details.payer.name.given_name + ' !');
            cart = [];
            saveCart();
          } catch (error) {
            console.error("Erreur enregistrement commande:", error);
            alert("Paiement réussi mais erreur d'enregistrement de la commande");
          }
        });
      },
      onError: function(err) {
        console.error("Erreur PayPal:", err);
        // Réessayer après un délai
        setTimeout(() => renderPaypalButton(totalPrice), 1000);
      },
      onCancel: function(data) {
        console.log("Paiement annulé");
      }
    }).render('#paypal-button-container');
  } catch (e) {
    console.error("Erreur initialisation PayPal:", e);
  }
}

function applyFilters() {
  // Filtrer d'abord par catégorie
  if (currentCategory === 'all') {
    filteredProducts = [...products];
  } else {
    filteredProducts = products.filter(product => product.category === currentCategory);
  }
  
  // Puis filtrer par terme de recherche
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      (product.description && product.description.toLowerCase().includes(searchTerm))
    );
  }
  
  renderProducts();
}

function filterByCategory(category) {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-category="${category}"]`).classList.add("active");
  applyFilters();
}

function toggleCart() {
  const sidebar = document.getElementById("cartSidebar");
  const overlay = document.getElementById("overlay");
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

function closeAllPanels() {
  document.getElementById("cartSidebar").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
  closeLightbox();
  toggleAdminPanel(false);
}

function toggleAdminPanel(show) {
  if (show === false) {
    document.getElementById("adminPanel").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
    return;
  }
  
  if (!isAdmin) {
    document.getElementById("adminLoginModal").classList.add("active");
    return;
  }
  
  const adminPanel = document.getElementById("adminPanel");
  const overlay = document.getElementById("overlay");
  adminPanel.classList.toggle("active");
  overlay.classList.toggle("active");
  
  if (adminPanel.classList.contains("active")) {
    // Charger les données admin
    updateActiveUsersList();
    updateOrdersList();
    updateProductsList();
    updateStats();
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`${tabName}Tab`).classList.add("active");
}

function shareWebsite() {
  const url = window.location.href;
  const text = "Découvrez MarcShop - La meilleure boutique en ligne pour tous vos besoins!";
  if (navigator.share) {
    navigator.share({ title: "MarcShop", text: text, url: url });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert("Lien copié dans le presse-papiers!");
    });
  }
}
