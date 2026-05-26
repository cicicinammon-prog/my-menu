const categories = ["主食", "汤羹", "特色菜"];
const storageKeys = {
  cart: "familyOrderCartV4",
  dishes: "familyOrderDishesV3",
  orders: "familyOrdersV1",
  theme: "familyOrderTheme",
};

const defaultDishes = [
  { id: "egg-fried-rice", name: "蛋炒饭", category: "主食", desc: "快手管饱，想加火腿写备注。", image: dishImage("🍚", "#f8d6c4", "#9a3f2b") },
  { id: "scallion-noodles", name: "葱油拌面", category: "主食", desc: "简单快手，适合夜宵。", image: dishImage("🍜", "#ffd8d6", "#bd4537") },
  { id: "rice-roll", name: "糯米饭团", category: "主食", desc: "软糯顶饱，可以提前做好。", image: dishImage("🍙", "#e6e2cc", "#766b45") },
  { id: "beef-noodles", name: "牛肉汤面", category: "主食", desc: "热乎一碗，汤面分开也行。", image: dishImage("🍝", "#f3d7b5", "#8a5132") },
  { id: "pumpkin-congee", name: "南瓜粥", category: "主食", desc: "软糯清甜，早晚都舒服。", image: dishImage("🥣", "#f8d98e", "#a36b2d") },
  { id: "garlic-shrimp", name: "蒜蓉大虾", category: "特色菜", desc: "蒜香足，默认少辣。", image: dishImage("🦐", "#ffe1cf", "#d85c3d") },
  { id: "dry-pot", name: "干锅时蔬", category: "特色菜", desc: "香一点，辣度可以备注。", image: dishImage("🥘", "#f2d2ad", "#7b4b26") },
  { id: "chicken-soup", name: "山药鸡汤", category: "汤羹", desc: "清淡热汤，适合晚餐。", image: dishImage("🍲", "#f5e7c6", "#8b6f3a") },
  { id: "seaweed-soup", name: "紫菜蛋花汤", category: "汤羹", desc: "快手汤，清爽不腻。", image: dishImage("🥣", "#dbeed9", "#426c51") },
];

let activeCategory = categories[0];
let searchTerm = "";
let manageMode = false;
let menuDishes = readJson(storageKeys.dishes, defaultDishes);
let savedOrders = readJson(storageKeys.orders, []);
const cart = new Map(readJson(storageKeys.cart, []));

const menuList = document.querySelector("#menuList");
const categoryTabs = document.querySelector("#categoryTabs");
const categoryTitle = document.querySelector("#categoryTitle");
const searchInput = document.querySelector("#searchInput");
const cartToggle = document.querySelector("#cartToggle");
const cartPanel = document.querySelector("#cartPanel");
const cartCount = document.querySelector("#cartCount");
const cartHint = document.querySelector("#cartHint");
const cartItems = document.querySelector("#cartItems");
const clearCart = document.querySelector("#clearCart");
const placeOrder = document.querySelector("#placeOrder");
const toast = document.querySelector("#toast");
const themeToggle = document.querySelector("#themeToggle");
const dishDialog = document.querySelector("#dishDialog");
const dishForm = document.querySelector("#dishForm");
const dishDialogTitle = document.querySelector("#dishDialogTitle");
const openAddDish = document.querySelector("#openAddDish");
const openAddDish2 = document.querySelector("#openAddDish2");
const closeAddDish = document.querySelector("#closeAddDish");
const toggleManage = document.querySelector("#toggleManage");
const openTodayOrders = document.querySelector("#openTodayOrders");
const dishIdInput = document.querySelector("#dishId");
const dishNameInput = document.querySelector("#dishName");
const dishCategoryInput = document.querySelector("#dishCategory");
const dishDescInput = document.querySelector("#dishDesc");
const dishImageInput = document.querySelector("#dishImage");
const orderDialog = document.querySelector("#orderDialog");
const closeOrder = document.querySelector("#closeOrder");
const backToMenu = document.querySelector("#backToMenu");
const pickupCode = document.querySelector("#pickupCode");
const orderItemCount = document.querySelector("#orderItemCount");
const orderItems = document.querySelector("#orderItems");
const orderNumber = document.querySelector("#orderNumber");
const orderTime = document.querySelector("#orderTime");
const todayOrdersDialog = document.querySelector("#todayOrdersDialog");
const closeTodayOrders = document.querySelector("#closeTodayOrders");
const refreshTodayOrders = document.querySelector("#refreshTodayOrders");
const todayOrdersList = document.querySelector("#todayOrdersList");

function dishImage(emoji, bg, ink) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="32" fill="${bg}"/><circle cx="182" cy="56" r="42" fill="#fff" opacity=".35"/><circle cx="60" cy="184" r="56" fill="#fff" opacity=".22"/><text x="120" y="145" text-anchor="middle" font-size="92">${emoji}</text><path d="M56 190c36 18 88 18 128 0" stroke="${ink}" stroke-width="12" stroke-linecap="round" opacity=".45"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

