// Импортирование модулей API, окон и уведомлений
import { API } from "./api.js";
import { openModal } from "./modal.js";
import { initNotifications, notify } from "./notifications.js";

// поиск внутри страницы (включая корневого каталога)
function $(sel, root) {
  if (!root) root = document;
  return root.querySelector(sel);
}

// форматирование даты и времени
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!isNaN(d.getTime())) {
    function pad(n) {
      return String(n).padStart(2, "0");
    }
    return (
      d.getFullYear() + "-" +
      pad(d.getMonth() + 1) + "-" +
      pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" +
      pad(d.getMinutes()) + ":" +
      pad(d.getSeconds())
    );
  }
  return String(iso); // если строка некорректна, то она возвращается так как есть
}

// формирование строки доставки (дата и интервал)
function fmtDelivery(order) {
  let date = "";
  let interval = "";

  // Проверка существования заказа и извлечение заданной даты доставки. Также с интервалом
  if (order && order.delivery_date) date = order.delivery_date;
  if (order && order.delivery_interval) interval = order.delivery_interval;

  // Если оба данных присутствуют то они вносятся в две строки через перевод
  if (date && interval) return (date + "\n" + interval).trim();
  return (date + interval).trim(); // сохранение переноса строки и удаление лишних пробелов
}

// форматирование стоимости в рублях
function rub(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return String(num) + " ₽";
}

