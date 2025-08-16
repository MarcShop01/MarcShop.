// État global de l'application
let currentUser = null;
let products = [];
let cart = [];
let users = [];
let currentProductImages = [];
let currentImageIndex = 0;

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  checkUserRegistration();
  setupEventListeners();
  renderProducts();
  updateCartUI();
  setupLightbox();
  setupAdminListeners();
});

// Gestion des données localStorage
function loadData() {
  try {
    products = JSON.parse(localStorage.getItem("marcshop-products")) || [];
    cart = JSON.parse(localStorage.getItem("marcshop-cart")) || [];
    users = JSON.parse(localStorage.getItem("marcshop-users")) || [];
    currentUser = JSON.parse(localStorage.getItem("marcshop-current-user"));
    
    // Correction pour les anciens produits sans createdAt
    products = products.map(p => {
      if (!p.createdAt) {
        p.createdAt = new Date().toISOString();
      }
      return p;
    });
    
  } catch (e) {
    console.error("Erreur de chargement des données:", e);
    products = [];
    cart = [];
    users = [];
  }
}

function saveData() {
  localStorage.setItem("marcshop-products", JSON.stringify(products));
  localStorage.setItem("marcshop-cart", JSON.stringify(cart));
  localStorage.setItem("marcshop-users", JSON.stringify(users));
  if (currentUser) {
    localStorage.setItem("marcshop-current-user", JSON.stringify(currentUser));
  }
}

// Vérification inscription utilisateur
function checkUserRegistration() {
  if (!currentUser) {
    setTimeout(() => {
      document.getElementById("registrationModal").classList.add("active");
    }, 1000);
  }
}

// Configuration des événements
function setupEventListeners() {
  // Formulaire d'inscription
  document.getElementById("registrationForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("userName").value.trim();
    const email = document.getElementById("userEmail").value.trim();

    if (name && email) {
      registerUser(name, email);
    }
  });

  // Filtres de catégories
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      filterByCategory(this.dataset.category);
    });
  });

  // Overlay
  document.getElementById("overlay").addEventListener("click", () => {
    closeAllPanels();
  });
}

// Configuration de la lightbox
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

// Configuration des écouteurs admin
function setupAdminListeners() {
  // Formulaire d'ajout de produit
  const productForm = document.getElementById("productForm");
  if (productForm) {
    productForm.addEventListener("submit", function(e) {
      e.preventDefault();
      addProduct();
    });
  }
  
  // Bouton d'administration
  const adminBtn = document.querySelector(".admin-btn");
  if (adminBtn) {
    adminBtn.addEventListener("click", toggleAdmin);
  }
  
  // Tabs admin
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      switchTab(this.dataset.tab);
    });
  });
}

// Fonctions pour la lightbox
function openLightbox(productId, imgIndex = 0) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.images || product.images.length === 0) return;
  
  currentProductImages = product.images;
  currentImageIndex = imgIndex;
  
  const lightboxImg = document.getElementById("lightboxImage");
  lightboxImg.src = currentProductImages[currentImageIndex];
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

// Inscription utilisateur
function registerUser(name, email) {
  const newUser = {
    id: Date.now(),
    name: name,
    email: email,
    registeredAt: new Date().toISOString(),
    isActive: true,
    lastActivity: new Date().toISOString(),
  };

  users.push(newUser);
  currentUser = newUser;
  saveData();

  document.getElementById("registrationModal").classList.remove("active");
}

// Gestion des produits
function addProduct() {
  const name = document.getElementById("productName").value;
  const price = parseFloat(document.getElementById("productPrice").value);
  const originalPrice = parseFloat(document.getElementById("productOriginalPrice").value);
  const image1 = document.getElementById("productImage1").value;
  const image2 = document.getElementById("productImage2").value;
  const image3 = document.getElementById("productImage3").value;
  const image4 = document.getElementById("productImage4").value;
  const category = document.getElementById("productCategory").value;
  const description = document.getElementById("productDescription").value;

  // Validation des champs obligatoires
  if (!name || isNaN(price) || isNaN(originalPrice) || !image1 || !category) {
    alert("Veuillez remplir tous les champs obligatoires (*)");
    return;
  }

  const images = [image1];
  if (image2) images.push(image2);
  if (image3) images.push(image3);
  if (image4) images.push(image4);

  const newProduct = {
    id: Date.now(),
    name: name,
    price: price,
    originalPrice: originalPrice,
    images: images,
    category: category,
    description: description,
    stock: 100,
    status: "active",
    createdAt: new Date().toISOString() // Ajout de la date de création
  };

  products.push(newProduct);
  saveData();
  renderProducts();
  document.getElementById("productForm").reset();
  alert("Produit ajouté avec succès!");
}