async function loadSharedDishes() {
  try {
    const sharedDishes = await fetchJson("/api/dishes");
    if (Array.isArray(sharedDishes) && sharedDishes.length) {
      menuDishes = sharedDishes;
      writeJson(storageKeys.dishes, menuDishes);
      renderMenu();
      renderCart();
    }
  } catch {
    // Static/offline fallback keeps local dishes.
  }
}

async function saveMenuShared() {
  writeJson(storageKeys.dishes, menuDishes);
  try {
    await fetchJson("/api/dishes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menuDishes),
    });
  } catch {
    // Static/offline fallback keeps changes in this browser.
  }
}

async function loadOrders() {
  try {
    const orders = await fetchJson("/api/orders");
    if (Array.isArray(orders)) {
      savedOrders = orders;
      writeJson(storageKeys.orders, savedOrders);
    }
  } catch {
    savedOrders = readJson(storageKeys.orders, []);
  }
  return savedOrders;
}

async function saveOrder(order) {
  savedOrders.push(order);
  writeJson(storageKeys.orders, savedOrders);
  try {
    const saved = await fetchJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    savedOrders = savedOrders.map((item) => (item.id === order.id ? saved : item));
    writeJson(storageKeys.orders, savedOrders);
    return saved;
  } catch {
    return order;
  }
}

function getQuantity(id) {
  return cart.get(id) || 0;
}

function saveCart() {
  writeJson(storageKeys.cart, [...cart.entries()]);
}

function setQuantity(id, nextQuantity) {
  if (nextQuantity <= 0) cart.delete(id);
  else cart.set(id, nextQuantity);
  saveCart();
  renderMenu();
  renderCart();
}

function renderTabs() {
  categoryTabs.innerHTML = categories
    .map((category) => `<button class="tab ${category === activeCategory ? "active" : ""}" type="button" data-category="${category}">${category}</button>`)
    .join("");
}

function renderMenu() {
  const visibleDishes = menuDishes.filter((dish) => {
    const matchesCategory = dish.category === activeCategory;
    const matchesSearch = !searchTerm || dish.name.includes(searchTerm) || dish.desc.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  categoryTitle.textContent = activeCategory;
  menuList.classList.toggle("manage-mode", manageMode);
  menuList.innerHTML = visibleDishes.length ? visibleDishes.map(renderDish).join("") : `<p class="empty">这个分类还没有菜。</p>`;
}

function renderDish(dish) {
  const quantity = getQuantity(dish.id);
  const tools = manageMode
    ? `<div class="dish-tools"><button class="pill-button" type="button" data-action="edit" data-id="${dish.id}">编辑</button><button class="pill-button danger" type="button" data-action="delete" data-id="${dish.id}">删除</button></div>`
    : `<div class="dish-controls" aria-label="${dish.name}数量"><button class="plus" type="button" data-action="plus" data-id="${dish.id}" aria-label="增加${dish.name}">+</button><span class="quantity">${quantity}</span><button class="minus" type="button" data-action="minus" data-id="${dish.id}" aria-label="减少${dish.name}">−</button></div>`;

  return `<article class="dish"><img class="dish-image" src="${dish.image}" alt="${dish.name}" /><div class="dish-info"><h3>${dish.name}</h3><p>${dish.desc || "家里人都爱吃。"}</p>${manageMode ? tools : ""}</div>${manageMode ? "" : tools}</article>`;
}

function getOrderLines() {
  return [...cart.entries()]
    .map(([id, quantity]) => {
      const dish = menuDishes.find((item) => item.id === id);
      return dish ? { ...dish, quantity } : null;
    })
    .filter(Boolean);
}

function renderCart() {
  const lines = getOrderLines();
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;
  cartHint.textContent = count ? "点开查看清单" : "先点几道菜吧";
  placeOrder.disabled = !count;
  cartItems.innerHTML = lines.length
    ? lines.map((item) => `<div class="cart-line"><span><strong>${item.name}</strong><small>${item.quantity} 份 · ${item.category}</small></span></div>`).join("")
    : `<p class="empty">购物车还是空的。</p>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildOrder() {
  const now = new Date();
  const lines = getOrderLines();
  const orderId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return {
    id: orderId,
    pickupCode: orderId.slice(-4),
    createdAt: now.toISOString(),
    createdLabel: formatDateTime(now),
    totalCount: lines.reduce((sum, item) => sum + item.quantity, 0),
    items: lines.map(({ id, name, category, quantity, image }) => ({ id, name, category, quantity, image })),
  };
}

function renderOrderDetail(order) {
  pickupCode.textContent = order.pickupCode;
  orderNumber.textContent = order.id;
  orderTime.textContent = order.createdLabel;
  orderItemCount.textContent = `共${order.totalCount}件菜`;
  orderItems.innerHTML = order.items
    .map((item) => `<div class="order-item"><img src="${item.image}" alt="${item.name}" /><strong>${item.name}</strong><span>x${item.quantity}</span></div>`)
    .join("");
}

async function openOrderPage() {
  if (!getOrderLines().length) {
    showToast("先选几道菜");
    return;
  }

  const order = await saveOrder(buildOrder());
  renderOrderDetail(order);
  cart.clear();
  saveCart();
  renderMenu();
  renderCart();
  cartPanel.hidden = true;
  cartToggle.setAttribute("aria-expanded", "false");
  if (typeof orderDialog.showModal === "function") orderDialog.showModal();
  else orderDialog.setAttribute("open", "");
}

function closeOrderPage() {
  orderDialog.close();
}

async function openTodayOrdersPage() {
  await loadOrders();
  renderTodayOrders();
  if (typeof todayOrdersDialog.showModal === "function") todayOrdersDialog.showModal();
  else todayOrdersDialog.setAttribute("open", "");
}

function renderTodayOrders() {
  const today = todayKey();
  const todayOrders = savedOrders
    .filter((order) => order.createdLabel?.startsWith(today) || order.createdAt?.startsWith(today))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));

  todayOrdersList.innerHTML = todayOrders.length
    ? todayOrders.map(renderHistoryOrder).join("")
    : `<section class="order-card"><p class="empty">今天还没有订单。</p></section>`;
}

function renderHistoryOrder(order) {
  const items = order.items.map((item) => `${item.name} x${item.quantity}`).join("、");
  return `<section class="history-order"><div><span class="order-tag">#${order.pickupCode}</span><strong>${order.totalCount}件菜</strong><small>${order.createdLabel}</small></div><p>${items}</p></section>`;
}

function closeTodayOrdersPage() {
  todayOrdersDialog.close();
}

function openDishDialog(dish) {
  dishForm.reset();
  dishIdInput.value = dish?.id || "";
  dishNameInput.value = dish?.name || "";
  dishCategoryInput.value = dish?.category || activeCategory;
  dishDescInput.value = dish?.desc || "";
  dishDialogTitle.textContent = dish ? "编辑菜品" : "添加菜品";
  if (typeof dishDialog.showModal === "function") dishDialog.showModal();
  else dishDialog.setAttribute("open", "");
}

function closeDishDialog() {
  dishDialog.close();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderMenu();
});

menuList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === "edit") return openDishDialog(menuDishes.find((dish) => dish.id === id));
  if (action === "delete") {
    menuDishes = menuDishes.filter((dish) => dish.id !== id);
    cart.delete(id);
    await saveMenuShared();
    saveCart();
    renderMenu();
    renderCart();
    showToast("菜品已删除");
    return;
  }
  setQuantity(id, action === "plus" ? getQuantity(id) + 1 : getQuantity(id) - 1);
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  renderMenu();
});

