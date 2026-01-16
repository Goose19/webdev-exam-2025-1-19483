let container; // создание контейнера уведомлений

export function initNotifications() { // инициализация системы уведомлений
  // ищется контейнер для тост-уведомлений (маленьких временных всплывающиъ окон)
  container = document.querySelector("[data-notify] .container");
}

// создание и показ уведомлений
export function notify(type, text) {
  if (!container) return; // если контейнера нет, то показ невозможен

  // Защита от пустых уведомлений
  if (typeof text !== "string" || !text.trim()) return;

  // создание элемента уведомлений и задача его класса и значения
  const el = document.createElement("div");
  el.className = "toast toast--" + type; // toast toast-- - модификатор уведомления (success, error, info)
  el.textContent = text;

  // Добавление уведомлений в контейнер
  container.appendChild(el);

  // Активация корневого контейнера уведомлений для показа блока
  const root = container.closest("[data-notify]");
  if (root) {
    root.classList.add("notify--active");
  }

  // Установка таймера автоматического удаления уведомления
  setTimeout(function () {
    el.remove(); // удаление текущего уведомления

    // Контейнер скрывается при отсутствии уведомлений
    if (!container.children.length) {
      const rootInner = container.closest("[data-notify]");
      if (rootInner) {
        rootInner.classList.remove("notify--active");
      }
    }
  }, 5000); // 5 секунд
}
