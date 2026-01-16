// Ключ, под которым корзина хранится
const CART_KEY = "shop_cart_ids";

// объект корзины
export const CartStorage = {
  getIds() { // возвращение ID товаров из корзины
    const raw = localStorage.getItem(CART_KEY); // считывание сырых данных из localStorage
    if (!raw) return []; // вывод пустой корзины на случай отсутствия данных

    try {
      const arr = JSON.parse(raw); // парсинг JSON

      if (Array.isArray(arr)) { // проверка на массив
        return arr;
      }
      return []; // вывод пустого массива на случай корректного JSON вне массива (это не массив)
    } catch {
      return []; // ну или если JSON невалиден или поврежден, то выводится пустой массив
    }
  },

  setIds(ids) { // перезапись корзины массивом ID
    localStorage.setItem(CART_KEY, JSON.stringify(ids));
  },

  add(id) { // добавление товаров в корзину по ID, не допуская дубликатов товара
    const ids = this.getIds(); // получение текущих ID из корзины
    const sid = String(id); // Приведение к строке для хранения
    if (!ids.includes(sid)) { // добавление товара в корзину, если его нет там
      ids.push(sid);
      this.setIds(ids); // сохранение изменений
    }
  },

  remove(id) { // удаленеие товара из корзины
    const sid = String(id); // приведение ID к строке для удобного сравнения
    const ids = this.getIds().filter((x) => String(x) !== sid); // фильтрация массива, исключая указанные товары
    this.setIds(ids); // сохранение обновленного массива
  },

  clear() { // очистка корзины
    localStorage.removeItem(CART_KEY); // удаление ключа из localStorage
  },
};