function deleteProduct(id) {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce produit?")) {
    products = products.filter((p) => p.id !== id);
    saveData();
    renderProducts();
  }
}

// Affichage des produits (CORRIGÉ)
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  
  // Trier les produits par date de création (les plus récents en premier)
  const sortedProducts = [...products].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  if (sortedProducts.length === 0) {
    grid.innerHTML = `
      <div class="no-products">
        <h3>Aucun produit disponible</h3>
        <p>Les produits seront affichés ici une fois ajoutés par l'administrateur.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = sortedProducts.map(product => {
    const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    const rating = 4.0 + Math.random() * 1.0;
    const reviews = Math.floor(Math.random() * 1000) + 100;
    
    const firstImage = product.images[0] || "https://via.placeholder.com/200?text=Image+Manquante";
    
    return `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image" onclick="openLightbox(${product.id})">
          <img src="${firstImage}" alt="${product.name}" class="product-img">
          <div class="product-badge">NOUVEAU</div>
          <div class="discount-badge">-${discount}%</div>
        </div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-rating">
            <span class="stars">${"★".repeat(Math.floor(rating))}${"☆".repeat(5 - Math.floor(rating))}</span>
            <span>(${reviews})</span>
          </div>
          <div class="product-price">
            <span class="current-price">$${product.price.toFixed(2)}</span>
            <span class="original-price">$${product.originalPrice.toFixed(2)}</span>
          </div>
          <button class="add-to-cart" onclick="addToCart(${product.id}); event.stopPropagation()">
            <i class="fas fa-shopping-cart"></i> Ajouter
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Filtrage par catégorie
function filterByCategory(category) {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-category="${category}"]`).classList.add("active");

  const productCards = document.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    if (category === "all" || card.dataset.category === category) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// Gestion du panier
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const existingItem = cart.find((item) => item.id === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity: 1,
    });
  }

  saveData();
  updateCartUI();

  // Animation d'ajout
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> Ajouté!';
  btn.style.background = "#059669";
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.style.background = "#10b981";
  }, 1000);
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  saveData();
  updateCartUI();
}

function updateQuantity(productId, newQuantity) {
  if (newQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const item = cart.find((item) => item.id === productId);
  if (item) {
    item.quantity = newQuantity;
    saveData();
    updateCartUI();
  }
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
  } else {
    cartItems.innerHTML = cart
      .map(
        (item) => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        <button class="quantity-btn" onclick="removeFromCart(${item.id})" style="margin-left: 1rem; color: #ef4444;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }
}

// Interface utilisateur
function toggleCart() {
  const sidebar = document.getElementById("cartSidebar");
  const overlay = document.getElementById("overlay");

  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

function toggleAdmin() {
  const panel = document.getElementById("adminPanel");
  const overlay = document.getElementById("overlay");

  panel.classList.toggle("active");
  overlay.classList.toggle("active");
}

function closeAllPanels() {
  document.getElementById("cartSidebar").classList.remove("active");
  document.getElementById("adminPanel").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
  closeLightbox();
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`${tabName}Tab`).classList.add("active");
}

// Fonctionnalités supplémentaires
function shareWebsite() {
  const url = window.location.href;
  const text = "Découvrez MarcShop - La meilleure boutique en ligne pour tous vos besoins!";

  if (navigator.share) {
    navigator.share({
      title: "MarcShop",
      text: text,
      url: url,
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert("Lien copié dans le presse-papiers!");
    });
  }
}

function checkout() {
  if (cart.length === 0) {
    alert("Votre panier est vide!");
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  alert(
    `Commande confirmée!\n${itemCount} article(s) pour un total de $${total.toFixed(2)}\n\nMerci pour votre achat sur MarcShop!`
  );

  // Vider le panier
  cart = [];
  saveData();
  updateCartUI();
  closeAllPanels();
}