// экранирование страницы от XSS инъекции
function escapeHtml(s) {
  if (s === undefined || s === null) s = "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// окно подтверждения
function confirmModal(message, opts) {
  // сами кнопки
  let okText = "OK";
  let cancelText = "Отмена";
  let title = "Подтверждение";

  // переопределение текста кнопок и заголовка
  if (opts) {
    if (opts.okText) okText = opts.okText;
    if (opts.cancelText) cancelText = opts.cancelText;
    if (opts.title) title = opts.title;
  }

  // открытие окна путем быстрого формирования HTML страницы и получения стиля
  return new Promise(function (resolve) {
    const modal = openModal(
      '<div style="display:flex; flex-direction:column; gap:12px; min-width:280px;">' +
        "<h3 style=\"margin:0;\">" + escapeHtml(title) + "</h3>" +
        "<div>" + escapeHtml(message) + "</div>" +
        '<div style="display:flex; gap:10px; justify-content:flex-end; margin-top:6px;">' +
          '<button type="button" class="btn" data-cancel>' + escapeHtml(cancelText) + "</button>" +
          '<button type="button" class="btn" data-ok>' + escapeHtml(okText) + "</button>" +
        "</div>" +
      "</div>"
    );

    // метод закрытия окна 
    const close = modal.close;
    const root = modal.root;

    function done(v) { // завершение работы окна
      close();
      resolve(v);
    }

    // обработка кнопки ОК: завершение работы окна
    root.querySelector("[data-ok]").addEventListener("click", function () {
      done(true);
    });

    // Обработка кнопки отмены: отмена завершения работы окна
    root.querySelector("[data-cancel]").addEventListener("click", function () {
      done(false);
    });

    // Обработка нажатия по иныб объектам: завершение работы окна
    root.addEventListener("click", function (e) {
      if (e.target === root) done(false);
    });
  });
}

// кэширование товаров (массив с заполнением результатов вызова функции для каждого элемента)
const goodCache = new Map();

// Получение товара по ID
async function getGood(id) {
  if (goodCache.has(id)) return goodCache.get(id); // При товара идет его вывод
  try { // Или загрузка товара с сервера
    const g = await API.getGoodById(id);
    goodCache.set(id, g); // сохранение товара в кэш
    return g; // вывод товара
  } catch (e) { // при ошибке создается запасной объект, чтобы интерфейс не ломался
    const g = { id: id, name: "Товар #" + id, actual_price: null, discount_price: null };
    goodCache.set(id, g); // кэшируется запасной объект и выводится
    return g;
  }
}

// Формирование метаданных по заказу
async function buildOrderMeta(order) {
  let ids = []; // массив товаров, входящих в заказ
  if (order && Array.isArray(order.good_ids)) ids = order.good_ids; // Если имеются заказ и массив товаров, то это все добавляется в исходный массив

  // загрузка всех данных товаров заказа
  const goods = await Promise.all(ids.map(function (id) {
    return getGood(id);
  }));

  // формирование массива названий товаров
  const names = goods
    .map(function (g) { // на случай отствуствия названия выводится его ID
      if (g && g.name) return g.name;
      if (g && g.id !== undefined) return "Товар #" + g.id;
      return "";
    })
    .filter(Boolean); // удаление пустых строк

    // формирование компактного краткого описания товаров
  let composition = "—";
  if (names.length === 1) composition = names[0];
  if (names.length > 1) composition = names[0] + " … и ещё " + (names.length - 1); // сжатие описания

  // подсчет общей стоимости заказа
  const cost = goods.reduce(function (sum, g) {
    let p = null; // текущая цена товара
    if (g) { // проверка существования объекта товара
      if (g.discount_price !== undefined && g.discount_price !== null) p = g.discount_price; // приоритезация скидки (если скидка имеется)
      else if (g.actual_price !== undefined && g.actual_price !== null) p = g.actual_price; // иначе использование обычной стоимости
    }

    // Приведение цены в числовой вид
    const v = Number(p);
    if (Number.isFinite(v)) return sum + v; // суммирование стоимости
    return sum;
  }, 0); // начальное значение общей стоимости: 0

  return { composition: composition, cost: cost, names: names, goods: goods }; // вывод результатов вычислений
  // описание, стоимость, название и массив объектов товаров
}

// Диалогое окно редактирование заказа
function ensureDialog() {
  let dlg = $("#order-edit-dialog"); // поиск существующего диалогового окна по ID
  if (dlg) return dlg; // вывод существующего окна

  // Иначе создание нового окна с разметкой и css
  dlg = document.createElement("dialog");
  dlg.id = "order-edit-dialog";
  dlg.style.maxWidth = "520px";
  dlg.style.width = "calc(100% - 24px)";
  dlg.innerHTML =
    '<form method="dialog" style="display:flex; flex-direction:column; gap:12px;">' +
      "<h3 style=\"margin:0;\">Редактирование заказа</h3>" +
      '<label><span>Адрес доставки</span><input name="delivery_address" type="text" required /></label>' +
      '<label><span>Дата доставки</span><input name="delivery_date" type="date" required /></label>' +
      '<label><span>Интервал доставки</span>' +
        '<select name="delivery_interval" required>' +
          '<option value="08:00-12:00">08:00-12:00</option>' +
          '<option value="12:00-14:00">12:00-14:00</option>' +
          '<option value="14:00-18:00">14:00-18:00</option>' +
          '<option value="18:00-22:00">18:00-22:00</option>' +
        "</select>" +
      "</label>" +
      '<label><span>Комментарий</span><textarea name="comment" rows="3"></textarea></label>' +
      '<div style="display:flex; gap:10px; justify-content:flex-end;">' +
        '<button type="button" data-cancel>Отмена</button>' +
        '<button type="submit" data-save>Сохранить</button>' +
      "</div>" +
    "</form>";

  document.body.appendChild(dlg); // добавление на страницу
  dlg.querySelector("[data-cancel]").addEventListener("click", function () { // обработка кнопки отмены
    dlg.close("cancel"); // выход
  });

  return dlg; // возвращение диалогового окна
}

// открытие диалогового окна редактирования заказа
async function openEdit(order) {
  const dlg = ensureDialog(); // получение/создания диалогового окна
  const form = dlg.querySelector("form"); // поиск форму внутри диалогового окна

  // заполнение полей формы текущими значениями заказа
  // значения подставляются по умолчанию на случай отсутствия данных
  form.elements.delivery_address.value = order.delivery_address || "";
  form.elements.delivery_interval.value = order.delivery_interval || "08:00-12:00";
  form.elements.comment.value = order.comment || "";

  // подготовка даты доставки
  let d = order.delivery_date || "";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) { // формирование даты в формате YYYY-MM-DD
    const p = d.split(".");
    form.elements.delivery_date.value = p[2] + "-" + p[1] + "-" + p[0];
  } else { // или сохранение исходника, если оно соответствует регулярному выражению
    form.elements.delivery_date.value = d;
  }

  // копирование формы, чтобы данные не перенеслись на другой заказ
  const clone = form.cloneNode(true);
  dlg.replaceChild(clone, form);

  // обработка кнопки отмены
  clone.querySelector("[data-cancel]").addEventListener("click", function () {
    dlg.close("cancel");
  });

  // обработка кнопки сохранить
  clone.addEventListener("submit", async function (e) {
    e.preventDefault(); // отключение браузерной функции кнопки
    const fd = new FormData(clone); // считывание данных формы через интерфейс FormData (для HTML)
    const payload = { // формирование запроса на обновление заказа
      delivery_address: String(fd.get("delivery_address") || "").trim(),
      delivery_date: String(fd.get("delivery_date") || "").trim(),
      delivery_interval: String(fd.get("delivery_interval") || "").trim(),
      comment: String(fd.get("comment") || "").trim(),
    };

    try {
      await API.updateOrder(order.id, payload); // отправка обновления заказа на сервер
      dlg.close("save"); // закрытие диалогового окна с сохранением изменений
    } catch (err) { // на случай ошибки отображается уведомление
      let msg = "Не удалось обновить заказ";
      if (err && err.message) msg = err.message;
      notify("error", msg);
    }
  });

  dlg.showModal(); // показ диалогового окна, блокируя остальную страницу

  return new Promise(function (resolve) { // возвращение результата с загрузкой
    dlg.addEventListener("close", function onClose() { // обработка закрытия окна
      dlg.removeEventListener("close", onClose); // закрытие обработчика
      resolve(dlg.returnValue); // завершение работы окна с или без сохранения изменений
    });
  });
}

