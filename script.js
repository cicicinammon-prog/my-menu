const APP_LOG = "[family-order]";
window.__familyOrderScriptLoaded = true;
const el = {};
const CATEGORIES = ["主食", "汤羹", "特色菜"];
const STORAGE_KEYS = {
  cart: "familyOrderCartV5",
  dishes: "familyOrderDishesV5",
  orders: "familyOrdersV5",
  theme: "familyOrderTheme",
};

const DEFAULT_DISHES = [
  dish("egg-fried-rice", "蛋炒饭", "主食", "快手管饱，想加火腿写备注。", "🍚", "#f8d6c4", "#9a3f2b", 10),
  dish("scallion-noodles", "葱油拌面", "主食", "简单快手，适合夜宵。", "🍜", "#ffd8d6", "#bd4537", 20),
  dish("rice-roll", "糯米饭团", "主食", "软糯顶饱，可以提前做好。", "🍙", "#e6e2cc", "#766b45", 30),
  dish("beef-noodles", "牛肉汤面", "主食", "热乎一碗，汤面分开也行。", "🍝", "#f3d7b5", "#8a5132", 40),
  dish("pumpkin-congee", "南瓜粥", "主食", "软糯清甜，早晚都舒服。", "🥣", "#f8d98e", "#a36b2d", 50),
  dish("chicken-soup", "山药鸡汤", "汤羹", "清淡热汤，适合晚餐。", "🍲", "#f5e7c6", "#8b6f3a", 60),
  dish("seaweed-soup", "紫菜蛋花汤", "汤羹", "快手汤，清爽不腻。", "🥣", "#dbeed9", "#426c51", 70),
  dish("garlic-shrimp", "蒜蓉大虾", "特色菜", "蒜香足，默认少辣。", "🦐", "#ffe1cf", "#d85c3d", 80),
  dish("dry-pot", "干锅时蔬", "特色菜", "香一点，辣度可以备注。", "🥘", "#f2d2ad", "#7b4b26", 90),
];

const state = {
  activeCategory: CATEGORIES[0],
  cart: new Map(),
  dishes: [],
  manageMode: false,
  orders: [],
  realtimeChannel: null,
  searchTerm: "",
  supabase: null,
  supabaseReady: false,
};

let initStarted = false;

function startApp() {
  if (initStarted) return;
  initStarted = true;
  initApp().catch((error) => {
    console.error(APP_LOG, "Fatal initialization error", error);
    safeToast("页面初始化失败，已进入离线模式");
    bootstrapOfflineState();
    renderAll();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp, { once: true });
} else {
  startApp();
}

async function initApp() {
  cacheElements();
  bootstrapOfflineState();
  bindEvents();
  applySavedTheme();
  renderAll();
  await connectSupabase();
  await loadRemoteData();
  subscribeRealtime();
  renderAll();
}

function cacheElements() {
  [
    "backToMenu",
    "cartCount",
    "cartHint",
    "cartItems",
    "cartPanel",
    "cartToggle",
    "categoryTabs",
    "categoryTitle",
    "clearCart",
    "closeAddDish",
    "closeOrder",
    "closeTodayOrders",
    "dishCategory",
    "dishDesc",
    "dishDialog",
    "dishDialogTitle",
    "dishForm",
    "dishId",
    "dishImage",
    "dishName",
    "menuList",
    "openAddDish",
    "openAddDish2",
    "openTodayOrders",
    "orderDialog",
    "orderItemCount",
    "orderItems",
    "orderNumber",
    "orderTime",
    "pickupCode",
    "placeOrder",
    "refreshTodayOrders",
    "searchInput",
    "themeToggle",
    "toast",
    "todayOrdersDialog",
    "todayOrdersList",
    "toggleManage",
  ].forEach((id) => {
    el[id] = document.getElementById(id);
    if (!el[id]) console.warn(APP_LOG, `Missing DOM element: #${id}`);
  });
}

function bootstrapOfflineState() {
  const savedDishes = safeReadJson(STORAGE_KEYS.dishes, []);
  const savedOrders = safeReadJson(STORAGE_KEYS.orders, []);
  const savedCart = safeReadJson(STORAGE_KEYS.cart, []);

  state.dishes = normalizeDishes(savedDishes.length ? savedDishes : DEFAULT_DISHES);
  state.orders = normalizeOrders(savedOrders);
  state.cart = new Map(Array.isArray(savedCart) ? savedCart.filter((item) => Array.isArray(item) && item.length === 2) : []);
}

async function connectSupabase() {
  const config = await getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    console.info(APP_LOG, "Supabase not configured; using local fallback");
    return;
  }

  try {
    const supabaseGlobal = await loadSupabaseBrowserClient();
    if (!supabaseGlobal || !supabaseGlobal.createClient) throw new Error("Supabase browser client is unavailable");
    state.supabase = supabaseGlobal.createClient(config.url, config.anonKey);
    state.supabaseReady = true;
  } catch (error) {
    console.error(APP_LOG, "Supabase client failed to load", error);
    state.supabaseReady = false;
  }
}

