// Импорт модулей API, уведомлений и получения ключа из localStorage
import { API } from "./api.js";
import { initNotifications, notify } from "./notifications.js";
import { getApiKey } from "./config.js";

document.addEventListener("DOMContentLoaded", function () {
  initNotifications(); // инициализация уведомлений

  // переменная хранения корзины
  const CART_KEY = "cart_good_ids";

  // Элементы страницы
  const cardsEl = document.querySelector("[data-cart-cards]");
  const emptyEl = document.querySelector("[data-cart-empty]");
  const totalEl = document.querySelector("[data-total]");
  const form = document.querySelector("[data-order-form]");
  const paymentBlock = document.querySelector("[data-payment]");


  // Защита: отсутствия товаров и формы заказа
  if (!cardsEl) {
    console.error("cart.js: container [data-cart-cards] not found");
    return;
  }

  if (!form) {
    console.error("cart.js: form [data-order-form] not found");
    return;
  }

  // Отключение HTML валидации, проверки идут в js
  form.noValidate = true;

  // XSS-защита
  function escapeHtml(s) {
    if (s === undefined || s === null) {
      s = "";
    }

    return String(s).replace(/[&<>"']/g, function (m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      if (m === "'") return "&#039;";
      return m;
    });
  }

  // Чтение корзины
  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      let arr = []; // создание массива товаров

      // парсинг товаров
      if (raw) {
        arr = JSON.parse(raw);
      }

      // проверка наличия массива
      if (!Array.isArray(arr)) {
        return [];
      }

      // результирующий массив
      const result = [];
      // Фильтрация числовые ID товаров
      for (let i = 0; i < arr.length; i++) {
        const n = Number(arr[i]);
        if (Number.isFinite(n)) {
          result.push(n);
        }
      }

      return result;
    } catch (e) {
      // При ошибке возвращается пустая корзина
      return [];
    }
  }

  // Сохранение данных в localStorage
  function writeCart(ids) {
    localStorage.setItem(CART_KEY, JSON.stringify(ids));
  }

  // Загрузка данных товара по ID
  async function fetchGood(id) {
    const payload = await API.getGoodById(id);
    if (payload && payload.good) {
      return payload.good;
    }
    return payload;
  }

  // Переключение состояния корзины
  function setEmptyState(isEmpty) {
    if (emptyEl) {
      if (isEmpty) {
        emptyEl.style.display = "";
      } else {
        emptyEl.style.display = "none";
      }
    }
    
    if (isEmpty) {
      cardsEl.style.display = "none";
    } else {
      cardsEl.style.display = "";
    }

    // Блокировка элементов корзины, если корзина пуста
    const controls = form.querySelectorAll("input,select,textarea,button");
    controls.forEach(function (el) {
      if (el.type !== "reset") {
        el.disabled = isEmpty;
      }
    });
  }

  // Обновление итоговой стоимости
  function updateTotal(sum) {
    if (!totalEl) return;

    let note = "";
    if (sum) {
      note =
        '<div style="font-weight:600; font-size:14px; color:#444;" data-delivery-note>' +
        "Стоимость доставки рассчитывается отдельно (по заданию не требуется)." +
        "</div>";
    }

    totalEl.innerHTML = "Итоговая стоимость: " + sum + " ₽" + note;
  }

  // Удаление товара из корзины
  function removeFromCart(id) {
    const ids = readCart().filter(function (x) {
      return x !== Number(id);
    });

    writeCart(ids);
    render();

    if (notify) {
      notify("success", "Товар удалён из корзины");
    }
  }

  // Отрисовка корзины
  async function render() {
    const ids = readCart();

    // Очистка контейнера
    cardsEl.innerHTML = "";
    updateTotal(0);

    // Изменение состоянии корзины
    if (!ids.length) {
      setEmptyState(true);
      return;
    }

    setEmptyState(false);

    let sum = 0;

    // Загрузка каждого товара по ID
    for (let i = 0; i < ids.length; i++) {
      let item = null;

      try {
        item = await fetchGood(ids[i]);
      } catch (e) {
        console.warn("cart.js: failed to load good", ids[i], e);
      }

      if (!item) continue;

      // Определение стоимости (скидки имеют приоритет)
      let price = 0;
      if (item.discount_price !== undefined && item.discount_price !== null) {
        price = Number(item.discount_price);
      } else if (item.actual_price !== undefined && item.actual_price !== null) {
        price = Number(item.actual_price);
      }

      if (!Number.isFinite(price)) price = 0;
      sum += price;

      // Категория товара
      let category = "";
      if (item.sub_category) category = item.sub_category;
      else if (item.main_category) category = item.main_category;

      // Формирование карточки товара
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="card__img">' +
        '<img src="' +
        item.image_url +
        '" alt="' +
        escapeHtml(item.name) +
        '" />' +
        "</div>" +
        '<div class="card__body">' +
        '<div class="card__title">' +
        escapeHtml(item.name) +
        "</div>" +
        '<div class="card__meta">Категория: ' +
        escapeHtml(category) +
        "</div>" +
        '<div class="card__meta">Цена: <b>' +
        price +
        "</b> ₽</div>" +
        '<div class="card__meta">Рейтинг: ' +
        escapeHtml(item.rating) +
        "</div>" +
        '<div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">' +
        '<button type="button" class="btn" data-remove="' +
        item.id +
        '" style="max-width:220px;">Удалить</button>' +
        "</div></div>";

      cardsEl.appendChild(card);
    }

    updateTotal(sum);
  }

  // Кнопка "удалить"
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    removeFromCart(btn.dataset.remove);
  });

  // Преобразование даты в DD-MM-YYYY
  function ymdToDmy(v) {
    if (!v) return "";
    const parts = String(v).split("-");
    if (parts.length !== 3) return "";
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  // Проверка формата даты
  function isValidDateYMD(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  }

  // Допустимые интервалы доставки
  const allowedIntervals = new Set([
    "08:00-12:00",
    "12:00-14:00",
    "14:00-18:00",
    "18:00-22:00",
  ]);

  // Обработка формы заказа
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Проверка наличия API-ключа
    if (!getApiKey()) {
      if (notify) notify("error", "Введите API-ключ для оформления заказа");
      return;
    }

    // Првоерка наличия корзины
    const ids = readCart();
    if (!ids.length) {
      if (notify) notify("info", "Корзина пуста");
      return;
    }

    // Получение формы оплаты 
    const fd = new FormData(form);

    // Получение данных формы
    const name = String(fd.get("name") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const deliveryDateRaw = String(fd.get("deliveryDate") || "").trim();
    const deliveryInterval = String(fd.get("deliveryInterval") || "").trim();
    const comment = String(fd.get("comment") || "").trim();

    // Валидация обязательных данных
    if (!name || !address || !phone || !email) {
      if (notify) notify("error", "Заполните имя, адрес, телефон и email");
      return;
    }

    if (!deliveryDateRaw || !isValidDateYMD(deliveryDateRaw)) {
      if (notify) notify("error", "Выберите дату доставки через календарь");
      return;
    }

    if (!allowedIntervals.has(deliveryInterval)) {
      if (notify) notify("error", "Выберите корректный интервал доставки");
      return;
    }

    // Показ блока оплаты, если ещё не введены данные карты
    const cardNumber = String(fd.get("cardNumber") || "").trim();
    const cardHolder = String(fd.get("cardHolder") || "").trim();
    const cardExpiry = String(fd.get("cardExpiry") || "").trim();
    const cardCvc = String(fd.get("cardCvc") || "").trim();
    
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvc) {
      if (paymentBlock) paymentBlock.style.display = "";
      notify("error", "Введите данные банковской карты для оплаты");
      return;
    }

    // Валидация карты
    if (!/^\d{16}$/.test(cardNumber.replace(/\s/g, ""))) {
      notify("error", "Неверный номер карты");
      return;
    }
    
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      notify("error", "Неверный срок действия карты");
      return;
    }
    
    if (!/^\d{3}$/.test(cardCvc)) {
      notify("error", "Неверный CVC-код");
      return;
    }

    // Формирование запроса заказа
    const payload = {
      full_name: name,
      delivery_address: address,
      phone: phone,
      email: email,
      delivery_date: ymdToDmy(deliveryDateRaw),
      delivery_interval: deliveryInterval,
      comment: comment,
      subscribe: fd.get("newsletter") ? 1 : 0, // Отправляется "1", если пользователь подписался на рассылку или, если нет, 0
      good_ids: ids,
    };

    try {
      const created = await API.createOrder(payload);

      // Очистка корзины
      writeCart([]);
      form.reset();
      await render();

      let orderId = "неизвестен";
      if (created && created.id !== undefined && created.id !== null) {
        orderId = created.id;
      }

      if (notify) notify("success", "Заказ создан (ID: " + orderId + ")");
    } catch (err) {
      console.error(err);
      let errorMessage = "Не удалось создать заказ";
      
      if (err && err.message) {
        errorMessage = err.message;
      }
      
      notify("error", errorMessage);
    }
  });

  // Перерисовка корзины
  form.addEventListener("reset", function () {
    setTimeout(function () {
      render();
    }, 0);
  });

  // Отрисовка корзины
  render();
});