// Импорт модулей API, импорт и удаление ключа, уведомления
import { API } from './api.js';
import { getApiKey, setApiKey, clearApiKey } from './config.js';
import { initNotifications, notify } from "./notifications.js";

document.addEventListener('DOMContentLoaded', function () {
  // безопасное навешивание событий
  function on(el, evt, fn, opts) {
    if (el) el.addEventListener(evt, fn, opts);
  }

  // Элементы
  const els = {
    form: document.querySelector('[data-search]'),
    input: document.querySelector('[data-search-input]'),
    btnSearch: document.querySelector('[data-search] button[type="submit"]'),
    suggest: document.querySelector('[data-suggest]'),
    sort: document.querySelector('[data-sort]'),
    priceMin: document.querySelector('[data-min-price]'),
    priceMax: document.querySelector('[data-max-price]'),
    discountOnly: document.querySelector('[data-discount-only]'),
    applyFilters: document.querySelector('[data-apply]'),
    categoriesWrap: document.querySelector('[data-categories]'),
    catalog: document.querySelector('[data-cards]') || document.querySelector('[data-catalog]'),
    empty: document.querySelector('[data-empty]'),
    loadMore: document.querySelector('[data-load-more]'),
    apiKeyInput: document.querySelector('[data-api-key-input]'),
    apiKeySave: document.querySelector('[data-api-key-save]'),
    apiKeyClear: document.querySelector('[data-api-key-clear]'),
  };

  // Инициализация уведомлений
  initNotifications();

  // Защита от отсутствия контейнера каталога
  if (!els.catalog) {
    console.error('Catalog container not found: expected [data-cards]');
    return;
  }

  // При сохранении API идет процесс автоматического ввода
  if (els.apiKeyInput) {
    els.apiKeyInput.value = getApiKey() || '';
  }

  // Кнопка "ОК"
  on(els.apiKeySave, 'click', async function (e) {
    e.preventDefault();

    let key = '';
    if (els.apiKeyInput) {
      key = String(els.apiKeyInput.value || '').trim();
    }

    // Проверка на пустой ввод
    if (!key) {
      notify("error", "Введите API-ключ");
      return;
    }

    // Сохранение API-ключа
    setApiKey(key);

    try {
      // Валидация API-ключа (отправка пробного запроса)
      await API.getGoods({ page: 1, per_page: 1 });
      notify("success", "API-ключ принят сервером");
      hideSuggest();
      loadGoods({ reset: true });
    } catch (err) {
      // Ключ удаляется, если он невалиден
      clearApiKey();
      if (els.apiKeyInput) els.apiKeyInput.value = '';
      notify("error", "Неверный API-ключ");
      setEmptyVisible(true);
      if (els.empty) els.empty.textContent = 'Введите корректный API-ключ и нажмите OK';
    }
  });

  // Кнопка "X"
  on(els.apiKeyClear, 'click', function (e) {
    e.preventDefault();
    clearApiKey();
    if (els.apiKeyInput) els.apiKeyInput.value = '';
    clearCatalog();
    setEmptyVisible(true);
    if (els.empty) els.empty.textContent = 'Введите API-ключ сверху и нажмите OK';
  });

  let sortDefault = 'rating:desc';
  if (els.sort && els.sort.value) {
    sortDefault = els.sort.value;
  }
  
  let minDefaultValue = null;
  if (els.priceMin) minDefaultValue = els.priceMin.value;
  
  let maxDefaultValue = null;
  if (els.priceMax) maxDefaultValue = els.priceMax.value;
  
  let discountDefault = false;
  if (els.discountOnly) discountDefault = !!els.discountOnly.checked;
  
  // Хранение каталога
  const state = {
    page: 1,
    perPage: 8,
    query: '',
    sort: sortDefault,
    minPrice: parseNumber(minDefaultValue),
    maxPrice: parseNumber(maxDefaultValue),
    discountOnly: discountDefault,
    categories: new Set(),
    allFetched: [],
    isLoading: false,
  };

  // Преобразование строки в число (с учетом запятых: double)
  function parseNumber(v) {
    const n = Number(String(v || '').replace(',', '.').trim());
    if (Number.isFinite(n)) return n;
    return null;
  }

  // Форматирование цены
  function formatPrice(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return String(x) + ' ₽';
  }

  // Получение ID товаров из корзины
  function getCartIds() {
    try {
      const raw = localStorage.getItem('cart_good_ids');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
      return [];
    } catch (e) {
      return [];
    }
  }

  // Сохранение корзины
  function setCartIds(ids) {
    localStorage.setItem('cart_good_ids', JSON.stringify(ids));
  }

  // Добавление товара в корзину с проверкой на наличие дублей
  function addToCart(id) {
    const ids = getCartIds();
    if (ids.indexOf(id) === -1) {
      ids.push(id);
      setCartIds(ids);
    }
  }

  // Сортировка товаров
  function sortGoods(goods, sortKey) {
    const arr = goods.slice();

    if (sortKey === 'rating:asc') {
      return arr.sort(function (a, b) {
        return Number(a.rating || 0) - Number(b.rating || 0);
      });
    }

    if (sortKey === 'rating:desc') {
      return arr.sort(function (a, b) {
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
    }

    if (sortKey === 'price:asc') {
      return arr.sort(function (a, b) {
        return Number(a.discount_price || a.actual_price || 0) - Number(b.discount_price || b.actual_price || 0);
      });
    }

    if (sortKey === 'price:desc') {
      return arr.sort(function (a, b) {
        return Number(b.discount_price || b.actual_price || 0) - Number(a.discount_price || a.actual_price || 0);
      });
    }

    return arr;
  }

  // Локальные фильтры
  function applyLocalFilters(goods) {
    let res = goods.slice();

    // Фильтр по категориям
    if (state.categories.size) {
      res = res.filter(function (g) {
        return state.categories.has(g.main_category);
      });
    }

    // Фильтр по цене
    const min = state.minPrice;
    const max = state.maxPrice;

    if (min !== null) {
      res = res.filter(function (g) {
        return Number(g.discount_price || g.actual_price || 0) >= min;
      });
    }

    if (max !== null) {
      res = res.filter(function (g) {
        return Number(g.discount_price || g.actual_price || 0) <= max;
      });
    }

    // Только товары со скидкой
    if (state.discountOnly) {
      res = res.filter(function (g) {
        return Number(g.discount_price || 0) < Number(g.actual_price || 0);
      });
    }

    return res;
  }

  function setEmptyVisible(isEmpty) {
    if (!els.empty) return;

    if (isEmpty) {
      els.empty.style.display = 'block';
    } else {
      els.empty.style.display = 'none';
    }
  }

  function clearCatalog() {
    els.catalog.innerHTML = '';
  }

  // Экранирование (защита от XSS)
  function escapeHtml(s) {
    if (s === undefined || s === null) s = '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Карточки товаров
  function createCard(good) {
    let category = '';
    if (good.sub_category) category = good.sub_category;
    else if (good.main_category) category = good.main_category;

    const actual = Number(good.actual_price || 0);
    const discount = Number(good.discount_price || 0);

    let hasDiscount = false;
    if (
      Number.isFinite(actual) &&
      Number.isFinite(discount) &&
      discount > 0 &&
      discount < actual
    ) {
      hasDiscount = true;
    }

    let priceHtml = '<span class="price-new">' + formatPrice(actual) + '</span>';
    if (hasDiscount) {
      priceHtml =
        '<span class="price-old">' + formatPrice(actual) + '</span>' +
        '<span class="price-new">' + formatPrice(discount) + '</span>';
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML =
      '<img class="product-image" src="' + good.image_url + '" alt="' + escapeHtml(good.name) + '" loading="lazy" />' +
      '<div class="product-title">' + escapeHtml(good.name) + '</div>' +
      '<div class="product-meta">Категория: ' + escapeHtml(category) + '</div>' +
      '<div class="product-meta">Цена: ' + priceHtml + '</div>' +
      '<div class="product-meta">Рейтинг: ' + Number(good.rating || 0).toFixed(1) + '</div>' +
      '<button class="btn add-to-cart" data-add-to-cart="' + good.id + '">В корзину</button>';

    return card;
  }

  // Отображение категорий
  function renderCategoriesFromGoods(goods) {
    if (!els.categoriesWrap) return;

    const uniq = new Map();

    goods.forEach(function (g) {
      if (g && g.main_category) {
        if (!uniq.has(g.main_category)) {
          uniq.set(g.main_category, true);
        }
      }
    });

    if (!uniq.size) return;

    const selected = state.categories;

    els.categoriesWrap.innerHTML = '';
    uniq.forEach(function (_v, cat) {
      const safeId = String(cat).replace(/[^a-z0-9]+/gi, '_');
      const id = 'cat_' + safeId;

      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';
      label.style.margin = '6px 0';

      let checkedAttr = '';
      if (selected.has(cat)) checkedAttr = 'checked';

      label.innerHTML =
        '<input type="checkbox" id="' + id + '" ' + checkedAttr + ' />' +
        '<span>' + escapeHtml(cat) + '</span>';

      const input = label.querySelector('input');
      input.addEventListener('change', function () {
        if (input.checked) selected.add(cat);
        else selected.delete(cat);
      });

      els.categoriesWrap.appendChild(label);
    });
  }

  // Поиск / автодополнение
  let acAbort = null; // отмена предыдущего запроса автодополнения, чтобы отместить устаревшие ответы
  let acTimer = null; // таймер, чтобы не дергать API ежесекундно

  // Сокрытие выпадающий список подсказок
  // Проверка существования контейнера подсказок, где далее очищается страница и освобождается место
  function hideSuggest() {
    if (!els.suggest) return;
    els.suggest.innerHTML = '';
    els.suggest.style.display = 'none';
  }

  // Отображение подсказок
  function showSuggest(items) { // массив строк (вариантов автодополнения)
    if (!els.suggest) return; // если ничего нет, то ничего не выводится

    // если подсказок нет, то список скрывается
    if (!items.length) {
      hideSuggest();
      return;
    }

    // создается список и стилизуется
    const ul = document.createElement('ul');
    ul.className = 'suggest-list';
    ul.style.listStyle = 'none';
    ul.style.margin = '0';
    ul.style.padding = '6px 0';

    // берется максимум 8 подсказок
    items.slice(0, 8).forEach(function (text) {
      const li = document.createElement('li'); // создаются пункты
      li.className = 'suggest-item';
      li.textContent = text; // тоже экранирование (защита от XSS в виде применения textContent)
      li.style.padding = '8px 12px';
      li.style.cursor = 'pointer';


      // Применение mousedown вместо клика, ибо список может скрыться при наведении на элемент
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        applySuggestion(text);
        hideSuggest();
      });

      ul.appendChild(li);
    });

    // Очистка страницы
    els.suggest.innerHTML = '';
    els.suggest.appendChild(ul);
    els.suggest.style.display = 'block';
  }

  // Замена последнего введенного слова на иное
  function replaceLastWord(inputValue, replacement) { // своего рода обновление предложения
    const v = String(inputValue || '');
    // проверка наличия пробела, система понимает, что слово уже завершено
    const endsWithSpace = /\s$/.test(v);

    // уборка лишних пробелов по краям
    const parts = v.trimEnd().split(/\s+/).filter(Boolean);
    if (!parts.length) return replacement; // если слов нет, то просто возвращается обновление

    // замена последнего слова на предложение
    parts[parts.length - 1] = replacement;

    // сборка строки
    let out = parts.join(' ');
    if (endsWithSpace) out += ' ';
    return out;
  }

  // применение подсказки (вставка в поле ввода)
  function applySuggestion(text) {
    if (!els.input) return;
    els.input.value = replaceLastWord(els.input.value, text);
  }

  // Создание запроса к API автодополнения
  async function fetchAutocomplete() {
    if (!els.input) return;

    // Берется введенное значение (пробелы обрезаны)
    const value = String(els.input.value || '').trim();
    // Если такового нет, то просто подсказка скрывается
    if (!value) {
      hideSuggest();
      return;
    }

    // запрос автодополнения по последнему слову
    const parts = value.split(/\s+/);
    let lastWord = value;
    if (parts.length) lastWord = parts[parts.length - 1];

    // Страховка: если последнее слово пустое, то оно просто используется (повтор присвоения значения переменной)
    if (!lastWord) lastWord = value;

    // API не дергается при слишком коротком слове
    if (lastWord.length < 2) {
      hideSuggest();
      return;
    }

    // Если есть незавершенный запрос, то он обрывается
    if (acAbort) acAbort.abort();
    acAbort = new AbortController();

    try { // Создание запроса к API автодополнения
      const list = await API.autocomplete(lastWord, { signal: acAbort.signal });

      // Отображается массив на случай наличия, иначе ничего не выводится
      if (Array.isArray(list)) showSuggest(list);
      else showSuggest([]);
    } catch (e) { // Сокрытие подсказок при наличии ошибок
      hideSuggest();
    }
  }

  // Откладывание автодополнения на случай отсутствия поля ввода
  function scheduleAutocomplete() {
    if (!els.input) return;
    clearTimeout(acTimer); // Сброс таймера для API
    acTimer = setTimeout(fetchAutocomplete, 200); // Таймер автоматически сбрасывается после активного ввода текста
  }

  // Загрузка товаров
  async function loadGoods(opts) {
    // Изначально загружается первая страница (reset)
    let reset = false;
    if (opts && opts.reset) reset = true; // переключение режима на новую выдачу товаров

    // Защита от повторных запросов для защиты от дубликатов товаров
    if (state.isLoading) return;
    state.isLoading = true;

    try {
      // Если применены новые фильтры/поиск/сортировка, то страница сбрасывается, отображая запрос
      if (reset) {
        state.page = 1;
        state.allFetched = [];
        clearCatalog();
      }

      // Параметры для API запроса
      const params = {
        page: state.page,
        per_page: state.perPage,
      };

      // Возвращение товаров по запросу в порядке очереди
      if (state.query) {
        params.query = state.query;
      }

      // Запрос товаров
      const resp = await API.getGoods(params);

      // Нормализация формата ответа
      let goods = [];
      if (resp && Array.isArray(resp.goods)) {
        goods = resp.goods;
      } else if (Array.isArray(resp)) {
        goods = resp;
      }

      // Загруженные товары копятся в качестве кэша
      state.allFetched.push.apply(state.allFetched, goods);

      // категории строятся в начале прогрузки
      if (state.page === 1 && goods.length) {
        renderCategoriesFromGoods(state.allFetched);
      }

      // Применение фильтров к текущей странице
      let view = applyLocalFilters(goods);
      view = sortGoods(view, state.sort);

      // Обновление состояния страницы
      if (reset) {
        setEmptyVisible(view.length === 0);
      }

      // Рендер карточек
      view.forEach(function (g) {
        els.catalog.appendChild(createCard(g));
      });

      // Логика кнопки "Показать ещё"
      if (els.loadMore) {
        const canMore = goods.length >= state.perPage;
        if (canMore) { // стилистика
          els.loadMore.style.display = 'inline-block';
        } else {
          els.loadMore.style.display = 'none';
        }
      }

      // Вывод информации на случай конца отображения с API
      if (reset && view.length === 0) {
        if (els.empty) {
          if (state.query) {
            els.empty.textContent = 'Нет товаров, соответствующих вашему запросу';
          } else {
            els.empty.textContent = 'Нет товаров для отображения';
          }
        }
      }
    } catch (e) { // Ошибка запроса
      console.error(e);
      setEmptyVisible(true);
      if (els.empty) {
        els.empty.textContent = 'Не удалось загрузить товары. Попробуйте обновить страницу.';
      }
    } finally { // снимается блокировка загрузки при любом исходе
      state.isLoading = false;
    }
  }

  // Синхронизация фильтров и сортировки интерфейса
  function syncFiltersFromUI() {
    let minVal = null; // минимальная и максимальная цена
    let maxVal = null;

    // считывание минимальной и максимальной цены
    if (els.priceMin) minVal = els.priceMin.value;
    if (els.priceMax) maxVal = els.priceMax.value;

    // преобразование строки в числа
    state.minPrice = parseNumber(minVal);
    state.maxPrice = parseNumber(maxVal);

    // boolean наличие скидки
    let disc = false; // флаг "только со скидкой"
    if (els.discountOnly) disc = !!els.discountOnly.checked;
    state.discountOnly = disc;

    // считывание выбранного типа сортировки, где обновляется страница
    if (els.sort && els.sort.value) {
      state.sort = els.sort.value;
    }
  }

  // Поиск товаров по текущему значению поля ввода в момент отправки формы и нажатии кнопки поиска
  function doSearch() {
    if (!els.input) return; // проверка на пустую строку поиска, ибо невозможен пустой запрос

    // считывание текста, приведениек строке и избавление от лишних пробелов
    state.query = String(els.input.value || '').trim();
    syncFiltersFromUI(); // синхронизация фильтров и сортировки из UI
    hideSuggest(); // сокрытие списка автодополнения
    loadGoods({ reset: true }); // Новая прогрузка товаров
  }

  // Обработка формы поиска, предотвращая перезагрузку страницы
  on(els.form, 'submit', function (e) {
    e.preventDefault();
    doSearch();
  });

  // обработка кнопки "поиск"
  on(els.btnSearch, 'click', function (e) {
    e.preventDefault();
    doSearch();
  });

  // Обработка ввода текста в поле поиска
  on(els.input, 'input', function () {
    scheduleAutocomplete();
  });

  // Обработка клавиш
  on(els.input, 'keydown', function (e) {
    if (e.key === 'Escape') hideSuggest(); // сокрытие подсказок при нажатии Esc
    if (e.key === 'Enter') { // запуск поиска по подсказке при нажатии на Enter
      e.preventDefault();
      doSearch();
    }
  });

  // Обтработка клика по документу (закрытие спискуа автодополнения путем клика вне поля)
  document.addEventListener('mousedown', function (e) {
    const t = e.target;

    // Если существует контейнер подсказок и нажато поле ввода, то контейнер остается
    if (els.suggest && (t === els.input || els.suggest.contains(t))) return;
    hideSuggest(); // в остальных случаях сокрывается подскаска
  });

  // Обработка кнопки "Применить фильтры"
  on(els.applyFilters, 'click', function (e) {
    e.preventDefault(); // предотвращение "перехода" по ссылке во время нажатия на кнопку
    syncFiltersFromUI();
    loadGoods({ reset: true }); // Повторная прогрузка страницы с учетом фильтрации
  });

  // Обработка изменения сортировки
  on(els.sort, 'change', function () {
    syncFiltersFromUI();
    loadGoods({ reset: true }); // Повторная прогрузка страницы с учетом сортировки
  });

  // Обработка кнопки "Показать ещё"
  on(els.loadMore, 'click', function (e) {
    e.preventDefault(); // Предотвращение "перехода" по ссылке в момент нажатия на кнопку
    state.page += 1;
    loadGoods({ reset: false }); // загрузка следующей страницы без очистки каталога
  });

  // Обработка кнопки корзины
  els.catalog.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-add-to-cart]'); // Поиск элемента корзины
    if (!btn) return; // выход из функции на случай клика не по корзине

    // Получение ID из кнопки
    const id = Number(btn.getAttribute('data-add-to-cart'));
    if (!Number.isFinite(id)) return; // прерывание обработки, если что-то произошло с кнопкой

    // Добавление товара в корзину
    addToCart(id);
    // Уведомление
    notify("success", 'Товар добавлен в корзину');
  });

  // Запуск
  syncFiltersFromUI();
  loadGoods({ reset: true });
});
