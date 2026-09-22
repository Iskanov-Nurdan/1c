/* =============================================================================
   ОБМЕН С EXCEL (ТЗ п. 3.5, 8)

   Выгрузка отчётов и журналов в настоящий .xlsx и загрузка данных из файлов
   Excel. В отличие от CSV, числа остаются числами, даты — датами, а книга
   может содержать несколько листов: бухгалтер сразу считает формулами,
   не переразбирая текст.

   Библиотека SheetJS (437 КБ) грузится лениво — только когда пользователь
   нажал «Excel». Старт приложения она не задерживает.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const LIB_PATH = 'vendor/sheetjs/xlsx.core.min.js';

  let loading = null;

  /** Подгружает SheetJS один раз и отдаёт промис с библиотекой. */
  function lib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (loading) return loading;

    loading = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = App.Config.staticUrl + LIB_PATH;
      script.async = true;
      script.onload = function () {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error('Библиотека Excel загрузилась, но не инициализировалась'));
      };
      script.onerror = function () {
        loading = null;
        reject(new Error('Не удалось загрузить библиотеку Excel'));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  /* =========================================================================
     ПОДГОТОВКА ЗНАЧЕНИЙ
     ====================================================================== */
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  /** Значение ячейки: колонка может задать своё через xlsx(), csv() или ключ. */
  function cellValue(column, row) {
    if (column.xlsx) return column.xlsx(row);
    if (column.csv) return column.csv(row);
    return row[column.k];
  }

  /** Приводит значение к типу, который Excel поймёт правильно. */
  function normalize(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return isFinite(value) ? value : '';
    if (typeof value === 'boolean') return value ? 'да' : 'нет';
    if (value instanceof Date) return value;

    const text = String(value);
    if (ISO_DATE.test(text)) {
      const d = new Date(text + 'T00:00:00');
      return isNaN(d.getTime()) ? text : d;
    }
    return text;
  }

  /** Ширина колонки по самому длинному значению, но в разумных пределах. */
  function widths(header, matrix) {
    return header.map(function (title, i) {
      let max = String(title == null ? '' : title).length;
      for (let r = 0; r < matrix.length; r++) {
        const v = matrix[r][i];
        const len = v instanceof Date ? 10 : String(v == null ? '' : v).length;
        if (len > max) max = len;
      }
      return { wch: Math.min(Math.max(max + 2, 9), 46) };
    });
  }

  /**
   * Лист из колонок и строк интерфейса.
   * columns — как в UI.table: { k, t, num, csv?, xlsx? }
   */
  function sheet(XLSX, columns, rows, options) {
    const opts = options || {};
    const cols = columns.filter(function (c) { return c.k || c.xlsx || c.csv; });
    const header = cols.map(function (c) { return c.t || c.k; });

    const matrix = rows.map(function (row) {
      return cols.map(function (c) { return normalize(cellValue(c, row)); });
    });

    const aoa = [];
    if (opts.title) aoa.push([opts.title]);
    if (opts.subtitle) aoa.push([opts.subtitle]);
    if (aoa.length) aoa.push([]);
    const headerRow = aoa.length;
    aoa.push(header);
    matrix.forEach(function (r) { aoa.push(r); });
    if (opts.totals) aoa.push(opts.totals.map(normalize));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths(header, matrix);

    // Числовые и денежные форматы + выравнивание дат
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r: r, c: c });
        const cell = ws[ref];
        if (!cell) continue;
        if (cell.t === 'n') cell.z = (cols[c] && cols[c].money !== false) ? '#,##0.00' : '0';
        if (cell.t === 'd') cell.z = 'dd.mm.yyyy';
      }
    }

    // Шапка таблицы закреплена: длинный регистр листается без потери колонок
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
    return ws;
  }

  /** Имя листа: Excel запрещает : \ / ? * [ ] и больше 31 знака. */
  function sheetName(name, index) {
    const clean = String(name || ('Лист' + (index + 1))).replace(/[:\\/?*[\]]/g, ' ').trim();
    return clean.slice(0, 31) || ('Лист' + (index + 1));
  }

  /* =========================================================================
     ВЫГРУЗКА
     ====================================================================== */
  /**
   * Книга из одного или нескольких листов.
   * sheets — [{ name, columns, rows, title?, subtitle?, totals? }]
   */
  function save(filename, sheets) {
    const list = Array.isArray(sheets) ? sheets : [sheets];
    const empty = list.every(function (s) { return !s.rows || !s.rows.length; });
    if (empty) {
      App.UI.toast({ kind: 'warn', title: 'Нечего выгружать' });
      return Promise.resolve(false);
    }

    return lib().then(function (XLSX) {
      const wb = XLSX.utils.book_new();
      list.forEach(function (s, i) {
        XLSX.utils.book_append_sheet(wb, sheet(XLSX, s.columns, s.rows || [], s), sheetName(s.name, i));
      });
      XLSX.writeFile(wb, filename.replace(/\.(csv|xlsx)$/i, '') + '.xlsx', { compression: true });

      const total = list.reduce(function (n, s) { return n + (s.rows || []).length; }, 0);
      App.UI.toast({
        kind: 'ok', title: 'Выгружено в Excel',
        text: total + ' строк' + (list.length > 1 ? ' · листов: ' + list.length : '')
      });
      return true;
    }).catch(function (err) {
      App.UI.toast({ kind: 'danger', title: 'Не удалось выгрузить', text: err.message });
      return false;
    });
  }

  /* =========================================================================
     ЗАГРУЗКА
     ====================================================================== */
  /**
   * Читает файл Excel или CSV и отдаёт строки объектами по первой строке-шапке.
   * Возвращает { columns, rows, sheetNames }.
   */
  function read(file, options) {
    const opts = options || {};
    return lib().then(function (XLSX) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
        reader.onload = function (e) {
          try {
            const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
            const name = opts.sheet || wb.SheetNames[0];
            const ws = wb.Sheets[name];
            if (!ws) throw new Error('Лист «' + name + '» в файле не найден');

            const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
            const head = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 })[0] || [];
            resolve({
              rows: rows,
              columns: head.map(function (t) { return String(t == null ? '' : t).trim(); }),
              sheetNames: wb.SheetNames
            });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    });
  }

  /** Открывает системный выбор файла и читает выбранный. */
  function pick(options) {
    return new Promise(function (resolve, reject) {
      const input = U.el('input', {
        type: 'file',
        accept: '.xlsx,.xls,.xlsb,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        style: { display: 'none' }
      });
      input.onchange = function () {
        const file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) return reject(new Error('Файл не выбран'));
        read(file, options).then(function (data) {
          data.fileName = file.name;
          resolve(data);
        }, reject);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  App.Xlsx = { save: save, read: read, pick: pick, load: lib };
})(window.App);
