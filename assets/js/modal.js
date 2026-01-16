// экспорт модуля контекстного окна
export function openModal(html) {
  const wrap = document.createElement("div"); // создание элемента
  wrap.className = "modal-backdrop"; // создание тени
  // формирование разметки окна
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal__close" aria-label="Закрыть">×</button>
      <div class="modal__content">${html}</div>
    </div>
  `;

  // удаление разметки
  function close() {
    wrap.remove();
    document.body.classList.remove("no-scroll");
  }

  // обработка клика
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) close(); // закрытие окна, если пользователь не нажал по нему
  });

  // Обработка клика по кнопке закрытия окна
  wrap.querySelector(".modal__close").addEventListener("click", close);

  // Добавление окна в страницу
  document.body.appendChild(wrap);
  document.body.classList.add("no-scroll"); // Запрет прокрутки страницы, пока действует это окно

  return { close, root: wrap }; // возврат объекта: закрытие вернет доступ к странице, root-ссылка на элемент в странице
}
