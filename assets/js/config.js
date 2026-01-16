export const CONFIG = {
  // персональный ключ
  //API_KEY: "2c38a968-6ffe-4e7c-bfea-1a31812a7035",

  // основной хост для Netlify/GitHub Pages (по методичке)
  BASE_URL: "https://edu.std-900.ist.mospolytech.ru",

  // ФОЛБЭК-хост на случай обрывов соединения с edu.* (иногда бывает ERR_CONNECTION_CLOSED)
  // Если этот хост у вас не отвечает по https — замените на рабочий https-хост из методички/препода.
  BASE_URL_FALLBACK: "https://api.std-900.ist.mospolytech.ru",

  // удобные составные поля для api.js (новая версия)
  API_BASE: "https://edu.std-900.ist.mospolytech.ru/exam-2024-1/api",
  API_BASE_FALLBACK: "https://api.std-900.ist.mospolytech.ru/exam-2024-1/api",

  // авторизация query-параметром
  AUTH_QUERY_NAME: "api_key",

  PAGE_SIZE: 8,

  // эндпоинты (если где-то ещё используются старые функции)
  ENDPOINTS: {
    GOODS: "/exam-2024-1/api/goods",
    AUTOCOMPLETE: "/exam-2024-1/api/autocomplete",
    ORDERS: "/exam-2024-1/api/orders",
  },
};

// Ключ, под которым API хранится в localStorage браузера
export const API_KEY_STORAGE = "shop_api_key";


// Получение API-ключа из localStorage
export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

// Сохранение API-ключа в localStorage
export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

// Удаление API-кдюча из localStorage
export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}