function loadSupabaseBrowserClient() {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) {
      resolve(window.supabase);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/dist/umd/supabase.min.js";
    script.async = true;
    script.onload = () => resolve(window.supabase);
    script.onerror = () => reject(new Error("Failed to load Supabase CDN script"));
    document.head.append(script);
  });
}

async function getSupabaseConfig() {
  const inline = window.FAMILY_ORDER_SUPABASE || {};
  let apiConfig = {};

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) apiConfig = await response.json();
  } catch (error) {
    console.info(APP_LOG, "No Vercel config endpoint available", error);
  }

  return {
    url: apiConfig.supabaseUrl || inline.url || "",
    anonKey: apiConfig.supabaseAnonKey || inline.anonKey || "",
  };
}

async function loadRemoteData() {
  if (!state.supabaseReady) return;

  await Promise.all([loadRemoteDishes(), loadRemoteOrders()]);
}

async function loadRemoteDishes() {
  try {
    const { data, error } = await state.supabase.from("dishes").select("*").eq("is_active", true).order("sort_index");
    if (error) throw error;

    if (Array.isArray(data) && data.length) {
      state.dishes = normalizeDishes(data.map(fromDishRow));
      safeWriteJson(STORAGE_KEYS.dishes, state.dishes);
    } else {
      await seedDefaultDishes();
    }
  } catch (error) {
    console.error(APP_LOG, "Failed to load dishes", error);
  }
}

async function seedDefaultDishes() {
  try {
    const rows = DEFAULT_DISHES.map(toDishRow);
    const { error } = await state.supabase.from("dishes").upsert(rows);
    if (error) throw error;
    state.dishes = DEFAULT_DISHES;
    safeWriteJson(STORAGE_KEYS.dishes, state.dishes);
  } catch (error) {
    console.error(APP_LOG, "Failed to seed default dishes", error);
  }
}

async function loadRemoteOrders() {
  try {
    const today = todayKey();
    const { data, error } = await state.supabase
      .from("orders")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.orders = normalizeOrders((data || []).map(fromOrderRow));
    safeWriteJson(STORAGE_KEYS.orders, state.orders);
  } catch (error) {
    console.error(APP_LOG, "Failed to load orders", error);
  }
}

function subscribeRealtime() {
  if (!state.supabaseReady || state.realtimeChannel) return;

  try {
    state.realtimeChannel = state.supabase
      .channel("family-daily-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
        await loadRemoteOrders();
        renderTodayOrders();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dishes" }, async () => {
        await loadRemoteDishes();
        renderMenu();
        renderCart();
      })
      .subscribe((status) => console.info(APP_LOG, "Realtime status:", status));
  } catch (error) {
    console.error(APP_LOG, "Realtime subscription failed", error);
  }
}

