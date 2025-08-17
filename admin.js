import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const db = window.firebaseDB; // défini dans admin.html

const ADMIN_PASSWORD = "marcshop2024";
let products = [];
let users = [];
let isLoggedIn = false;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkAdminSession();
  listenProducts();
  listenUsers();
});

function listenProducts() {
  onSnapshot(collection(db, "products"), (snapshot) => {
    products = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    renderProductsList();
    updateStats();
  });
}
function listenUsers() {
  onSnapshot(collection(db, "users"), (snapshot) => {
    users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    renderUsersList();
    updateStats();
  });
}

function setupEventListeners() {
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    login();
  });
  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addProduct();
  });
}

function checkAdminSession() {
  const adminSession = localStorage.getItem("marcshop-admin-session");
  if (adminSession) {
    const sessionData = JSON.parse(adminSession);
    const now = new Date().getTime();
    if (now - sessionData.timestamp < 24 * 60 * 60 * 1000) {
      showDashboard();
      return;
    }
  }
  showLogin();
}

function login() {
  const password = document.getElementById("adminPassword").value;
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem("marcshop-admin-session", JSON.stringify({
      timestamp: new Date().getTime(),
      isAdmin: true,
    }));
    showDashboard();
  } else {
    alert("Mot de passe incorrect!");
    document.getElementById("adminPassword").value = "";
  }
}
function logout() {
  localStorage.removeItem("marcshop-admin-session");
  showLogin();
}
function showLogin() {
  document.getElementById("adminLogin").style.display = "flex";
  document.getElementById("adminDashboard").style.display = "none";
  isLoggedIn = false;
}
function showDashboard() {
  document.getElementById("adminLogin").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";
  isLoggedIn = true;
  updateStats();
  renderProductsList();
  renderUsersList();
}
window.showSection = function(sectionName) {
  document.querySelectorAll(".sidebar-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".admin-section").forEach((section) => section.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById(sectionName + "Section").classList.add("active");
  if (sectionName === "dashboard") updateStats();
  if (sectionName === "products") renderProductsList();
  if (sectionName === "users") renderUsersList();
}

async function addProduct() {
  const name = document.getElementById("productName").value;
  const price = Number.parseFloat(document.getElementById("productPrice").value);
  const originalPrice = Number.parseFloat(document.getElementById("productOriginalPrice").value);
  const category = document.getElementById("productCategory").value;
  const description = document.getElementById("productDescription").value;
  const images = [
    document.getElementById("productImage1").value,
    document.getElementById("productImage2").value,
    document.getElementById("productImage3").value,
    document.getElementById("productImage4").value,
  ].filter((img) => img.trim() !== "");
  const newProduct = {
    name, price, originalPrice, images, category, description,
    stock: 100,
    status: "active",
    createdAt: new Date().toISOString()
  };
  try {
    await addDoc(collection(db, "products"), newProduct);
    document.getElementById("productForm").reset();
    alert("Produit ajouté avec succès!");
  } catch (e) {
    alert("Erreur lors de l'ajout: " + e.message);
  }
}

window.deleteProduct = async function(id) {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce produit?")) {
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (e) {
      alert("Erreur suppression: " + e.message);
    }
  }
};

function renderProductsList() {
  const productsList = document.getElementById("productsList");
  if (!products || products.length === 0) {
    productsList.innerHTML = "<p>Aucun produit ajouté.</p>";
    return;
  }
  const sortedProducts = [...products].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  productsList.innerHTML = `
        <h3>Produits existants (${sortedProducts.length})</h3>
        <div style="display: grid; gap: 1rem;">
            ${sortedProducts
              .map(
                (product) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; background: white;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${product.images[0] || 'https://via.placeholder.com/60x60?text=Image+Manquante'}" alt="${product.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 0.375rem;">
                        <div>
                            <strong>${product.name}</strong><br>
                            <span style="color: #10b981; font-weight: bold;">$${product.price.toFixed(2)}</span>
                            <span style="color: #6b7280; text-decoration: line-through; margin-left: 0.5rem;">$${product.originalPrice.toFixed(2)}</span><br>
                            <span style="color: #6b7280; font-size: 0.875rem;">${product.category}</span>
                        </div>
                    </div>
                    <button onclick="deleteProduct('${product.id}')" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </div>
            `
              )
              .join("")}
        </div>
    `;
}

function renderUsersList() {
  const usersList = document.getElementById("usersList");
  if (!users || users.length === 0) {
    usersList.innerHTML = "<p>Aucun utilisateur inscrit.</p>";
    return;
  }
  usersList.innerHTML = `
        <h3>Utilisateurs inscrits (${users.length})</h3>
        <div style="display: grid; gap: 1rem;">
            ${users
              .map((user) => {
                const isActive = isUserActive(user);
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; background: white;">
                        <div>
                            <strong>${user.name}</strong><br>
                            <span style="color: #6b7280;">${user.email}</span><br>
                            <small>Inscrit le: ${new Date(user.registeredAt).toLocaleDateString()}</small>
                        </div>
                        <div style="text-align: right;">
                            <span style="background: ${isActive ? "#10b981" : "#6b7280"}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">
                                ${isActive ? "Actif" : "Inactif"}
                            </span>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;
}

function isUserActive(user) {
  if (!user.lastActivity) return false;
  const lastActivity = new Date(user.lastActivity);
  const now = new Date();
  const diffHours = (now - lastActivity) / (1000 * 60 * 60);
  return diffHours < 24;
}

function updateStats() {
  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("totalUsers").textContent = users.length;
  document.getElementById("activeUsers").textContent = users.filter(isUserActive).length;
}
