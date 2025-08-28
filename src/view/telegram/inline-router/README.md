# inline‑router — публичное API

## 🔎 Обзор

Роутер упрощает работу с inline‑кнопками и сценариями ввода текста в Telegram на базе **Telegraf**:

- типизированные **роуты** (`action` + опциональный `onText`),
- стековая навигация и «Назад»,
- стратегия рендера (`edit`/`replace`/`append`/`smart`),
- «Отмена» при вводе текста + команды `/cancel` и т.п.,
- обработка ошибок через `RouterUserError`,
- асинхронные **StateStore**/**TokenStore**, DSL‑хелперы, версионированные `callback_data`,
- `answerCbQuery` на уровне кнопок, `setMyCommands` при запуске,
- ограничение числа сообщений с авто‑удалением лишних.

---

## 🧱 Базовые сущности

### `Route<A, P>` — роут

```ts
export type Route<A = unknown, P = unknown> = {
  id: string;
  action: (
    args: RouteActionArgs<A, P>
  ) => Promise<RouteView<A> | void> | RouteView<A> | void;
  onText?: (
    args: RouteActionArgs<A, P> & { text: string }
  ) => Promise<RouteView<A> | void> | RouteView<A> | void;
};
```

**Поведение:**

- `action` рендерит экран. Если роут имеет `onText`, после `action` роутер **переходит в режим ожидания текста**.
- Если `action` **ничего не вернул**, а `onText` есть — показывается глобальный `inputPrompt`.
- При поступлении текста вызывается `onText`. Если он вернёт `RouteView` — он будет отрисован и ожидание ввода **сбросится** (если вы сами не навигировали).

### `RouteView<A>` — экран

```ts
export type RouteView<A = unknown> = {
  text: string;
  buttons?: Array<Button<A> | Button<A>[]>; // строки
  disablePreview?: boolean;
  renderMode?: RenderMode; // 'smart' | 'edit' | 'replace' | 'append'
  showBack?: boolean; // локальный override
  showCancel?: boolean; // локальный override
};
```

### `Button<A>` — кнопка

```ts
export type Button<A = unknown> = {
  text: string;
  callback: string; // рекомендуем cb(...) или cbTok(...)
  action?: (args: {
    ctx: Context;
    actions: A;
    navigate: NavigateFn<A>;
    navigateBack: () => Promise<void>;
  }) => Promise<void> | void;
  answer?: {
    text?: string;
    alert?: boolean;
    url?: string;
    cacheTimeSec?: number;
  }; // answerCbQuery
};
```

- Если `action` задан — он вызывается при нажатии.
- `answer` позволяет настроить `ctx.answerCbQuery(...)` (снять спиннер, показать тост/alert, ссылку, кэш).

### `RouteNode<A>` — узел дерева

```ts
export type RouteNode<A = unknown> = {
  route: Route<A, unknown>;
  hasBack?: boolean; // добавляет «Назад» этому узлу и «простым» детям
  children?: Array<RouteNode<A> | Route<A, unknown>>;
};
```

**Наследование `hasBack`:**

- Если ребёнок передан **как `Route`** (без обёртки `RouteNode`) — он **унаследует** `hasBack` родителя.
- Если ребёнок — **`RouteNode`** с собственным `hasBack` — у него **собственная настройка** (по умолчанию `false`).

### `NavigateFn`

```ts
export type NavigateFn<A = unknown> = <NP = unknown>(
  route: Route<A, NP>,
  params?: NP
) => Promise<void>;
```

### `RouteActionArgs<A, P>`

```ts
export type RouteActionArgs<A, P> = {
  ctx: Context;
  actions: A;
  params: P;
  state: RouterState;
  navigate: NavigateFn<A>;
  navigateBack: () => Promise<void>;
};
```

---

## 🧭 Навигация и стек

- Роутер хранит стек `state.stack` (id роутов). `navigate()` пушит id; `navigateBack()` делает pop и рендерит предыдущий.
- Кнопка «Назад» появляется:
  - если включён `hasBack` на узле или унаследован,
  - либо принудительно через `view.showBack = true`.

---

## ⌨️ Ввод текста (`onText`)

- Наличие `onText` у роута включает **ожидание текста** после `action`.
- При ожидании можно:
  - показать «Отмена» (глобально `showCancelOnWait: true` или локально `view.showCancel = true`),
  - отменить текст кнопкой «Отмена» или текстом из `cancelCommands`.

- По «Отмене» выполняется возврат на предыдущий экран.

**Шаблон:**

```ts
const EnterValue = route<Actions, { id: string }>({
  id: 'enter_value',
  async action({ params }) {
    return { text: `Введите значение для ${params.id}`, showCancel: true };
  },
  async onText({ text, actions, params }) {
    await actions.save(params.id, text);
    return { text: '✅ Сохранено', showBack: true };
  },
});
```

---

## 🖼️ Рендер: `RenderMode`

`'edit' | 'replace' | 'append' | 'smart'` (по умолчанию — `'smart'`).

- **smart**: пытается `editMessageText` текущего сообщения; если содержимое и клавиатура **не изменились** — no‑op; при ошибке — поведение `onEditFail`.
- **edit**: всегда `editMessageText` (с фолбэком по `onEditFail`).
- **replace**: удалить целевое сообщение (если можно) и отправить новое.
- **append**: всегда отправить новое сообщение.

`StartOptions.onEditFail: 'reply' | 'replace' | 'ignore'` — стратегия на случай ошибки `edit`.

---

## 🧰 Хелперы callback‑данных

```ts
cb(routeId: string, args?: Array<string|number>, cbVersion = 'v1'): string
parseCb(data: string): { routeId: string; cbVersion?: string; args: string[]; isToken: boolean; token?: string }
cbTok(routeId: string, tokenStore: TokenStore, payload: unknown, ttlMs = 600_000, cbVersion = 'v1'): Promise<string>
```

- `cb` — компактный `callback_data` вида `route!vX:arg1:arg2`.
- `cbTok` — хранит payload в `TokenStore`, а в `callback_data` кладёт токен: `route!vX:t:<token>`.
- `parseCb` — парсит обе формы.

---

## 🧩 DSL для клавиатур

```ts
DSL.row(...btns: Button[]) => Button[]
DSL.rows(...lines: Array<Button | Button[]>) => Array<Button | Button[]>
DSL.pager(page: number, pages: number, prev: Button, next: Button) => Button[]
```

---

## 🗃️ Хранилища

### `StateStore` (async)

```ts
interface StateStore {
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}
```

- По умолчанию — **in‑memory** реализация (на процесс). Для продакшена используйте Redis/БД.
- Роутер сам поддерживает `state.messages` — список отрисованных сообщений для корректного `edit/delete`.

### `TokenStore`

```ts
interface TokenStore {
  save(data: unknown, ttlMs?: number): Promise<string> | string;
  load(token: string): Promise<unknown | undefined> | unknown | undefined;
  delete?(token: string): Promise<void> | void;
}
```

- По умолчанию — **in‑memory** с TTL на стороне процесса.
- Используется `cbTok(...)` для длинных payload.

---

## 🚦 Ошибки

### `RouterUserError`

```ts
class RouterUserError extends Error {
  view?: Partial<RouteView<unknown>>;
  constructor(message: string, view?: Partial<RouteView<unknown>>);
}
```

- Бросайте в экшенах/`onText` для **контролируемых ошибок** (валидация, права и т.п.).
- Роутер отрисует `view` ошибки или текст с префиксом `errorPrefix` (по умолчанию `⚠️`).
- Необработанные ошибки показываются как «Неизвестная ошибка» и логируются через `StartOptions.onError`, если задан.

---

## ⚙️ Создание и запуск

### `createRouter`

```ts
function createRouter<A>(
  tree: Array<RouteNode<A> | Route<A, unknown>>,
  options?: StartOptions
): { run: (bot: Telegraf<Context>, actions: A) => RunningRouter<A> };
```

- Собирает дерево роутов; проверяет уникальность `id`.
- Наследование `hasBack` действует как описано выше.

### `RunningRouter`

```ts
interface RunningRouter<A> {
  onText(fn: (ctx: Context) => Promise<void> | void): void; // общий текстовый fallback
  navigate(
    ctx: Context,
    route: Route<A, unknown>,
    params?: unknown
  ): Promise<void>;
  navigateBack(ctx: Context): Promise<void>;
}
```

### `run(bot, actions)`

- Регистрирует обработчики `callback_query` и `text`.
- Применяет `setMyCommands`, если указаны `options.commands`/`commandsExtra`.
- Возвращает `RunningRouter` для навигации и глобального `onText` (когда **не** ждём ввод).

---

## 🛠️ Опции `StartOptions` (ключевые)

```ts
{
  inputPrompt?: string;            // дефолтный промпт при onText без собственного View
  backLabel?: string;              // текст «Назад»
  backCallbackData?: string;
  cancelLabel?: string;            // текст «Отмена»
  cancelCallbackData?: string;
  cancelCommands?: string[];       // слова/команды для текстовой отмены
  showCancelOnWait?: boolean;      // auto «Отмена» при ожидании ввода

  renderMode?: RenderMode;         // глобальный режим ('smart' по умолчанию)
  onEditFail?: 'reply' | 'replace' | 'ignore';
  errorRenderMode?: RenderMode;    // как рендерить ошибки (по умолчанию 'append')
  errorPrefix?: string;

  cbVersion?: string;              // версия формата callback_data
  maxMessages?: number;            // лимит хранимых сообщений

  stateStore?: StateStore;         // внешнее async‑хранилище состояния
  tokenStore?: TokenStore;         // хранилище токенов для cbTok

  onError?: (err, ctx, state) => void; // логирование/метрики

  commands?: BotCommand[];         // setMyCommands
  commandsExtra?: { scope?: BotCommandScope; language_code?: string };
}
```

**Замечания по сообщениям:**

- При переполнении `maxMessages` роутер удаляет самые старые **из чата** (если права/условия позволяют) и из `state`.
- Telegram может ограничивать удаление/редактирование (права, тип чата, возраст сообщения). Точного универсального лимита **нет** — учитывайте окружение и права бота.

---

## 💬 answerCbQuery на кнопке

В `Button.answer` можно указать параметры, которые передаются в `ctx.answerCbQuery(...)`. Если не указано — роутер вызовет `answerCbQuery()` без текста, чтобы убрать «спиннер».

Пример:

```ts
button({
  text: 'Обновить',
  callback: cb('refresh'),
  answer: { text: 'Обновляю…', cacheTimeSec: 2 },
  action: async ({ navigate }) => {
    /* ... */
  },
});
```

---

## 🧠 Примеры

### Меню → ввод → сохранение

```ts
const EditLimit = route<Actions, { chatId: number }>({
  id: 'edit_limit',
  async action({ actions, params }) {
    const { historyLimit } = await actions.loadConfigFor(params.chatId);
    return {
      text: `Введите новый лимит (сейчас: ${historyLimit})`,
      showCancel: true,
    };
  },
  async onText({ text, actions, params }) {
    const n = Number(text);
    if (!Number.isFinite(n) || !/^\d+$/.test(text))
      throw new RouterUserError('Введите целое число.');
    actions.validateLimit(n);
    await actions.updateLimit(params.chatId, n);
    return { text: `✅ Лимит обновлён: ${n}`, showBack: true };
  },
});
```

### Версионированный callback и большой payload

```ts
const cbStr = cb('user_open', [42]); // "user_open!v1:42"
const cbWithTok = await cbTok('user_open', tokenStore, {
  id: 42,
  mode: 'full',
});
```

### DSL: пейджер

```ts
const pager = DSL.pager(
  page,
  pages,
  button({ text: '◀️', callback: cb('list_prev', [page - 1]) }),
  button({ text: '▶️', callback: cb('list_next', [page + 1]) })
);
```

---

## 🔒 Конкурентность

Встроенный **простой мьютекс** сериализует обработку апдейтов **на ключ `(chatId:userId)`**. Для распределённого окружения используйте внешнюю блокировку.

---

## 🔁 Миграция с прежних версий

- **Было:** `waitForText` + `prompt`.
- **Стало:** только `action` + опциональный `onText`.
  - Вынесите содержимое `prompt` в `action` (экран‑подсказку).
  - Логику обработки текста перенесите в `onText`.
  - Если `action` ничего не возвращает, а `onText` есть — сработает `inputPrompt`.

---

## ❓ FAQ / троблшутинг

- **Кнопка не срабатывает / спиннер крутится:** проверьте, что `callback_data` укладывается в 64 байта (или используйте `cbTok`). Также можно задать `Button.answer`.
- **Сообщение не редактируется:** используйте `renderMode: 'replace'` и/или `onEditFail: 'replace'`.
- **«Назад» не показывается у ребёнка:** если ребёнок — `RouteNode`, его `hasBack` по умолчанию `false`; для наследования передайте ребёнка как чистый `Route`.
- **Ожидание текста не сбрасывается:** верните `RouteView` из `onText` **или** выполните `navigate()`/`navigateBack()`; роутер сам сбросит флаг ожидания.

---

## 📦 Публичные фабрики

```ts
route<A, P>(cfg: Route<A, P>): Route<A, P>
button<A>(cfg: Button<A>): Button<A>
createRouter<A>(tree, options?): { run(bot, actions): RunningRouter<A> }
```

---

## 🧾 Лицензия и версионирование

- Текущая версия API: **v13** (см. заголовок файла).
- Версия формата `callback_data`: по умолчанию **'v1'** (см. `StartOptions.cbVersion`).