function bindEvents() {
  on(el.categoryTabs, "click", handleCategoryClick);
  on(el.menuList, "click", handleMenuClick);
  on(el.searchInput, "input", () => {
    state.searchTerm = el.searchInput && el.searchInput.value ? el.searchInput.value.trim() : "";
    renderMenu();
  });
  on(el.cartToggle, "click", toggleCartPanel);
  on(el.clearCart, "click", clearCart);
  on(el.placeOrder, "click", openOrderPage);
  on(el.closeOrder, "click", closeOrderPage);
  on(el.backToMenu, "click", closeOrderPage);
  on(el.openTodayOrders, "click", openTodayOrdersPage);
  on(el.closeTodayOrders, "click", closeTodayOrdersPage);
  on(el.todayOrdersList, "click", (event) => {
    const btn = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "toggleDone") {
      const order = state.orders.find((o) => o.id === id);
      if (!order) return;
      const updated = { ...order, isDone: !order.isDone };
      state.orders = upsertById(state.orders, updated);
      safeWriteJson(STORAGE_KEYS.orders, state.orders);
      renderTodayOrders();
      safeToast(updated.isDone ? "已标记完成" : "已取消完成");
    }
    if (action === "deleteOrder") {
      state.orders = state.orders.filter((o) => o.id !== id);
      safeWriteJson(STORAGE_KEYS.orders, state.orders);
      renderTodayOrders();
      safeToast("订单已删除");
    }
  });
  on(el.refreshTodayOrders, "click", async () => {
    await loadRemoteOrders();
    renderTodayOrders();
    safeToast("今日订单已刷新");
  });
  on(el.themeToggle, "click", toggleTheme);
  on(el.openAddDish, "click", () => openDishDialog());
  on(el.openAddDish2, "click", () => openDishDialog());
  on(el.closeAddDish, "click", closeDishDialog);
  on(el.toggleManage, "click", toggleManageMode);
  on(el.dishForm, "submit", handleDishSubmit);
}

function on(target, eventName, handler) {
  if (!target) return;
  target.addEventListener(eventName, (event) => {
    try {
      handler(event);
    } catch (error) {
      console.error(APP_LOG, `Event handler failed: ${eventName}`, error);
      safeToast("操作失败，请稍后再试");
    }
  });
}

function renderAll() {
  renderTabs();
  renderMenu();
  renderCart();
}

function renderTabs() {
  if (!el.categoryTabs) return;
  replaceChildren(
    el.categoryTabs,
    CATEGORIES.map((category) => {
      const button = createNode("button", {
        className: `tab ${category === state.activeCategory ? "active" : ""}`,
        text: category,
        type: "button",
      });
      button.dataset.category = category;
      return button;
    })
  );
}

function renderMenu() {
  if (!el.menuList) return;
  const visibleDishes = state.dishes.filter((item) => {
    const matchesCategory = item.category === state.activeCategory;
    const matchesSearch = !state.searchTerm || item.name.includes(state.searchTerm) || item.desc.includes(state.searchTerm);
    return matchesCategory && matchesSearch;
  });

  setText(el.categoryTitle, state.activeCategory);
  el.menuList.classList.toggle("manage-mode", state.manageMode);

  if (!visibleDishes.length) {
    replaceChildren(el.menuList, [createNode("p", { className: "empty", text: "这个分类还没有菜。" })]);
    return;
  }

  replaceChildren(el.menuList, visibleDishes.map(renderDish));
}

function renderDish(item) {
  const article = createNode("article", { className: "dish" });
  const image = createNode("img", { className: "dish-image" });
  image.src = item.image || fallbackDishImage();
  image.alt = item.name || "菜品";
  image.loading = "lazy";

  const info = createNode("div", { className: "dish-info" }, [
    createNode("h3", { text: item.name || "未命名菜品" }),
    createNode("p", { text: item.desc || "家里人都爱吃。" }),
  ]);

  if (state.manageMode) info.append(renderDishTools(item));
  article.append(image, info);
  if (!state.manageMode) article.append(renderDishControls(item));
  return article;
}

