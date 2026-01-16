// Импортирование модулей конфигурации и получения API-ключа
import { CONFIG, getApiKey } from "./config.js";

// Парсер JSON
function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch (e) { // Возвращение к сырому тексту и отказу от исполнения на случай наличия ошибок
    return { raw: t };
  }
}

// формирование ссылки на основе ключа
function buildUrl(path, params) {
  let base = window.location.origin; // используется текущая ссылка

  // применение стандартной страницы в формировании
  if (CONFIG.BASE_URL && String(CONFIG.BASE_URL).trim()) {
    base = String(CONFIG.BASE_URL).trim();
  }

  // создание объекта ссылки
  const url = new URL(path, base);

  // ключ всегда задается
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Введите API Key");
  }

  // параметр с ключом берется из конфигурации
  url.searchParams.set(CONFIG.AUTH_QUERY_NAME, apiKey);

  // добавление остальных данных запроса
  if (params) {
    Object.entries(params).forEach(function (entry) {
      const k = entry[0];
      const v = entry[1];

      // пропуск пустых значений
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v)); // выставление новой ссылки
    });
  }

  return url.toString(); // возвращение готовой строки
}

// функция запроса
async function request(method, path, options) {
  let params = null; // параметры
  let body = null; // тело запроса
  let signal = null; // для отмены запроса

  // экранизация параметров запроса (запросы принимаются/отправляются только после проверки на действительность)
  if (options) {
    if (options.params !== undefined) params = options.params;
    if (options.body !== undefined) body = options.body;
    if (options.signal !== undefined) signal = options.signal;
  }

  // Определение тела запроса
  const hasBody = body !== undefined && body !== null;

  // базовые параметры отправки запросов
  const fetchOptions = {
    method: method,
  };

  // отправляется JSON на случай наличия тела запроса
  if (hasBody) {
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = JSON.stringify(body);
  }

  // Ну или отклоняется запрос
  if (signal) {
    fetchOptions.signal = signal;
  }

  // Исполнение запроса
  const res = await fetch(buildUrl(path, params), fetchOptions);

  // Считывание ответа в качестве текста
  const text = await res.text();
  let data = null;

  // при наличии текста идет его считывание
  if (text) {
    data = safeJson(text);
  }

  // если статус не ОК, то формируется ошибка
  if (!res.ok) {
    let msg = "Ошибка запроса (" + res.status + ")";
    if (data && (data.message || data.error)) {
      msg = data.message || data.error;
    }
    throw new Error(msg);
  }

  return data;
}

// Основной объект API
export const API = {
  // GET /goods?page=&per_page=&query=
  async getGoods(opts) {
    let page = 1;
    let per_page = CONFIG.PAGE_SIZE;
    let query = undefined;

    // Разбор входных параметров
    if (opts) {
      if (opts.page !== undefined) page = opts.page;
      if (opts.per_page !== undefined) per_page = opts.per_page;
      if (opts.query !== undefined) query = opts.query;
    }

    return request("GET", CONFIG.ENDPOINTS.GOODS, {
      params: {
        page: page,
        per_page: per_page,
        query: query,
      },
    });
  },

  // Получение товара по ID
  // GET /goods/{good-id}
  async getGoodById(id) {
    return request("GET", CONFIG.ENDPOINTS.GOODS + "/" + id);
  },

  // Автодополнение запроса + отмена запроса
  // GET /autocomplete?query=
  async autocomplete(query, opts) {
    let signal = null;
    if (opts && opts.signal !== undefined) {
      signal = opts.signal;
    }

    // Вывод запроса
    return request("GET", CONFIG.ENDPOINTS.AUTOCOMPLETE, {
      params: { query: query },
      signal: signal,
    });
  },

  // Получение всех заказов
  async getOrders() {
    return request("GET", CONFIG.ENDPOINTS.ORDERS);
  },

  // Получение заказа по ID
  async getOrderById(orderId) {
    return request("GET", CONFIG.ENDPOINTS.ORDERS + "/" + orderId);
  },

  // Создание нового заказа
  async createOrder(payload) {
    return request("POST", CONFIG.ENDPOINTS.ORDERS, { body: payload });
  },

  // Изменение заказа(Обновление)
  async updateOrder(orderId, payload) {
    return request("PUT", CONFIG.ENDPOINTS.ORDERS + "/" + orderId, {
      body: payload,
    });
  },

  // Удаление заказа
  async deleteOrder(orderId) {
    return request("DELETE", CONFIG.ENDPOINTS.ORDERS + "/" + orderId);
  },
};

// Совместимые именованные экспорты
// для работоспособности старых фрагментов кода
export async function getGoods(page, per_page, query) { // Старый формат вызова товаров
  let p = 1; // страницы
  if (page !== undefined) {
    p = page;
  }

  let pp = CONFIG.PAGE_SIZE; // размер страницы
  if (per_page !== undefined) {
    pp = per_page;
  }

  return API.getGoods({ // итоговый запрос
    page: p,
    per_page: pp,
    query: query
  });
}

export async function getGoodById(id) {
  return API.getGoodById(id);
}

// Поддержка старых и новых вызовов автодополнения
export async function getAutocomplete(queryOrOpts, maybeSignal) {
  if (queryOrOpts && typeof queryOrOpts === "object") { // Проверка существования аргумента и правильности его типа
    return API.autocomplete(queryOrOpts.query, { signal: queryOrOpts.signal });
  }
  // иначе это строка запроса
  return API.autocomplete(queryOrOpts, { signal: maybeSignal });
}

export async function autocomplete(queryOrOpts, maybeSignal) {
  return getAutocomplete(queryOrOpts, maybeSignal);
}

export async function getOrders() {
  return API.getOrders();
}

export async function getOrderById(orderId) {
  return API.getOrderById(orderId);
}

export async function createOrder(payload) {
  return API.createOrder(payload);
}

export async function updateOrder(orderId, payload) {
  return API.updateOrder(orderId, payload);
}

export async function deleteOrder(orderId) {
  return API.deleteOrder(orderId);
}
