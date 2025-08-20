import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const db = window.firebaseDB;

let currentUser = null;
let products = [];
let allProducts = [];
let filteredProducts = [];
let cart = [];
let users = [];
let currentProductImages = [];
let currentImageIndex = 0;
let isAddingToCart = false;
let searchTerm = '';
let currentCategory = 'all';

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
  loadCart();
  checkUserRegistration();
  setupEventListeners();
  setupLightbox();
  window.toggleCart = toggleCart;
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
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function loadFirestoreUsers() {
  const usersCol = collection(db, "users");
  onSnapshot(usersCol, (snapshot) => {
    users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  });
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

  document.getElementById("shareBtn").addEventListener("click", shareWebsite);

  document.querySelector(".user-logo").addEventListener("click", showUserProfile);
  document.getElementById("profileBtn").addEventListener("click", showUserProfile);

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
}

function setupLightbox() {
  const lightbox = document.getElementById("productLightbox");
  const closeBtn = lightbox.querySelector(".close");
  const prevBtn = lightbox.querySelector(".prev");
  const nextBtn = lightbox.querySelector(".next");
  
  window.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

window.openLightbox = function(productId, imgIndex = 0) {
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
};

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
        <label for="cartSize">${极速加速器izeLabel} :</label>
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
        <input type="number" id="cartQ极速加速器" name="qty" min="1" value="1" style="width:60px;">
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
      color
    });
  }
  
  saveCart();
  
  // Enregistrer l'action dans Firestore pour l'admin
  if (currentUser) {
    addDoc(collection(db, "cartActivities"), {
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      action: "add",
      productId: product.id,
      productName: product.name,
      size: size,
      color: color,
      quantity: quantity,
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
  const totalPrice = cart.reduce((sum, item)极速加速器 sum + item.price * item.quantity, 0);

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
  
  // Enregistrer l'action dans Firestore pour l'admin
  if (currentUser && item) {
    addDoc(collection(db, "cartActivities"), {
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      action: "remove",
      productId: item.id,
      productName: item.name,
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
            
            // Enregistrer l'action de paiement
            await addDoc(collection(db, "cartActivities"), {
              userId: currentUser.id,
              userName: currentUser.name,
              userEmail: currentUser.email,
              action: "purchase",
              items: cart,
              total: totalPrice,
              timestamp: serverTimestamp()
            });
            
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