function renderDishTools(item) {
  const tools = createNode("div", { className: "dish-tools" });
  const edit = createNode("button", { className: "pill-button", text: "编辑", type: "button" });
  edit.dataset.action = "edit";
  edit.dataset.id = item.id;
  const remove = createNode("button", { className: "pill-button danger", text: "删除", type: "button" });
  remove.dataset.action = "delete";
  remove.dataset.id = item.id;
  tools.append(edit, remove);
  return tools;
}

function renderDishControls(item) {
  const controls = createNode("div", { className: "dish-controls" });
  controls.setAttribute("aria-label", `${item.name}数量`);
  const plus = createNode("button", { className: "plus", text: "+", type: "button" });
  plus.dataset.action = "plus";
  plus.dataset.id = item.id;
  plus.setAttribute("aria-label", `增加${item.name}`);
  const quantity = createNode("span", { className: "quantity", text: String(getQuantity(item.id)) });
  const minus = createNode("button", { className: "minus", text: "−", type: "button" });
  minus.dataset.action = "minus";
  minus.dataset.id = item.id;
  minus.setAttribute("aria-label", `减少${item.name}`);
  controls.append(plus, quantity, minus);
  return controls;
}

function renderCart() {
  const lines = getOrderLines();
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  setText(el.cartCount, String(count));
  setText(el.cartHint, count ? "点开查看清单" : "先点几道菜吧");
  if (el.placeOrder) el.placeOrder.disabled = !count;

  if (!el.cartItems) return;
  if (!lines.length) {
    replaceChildren(el.cartItems, [createNode("p", { className: "empty", text: "购物车还是空的。" })]);
    return;
  }
  replaceChildren(
    el.cartItems,
    lines.map((item) => createNode("div", { className: "cart-line" }, [createNode("span", {}, [createNode("strong", { text: item.name }), createNode("small", { text: `${item.quantity} 份 · ${item.category}` })])]))
  );
}

function renderOrderDetail(order) {
  if (!order) return;
  setText(el.pickupCode, order.pickupCode || "0000");
  setText(el.orderNumber, order.id || "--");
  setText(el.orderTime, order.createdLabel || "--");
  setText(el.orderItemCount, `共${Number(order.totalCount || 0)}件菜`);
  if (!el.orderItems) return;
  replaceChildren(el.orderItems, order.items.map(renderOrderItem));
}

function renderOrderItem(item) {
  const image = createNode("img");
  image.src = item.image || fallbackDishImage();
  image.alt = item.name || "菜品";
  return createNode("div", { className: "order-item" }, [
    image,
    createNode("strong", { text: item.name || "未命名菜品" }),
    createNode("span", { text: `x${Number(item.quantity || 0)}` }),
  ]);
}

function renderTodayOrders() {
  if (!el.todayOrdersList) return;
  const today = todayKey();
  const todayOrders = state.orders
    .filter((order) => (order.createdLabel || "").startsWith(today) || (order.createdAt || "").startsWith(today))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));

  if (!todayOrders.length) {
    replaceChildren(el.todayOrdersList, [createNode("section", { className: "order-card" }, [createNode("p", { className: "empty", text: "今天还没有订单。" })])]);
    return;
  }
  replaceChildren(el.todayOrdersList, todayOrders.map(renderHistoryOrder));
}

function renderHistoryOrder(order) {
  const items = (order.items || []).map((item) => `${item.name} x${Number(item.quantity || 0)}`).join("、");
  const section = createNode("section", { className: `history-order${order.isDone ? " done" : ""}` });

  const meta = createNode("div", { className: "history-order-meta" });
  meta.append(
    createNode("span", { className: "order-tag", text: `#${order.pickupCode || "0000"}` }),
    createNode("strong", { text: `${Number(order.totalCount || 0)}件菜` }),
    createNode("small", { text: order.createdLabel || "" })
  );

  const actions = createNode("div", { className: "history-order-actions" });

  const doneBtn = createNode("button", { className: `pill-button${order.isDone ? " done-active" : ""}`, text: order.isDone ? "✓ 已完成" : "标记完成", type: "button" });
  doneBtn.dataset.action = "toggleDone";
  doneBtn.dataset.id = order.id;

  const deleteBtn = createNode("button", { className: "pill-button danger", text: "删除", type: "button" });
  deleteBtn.dataset.action = "deleteOrder";
  deleteBtn.dataset.id = order.id;

  actions.append(doneBtn, deleteBtn);
  section.append(meta, createNode("p", { text: items || "暂无菜品明细" }), actions);
  return section;
}