// ожидание полноценной загрузки страницы
document.addEventListener("DOMContentLoaded", async function () {
  initNotifications(); // загрузка уведомлений
  const tbody = document.querySelector("tbody[data-orders]"); // поиск данных о заказе
  const noOrders = document.querySelector("[data-no-orders]"); // поиск ответа "заказов нет"

  if (!tbody) return; // если данных о заказе нет, то нет смысла в продолжении

  async function load() { // загрузка заказов и отрисовки таблицы
    tbody.innerHTML = ""; // очистка страницы
    if (noOrders) noOrders.style.display = "none"; // сокрытие текста

    let orders;
    try { // получение списка заказов с сервера
      orders = await API.getOrders();
    } catch (err) { // на случай ошибки показывается сообщение об ошибке
      if (noOrders) {
        noOrders.style.display = "block";
        noOrders.textContent = "Ошибка загрузки заказов";
      }
      return;
    }

    if (!Array.isArray(orders) || orders.length === 0) { // если заказов нет, то показывается блок "нет заказов"
      if (noOrders) noOrders.style.display = "block";
      return;
    }

    orders.sort(function (a, b) { // сортировка по убыванию id
      return Number(b.id || 0) - Number(a.id || 0);
    });

    // проход по заказам и создание строк таблицы
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i]; // присваивание индекса массива переменной
      const meta = await buildOrderMeta(o); // создание метаданных заказа

      // создание строки таблицы и дальнейшее заполнение разверткой
      const tr = document.createElement("tr");
      tr.innerHTML = // форматирование страницы в читаемый вид
        "<td>" + (o.id || "") + "</td>" +
        "<td style=\"white-space:pre-line;\">" + fmtDateTime(o.created_at) + "</td>" + // дата
        "<td>" + meta.composition + "</td>" + // состав заказа
        "<td>" + rub(meta.cost) + "</td>" + // стоимость в рублях
        "<td style=\"white-space:pre-line;\">" + fmtDelivery(o) + "</td>" + // доставка
        '<td><button data-edit="' + o.id + '">Редакт.</button> ' + // кнопки действий
        '<button data-del="' + o.id + '">Удалить</button></td>';

      tbody.appendChild(tr); // добавление элемента в страницу
    }
  }

  // события клика по кнопкам в таблице
  tbody.addEventListener("click", async function (e) {
    const editBtn = e.target.closest("[data-edit]"); // редактирование
    const delBtn = e.target.closest("[data-del]"); // удаления

    // на случай нажатия на кнопку редактирования
    if (editBtn) {
      // ID заказа приводится к числу из data-edit
      const id = Number(editBtn.dataset.edit);
      if (!Number.isFinite(id)) return;

      // загрузка всех заказов для нахождения полного объекта по id
      let orders = await API.getOrders();
      const order = orders.find(function (o) {
        return Number(o.id) === id;
      });

      if (!order) {
        notify("error", "Заказ не найден");
        return;
      }

      const res = await openEdit(order); // открывается диалоговое окно и ожидается результат
      if (res === "save") await load(); // сохранение изменений
      return;
    }

    if (delBtn) { // кнопка удаления
      const id = Number(delBtn.dataset.del); // ID заказа приводится к числу
      if (!Number.isFinite(id)) return; // проверка ID

      // отдельное подтверждение удаления заказа
      const ok = await confirmModal("Удалить заказ #" + id + "?", {
        title: "Удаление заказа",
        okText: "Удалить",
        cancelText: "Отмена",
      });

      if (!ok) return; // если не нажат ОК, то диалоговое окно остается

      try {
        await API.deleteOrder(id); // удаление заказа на сервере
        notify("success", "Заказ #" + id + " удалён"); // уведомление об удалении
        await load(); // перезагрузка табьлицы заказов
      } catch (err) { // в случае ошибки выводится уведомление
        let msg = "Не удалось удалить заказ";
        if (err && err.message) msg = err.message;
        notify("error", msg);
      }
    }
  });

  load(); // первичная загрузка списка всех заказов
});
