import { collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const db = window.firebaseDB;

let currentUser = null;
let products = [];
let cart = [];
let users = [];
let currentProductImages = [];
let currentImageIndex = 0;

const SIZES = ["XS", "S", "M", "L", "XL"];
const COLORS = ["Blanc", "Noir", "Rouge", "Bleu", "Vert", "Jaune"];

document.addEventListener("DOMContentLoaded", () => {
  loadFirestoreProducts();
  loadFirestoreUsers();
  loadCart();
  checkUserRegistration();
  setupEventListeners();
  setupLightbox();
  setupAdminListeners();
  window.toggleCart = toggleCart;
  // window.toggleAdmin = toggleAdmin; // admin retiré
});

function loadFirestoreProducts() {
  const productsCol = collection(db, "products");
  onSnapshot(productsCol, (snapshot) => {
    products = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    renderProducts();
  });
}

function loadFirestoreUsers() {
  const usersCol = collection(db, "users");
  onSnapshot(usersCol, (snapshot) => {
    users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    // Optionnel : admin
    // renderUsersAdmin();
    // updateAdminStats();
  });
}

function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem("marcshop-cart")) || [];
    currentUser = JSON.parse(localStorage.getItem("marcshop-current-user"));
  } catch (e) {
    cart = [];
  }
}

function saveCart() {
  localStorage.setItem("marcshop-cart", JSON.stringify(cart));
  if (currentUser) {
    localStorage.setItem("marcshop-current-user", JSON.stringify(currentUser));
  }
}

function checkUserRegistration() {
  if (!currentUser) {
    setTimeout(() => {
      document.getElementById("registrationModal").classList.add("active");
    }, 1000);
  } else {
    displayUserName();
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

  // Sur le logo ou le bouton user, affiche le nom inscrit
  document.querySelector(".user-logo").addEventListener("click", showUserProfile);
  document.getElementById("profileBtn").addEventListener("click", showUserProfile);

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      filterByCategory(this.dataset.category);
    });
  });

  document.getElementById("overlay").addEventListener("click", () => {
    closeAllPanels();
  });
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
  // Retiré - plus de bouton admin
}

window.openLightbox = openLightbox;
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
    const discount = product.originalPrice > 0 ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const rating = 4.0 + Math.random() * 1.0;
    const reviews = Math.floor(Math.random() * 1000) + 100;
    const firstImage = product.images[0] || "https://via.placeholder.com/200?text=Image+Manquante";
    return `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image" onclick="openLightbox('${product.id}')">
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
          <button class="add-to-cart" onclick="addToCart('${product.id}'); event.stopPropagation()">
            <i class="fas fa-shopping-cart"></i> Ajouter
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.addToCart = function(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  openProductOptions(product);
};

function openProductOptions(product) {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("active");
  let modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <h3>Ajouter au panier</h3>
      <img src="${product.images[0]}" style="max-width:120px;max-height:120px;border-radius:6px;">
      <p><strong>${product.name}</strong></p>
      <form id="optionsForm">
        <label for="cartSize">Taille :</label>
        <select id="cartSize" required>
          <option value="">Sélectionner</option>
          ${SIZES.map(s=>`<option value="${s}">${s}</option>`).join("")}
        </select>
        <label for="cartColor" style="margin-top:1rem;">Couleur :</label>
        <select id="cartColor" required>
          <option value="">Sélectionner</option>
          ${COLORS.map(c=>`<option value="${c}">${c}</option>`).join("")}
        </select>
        <label for="cartQty" style="margin-top:1rem;">Quantité :</label>
        <input type="number" id="cartQty" min="1" value="1" style="width:60px;">
        <button type="submit" style="margin-top:1rem;background:#10b981;color:white;">Ajouter au panier</button>
        <button type="button" id="closeOptions" style="margin-top:0.5rem;">Annuler</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("closeOptions").onclick = () => {modal.remove(); overlay.classList.remove("active");};
  document.getElementById("optionsForm").onsubmit = function(e) {
    e.preventDefault();
    const size = document.getElementById("cartSize").value;
    const color = document.getElementById("cartColor").value;
    const qty = parseInt(document.getElementById("cartQty").value)||1;
    addProductToCart(product, size, color, qty);
    modal.remove();
    overlay.classList.remove("active");
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
  updateCartUI();
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
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size:0.9em;color:#666;">Taille: <b>${item.size}</b>, Couleur: <b>${item.color}</b></div>
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
    `).join("");
    renderPaypalButton(totalPrice);
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
  updateCartUI();
};
window.removeFromCart = function(key) {
  cart = cart.filter((i) => i.key !== key);
  saveCart();
  updateCartUI();
};

function renderPaypalButton(totalPrice) {
  if (!window.paypal) return;
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  container.innerHTML = "";
  window.paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: totalPrice.toFixed(2) }
        }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        alert('Paiement réussi, merci ' + details.payer.name.given_name + ' !');
        cart = [];
        saveCart();
        updateCartUI();
      });
    },
    onError: function(err) {
      alert("Une erreur est survenue avec PayPal.");
      console.log(err);
    }
  }).render('#paypal-button-container');
}

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