function handleCategoryClick(event) {
  const button = event.target && event.target.closest ? event.target.closest("[data-category]") : null;
  const category = button && button.dataset ? button.dataset.category : "";
  if (!category || !CATEGORIES.includes(category)) return;
  state.activeCategory = category;
  renderTabs();
  renderMenu();
}

async function handleMenuClick(event) {
  const button = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (!id || !action) return;

  if (action === "edit") {
    openDishDialog(state.dishes.find((item) => item.id === id));
    return;
  }
  if (action === "delete") {
    await deleteDish(id);
    return;
  }
  setQuantity(id, action === "plus" ? getQuantity(id) + 1 : getQuantity(id) - 1);
}

async function deleteDish(id) {
  state.dishes = state.dishes.filter((item) => item.id !== id);
  state.cart.delete(id);
  saveCart();
  safeWriteJson(STORAGE_KEYS.dishes, state.dishes);
  renderMenu();
  renderCart();

  if (state.supabaseReady) {
    const { error } = await state.supabase.from("dishes").update({ is_active: false }).eq("id", id);
    if (error) console.error(APP_LOG, "Failed to delete dish remotely", error);
  }
  safeToast("菜品已删除");
}

function setQuantity(id, quantity) {
  if (!id) return;
  if (quantity <= 0) state.cart.delete(id);
  else state.cart.set(id, quantity);
  saveCart();
  renderMenu();
  renderCart();
}

function getQuantity(id) {
  return state.cart.get(id) || 0;
}

function saveCart() {
  safeWriteJson(STORAGE_KEYS.cart, [...state.cart.entries()]);
}

function getOrderLines() {
  return [...state.cart.entries()]
    .map(([id, quantity]) => {
      const item = state.dishes.find((dishItem) => dishItem.id === id);
      return item ? { ...item, quantity: Number(quantity || 0) } : null;
    })
    .filter(Boolean);
}

async function openOrderPage() {
  const lines = getOrderLines();
  if (!lines.length) {
    safeToast("先选几道菜");
    return;
  }
  const order = await saveOrder(buildOrder(lines));
  renderOrderDetail(order);
  state.cart.clear();
  saveCart();
  renderMenu();
  renderCart();
  if (el.cartPanel) el.cartPanel.hidden = true;
  if (el.cartToggle) el.cartToggle.setAttribute("aria-expanded", "false");
  showDialog(el.orderDialog);
}

function closeOrderPage() {
  closeDialog(el.orderDialog);
}

async function openTodayOrdersPage() {
  await loadRemoteOrders();
  renderTodayOrders();
  showDialog(el.todayOrdersDialog);
}

function closeTodayOrdersPage() {
  closeDialog(el.todayOrdersDialog);
}

function buildOrder(lines) {
  const now = new Date();
  const id = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return normalizeOrder({
    id,
    pickupCode: id.slice(-4),
    createdAt: now.toISOString(),
    createdLabel: formatDateTime(now),
    totalCount: lines.reduce((sum, item) => sum + item.quantity, 0),
    items: lines.map(({ id: dishId, name, category, quantity, image }) => ({ id: dishId, name, category, quantity, image })),
  });
}

async function saveOrder(order) {
  state.orders = upsertById(state.orders, order);
  safeWriteJson(STORAGE_KEYS.orders, state.orders);
  if (!state.supabaseReady) return order;

  try {
    const { data, error } = await state.supabase.from("orders").insert(toOrderRow(order)).select().single();
    if (error) throw error;
    const saved = fromOrderRow(data);
    state.orders = upsertById(state.orders, saved);
    safeWriteJson(STORAGE_KEYS.orders, state.orders);
    return saved;
  } catch (error) {
    console.error(APP_LOG, "Failed to save order remotely", error);
    safeToast("网络暂时不可用，订单已保存在本机");
    return order;
  }
}

