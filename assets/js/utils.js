// ограничение частоты вызова функции
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { // вывод всех собранных значений
    clearTimeout(t); // сброс предыдущего таймера
    t = setTimeout(() => fn(...args), ms); // установка нового таймера, только если за 200 мс не было новых вызовов
  };
}

// Форматирование денежных единиц
export function formatMoney(v) {
  const n = Number(v) || 0;
  return `${n.toLocaleString("ru-RU")} ₽`;
}

// Экранирование страницы (защита от XSS инъекции)
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

// Дата и время
export function toDdMmYyyyFromInput(dateStr) {
  // форматирование из yyyy-mm-dd в dd.mm.yyyy (в пользовательский интерфейс)
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).split("-"); // разбиение строки по тире
  if (!y) return ""; // возвращается пустая строка, если формат некорректный
  return `${d}.${m}.${y}`; // сбор даты в формате DD.MM.YYYY
}

// преобразование даты из dd.mm.yyyy в yyyy-mm-dd (для браузера)
export function fromDdMmYyyyToInput(dateStr) {
  if (!dateStr) return "";
  const [d, m, y] = String(dateStr).split("."); // разбиение строки по точке
  if (!y) return ""; // Возвращается пустая строка, если формат некорректный
  return `${y}-${m}-${d}`; // сбор даты в формате YYYY-MM-DD
}