cartToggle.addEventListener("click", () => {
  const shouldOpen = cartPanel.hidden;
  cartPanel.hidden = !shouldOpen;
  cartToggle.setAttribute("aria-expanded", String(shouldOpen));
});

clearCart.addEventListener("click", () => {
  cart.clear();
  saveCart();
  renderMenu();
  renderCart();
  showToast("已清空订单");
});

placeOrder.addEventListener("click", openOrderPage);
closeOrder.addEventListener("click", closeOrderPage);
backToMenu.addEventListener("click", closeOrderPage);
openTodayOrders.addEventListener("click", openTodayOrdersPage);
closeTodayOrders.addEventListener("click", closeTodayOrdersPage);
refreshTodayOrders.addEventListener("click", async () => {
  await loadOrders();
  renderTodayOrders();
  showToast("今日订单已刷新");
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(storageKeys.theme, document.body.classList.contains("dark") ? "dark" : "light");
});

openAddDish.addEventListener("click", () => openDishDialog());
openAddDish2.addEventListener("click", () => openDishDialog());
closeAddDish.addEventListener("click", closeDishDialog);
toggleManage.addEventListener("click", () => {
  manageMode = !manageMode;
  toggleManage.textContent = manageMode ? "完成管理" : "管理菜品";
  renderMenu();
});

dishForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(dishForm);
  const file = dishImageInput.files[0];
  const existingId = String(data.get("id") || "");
  const existingDish = menuDishes.find((dish) => dish.id === existingId);
  const dish = {
    id: existingId || `dish-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    category: String(data.get("category") || categories[0]),
    desc: String(data.get("desc") || "").trim(),
    image: file ? await fileToDataUrl(file) : existingDish?.image || dishImage("🍽️", "#f6dfd0", "#b6543f"),
  };
  if (!dish.name) return showToast("先写菜名");
  menuDishes = existingDish ? menuDishes.map((item) => (item.id === dish.id ? dish : item)) : [...menuDishes, dish];
  activeCategory = dish.category;
  await saveMenuShared();
  closeDishDialog();
  renderTabs();
  renderMenu();
  renderCart();
  showToast(existingDish ? "菜品已更新" : "菜品已添加");
});

if (localStorage.getItem(storageKeys.theme) === "dark") document.body.classList.add("dark");

renderTabs();
renderMenu();
renderCart();
loadSharedDishes();
loadOrders();