function toggleCartPanel() {
  if (!el.cartPanel) return;
  const shouldOpen = el.cartPanel.hidden;
  el.cartPanel.hidden = !shouldOpen;
  if (el.cartToggle) el.cartToggle.setAttribute("aria-expanded", String(shouldOpen));
}

function clearCart() {
  state.cart.clear();
  saveCart();
  renderMenu();
  renderCart();
  safeToast("已清空订单");
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  try {
    localStorage.setItem(STORAGE_KEYS.theme, document.body.classList.contains("dark") ? "dark" : "light");
  } catch (error) {
    console.error(APP_LOG, "Failed to save theme", error);
  }
}

function applySavedTheme() {
  try {
    if (localStorage.getItem(STORAGE_KEYS.theme) === "dark") document.body.classList.add("dark");
  } catch (error) {
    console.error(APP_LOG, "Failed to read theme", error);
  }
}

function toggleManageMode() {
  state.manageMode = !state.manageMode;
  setText(el.toggleManage, state.manageMode ? "完成管理" : "管理菜品");
  renderMenu();
}

function openDishDialog(item) {
  if (!el.dishForm || !el.dishDialog) return;
  el.dishForm.reset();
  setInputValue(el.dishId, item && item.id ? item.id : "");
  setInputValue(el.dishName, item && item.name ? item.name : "");
  setInputValue(el.dishCategory, item && item.category ? item.category : state.activeCategory);
  setInputValue(el.dishDesc, item && item.desc ? item.desc : "");
  setText(el.dishDialogTitle, item ? "编辑菜品" : "添加菜品");
  showDialog(el.dishDialog);
}

function closeDishDialog() {
  closeDialog(el.dishDialog);
}

async function handleDishSubmit(event) {
  event.preventDefault();
  const form = el.dishForm;
  if (!form) return;
  const data = new FormData(form);
  const id = String(data.get("id") || "");
  const existing = state.dishes.find((item) => item.id === id);
  const file = el.dishImage && el.dishImage.files ? el.dishImage.files[0] : null;
  const image = file ? await fileToDataUrl(file) : existing && existing.image ? existing.image : fallbackDishImage();
  const item = normalizeDish({
    id: id || `dish-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    category: String(data.get("category") || CATEGORIES[0]),
    desc: String(data.get("desc") || "").trim(),
    image,
    sortIndex: existing && existing.sortIndex ? existing.sortIndex : Date.now(),
    isActive: true,
  });
  if (!item.name) {
    safeToast("先写菜名");
    return;
  }
  state.dishes = upsertById(state.dishes, item).sort(sortDishes);
  safeWriteJson(STORAGE_KEYS.dishes, state.dishes);
  renderAll();
  closeDishDialog();

  if (state.supabaseReady) {
    const row = toDishRow(item);
    const { error } = await state.supabase.from("dishes").upsert(row);
    if (error) console.error(APP_LOG, "Failed to save dish remotely", error);
  }
  safeToast(existing ? "菜品已更新" : "菜品已添加");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dish(id, name, category, desc, emoji, bg, ink, sortIndex) {
  return normalizeDish({ id, name, category, desc, image: dishImage(emoji, bg, ink), sortIndex, isActive: true });
}

function normalizeDish(item) {
  return {
    id: String(item && item.id ? item.id : `dish-${Date.now()}`),
    name: String(item && item.name ? item.name : "").slice(0, 24),
    category: CATEGORIES.includes(item && item.category ? item.category : "") ? item.category : CATEGORIES[0],
    desc: String(item && item.desc ? item.desc : item && item.description ? item.description : "").slice(0, 80),
    image: String(item && item.image ? item.image : fallbackDishImage()),
    sortIndex: Number(item && item.sortIndex !== undefined ? item.sortIndex : item && item.sort_index !== undefined ? item.sort_index : 0),
    isActive: item && item.isActive !== undefined ? item.isActive : item && item.is_active !== undefined ? item.is_active : true,
  };
}

function normalizeDishes(items) {
  return (Array.isArray(items) ? items : []).map(normalizeDish).filter((item) => item.isActive !== false).sort(sortDishes);
}

function normalizeOrder(order) {
  const items = order && Array.isArray(order.items) ? order.items : [];
  return {
    id: String(order && order.id ? order.id : `order-${Date.now()}`),
    pickupCode: String(order && order.pickupCode ? order.pickupCode : order && order.pickup_code ? order.pickup_code : "0000"),
    createdAt: String(order && order.createdAt ? order.createdAt : order && order.created_at ? order.created_at : new Date().toISOString()),
    createdLabel: String(order && order.createdLabel ? order.createdLabel : order && order.created_label ? order.created_label : formatDateTime(new Date())),
    totalCount: Number(order && order.totalCount !== undefined ? order.totalCount : order && order.total_count !== undefined ? order.total_count : items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
    isDone: !!(order && order.isDone),
    items: items.map((item) => ({
      id: String(item && item.id ? item.id : ""),
      name: String(item && item.name ? item.name : "未命名菜品"),
      category: String(item && item.category ? item.category : ""),
      quantity: Number(item && item.quantity ? item.quantity : 0),
      image: String(item && item.image ? item.image : fallbackDishImage()),
    })),
  };
}

function normalizeOrders(items) {
  return (Array.isArray(items) ? items : []).map(normalizeOrder).filter((order) => order.items.length);
}

function fromDishRow(row) {
  return normalizeDish({
    id: row.id,
    name: row.name,
    category: row.category,
    desc: row.description,
    image: row.image,
    sortIndex: row.sort_index,
    isActive: row.is_active,
  });
}

function toDishRow(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.desc,
    image: item.image,
    sort_index: item.sortIndex,
    is_active: item.isActive !== false,
    updated_at: new Date().toISOString(),
  };
}

function fromOrderRow(row) {
  return normalizeOrder({
    id: row.id,
    pickupCode: row.pickup_code,
    createdAt: row.created_at,
    createdLabel: row.created_label,
    totalCount: row.total_count,
    items: row.items,
  });
}

function toOrderRow(order) {
  return {
    id: order.id,
    pickup_code: order.pickupCode,
    created_at: order.createdAt,
    created_label: order.createdLabel,
    total_count: order.totalCount,
    items: order.items,
  };
}

function sortDishes(a, b) {
  return Number(a.sortIndex || 0) - Number(b.sortIndex || 0) || a.name.localeCompare(b.name);
}

function upsertById(items, item) {
  const next = [...items];
  const index = next.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) next[index] = item;
  else next.push(item);
  return next;
}

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(APP_LOG, `Failed to parse localStorage key ${key}`, error);
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(APP_LOG, `Failed to write localStorage key ${key}`, error);
  }
}

function createNode(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.setAttribute("type", options.type);
  children.forEach((child) => {
    if (child) node.append(child);
  });
  return node;
}

function replaceChildren(parent, children) {
  if (!parent) return;
  parent.replaceChildren(...children.filter(Boolean));
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function setInputValue(node, value) {
  if (node) node.value = value;
}

function showDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function safeToast(message) {
  if (!el.toast) {
    console.info(APP_LOG, message);
    return;
  }
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.clearTimeout(safeToast.timer);
  safeToast.timer = window.setTimeout(() => {
    if (el.toast) el.toast.classList.remove("show");
  }, 1800);
}

function dishImage(emoji, bg, ink) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="36">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function fallbackDishImage() {
  return dishImage("🍽️", "#f6dfd0", "#b6543f");
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// Inject styles for order actions
(function injectOrderStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .history-order-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .history-order-actions { display: flex; gap: 8px; margin-top: 10px; }
    .history-order.done { opacity: 0.6; }
    .history-order.done p { text-decoration: line-through; }
    .pill-button.done-active { background: #4caf50; color: white; border-color: #4caf50; }
  `;
  document.head.append(style);
})();
